import type { BookMediaChunk } from '@/types/bookDocument'
import type { TravelForBook } from '@/types/pdf-export'
import type { TravelSectionMeta } from '@/services/pdf-export/generators/v2/runtime/types'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { assertBookSegmentSourceSchema } from '@/services/pdf-export/segments/renderSegment'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import { validateSnapshotChunk } from '@/services/pdf-export/segments/snapshotAdapter'
import { canonicalJson, sha256 } from './filesystem'
import { readBookRecord } from './planningContent'
import { readIndexedSource } from './planningSource'
import type { PlanningStorage } from './planningStorage'
import { enqueueBookPage } from './planningBody'
import { bookQuotes } from './planner'
import { assetUrl } from './snapshot'
import type { BookPlanningContext, BookPlanningState, PlannedChapter, PlannedPageRecord, PlannedAtlasRecord } from './planningBookTypes'
import { bookCounter } from './planningBookTypes'

interface TocAccumulator { entries: TravelSectionMeta[]; occurrences: string[] }
async function metadata(storage: PlanningStorage, id: number): Promise<TravelForBook> {
  const value = await storage.readIndex<TravelForBook>(`metadata/${id}.json`)
  if (!value || value.id !== id || typeof value.name !== 'string' || canonicalJson(value).length > 32_768) throw new Error('WORKER_BOOK_METADATA_INVALID')
  return value
}
async function indexedCover(context: BookPlanningContext, storage: PlanningStorage, id: number): Promise<BookMediaChunk | undefined> {
  const value = await storage.readIndex<unknown>(`index/travel/${id}/media/cover/0.json`)
  if (value === undefined) return undefined
  const chunk = await readIndexedSource(storage, context.pinned, `index/travel/${id}/media/cover/0.json`, context.summary.sources, id, 'media')
  if (chunk.kind !== 'media' || chunk.metadata.role !== 'cover') throw new Error('WORKER_BOOK_COVER_INVALID')
  return chunk
}
async function bookMedia(context: BookPlanningContext, storage: PlanningStorage, ref: string, role: 'cover' | 'book-cover'): Promise<BookMediaChunk | undefined> {
  const value = await storage.readIndex<unknown>(ref)
  if (value === undefined) return undefined
  const chunk = validateSnapshotChunk(value, context.pinned)
  if (chunk.kind !== 'media' || chunk.position >= context.summary.sources || chunk.metadata.role !== role) throw new Error('WORKER_BOOK_COVER_INVALID')
  return chunk
}

/** Seven bounded chapter entries per TOC candidate; physical splits determine the offset. */
export async function advanceTocPlanning(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState): Promise<void> {
  if (state.queue || state.phase !== 'toc' || !state.body_seal) throw new Error('WORKER_BOOK_TOC_PHASE_INVALID')
  const accumulator: TocAccumulator = state.toc.accumulator ? await readBookRecord(storage, state.toc.accumulator) : { entries: [], occurrences: [] }
  if (accumulator.entries.length > BOOK_SEGMENT_LIMITS.toc_entries || accumulator.occurrences.length > BOOK_SEGMENT_LIMITS.toc_entries) throw new Error('WORKER_BOOK_TOC_BUDGET_EXCEEDED')
  if (!context.pinned.settings.includeToc || state.toc.chapter === state.chapters || accumulator.entries.length === BOOK_SEGMENT_LIMITS.toc_entries) {
    if (context.pinned.settings.includeToc && accumulator.entries.length) {
      await enqueueBookPage(storage, state, { page: { type: 'toc', entries: accumulator.entries, total: context.summary.travels, start: state.toc.start },
        blocks: accumulator.entries.map(entry => `${entry.travel.id}:toc`), occurrences: accumulator.occurrences }, 0, 'toc')
      state.toc.start = bookCounter(state.toc.start, accumulator.entries.length); delete state.toc.accumulator
      return
    }
    state.toc_seal = await storage.put('book/toc-complete.json', { version: 1, pages: state.counts.toc_pages, chapters: state.chapters, entries: state.toc.start })
    state.phase = 'frontmatter'; return
  }
  const chapter = await storage.readIndex<PlannedChapter>(`book/chapters/${state.toc.chapter}.json`)
  if (!chapter || !Number.isSafeInteger(chapter.travel_id) || chapter.travel_id < 1 || !Number.isSafeInteger(chapter.start) || chapter.start < 0 ||
      !Number.isSafeInteger(chapter.pages) || chapter.pages < 1 || chapter.start + chapter.pages > state.counts.pages ||
      (chapter.map_start !== undefined && (!Number.isSafeInteger(chapter.map_start) || chapter.map_start < chapter.start || chapter.map_start >= chapter.start + chapter.pages))) throw new Error('WORKER_BOOK_CHAPTER_INVALID')
  const travel = await metadata(storage, chapter.travel_id)
  accumulator.entries.push({ travel, startPage: chapter.start + 1, hasGallery: context.pinned.settings.includeGallery,
    hasMap: chapter.map_start !== undefined, locations: [], mapPage: chapter.map_start === undefined ? undefined : chapter.map_start + 1 })
  const cover = await indexedCover(context, storage, chapter.travel_id)
  if (cover) accumulator.occurrences.push(`${cover.occurrence_key}:toc`)
  state.toc.chapter = bookCounter(state.toc.chapter)
  state.toc.accumulator = await storage.put(`book/toc-accumulators/${sha256(canonicalJson(accumulator))}.json`, accumulator, BOOK_SEGMENT_LIMITS.source_bytes)
}

