import QRCode from 'qrcode'
import type { BookDocument, BookMediaChunk } from '@/types/bookDocument'
import type { TravelForBook } from '@/types/pdf-export'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import type { NormalizedLocation } from '@/services/pdf-export/generators/v2/runtime/types'
import { parseCoordinates } from '@/services/pdf-export/generators/v2/runtime/bookData'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import { canonicalJson, sha256 } from './filesystem'
import { advanceTravelMetadata, startTravelMetadata, type TravelMetadataCursor } from './planningTravel'
import { readIndexedSource, initialFieldSource } from './planningSource'
import { advanceSmallContent, advanceContentPlanning, initialContentPlanning, readBookRecord } from './planningContent'
import { initialPageQueue, advancePageQueue } from './planningPageQueue'
import { type PlanningStorage } from './planningStorage'
import { validateRendererResourceProfile } from './measurement'
import { assetUrl, appendMetadataLabel, type IndexedBookSummary } from './snapshot'
import { bookQuotes } from './planner'
import type { IndexCounts, PlanningLimits, PlanningFile } from './planningTypes'
import { BOOK_FIELDS, restoreBookPlanning, type BookPlanningState, type BookPlanningContext, type BookLane,
  type PlannedPageRecord, type PlannedAtlasRecord, type PlannedChapter, bookImageDimensions, bookCounter } from './planningBookTypes'
import { advanceTocPlanning, advanceFrontmatterPlanning } from './planningFrontmatter'

interface GalleryAccumulator {
  photos: NonNullable<TravelForBook['gallery']>; keys: string[]; blocks: string[]; pixels: number
}
interface RouteAccumulator { locations: NormalizedLocation[]; keys: string[]; blocks: string[] }
interface PendingRoute { location: NormalizedLocation; id: number; image?: string }

async function immutableValue(storage: PlanningStorage, scope: string, value: unknown, maximum = 524_288): Promise<PlanningFile> {
  return storage.put(`${scope}/${sha256(canonicalJson(value))}.json`, value, maximum)
}
export async function enqueueBookPage(storage: PlanningStorage, state: BookPlanningState, source: BookSegmentSource, travelId: number, lane: BookLane): Promise<void> {
  if (state.queue) throw new Error('WORKER_BOOK_QUEUE_BUSY')
  const ordinal = state.candidate_sequence
  state.candidate_sequence = bookCounter(ordinal)
  const file = await storage.put(`book/candidates/${ordinal}.json`, { page: source.page, blocks: source.blocks, occurrences: source.occurrences, source_schema_version: 2 }, BOOK_SEGMENT_LIMITS.source_bytes)
  state.queue = { lane, travel_id: travelId, state: initialPageQueue(file, `book/q${ordinal}`) }
}

async function drainBookPage(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState): Promise<{ probes: number }> {
  const queue = state.queue!
  const counter = queue.lane === 'body' ? 'pages' : queue.lane === 'toc' ? 'toc_pages' : 'frontmatter_pages'
  const ordinal = state.counts[counter]
  const result = await advancePageQueue(queue.state, { ...context.ports,
    admit: (records, bytes) => context.ports.admit(records + 2, bytes + 8192),
  }, { start_page: queue.lane === 'toc' ? 1 : bookCounter(ordinal), folio_area_mm: 12 })
  queue.state = result.state
  if (result.accepted) {
    const accepted = result.accepted
    await storage.put(`book/${queue.lane}/${ordinal}.json`, { source: accepted.source, travel_id: queue.travel_id, ordinal } satisfies PlannedPageRecord)
    state.counts[counter] = bookCounter(state.counts[counter])
    if (queue.lane !== 'toc') { state.counts.blocks = bookCounter(state.counts.blocks, accepted.source_value.blocks.length); state.counts.occurrences = bookCounter(state.counts.occurrences, accepted.source_value.occurrences.length) }
    if (queue.lane === 'body' && accepted.source_value.page.type === 'map') {
      if (state.travel && state.travel.id === queue.travel_id) state.travel.map_start ??= ordinal
      await storage.put(`book/atlas/${state.atlas_records}.json`, { source: accepted.source, travel_id: queue.travel_id, map_start: ordinal } satisfies PlannedAtlasRecord)
      state.atlas_records = bookCounter(state.atlas_records)
    }
  }
  if (result.done) delete state.queue
  return { probes: result.probes }
}

