/** @jest-environment node */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser, type Route } from 'playwright'
import { physicalMeasurer } from '@/workers/book-renderer/measurement'
import { canonicalJson, sha256 } from '@/workers/book-renderer/filesystem'
import { PrintAssetCache } from '@/workers/book-renderer/printAssets'

jest.mock('playwright', () => ({ chromium: { launch: jest.fn(), executablePath: jest.fn(() => '/fixture/chromium') } }))

jest.mock('@/workers/book-renderer/printAssets', () => ({ ...jest.requireActual('@/workers/book-renderer/printAssets'), PrintAssetCache: { create: jest.fn(async () => ({ identity: {}, policyHash: 'fixture' })) } }))

describe('physical measurement resource readiness with a mocked browser port', () => {
  it.each(['single', 'overflow', 'multiple', 'oversized'] as const)('returns exact bounded PDF bytes only for a successful single page (%s)', async kind => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    const scratch = await mkdtemp(path.join(root, 'book-measured-pdf-'))
    const fonts = path.join(scratch, 'fonts'); await mkdir(fonts); await writeFile(path.join(fonts, 'fonts.css'), '')
    const bytes = kind === 'oversized' ? Buffer.alloc(4 * 1024 * 1024 + 1) : Buffer.from(`%PDF-1.4\n/Count ${kind === 'multiple' ? 2 : 1}\n`)
    const page = { setDefaultTimeout: jest.fn(), emulateMedia: jest.fn(), setContent: jest.fn(),
      evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValue(kind === 'overflow'),
      pdf: jest.fn().mockResolvedValue(bytes), goto: jest.fn(), requestGC: jest.fn() }
    const browser = { close: jest.fn(), newContext: async () => ({ route: jest.fn(), newPage: async () => page }) }
    jest.mocked(chromium.launch).mockResolvedValueOnce(browser as unknown as Browser)
    let measurer: Awaited<ReturnType<typeof physicalMeasurer>> | undefined
    try {
      measurer = await physicalMeasurer(scratch, scratch, fonts)
      if (kind === 'oversized') await expect(measurer.measurePdf('<html><head></head><body></body></html>')).rejects.toThrow('WORKER_SEGMENT_PDF_BUDGET_EXCEEDED')
      else {
        const result = await measurer.measurePdf('<html><head></head><body></body></html>')
        if (kind === 'single') { expect(result).toEqual({ pages: 1, fits: true, pdf: bytes }); expect(result.pdf).toBe(bytes) }
        else expect(result).toEqual({ pages: kind === 'multiple' ? 2 : 0, fits: false })
      }
      expect(page.pdf).toHaveBeenCalledTimes(kind === 'overflow' ? 0 : 1)
      expect(page.goto).toHaveBeenCalledWith('about:blank')
      expect(page.requestGC).toHaveBeenCalledTimes(1)
    } finally { await measurer?.close(); await rm(scratch, { recursive: true, force: true }) }
  })
  it.each([false, true])('requires each original response even when two bindings share served bytes (complete=%s)', async complete => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    const scratch = await mkdtemp(path.join(root, 'book-served-lineage-'))
    const fonts = path.join(scratch, 'fonts'); await mkdir(fonts); await writeFile(path.join(fonts, 'fonts.css'), '')
    const bytes = Buffer.from('mock-codec-bytes'), servedChecksum = sha256(bytes)
    const originals = ['a'.repeat(64), 'b'.repeat(64)]
    const bindings = originals.map(original_checksum => ({ original_checksum, served_checksum: servedChecksum, mime: 'image/jpeg' }))
    jest.mocked(PrintAssetCache.create).mockResolvedValueOnce({ identity: {}, policyHash: 'fixture',
      load: async () => bytes, prepareHtml: async (html: string) => ({ html, resource_bindings: bindings }) } as never)
    let handleRoute!: (route: Route) => Promise<void>
    const page = { setDefaultTimeout: jest.fn(), emulateMedia: jest.fn(),
      setContent: async () => { for (const original of originals.slice(0, complete ? 2 : 1)) await handleRoute({
        request: () => ({ url: () => `https://book-snapshot.invalid/print-assets/${original}/${servedChecksum}` }),
        fulfill: jest.fn(), abort: jest.fn(),
      } as unknown as Route) },
      evaluate: jest.fn().mockResolvedValue(false), pdf: jest.fn().mockResolvedValue(Buffer.from('/Count 1')),
      goto: jest.fn(), requestGC: jest.fn() }
    const browser = { close: jest.fn(), newContext: async () => ({ route: async (_pattern: string, handler: typeof handleRoute) => { handleRoute = handler }, newPage: async () => page }) }
    jest.mocked(chromium.launch).mockResolvedValueOnce(browser as unknown as Browser)
    let measurer: Awaited<ReturnType<typeof physicalMeasurer>> | undefined
    try {
      measurer = await physicalMeasurer(scratch, scratch, fonts)
      const prepared = await measurer.prepareHtml('<html><head></head><body></body></html>')
      await measurer.measure(prepared.html)
      if (complete) expect(() => measurer!.assertResourceServing()).not.toThrow()
      else expect(() => measurer!.assertResourceServing()).toThrow('PRINT_RESOURCE_SERVING_INCOMPLETE')
      expect(measurer.servedResources()).toEqual(originals.slice(0, complete ? 2 : 1).map(original_checksum => ({ original_checksum, served_checksum: servedChecksum })))
    } finally { await measurer?.close(); await rm(scratch, { recursive: true, force: true }) }
  })
  it('rejects an SVG cover analysis source before setContent can decode nested unbudgeted pixels', async () => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    const scratch = await mkdtemp(path.join(root, 'book-analysis-predecode-'))
    const fonts = path.join(scratch, 'fonts'), assets = path.join(scratch, 'assets')
    await mkdir(fonts); await mkdir(assets)
    await writeFile(path.join(fonts, 'fonts.css'), '')
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><image href="data:image/png;base64,unbounded"/></svg>'), checksum = sha256(svg)
    await writeFile(path.join(scratch, checksum), svg)
    await writeFile(path.join(assets, `${checksum}.json`), canonicalJson({ checksum, file_ref: checksum, size_bytes: svg.length }))
    const page = { setDefaultTimeout: jest.fn(), emulateMedia: jest.fn(), setContent: jest.fn() }
    const browser = { close: jest.fn(), newContext: async () => ({ route: jest.fn(), newPage: async () => page }) }
    jest.mocked(chromium.launch).mockResolvedValueOnce(browser as unknown as Browser)
    let measurer: Awaited<ReturnType<typeof physicalMeasurer>> | undefined
    try {
      measurer = await physicalMeasurer(scratch, scratch, fonts)
      await expect(measurer.brightness(`https://book-snapshot.invalid/assets/${checksum}`)).rejects.toThrow('PRINT_IMAGE_FORMAT_UNSUPPORTED')
      expect(page.setContent).not.toHaveBeenCalled()
    } finally { await measurer?.close(); await rm(scratch, { recursive: true, force: true }) }
  })
  it.each(['corrupted', 'oversized'])('rejects a %s font request that fails during readiness after setContent completed', async kind => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    const scratch = await mkdtemp(path.join(root, 'book-font-readiness-'))
    const fonts = path.join(scratch, 'fonts')
    await mkdir(fonts)
    const filename = `${'a'.repeat(64)}.woff2`
    await writeFile(path.join(fonts, 'fonts.css'), '@font-face { font-family: Fixture; }')
    await writeFile(path.join(fonts, filename), kind === 'corrupted' ? 'corrupted frozen font bytes' : Buffer.alloc(2 * 1024 * 1024 + 1))
    let handleRoute!: (route: Route) => Promise<void>
    const abort = jest.fn().mockResolvedValue(undefined)
    const route = { request: () => ({ url: () => `https://book-snapshot.invalid/fonts/${filename}` }), abort } as unknown as Route
    const page = {
      setDefaultTimeout: jest.fn(), emulateMedia: jest.fn(), setContent: jest.fn(),
      evaluate: jest.fn().mockResolvedValue(false).mockImplementationOnce(async () => { await handleRoute(route) }),
      pdf: jest.fn().mockResolvedValue(Buffer.from('/Count 1')), goto: jest.fn(), requestGC: jest.fn(),
    }
    const close = jest.fn().mockResolvedValue(undefined)
    const browser = { close, newContext: async () => ({
      route: async (_pattern: string, handler: typeof handleRoute) => { handleRoute = handler },
      newPage: async () => page,
    }) }
    jest.mocked(chromium.launch).mockResolvedValueOnce(browser as unknown as Browser)
    let measurer: Awaited<ReturnType<typeof physicalMeasurer>> | undefined
    try {
      measurer = await physicalMeasurer(scratch, scratch, fonts)
      await expect(measurer.measure('<html><head></head><body></body></html>'))
        .rejects.toThrow('WORKER_FONT_INTEGRITY_FAILED')
      expect(abort).toHaveBeenCalledTimes(1)
      expect(page.pdf).not.toHaveBeenCalled()
    } finally {
      await measurer?.close()
      await rm(scratch, { recursive: true, force: true })
    }
    expect(close).toHaveBeenCalledTimes(1)
  })
})