async function coverSource(context: BookPlanningContext, storage: PlanningStorage): Promise<BookSegmentSource> {
  if (!context.summary.first_travel) throw new Error('WORKER_BOOK_EMPTY')
  const first = await metadata(storage, context.summary.first_travel)
  const settings = context.pinned.settings
  const quote = bookQuotes(context.pinned.seed).cover
  let cover = settings.coverType === 'gradient' ? undefined : first.travel_image_url
  let occurrences: string[] = []
  const firstCover = await indexedCover(context, storage, context.summary.first_travel)
  if (cover && firstCover) occurrences = [`${firstCover.occurrence_key}:book-cover`]
  if (settings.coverType === 'auto' && !settings.coverImage) {
    const selected = await bookMedia(context, storage, 'index/first-cover.json', 'cover')
    if (selected) { cover = assetUrl(selected); occurrences = [`${selected.occurrence_key}:book-cover`] }
  }
  if (settings.coverImage && !['gradient', 'first-photo'].includes(settings.coverType)) {
    const selected = await bookMedia(context, storage, 'index/book-cover.json', 'book-cover')
    if (!selected) throw new Error('WORKER_BOOK_COVER_INVALID')
    cover = assetUrl(selected); occurrences = [selected.occurrence_key]
  }
  return { page: { type: 'cover', data: { title: settings.title, subtitle: settings.subtitle, userName: first.userName || '',
    travelCount: context.summary.travels, yearRange: context.summary.min_year ? `${context.summary.min_year}${context.summary.min_year !== context.summary.max_year ? ` - ${context.summary.max_year}` : ''}` : undefined,
    coverImage: cover, quote: quote.author ? { text: quote.text, author: quote.author } : undefined,
    textPosition: 'auto', showDecorations: true } }, blocks: ['book:cover'], occurrences }
}

/** Frontmatter has a sealed page count: changing it would invalidate all chapter offsets. */
async function publishFrontmatter(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState, source: BookSegmentSource): Promise<void> {
  const ordinal = state.counts.frontmatter_pages
  context.ports.admit(2, BOOK_SEGMENT_LIMITS.source_bytes + 4096)
  const measured = await context.ports.probe({ source_schema_version: 2, page: source.page, blocks: source.blocks, occurrences: source.occurrences }, { start_page: ordinal + 1, folio_area_mm: 12 })
  if (measured.measurement.pages !== 1 || !measured.measurement.fits) throw new Error('WORKER_BOOK_FRONTMATTER_LAYOUT_UNSTABLE')
  assertBookSegmentSourceSchema(measured.source)
  if (measured.source.source_schema_version !== 5) throw new Error('WORKER_PAGE_QUEUE_UNFROZEN_SOURCE')
  const file = await storage.put(`book/frontmatter-sources/${ordinal}.json`, measured.source, BOOK_SEGMENT_LIMITS.source_bytes)
  await storage.put(`book/frontmatter/${ordinal}.json`, { source: file, travel_id: 0, ordinal } satisfies PlannedPageRecord)
  state.counts.frontmatter_pages = bookCounter(state.counts.frontmatter_pages)
  state.counts.blocks = bookCounter(state.counts.blocks, source.blocks.length); state.counts.occurrences = bookCounter(state.counts.occurrences, source.occurrences.length)
}