async function gallerySource(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState, travel: TravelForBook): Promise<boolean> {
  const cursor = state.travel!
  const accumulator = cursor.gallery_accumulator ? await readBookRecord<GalleryAccumulator>(storage, cursor.gallery_accumulator) : undefined
  if (!accumulator?.photos.length) return false
  await enqueueBookPage(storage, state, { page: { type: 'gallery', travel: { ...travel, gallery: accumulator.photos },
    start_index: cursor.gallery_count - accumulator.photos.length, total_photos: travel.sourceCounts?.photos,
    caption_policy: context.pinned.settings.showCaptions && context.pinned.settings.captionPosition !== 'none' ? 'inline' : 'detached',
    aspects: Object.fromEntries(accumulator.photos.map(photo => [photo.url, photo.aspect || 1])) }, blocks: accumulator.blocks, occurrences: accumulator.keys }, cursor.id, 'body')
  delete cursor.gallery_accumulator
  return true
}

async function advanceGallery(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState, travel: TravelForBook, counts: IndexCounts): Promise<void> {
  const cursor = state.travel!
  const configured = context.pinned.settings.galleryPhotosPerPage
  const capacity = context.pinned.settings.galleryLayout === 'slideshow' ? 1 : configured === 0 ? 6 : Math.min(14, Math.max(1, configured))
  const accumulator: GalleryAccumulator = cursor.gallery_accumulator ? await readBookRecord(storage, cursor.gallery_accumulator) : { photos: [], keys: [], blocks: [], pixels: 0 }
  if (accumulator.photos.length >= capacity || cursor.gallery_row === (counts.kinds.gallery ?? 0)) {
    if (await gallerySource(context, storage, state, travel)) return
    if (cursor.gallery_media !== (counts.roles.gallery ?? 0)) throw new Error('SNAPSHOT_GALLERY_MEDIA_COVERAGE_MISMATCH')
    cursor.stage = 'map'; return
  }
  const row = await readIndexedSource(storage, context.pinned, `index/travel/${cursor.id}/gallery/${cursor.gallery_row}.json`, context.summary.sources, cursor.id, 'gallery')
  if (row.kind !== 'gallery') throw new Error('WORKER_PLANNING_PREFIX_MISMATCH')
  if (!row.metadata.image) { cursor.gallery_row = bookCounter(cursor.gallery_row); return }
  const media = await readIndexedSource(storage, context.pinned, `index/travel/${cursor.id}/media/gallery/${cursor.gallery_media}.json`, context.summary.sources, cursor.id, 'media')
  if (media.kind !== 'media' || media.metadata.role !== 'gallery' || media.metadata.resource_key !== row.metadata.image) throw new Error('SNAPSHOT_GALLERY_MEDIA_ORDER_MISMATCH')
  const dimensions = await bookImageDimensions(context, storage, media as BookMediaChunk)
  if (accumulator.photos.length && accumulator.pixels + dimensions.width * dimensions.height > context.ports.resource_profile.decoded_portion_pixels) {
    await gallerySource(context, storage, state, travel); return
  }
  accumulator.pixels = bookCounter(accumulator.pixels, dimensions.width * dimensions.height)
  accumulator.photos.push({ id: row.metadata.id, url: assetUrl(media), caption: row.metadata.caption || undefined, aspect: dimensions.aspect })
  accumulator.keys.push(media.occurrence_key); accumulator.blocks.push(`${cursor.id}:gallery:${row.metadata.id}`)
  cursor.gallery_count = bookCounter(cursor.gallery_count); cursor.gallery_media = bookCounter(cursor.gallery_media); cursor.gallery_row = bookCounter(cursor.gallery_row)
  cursor.gallery_accumulator = await immutableValue(storage, `book/gallery/${cursor.id}`, accumulator)
}

async function mapSource(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState, travel: TravelForBook): Promise<boolean> {
  const cursor = state.travel!
  const accumulator = cursor.route_accumulator ? await readBookRecord<RouteAccumulator>(storage, cursor.route_accumulator) : undefined
  if (!accumulator?.locations.length) return false
  await enqueueBookPage(storage, state, { page: { type: 'map', travel, locations: accumulator.locations,
    point_start: cursor.route - accumulator.locations.length, show_coordinates: context.pinned.settings.showCoordinatesOnMapPage },
    blocks: accumulator.blocks, occurrences: accumulator.keys }, cursor.id, 'body')
  delete cursor.route_accumulator
  return true
}

