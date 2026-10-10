/** @jest-environment node */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { CanonicalPageRenderer } from '@/services/pdf-export/segments/CanonicalPageRenderer'
import { assertBookSegmentSourceSchema, type BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { workerImageFilterStyle, imageEffectFromWorkerStyle, assertNoAuthoredImageEffectMarkers } from '@/services/pdf-export/segments/workerImageEffects'
import { transformPrintResourceUrls } from '@/workers/book-renderer/printAssets'
import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer'
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'

const original = 'a'.repeat(64)
const url = `https://book-snapshot.invalid/assets/${original}`

it('preserves the winning theme effect instead of reactivating an overridden decorative blur', () => {
  const style = `filter: blur(28px) brightness(.55) saturate(.4); ${workerImageFilterStyle('sepia(100%)', 'sepia')}`
  expect(style).toContain('filter: none;')
  expect(imageEffectFromWorkerStyle(style)).toEqual({ theme_id: 'sepia', filter: 'sepia(1)' })
  const variants: string[] = []
  const html = `<p>${url}</p><img src="${url}"><img src="${url}" style="${style}">`
  const rewritten = transformPrintResourceUrls(html, (hash, effect) => { variants.push(effect!.filter); return `${hash}/${effect!.filter}` }, true)
  expect(variants).toEqual(['none', 'sepia(1)'])
  expect(rewritten).toContain(`<p>${url}</p>`)
  expect(rewritten).toContain(style)
})

it.each([
  '--metravel-print-effect: sepia(1);',
  'filter:none; --metravel-print-effect: sepia(1); --metravel-print-theme:black-white;',
  'filter:none; --metravel-print-effect: sepia(1); --metravel-print-theme:sepia; filter:blur(2px);',
  'filter:none!important; --metravel-print-effect: sepia(1); --metravel-print-theme:sepia;',
])('rejects ambiguous/unauthorized worker effect styles: %s', style => {
  expect(() => transformPrintResourceUrls(`<img src="${url}" style="${style}">`, hash => hash, true)).toThrow()
})

it('leaves authored color styles and ordinary text outside the private effect context', () => {
  const seen: string[] = []
  const html = `<p>--metravel-print-effect: sepia(1)</p><img src="${url}" style="filter:sepia(.5)">`
  expect(transformPrintResourceUrls(html, (hash, effect) => { seen.push(effect!.filter); return hash }, true)).toContain('style="filter:sepia(.5)"')
  expect(seen).toEqual(['none'])
  expect(() => workerImageFilterStyle('blur(20px)', 'sepia')).toThrow('PRINT_IMAGE_EFFECT_UNSUPPORTED')
  expect(workerImageFilterStyle('sepia(100%)')).toBe('filter: sepia(100%);')
})

it('rejects entity-encoded/private data markers while preserving literal editorial text', () => {
  expect(() => assertNoAuthoredImageEffectMarkers('<img style="&#45;&#45;metravel-print-effect:sepia(1)">')).toThrow('PRINT_IMAGE_EFFECT_AUTHORED_MARKER')
  expect(() => assertNoAuthoredImageEffectMarkers('<img data-book-print-effect="sepia(1)">')).toThrow('PRINT_IMAGE_EFFECT_AUTHORED_MARKER')
  expect(() => assertNoAuthoredImageEffectMarkers('<p>--metravel-print-effect: sepia(1)</p>')).not.toThrow()
  expect(() => transformPrintResourceUrls(`<img style="${workerImageFilterStyle('sepia(100%)', 'sepia')}" src="https://example.com/photo.jpg">`, hash => hash, true)).toThrow('PRINT_IMAGE_EFFECT_RESOURCE_INVALID')
})

it('retains the actual compound decorative effect and marks only its color-only foreground', () => {
  const theme = getThemeConfig('sepia')
  const block = { type: 'image' as const, src: url }
  const legacy = new BlockRenderer(theme).renderBlocks([block], 'description')
  const worker = new BlockRenderer(theme, 'sepia').renderBlocks([block], 'description')
  expect(legacy).toContain('filter: blur(18px) saturate(1.06) sepia(100%);')
  expect(worker).toContain('filter: blur(18px) saturate(1.06) sepia(100%);')
  const effects: string[] = []
  transformPrintResourceUrls(worker, (hash, effect) => { effects.push(effect!.filter); return hash }, true)
  expect(effects).toEqual(['none', 'sepia(1)'])
})

it('keeps schema3 separate and requires effect bindings for schema4', () => {
  const source: BookSegmentSource = { source_schema_version: 3, page: { type: 'checklists' }, blocks: [], occurrences: [],
    resource_bindings: [], resource_bindings_hash: 'a'.repeat(64), resource_policy_hash: 'b'.repeat(64), encoder_identity_hash: 'c'.repeat(64) }
  expect(() => assertBookSegmentSourceSchema(source)).not.toThrow()
  expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 4, resource_bindings: [{} as never] })).toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
  expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 5, resource_bindings: [{} as never] })).toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
  expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 5 })).not.toThrow()
  expect(() => assertBookSegmentSourceSchema({ ...source, source_schema_version: 6 as never })).toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
})

it('marks canonical foreground only in worker4 and restores byte-identical default markup on reuse', async () => {
  const root = path.resolve(__dirname, '../../../.codex-temp/tests')
  await mkdir(root, { recursive: true })
  const scratch = await mkdtemp(path.join(root, 'image-effects-'))
  try {
    const fixture = await buildSnapshotFixture(scratch, { travels: [{ id: 41, title: 'Complete image', photos: 2 }], settings: { template: 'sepia' } })
    const renderer = new CanonicalPageRenderer('sepia')
    const page = { type: 'photo' as const, travel: { id: 41, name: 'Complete image', travel_image_url: url } }
    const context = { start_page: 1, folio_area_mm: 12 as const }
    const legacy = await renderer.renderBoundedPage(page, context, fixture.document)
    expect(legacy).toContain('filter: sepia(100%);')
    expect(legacy).not.toContain('--metravel-print-')
    const worker = await renderer.renderBoundedPage(page, context, fixture.document, true)
    expect(worker).toContain('--metravel-print-effect: sepia(1); --metravel-print-theme: sepia;')
    expect(worker).not.toContain('filter: sepia(100%);')
    expect(await renderer.renderBoundedPage(page, context, fixture.document)).toBe(legacy)
    await expect(renderer.renderBoundedPage({ type: 'content', field: 'description', first: true, last: true, qr: '', travel: page.travel,
      html: `<img src="${url}" style="${workerImageFilterStyle('sepia(100%)', 'sepia')}">` }, context, fixture.document, true)).rejects.toThrow('PRINT_IMAGE_EFFECT_AUTHORED_MARKER')
  } finally { await rm(scratch, { recursive: true, force: true }) }
})