/** Cover, physically sealed TOC pages, then a map/index pair per accepted body map. */
export async function advanceFrontmatterPlanning(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState): Promise<number> {
  if (state.queue || state.phase !== 'frontmatter' || !state.body_seal || !state.toc_seal) throw new Error('WORKER_BOOK_FRONTMATTER_PHASE_INVALID')
  const cursor = state.frontmatter
  const offset = bookCounter(bookCounter(state.counts.toc_pages, state.counts.atlas_pages))
  if (cursor.stage === 'cover') {
    await publishFrontmatter(context, storage, state, await coverSource(context, storage)); cursor.stage = 'toc'; return 1
  }
  if (cursor.stage === 'toc') {
    if (cursor.toc === state.counts.toc_pages) { cursor.stage = 'atlas'; return 0 }
    const record = await storage.readIndex<PlannedPageRecord>(`book/toc/${cursor.toc}.json`)
    if (!record || record.ordinal !== cursor.toc) throw new Error('WORKER_TOC_PLAN_INVALID')
    const source = await readBookRecord<BookSegmentSource>(storage, record.source, BOOK_SEGMENT_LIMITS.source_bytes)
    if (source.page.type !== 'toc') throw new Error('WORKER_TOC_PLAN_INVALID')
    for (const entry of source.page.entries) { entry.startPage = bookCounter(entry.startPage, offset); if (entry.mapPage !== undefined) entry.mapPage = bookCounter(entry.mapPage, offset) }
    await publishFrontmatter(context, storage, state, source); cursor.toc = bookCounter(cursor.toc); return 1
  }
  if (cursor.stage === 'atlas') {
    if (!state.counts.atlas_pages || cursor.atlas === state.atlas_records) { cursor.stage = 'done'; return 0 }
    const record = await storage.readIndex<PlannedAtlasRecord>(`book/atlas/${cursor.atlas}.json`)
    if (!record || !Number.isSafeInteger(record.map_start) || record.map_start < 0 || record.map_start >= state.counts.pages) throw new Error('WORKER_ATLAS_PLAN_INVALID')
    const map = await readBookRecord<BookSegmentSource>(storage, record.source, BOOK_SEGMENT_LIMITS.source_bytes)
    if (map.page.type !== 'map' || !map.page.locations.length || map.page.locations.length > BOOK_SEGMENT_LIMITS.map_points) throw new Error('WORKER_ATLAS_PLAN_INVALID')
    const travel = await metadata(storage, record.travel_id)
    const startPage = bookCounter(bookCounter(offset, record.map_start))
    const entries: TravelSectionMeta[] = [{ travel, locations: map.page.locations, startPage,
      mapPage: startPage, hasMap: true, hasGallery: context.pinned.settings.includeGallery }]
    await publishFrontmatter(context, storage, state, { page: { type: 'atlas', entries, part: cursor.part, total_pages: state.counts.atlas_pages,
      total_points: context.summary.points, total_travels: context.summary.mapped_travels, index: cursor.index },
      blocks: map.page.locations.map(location => `${record.travel_id}:atlas:${cursor.part}:${location.id}`), occurrences: [] })
    cursor.index = bookCounter(cursor.index)
    if (cursor.part === 'map') cursor.part = 'index'
    else { cursor.part = 'map'; cursor.atlas = bookCounter(cursor.atlas) }
    return 1
  }
  if (state.counts.frontmatter_pages !== offset || cursor.index !== state.counts.atlas_pages) throw new Error('WORKER_BOOK_FRONTMATTER_COUNT_MISMATCH')
  state.frontmatter_seal = await storage.put('book/frontmatter-complete.json', { version: 1, pages: state.counts.frontmatter_pages,
    body_offset: offset, toc_pages: state.counts.toc_pages, atlas_pages: state.counts.atlas_pages,
    total_pages: bookCounter(offset, state.counts.pages), blocks: state.counts.blocks, occurrences: state.counts.occurrences })
  state.phase = 'done'
  return 0
}
