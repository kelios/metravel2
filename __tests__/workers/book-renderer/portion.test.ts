/** @jest-environment node */
import { mkdir, mkdtemp, open, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { renderPreparedPage, type PreparedPageRequest } from '@/workers/book-renderer/portion'
import { physicalMeasurer, type PhysicalMeasurer } from '@/workers/book-renderer/measurement'
import { canonicalJson, sha256 } from '@/workers/book-renderer/filesystem'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'

const mockHtml = '<html><head></head><body><section class="pdf-page">Frozen source</section></body></html>'
jest.mock('@/services/pdf-export/segments/CanonicalPageRenderer', () => ({ CanonicalPageRenderer: class {
  async renderBoundedPage() { return mockHtml }
} }))
jest.mock('@/workers/book-renderer/measurement', () => ({ ...jest.requireActual('@/workers/book-renderer/measurement'), physicalMeasurer: jest.fn() }))
jest.mock('@/workers/book-renderer/locale', () => ({ withWorkerLocale: (_locale: string, run: () => unknown) => run() }))
jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises')
  return { ...actual, open: jest.fn(actual.open) }
})

describe('prepared page exact measured PDF publication with a mocked physical port', () => {
  let scratch: string
  beforeEach(async () => {
    jest.mocked(physicalMeasurer).mockReset()
    jest.mocked(open).mockImplementation(jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises').open)
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true }); scratch = await mkdtemp(path.join(root, 'book-portion-pdf-'))
  })
  afterEach(async () => { await rm(scratch, { recursive: true, force: true }) })

  async function fixture(version: 1 | 5 = 5) {
    const input = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 23, title: 'Frozen chapter' }] })
    const plan = path.join(scratch, 'plan'), fonts = path.join(scratch, 'fonts'), output = path.join(scratch, 'output')
    await mkdir(plan); await mkdir(fonts); await writeFile(path.join(fonts, 'fonts.css'), '.pdf-page{color:black}')
    const keys = { resource_bindings_hash: 'a'.repeat(64), resource_policy_hash: 'b'.repeat(64), encoder_identity_hash: 'c'.repeat(64) }
    const source: BookSegmentSource = { source_schema_version: version, page: { type: 'checklists' }, blocks: ['23:block'], occurrences: [],
      ...(version === 5 ? { ...keys, resource_bindings: [] } : {}) }
    const bytes = canonicalJson(source)
    await writeFile(path.join(plan, 'source.json'), bytes)
    const request: PreparedPageRequest = { snapshot_hash: input.document.snapshot_hash, segment_ref: 'source.json', source_checksum: sha256(bytes),
      expected: { blocks: source.blocks, occurrences: source.occurrences }, page_context: { start_page: 17, folio_area_mm: 12 }, ...(version === 5 ? keys : {}) }
    const pdf = Buffer.from('%PDF-1.4\n/Count 1\nexact measured bytes\n')
    const physical = { prepareHtml: jest.fn(async (html: string) => ({ html })), measurePdf: jest.fn(async () => ({ pages: 1, fits: true, pdf })),
      measure: jest.fn(), assertResourceServing: jest.fn(), servedResources: jest.fn(() => []), encoder_identity: {}, close: jest.fn() } as unknown as PhysicalMeasurer
    jest.mocked(physicalMeasurer).mockResolvedValueOnce(physical)
    return { input, plan, fonts, output, request, physical, pdf }
  }

  it('persists only the exact successful measured bytes and ties them to the immutable receipt', async () => {
    const f = await fixture()
    const receipt = await renderPreparedPage(f.input.jobDir, f.plan, f.output, f.input.document, f.request, { fonts_dir: f.fonts })
    expect(await readFile(path.join(f.output, 'page.pdf'))).toEqual(f.pdf)
    expect(receipt.pdf).toEqual({ pdf_ref: 'page.pdf', checksum: sha256(f.pdf), size_bytes: f.pdf.length, pages: 1 })
    expect(receipt).toMatchObject({ measured: true, source_checksum: f.request.source_checksum, snapshot_hash: f.input.document.snapshot_hash,
      settings_hash: f.input.document.settings_hash, resource_bindings_hash: f.request.resource_bindings_hash, expected: receipt.completed })
    expect(JSON.parse(await readFile(path.join(f.output, 'receipt.json'), 'utf8'))).toEqual(receipt)
    expect((await stat(path.join(f.output, 'page.pdf'))).mode & 0o777).toBe(0o600)
    expect(f.physical.measurePdf).toHaveBeenCalledTimes(1)
    expect(f.physical.measure).not.toHaveBeenCalled()
    expect(f.physical.close).toHaveBeenCalledTimes(1)
    await expect(renderPreparedPage(f.input.jobDir, f.plan, f.output, f.input.document, f.request, { fonts_dir: f.fonts })).rejects.toThrow()
    expect(await readFile(path.join(f.output, 'page.pdf'))).toEqual(f.pdf)
  })

  it.each(['geometry', 'serving', 'missing-pdf', 'oversized-pdf', 'pdf-conflict', 'html-conflict', 'receipt-conflict', 'partial-write', 'close'] as const)('leaves no owned PDF or receipt after %s fails', async failure => {
    const f = await fixture()
    if (failure === 'geometry') jest.mocked(f.physical.measurePdf).mockResolvedValueOnce({ pages: 2, fits: false })
    if (failure === 'missing-pdf') jest.mocked(f.physical.measurePdf).mockResolvedValueOnce({ pages: 1, fits: true })
    if (failure === 'oversized-pdf') jest.mocked(f.physical.measurePdf).mockResolvedValueOnce({ pages: 1, fits: true, pdf: Buffer.alloc(4 * 1024 * 1024 + 1) })
    if (failure === 'serving') jest.mocked(f.physical.assertResourceServing).mockImplementationOnce(() => { throw new Error('PRINT_RESOURCE_SERVING_INCOMPLETE') })
    if (failure === 'close') jest.mocked(f.physical.close).mockRejectedValueOnce(new Error('BROWSER_CLOSE_FAILED'))
    const conflicting = failure === 'pdf-conflict' ? 'page.pdf' : failure === 'html-conflict' ? 'page.html' : failure === 'receipt-conflict' ? 'receipt.json' : undefined
    if (conflicting) jest.mocked(f.physical.measurePdf).mockImplementationOnce(async () => {
      await writeFile(path.join(f.output, conflicting), 'foreign bytes')
      return { pages: 1, fits: true, pdf: f.pdf }
    })
    if (failure === 'partial-write') {
      const actualOpen = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises').open
      jest.mocked(open).mockImplementation(async (...args: Parameters<typeof open>) => {
        const handle = await actualOpen(...args)
        if (args[0] === path.join(f.output, 'page.pdf')) {
          const write = handle.writeFile.bind(handle)
          handle.writeFile = async () => { await write('partial'); throw new Error('PDF_WRITE_FAILED') }
        }
        return handle
      })
    }
    await expect(renderPreparedPage(f.input.jobDir, f.plan, f.output, f.input.document, f.request, { fonts_dir: f.fonts })).rejects.toThrow()
    expect(await readdir(f.output)).toEqual(conflicting ? [conflicting] : [])
    if (conflicting) expect(await readFile(path.join(f.output, conflicting), 'utf8')).toBe('foreign bytes')
    expect(f.physical.close).toHaveBeenCalledTimes(1)
  })

  it('rejects forged source coverage before opening a browser or publishing output', async () => {
    const f = await fixture()
    jest.mocked(physicalMeasurer).mockClear()
    await expect(renderPreparedPage(f.input.jobDir, f.plan, f.output, f.input.document,
      { ...f.request, expected: { blocks: ['forged'], occurrences: [] } })).rejects.toThrow('SEGMENT_PLAN_INTEGRITY_FAILED')
    expect(physicalMeasurer).not.toHaveBeenCalled()
  })

  it('keeps injected protocol measurement unmeasured and without a PDF', async () => {
    const f = await fixture(1)
    const receipt = await renderPreparedPage(f.input.jobDir, f.plan, f.output, f.input.document, f.request, { measure: async () => ({ pages: 1, fits: true }) })
    expect(receipt.measured).toBe(false)
    expect(receipt.pdf).toBeUndefined()
    expect(await readdir(f.output)).toEqual(['page.html', 'receipt.json'])
  })
})
