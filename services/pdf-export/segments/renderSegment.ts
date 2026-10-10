import { assertNoPrintOrientationBinding, assertPrintOrientedBinding, assertPrintResourceBinding, assertPrintVariantBinding, type PrintResourceBinding } from './printAssetsTypes'
import type { BookDocument } from '@/types/bookDocument'
import { CanonicalPageRenderer } from './CanonicalPageRenderer'
import { BOOK_SEGMENT_SOURCE_SCHEMA_VERSION, BOOK_SEGMENT_LIMITS, type BookPageContext, type BookSegmentPage } from './types'

export interface BookSegmentSource {
  source_schema_version?: 1 | 2 | 3 | 4 | typeof BOOK_SEGMENT_SOURCE_SCHEMA_VERSION
  resource_bindings?: PrintResourceBinding[]
  resource_bindings_hash?: string
  resource_policy_hash?: string
  encoder_identity_hash?: string
  page: BookSegmentPage
  blocks: string[]
  occurrences: string[]
}
export interface SegmentRenderPorts {
  load: (ref: string) => Promise<BookSegmentSource>
  verifyResources?: () => void
  prepare?: (html: string, source: BookSegmentSource) => Promise<string>
  measure: (html: string) => Promise<{ pages: number; fits: boolean }>
  persist: (html: string) => Promise<{ html_ref: string; checksum: string }>
}
export interface SegmentRenderRequest {
  segment_ref: string
  page_context: BookPageContext
  snapshot_hash: string
}
export interface SegmentRenderResult {
  html_ref: string
  checksum: string
  measured_pages: number
  expected: { blocks: number; mediaOccurrences: number }
  completed: { blocks: number; mediaOccurrences: number }
}

const LEGACY_SOURCE_TYPES = new Set(['cover', 'photo', 'legacy-content', 'content', 'gallery', 'gallery-caption', 'map', 'toc', 'atlas', 'separator', 'checklists', 'final'])

export function assertBookSegmentSourceSchema(source: BookSegmentSource): void {
  if (!source || !source.page || typeof source.page !== 'object') throw new Error('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
  const version = source.source_schema_version === undefined ? 1 : source.source_schema_version
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== BOOK_SEGMENT_SOURCE_SCHEMA_VERSION) throw new Error('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
  if (version >= 3 && (!Array.isArray(source.resource_bindings) || source.resource_bindings.length > 64 ||
    ![source.resource_bindings_hash, source.resource_policy_hash, source.encoder_identity_hash].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)))) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  if (version >= 3) source.resource_bindings!.forEach(value => {
    if (version === 5) assertPrintOrientedBinding(value)
    else if (version === 4) assertPrintVariantBinding(value)
    else { assertPrintResourceBinding(value); assertNoPrintOrientationBinding(value); if (value.variant_hash !== undefined || value.effect !== undefined || value.filter_working_pixels !== undefined) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID') }
  })
  if (version < 3 && [source.resource_bindings, source.resource_bindings_hash, source.resource_policy_hash, source.encoder_identity_hash].some(value => value !== undefined)) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  if (!LEGACY_SOURCE_TYPES.has(source.page.type) && source.page.type !== 'map-text') throw new Error('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
  if (version >= 2 && source.page.type === 'map' && (!Number.isSafeInteger(source.page.point_start) || source.page.point_start! < 0 || typeof source.page.show_coordinates !== 'boolean')) throw new Error('SEGMENT_MAP_POSITION_INVALID')
  if (source.page.type === 'map-text' && (typeof source.page.html !== 'string' || typeof source.page.point_id !== 'string' || !source.page.point_id || !Number.isSafeInteger(source.page.point_ordinal) || source.page.point_ordinal < 1 || !['address', 'category', 'coord'].includes(source.page.field))) throw new Error('SEGMENT_MAP_POSITION_INVALID')
  if (version === 1 && (source.page.type === 'map-text' || (source.page.type === 'map' &&
    (source.page.point_start !== undefined || source.page.text_policy !== undefined || source.page.show_coordinates !== undefined)))) throw new Error('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
}

/** One bounded source/page. No book, manifest, asset index, or HTML array is retained here. */
export async function renderSegment(
  request: SegmentRenderRequest,
  pinned: BookDocument,
  ports: SegmentRenderPorts,
): Promise<SegmentRenderResult> {
  if (request.snapshot_hash !== pinned.snapshot_hash) throw new Error('SEGMENT_SNAPSHOT_HASH_MISMATCH')
  const source = await ports.load(request.segment_ref)
  assertBookSegmentSourceSchema(source)
  if (source.blocks.length > 256 || source.occurrences.length > 64) throw new Error('SEGMENT_COVERAGE_BUDGET_EXCEEDED')
  const renderer = new CanonicalPageRenderer(pinned.settings.template)
  let html = await renderer.renderBoundedPage(source.page, request.page_context, pinned, source.source_schema_version === 4 || source.source_schema_version === 5)
  if ((source.source_schema_version ?? 1) >= 3) {
    if (!ports.prepare || !ports.verifyResources) throw new Error('SEGMENT_RESOURCE_PORT_REQUIRED')
    html = await ports.prepare(html, source)
  }
  if (new TextEncoder().encode(html).byteLength > BOOK_SEGMENT_LIMITS.html_bytes) throw new Error('SEGMENT_HTML_BUDGET_EXCEEDED')
  const measured = await ports.measure(html)
  if (!measured.fits || measured.pages !== 1) throw new Error('SEGMENT_REQUIRES_SUBDIVISION')
  if ((source.source_schema_version ?? 1) >= 3) ports.verifyResources!()
  const expected = { blocks: source.blocks.length, mediaOccurrences: source.occurrences.length }
  return { ...await ports.persist(html), measured_pages: measured.pages, expected, completed: { ...expected } }
}
