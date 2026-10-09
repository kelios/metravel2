import type { BookDocument } from '@/types/bookDocument'
import { CanonicalPageRenderer } from './CanonicalPageRenderer'
import { BOOK_SEGMENT_LIMITS, type BookPageContext, type BookSegmentPage } from './types'

export interface BookSegmentSource {
  page: BookSegmentPage
  blocks: string[]
  occurrences: string[]
}
export interface SegmentRenderPorts {
  load: (ref: string) => Promise<BookSegmentSource>
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

/** One bounded source/page. No book, manifest, asset index, or HTML array is retained here. */
export async function renderSegment(
  request: SegmentRenderRequest,
  pinned: BookDocument,
  ports: SegmentRenderPorts,
): Promise<SegmentRenderResult> {
  if (request.snapshot_hash !== pinned.snapshot_hash) throw new Error('SEGMENT_SNAPSHOT_HASH_MISMATCH')
  const source = await ports.load(request.segment_ref)
  if (source.blocks.length > 256 || source.occurrences.length > 64) throw new Error('SEGMENT_COVERAGE_BUDGET_EXCEEDED')
  const renderer = new CanonicalPageRenderer(pinned.settings.template)
  const html = await renderer.renderBoundedPage(source.page, request.page_context, pinned)
  if (new TextEncoder().encode(html).byteLength > BOOK_SEGMENT_LIMITS.html_bytes) throw new Error('SEGMENT_HTML_BUDGET_EXCEEDED')
  const measured = await ports.measure(html)
  if (!measured.fits || measured.pages !== 1) throw new Error('SEGMENT_REQUIRES_SUBDIVISION')
  const expected = { blocks: source.blocks.length, mediaOccurrences: source.occurrences.length }
  return { ...await ports.persist(html), measured_pages: measured.pages, expected, completed: { ...expected } }
}