async function advanceMap(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState, travel: TravelForBook, counts: IndexCounts): Promise<void> {
  const cursor = state.travel!
  const accumulator: RouteAccumulator = cursor.route_accumulator ? await readBookRecord(storage, cursor.route_accumulator) : { locations: [], keys: [], blocks: [] }
  if (cursor.route_pending) {
    const pending = await readBookRecord<PendingRoute>(storage, cursor.route_pending.file)
    if (cursor.route_pending.category < cursor.route_pending.categories) {
      const category = await readIndexedSource(storage, context.pinned, `index/travel/${cursor.id}/route-categories/${pending.id}/${cursor.route_pending.category}.json`, context.summary.sources, cursor.id, 'route-category')
      if (category.kind !== 'route-category' || category.metadata.route_id !== pending.id) throw new Error('WORKER_ROUTE_CATEGORY_INVALID')
      pending.location.categoryName = appendMetadataLabel(pending.location.categoryName, category.metadata.name)
      cursor.route_pending.category = bookCounter(cursor.route_pending.category)
      cursor.route_pending.file = await immutableValue(storage, `book/route/${cursor.id}/${cursor.route}`, pending)
      return
    }
    if (pending.image) {
      const image = await readIndexedSource(storage, context.pinned, `index/travel/${cursor.id}/media/route-image/${cursor.route_media}.json`, context.summary.sources, cursor.id, 'media')
      if (image.kind !== 'media' || image.metadata.role !== 'route-image' || image.metadata.resource_key !== pending.image) throw new Error('SNAPSHOT_ROUTE_MEDIA_ORDER_MISMATCH')
      await bookImageDimensions(context, storage, image as BookMediaChunk)
      pending.location.thumbnailUrl = assetUrl(image); accumulator.keys.push(image.occurrence_key); cursor.route_media = bookCounter(cursor.route_media)
    }
    accumulator.locations.push(pending.location); accumulator.blocks.push(`${cursor.id}:route:${pending.id}`)
    cursor.route = bookCounter(cursor.route); delete cursor.route_pending
    cursor.route_accumulator = await immutableValue(storage, `book/maps/${cursor.id}`, accumulator)
    return
  }
  if (accumulator.locations.length === 6 || cursor.route === (counts.kinds.route ?? 0)) {
    if (await mapSource(context, storage, state, travel)) return
    if (cursor.route_media !== (counts.roles['route-image'] ?? 0)) throw new Error('SNAPSHOT_ROUTE_MEDIA_COVERAGE_MISMATCH')
    cursor.stage = 'chapter'; return
  }
  const row = await readIndexedSource(storage, context.pinned, `index/travel/${cursor.id}/route/${cursor.route}.json`, context.summary.sources, cursor.id, 'route')
  if (row.kind !== 'route') throw new Error('WORKER_PLANNING_PREFIX_MISMATCH')
  const route = row.metadata
  const location: NormalizedLocation = { id: String(route.id), address: route.address, coord: route.coord || `${route.lat},${route.lng}` }
  const coordinates = parseCoordinates(location.coord)
  if (coordinates) { location.lat = coordinates.lat; location.lng = coordinates.lng }
  const related = await storage.readIndex<{ id: number; categories: number }>(`index/travel/${cursor.id}/route-categories/${route.id}/counts.json`)
  if (!related || related.id !== route.id || !Number.isSafeInteger(related.categories) || related.categories < 0) throw new Error('WORKER_ROUTE_CATEGORY_INVALID')
  cursor.route_pending = { file: await immutableValue(storage, `book/route/${cursor.id}/${cursor.route}`, { location, id: route.id, image: route.image ?? undefined } satisfies PendingRoute), category: 0, categories: related.categories }
}

async function advanceBody(context: BookPlanningContext, storage: PlanningStorage, state: BookPlanningState, inputBudget: number): Promise<{ consumed_bytes: number; probes: number }> {
  const result = { consumed_bytes: 0, probes: 0 }
  if (!state.travel) {
    if (state.travel_ordinal < context.summary.travels) {
      const row = await storage.readIndex<{ id: number; position: number }>(`index/travels/${state.travel_ordinal}.json`)
      if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || row.position >= context.summary.sources) throw new Error('WORKER_TRAVEL_ORDER_INVALID')
      state.travel = { id: row.id, start: state.counts.pages, stage: 'metadata', gallery_row: 0, gallery_media: 0, gallery_count: 0, route: 0, route_media: 0 }
      return result
    }
    if (state.body_tail === 'checklists') {
      state.body_tail = 'final'
      if (context.pinned.settings.includeChecklists && context.pinned.settings.checklistSections.length) await enqueueBookPage(storage, state, { page: { type: 'checklists' }, blocks: ['book:checklists'], occurrences: [] }, 0, 'body')
    } else if (state.body_tail === 'final') {
      state.body_tail = 'done'
      await enqueueBookPage(storage, state, { page: { type: 'final', summary: context.summary, quote: bookQuotes(context.pinned.seed).final }, blocks: ['book:final'], occurrences: [] }, 0, 'body')
    } else {
      state.counts.atlas_pages = context.pinned.settings.includeMap && context.summary.mapped_travels >= 2 ? bookCounter(state.atlas_records, state.atlas_records) : 0
      state.body_seal = await storage.put('book/body-complete.json', { version: 1, pages: state.counts.pages, chapters: state.chapters, atlas_records: state.atlas_records,
        atlas_pages: state.counts.atlas_pages, blocks: state.counts.blocks, occurrences: state.counts.occurrences })
      state.phase = 'toc'
    }
    return result
  }
  const cursor = state.travel
  if (cursor.stage === 'metadata') {
    if (!cursor.metadata_cursor) {
      cursor.metadata_cursor = await immutableValue(storage, `book/metadata-cursors/${cursor.id}`, await startTravelMetadata(storage, context.pinned, context.summary.sources, cursor.id))
    } else {
      const metadata = await advanceTravelMetadata(storage, context.pinned, context.summary.sources, await readBookRecord<TravelMetadataCursor>(storage, cursor.metadata_cursor))
      cursor.metadata_cursor = await immutableValue(storage, `book/metadata-cursors/${cursor.id}`, metadata.cursor)
      if (metadata.file) { cursor.metadata = metadata.file; cursor.stage = 'separator'; delete cursor.metadata_cursor }
    }
    return result
  }
  const travel = await readBookRecord<TravelForBook>(storage, cursor.metadata!, 131_072)
  const counts = await storage.readIndex<IndexCounts>(`index/travel/${cursor.id}/counts.json`)
  if (!counts) throw new Error('WORKER_PLANNING_COUNTS_INVALID')
  if (cursor.stage === 'separator') {
    cursor.stage = 'photo'
    if (context.summary.travels >= 3 && state.travel_ordinal > 0) await enqueueBookPage(storage, state, { page: { type: 'separator', travel, ordinal: state.travel_ordinal + 1, total: context.summary.travels }, blocks: [`${cursor.id}:separator`], occurrences: [] }, cursor.id, 'body')
  } else if (cursor.stage === 'photo') {
    cursor.start = state.counts.pages
    const cover = counts.roles.cover ? await readIndexedSource(storage, context.pinned, `index/travel/${cursor.id}/media/cover/0.json`, context.summary.sources, cursor.id, 'media') : undefined
    await enqueueBookPage(storage, state, { page: { type: 'photo', travel }, blocks: [`${cursor.id}:photo`], occurrences: cover ? [cover.occurrence_key] : [] }, cursor.id, 'body')
    cursor.stage = 'small'; cursor.small = { field: 0, source: initialFieldSource(), characters: 0, sequence: 0 }
  } else if (cursor.stage === 'small') {
    const small = await advanceSmallContent(context, storage, cursor.id, counts, cursor.small!, inputBudget)
    cursor.small = small.state; result.consumed_bytes = small.consumed_bytes
    if (small.excluded) { cursor.stage = 'content'; cursor.content = initialContentPlanning(cursor.id); delete cursor.small }
    else if (small.done) {
      const source: BookSegmentSource = { page: { type: 'legacy-content', travel: { ...travel, ...small.fields }, qr: await QRCode.toDataURL(travel.url || '', { width: 110, margin: 0 }) },
        blocks: [...BOOK_FIELDS.filter(field => small.fields?.[field]).map(field => `${cursor.id}:${field}:small`), `${cursor.id}:online`], occurrences: [] }
      cursor.small_candidate = await immutableValue(storage, `book/small-candidates/${cursor.id}`, source); cursor.stage = 'small-fit'; delete cursor.small
    }
  } else if (cursor.stage === 'small-fit') {
    const source = await readBookRecord<BookSegmentSource>(storage, cursor.small_candidate!)
    const measured = await context.ports.probe(source, { start_page: bookCounter(state.counts.pages), folio_area_mm: 12 })
    result.probes = 1
    if (measured.measurement.pages === 1 && measured.measurement.fits) { await enqueueBookPage(storage, state, source, cursor.id, 'body'); cursor.stage = 'gallery' }
    else { cursor.stage = 'content'; cursor.content = initialContentPlanning(cursor.id) }
    delete cursor.small_candidate
  } else if (cursor.stage === 'content') {
    const content = await advanceContentPlanning(context, storage, cursor.id, travel, counts, cursor.content!, inputBudget, bookCounter(state.counts.pages))
    cursor.content = content.state; result.consumed_bytes = content.consumed_bytes; result.probes = content.probes
    if (content.source) await enqueueBookPage(storage, state, content.source, cursor.id, 'body')
    if (content.done) cursor.stage = 'online'
  } else if (cursor.stage === 'online') {
    if (cursor.content!.inline !== (counts.roles.inline ?? 0)) throw new Error('SNAPSHOT_INLINE_MEDIA_COVERAGE_MISMATCH')
    await enqueueBookPage(storage, state, { page: { type: 'content', travel, field: 'description', html: '', first: !cursor.content!.emitted,
      last: true, qr: await QRCode.toDataURL(travel.url || '', { width: 110, margin: 0 }) }, blocks: [`${cursor.id}:online`], occurrences: [] }, cursor.id, 'body')
    cursor.stage = 'gallery'; delete cursor.content
  } else if (cursor.stage === 'gallery') {
    if (!context.pinned.settings.includeGallery) cursor.stage = 'map'
    else await advanceGallery(context, storage, state, travel, counts)
  } else if (cursor.stage === 'map') {
    if (!context.pinned.settings.includeMap) cursor.stage = 'chapter'
    else await advanceMap(context, storage, state, travel, counts)
  } else if (cursor.stage === 'chapter') {
    await storage.put(`book/chapters/${state.chapters}.json`, { travel_id: cursor.id, start: cursor.start, pages: state.counts.pages - cursor.start, map_start: cursor.map_start } satisfies PlannedChapter)
    state.chapters = bookCounter(state.chapters)
    state.travel_ordinal = bookCounter(state.travel_ordinal); delete state.travel
  }
  return result
}

/** A call performs one durable semantic unit and no more than one physical layout probe. */
export async function advanceBookPlanning(
  jobRoot: string, storage: PlanningStorage, pinned: BookDocument, summary: IndexedBookSummary,
  previous: BookPlanningState, limits: PlanningLimits, ports: BookPlanningContext['ports'],
): Promise<{ state: BookPlanningState; consumed_bytes: number; consumed_asset_bytes: number; probes: number; done: boolean }> {
  const state = restoreBookPlanning(previous, summary)
  validateRendererResourceProfile(ports.resource_profile)
  const context: BookPlanningContext = { jobRoot, pinned, summary, ports, consumed_asset_bytes: 0 }
  let delta = { consumed_bytes: 0, probes: 0 }
  if (state.queue) delta = { consumed_bytes: 0, ...await drainBookPage(context, storage, state) }
  else if (state.phase === 'body') delta = await advanceBody(context, storage, state, Math.min(255, limits.input_bytes))
  else if (state.phase === 'toc') await advanceTocPlanning(context, storage, state)
  else if (state.phase === 'frontmatter') delta.probes = await advanceFrontmatterPlanning(context, storage, state)
  return { state: restoreBookPlanning(state, summary), ...delta, consumed_asset_bytes: context.consumed_asset_bytes, done: state.phase === 'done' }
}
