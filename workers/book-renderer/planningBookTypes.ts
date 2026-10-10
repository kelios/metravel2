import type { BookDocument, BookTextField, BookMediaChunk } from '@/types/bookDocument'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import type { FieldSourceCursor } from './planningSource'
import type { AnchorLedgerState } from './planningAnchors'
import type { PlanningFile } from './planningTypes'
import type { PageQueuePorts, PageQueueState } from './planningPageQueue'
import type { IndexedBookSummary } from './snapshot'
import type { RendererResourceProfile } from './measurement'
import { restoreFieldSource } from './planningSource'
import { restoreAnchorLedger } from './planningAnchors'
import { restorePageQueue } from './planningPageQueue'
import { canonicalJson, sha256 } from './filesystem'
import type { PlanningStorage } from './planningStorage'

export const BOOK_FIELDS: BookTextField[] = ['description', 'plus', 'minus', 'recommendation']
export type BookLane = 'body' | 'toc' | 'frontmatter'
export interface PlannedPageRecord { source: PlanningFile; travel_id: number; ordinal: number }
export interface PlannedChapter { travel_id: number; start: number; pages: number; map_start?: number }
export interface PlannedAtlasRecord { source: PlanningFile; travel_id: number; map_start: number }
export interface BookCounts { pages: number; blocks: number; occurrences: number; atlas_pages: number; toc_pages: number; frontmatter_pages: number }
export interface ContentPlanningState {
  field: number
  pass: 'anchors' | 'body'
  source: FieldSourceCursor
  parser?: PlanningFile
  parser_done: boolean
  needs_drain: boolean
  fragments?: PlanningFile
  fragment_total: number
  fragment_cursor: number
  anchors: AnchorLedgerState
  anchor_seal?: PlanningFile
  rewriting?: { fragment: PlanningFile; image: number; inline: number; skip_fit?: boolean }
  packed?: PlanningFile
  first: boolean
  emitted: boolean
  inline: number
  sequence: number
}
export interface SmallContentState { field: number; source: FieldSourceCursor; raw?: PlanningFile; characters: number; sequence: number }
export interface TravelBookState {
  id: number
  metadata?: PlanningFile
  metadata_cursor?: PlanningFile
  start: number
  map_start?: number
  stage: 'metadata' | 'separator' | 'photo' | 'small' | 'small-fit' | 'content' | 'online' | 'gallery' | 'map' | 'chapter'
  small?: SmallContentState
  small_candidate?: PlanningFile
  content?: ContentPlanningState
  gallery_row: number
  gallery_media: number
  gallery_count: number
  gallery_accumulator?: PlanningFile
  route: number
  route_media: number
  route_accumulator?: PlanningFile
  route_pending?: { file: PlanningFile; category: number; categories: number }
}
export interface BookPlanningState {
  version: 1
  phase: 'body' | 'toc' | 'frontmatter' | 'done'
  travel_ordinal: number
  travel?: TravelBookState
  counts: BookCounts
  candidate_sequence: number
  queue?: { lane: BookLane; travel_id: number; state: PageQueueState }
  body_tail: 'checklists' | 'final' | 'done'
  chapters: number
  atlas_records: number
  toc: { chapter: number; start: number; accumulator?: PlanningFile }
  frontmatter: { stage: 'cover' | 'toc' | 'atlas' | 'done'; toc: number; atlas: number; part: 'map' | 'index'; index: number }
  body_seal?: PlanningFile
  toc_seal?: PlanningFile
  frontmatter_seal?: PlanningFile
}
export interface ImageDimensions { width: number; height: number; aspect: number; read_bytes: number }
export type BookPlanningPorts = PageQueuePorts & {
  /** Synchronous bounded membership lookup for the canonical parser's anchor callback. */
  anchor_receipt?: (ref: string) => PlanningFile | null
  /** Frozen worker resource profile, included in the outer renderer identity. */
  resource_profile: RendererResourceProfile
  /** One frozen image, independently bounded/accounted by the declared resource profile. */
  imageDimensions: (chunk: BookMediaChunk) => Promise<ImageDimensions>
}
export interface BookPlanningContext {
  jobRoot: string
  pinned: BookDocument
  summary: IndexedBookSummary
  ports: BookPlanningPorts
  consumed_asset_bytes: number
}
export interface BookPlanningDelta { consumed_bytes: number; consumed_asset_bytes: number; probes: number }
export interface PackedContent { source: BookSegmentSource }

function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) }
export function bookCounter(value: number, amount = 1): number {
  const result = value + amount
  if (!count(value) || !count(amount) || !count(result)) throw new Error('WORKER_PLANNING_COUNTER_OVERFLOW')
  return result
}
function file(value: PlanningFile | undefined): void {
  if (value && (!/^book\/[a-zA-Z0-9/._-]+\.json$/.test(value.ref) && !/^metadata\/[1-9][0-9]*\.json$/.test(value.ref) && !/^fields\/[1-9][0-9]*\/(?:description|plus|minus|recommendation)\/anchors\//.test(value.ref) ||
      !/^[a-f0-9]{64}$/.test(value.checksum) || !count(value.size_bytes) || value.size_bytes > 1_048_576)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  if (value && (Object.keys(value).length !== 3 || Object.keys(value).some(key => !['ref', 'checksum', 'size_bytes'].includes(key)) || value.ref.split('/').some(part => part === '.' || part === '..' || !part))) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
}
function keys(value: object, required: string[], optional: string[] = []): void {
  if (required.some(key => !(key in value)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
}
function prefix(value: PlanningFile | undefined, scope: string): void { if (value && !value.ref.startsWith(scope)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID') }

export async function bookImageDimensions(context: BookPlanningContext, storage: PlanningStorage, chunk: BookMediaChunk): Promise<ImageDimensions> {
  const profile = sha256(canonicalJson(context.ports.resource_profile))
  const ref = `book/image-dimensions/${profile}/${chunk.checksum}.json`
  const cached = await storage.readIndex<{ profile: string; checksum: string; dimensions: ImageDimensions }>(ref)
  if (cached && (cached.profile !== profile || cached.checksum !== chunk.checksum)) throw new Error('WORKER_BOOK_IMAGE_PROBE_INVALID')
  if (!cached) context.ports.admit(1, 1024)
  const dimensions = cached ? { ...cached.dimensions, read_bytes: 0 } : await context.ports.imageDimensions(chunk)
  if (![dimensions.width, dimensions.height, dimensions.read_bytes].every(count) || dimensions.width < 1 || dimensions.height < 1 ||
      !Number.isFinite(dimensions.aspect) || dimensions.aspect <= 0 || dimensions.aspect !== dimensions.width / dimensions.height ||
      dimensions.width * dimensions.height > context.ports.resource_profile.decoded_resource_pixels ||
      chunk.size_bytes > context.ports.resource_profile.encoded_resource_bytes || dimensions.read_bytes > 2 * context.ports.resource_profile.encoded_resource_bytes ||
      !count(context.consumed_asset_bytes + dimensions.read_bytes)) throw new Error('WORKER_BOOK_IMAGE_PROBE_INVALID')
  context.consumed_asset_bytes += dimensions.read_bytes
  if (!cached) await storage.put(ref, { profile, checksum: chunk.checksum, dimensions }, 1024)
  return dimensions
}

/** The archive lives in numbered immutable records; this envelope retains one bounded unit only. */
export function restoreBookPlanning(value: BookPlanningState, summary: IndexedBookSummary): BookPlanningState {
  if (!value || value.version !== 1 || !['body', 'toc', 'frontmatter', 'done'].includes(value.phase) ||
      !['checklists', 'final', 'done'].includes(value.body_tail) || !count(value.travel_ordinal) || value.travel_ordinal > summary.travels ||
      !count(value.candidate_sequence) || !count(value.chapters) || value.chapters > summary.travels || !count(value.atlas_records) ||
      !value.counts || Object.values(value.counts).some(item => !count(item)) || Object.keys(value.counts).length !== 6 ||
      !value.toc || !count(value.toc.chapter) || value.toc.chapter > value.chapters || !count(value.toc.start) ||
      !value.frontmatter || !['cover', 'toc', 'atlas', 'done'].includes(value.frontmatter.stage) ||
      !['map', 'index'].includes(value.frontmatter.part) || !count(value.frontmatter.toc) || value.frontmatter.toc > value.counts.toc_pages ||
      !count(value.frontmatter.atlas) || value.frontmatter.atlas > value.atlas_records || !count(value.frontmatter.index)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  keys(value, ['version', 'phase', 'travel_ordinal', 'counts', 'candidate_sequence', 'body_tail', 'chapters', 'atlas_records', 'toc', 'frontmatter'], ['travel', 'queue', 'body_seal', 'toc_seal', 'frontmatter_seal'])
  keys(value.counts, ['pages', 'blocks', 'occurrences', 'atlas_pages', 'toc_pages', 'frontmatter_pages'])
  keys(value.toc, ['chapter', 'start'], ['accumulator'])
  keys(value.frontmatter, ['stage', 'toc', 'atlas', 'part', 'index'])
  if (value.chapters !== value.travel_ordinal || value.toc.start > value.toc.chapter || value.frontmatter.index > value.counts.atlas_pages ||
      (value.phase !== 'body' && (value.travel || value.travel_ordinal !== summary.travels || value.body_tail !== 'done' || !value.body_seal)) ||
      (value.phase === 'body' && (value.body_seal || value.toc_seal || value.frontmatter_seal || value.counts.toc_pages || value.counts.frontmatter_pages)) ||
      ((value.phase === 'frontmatter' || value.phase === 'done') && !value.toc_seal)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  if (value.travel) {
    const travel = value.travel
    if (!count(travel.id) || !travel.id || !count(travel.start) || travel.start > value.counts.pages ||
        !['metadata', 'separator', 'photo', 'small', 'small-fit', 'content', 'online', 'gallery', 'map', 'chapter'].includes(travel.stage) ||
        [travel.gallery_row, travel.gallery_media, travel.gallery_count, travel.route, travel.route_media].some(item => !count(item)) ||
        (travel.map_start !== undefined && (!count(travel.map_start) || travel.map_start >= value.counts.pages))) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
    keys(travel, ['id', 'start', 'stage', 'gallery_row', 'gallery_media', 'gallery_count', 'route', 'route_media'], ['metadata', 'metadata_cursor', 'map_start', 'small', 'small_candidate', 'content', 'gallery_accumulator', 'route_accumulator', 'route_pending'])
    if (travel.stage !== 'metadata' && (!travel.metadata || travel.metadata_cursor) || travel.stage === 'small' !== !!travel.small ||
        travel.stage === 'small-fit' !== !!travel.small_candidate || !['content', 'online'].includes(travel.stage) && !!travel.content ||
        travel.stage === 'content' && !travel.content || travel.stage === 'online' && !travel.content ||
        travel.route_pending && travel.stage !== 'map' || travel.gallery_accumulator && travel.stage !== 'gallery' || travel.route_accumulator && travel.stage !== 'map') throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
    if (travel.metadata && travel.metadata.ref !== `metadata/${travel.id}.json`) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
    prefix(travel.metadata_cursor, `book/metadata-cursors/${travel.id}/`)
    prefix(travel.small_candidate, `book/small-candidates/${travel.id}/`)
    prefix(travel.gallery_accumulator, `book/gallery/${travel.id}/`)
    prefix(travel.route_accumulator, `book/maps/${travel.id}/`)
    for (const item of [travel.metadata, travel.metadata_cursor, travel.small_candidate, travel.gallery_accumulator, travel.route_accumulator]) file(item)
    if (travel.route_pending) {
      keys(travel.route_pending, ['file', 'category', 'categories'])
      file(travel.route_pending.file)
      prefix(travel.route_pending.file, `book/route/${travel.id}/${travel.route}/`)
      if (!count(travel.route_pending.category) || !count(travel.route_pending.categories) || travel.route_pending.category > travel.route_pending.categories) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
    }
    if (travel.small) {
      keys(travel.small, ['field', 'source', 'characters', 'sequence'], ['raw'])
      if (!count(travel.small.field) || travel.small.field > 4 || !count(travel.small.characters) || travel.small.characters > 8192 || !count(travel.small.sequence)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
      file(travel.small.raw)
      prefix(travel.small.raw, `book/small/${travel.id}/`)
      restoreFieldSource(travel.small.source, Number.MAX_SAFE_INTEGER)
    }
    if (travel.content) {
      const content = travel.content
      if (!count(content.field) || content.field > 4 || !['anchors', 'body'].includes(content.pass) || !count(content.inline) ||
          !count(content.sequence) || !count(content.fragment_cursor) || !count(content.fragment_total) || content.fragment_total > 16 ||
          content.fragment_cursor > content.fragment_total || ['first', 'emitted', 'parser_done', 'needs_drain'].some(key => typeof content[key as keyof ContentPlanningState] !== 'boolean')) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
      keys(content, ['field', 'pass', 'source', 'parser_done', 'needs_drain', 'fragment_total', 'fragment_cursor', 'anchors', 'first', 'emitted', 'inline', 'sequence'], ['parser', 'fragments', 'anchor_seal', 'rewriting', 'packed'])
      restoreFieldSource(content.source, Number.MAX_SAFE_INTEGER)
      restoreAnchorLedger(content.anchors)
      if (content.parser_done && content.needs_drain || !!content.fragments !== (content.fragment_total > 0) ||
          content.fragments && content.fragment_cursor >= content.fragment_total || content.pass === 'body' && !content.anchor_seal ||
          content.pass === 'anchors' && (content.anchor_seal || content.rewriting || content.packed) ||
          content.field === 4 && (!content.parser_done || content.pass !== 'body' || content.fragments || content.packed || content.rewriting)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
      const field = BOOK_FIELDS[Math.min(3, content.field)]
      const scope = `book/content/${travel.id}/${field}/${content.pass}/`
      for (const item of [content.parser, content.packed, content.fragments]) prefix(item, scope)
      if (content.anchors.scope !== `fields/${travel.id}/${field}/anchors` || content.anchor_seal && content.anchor_seal.ref !== `${content.anchors.scope}/complete.json`) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
      for (const item of [content.parser, content.packed, content.anchor_seal, content.fragments]) file(item)
      if (content.rewriting) {
        keys(content.rewriting, ['fragment', 'image', 'inline'], ['skip_fit'])
        file(content.rewriting.fragment)
        if (!count(content.rewriting.image) || !count(content.rewriting.inline)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
        prefix(content.rewriting.fragment, scope)
        if (content.rewriting.skip_fit !== undefined && content.rewriting.skip_fit !== true || content.rewriting.inline > content.inline) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
      }
    }
  }
  for (const item of [value.toc.accumulator, value.body_seal, value.toc_seal, value.frontmatter_seal]) file(item)
  if (value.body_seal && value.body_seal.ref !== 'book/body-complete.json' || value.toc_seal && value.toc_seal.ref !== 'book/toc-complete.json' ||
      value.frontmatter_seal && value.frontmatter_seal.ref !== 'book/frontmatter-complete.json') throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  prefix(value.toc.accumulator, 'book/toc-accumulators/')
  if (value.queue && (!['body', 'toc'].includes(value.queue.lane) || !count(value.queue.travel_id))) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  if (value.queue) {
    keys(value.queue, ['lane', 'travel_id', 'state'])
    restorePageQueue(value.queue.state)
    if (value.queue.state.scope !== `book/q${value.candidate_sequence - 1}` ||
        value.queue.lane !== (value.phase === 'body' ? 'body' : value.phase === 'toc' ? 'toc' : 'frontmatter') ||
        value.queue.lane === 'body' && value.queue.travel_id !== (value.travel?.id ?? 0) || value.queue.lane !== 'body' && value.queue.travel_id !== 0) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  }
  if (value.phase === 'done' && (!value.body_seal || !value.toc_seal || !value.frontmatter_seal || value.travel || value.queue)) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  if (value.phase === 'done' && (value.frontmatter.stage !== 'done' || value.frontmatter.toc !== value.counts.toc_pages ||
      value.frontmatter.index !== value.counts.atlas_pages || value.frontmatter.part !== 'map' ||
      value.counts.frontmatter_pages !== bookCounter(bookCounter(value.counts.toc_pages, value.counts.atlas_pages)))) throw new Error('WORKER_BOOK_CHECKPOINT_INVALID')
  return structuredClone(value)
}

export function initialBookPlanning(): BookPlanningState {
  return { version: 1, phase: 'body', travel_ordinal: 0, counts: { pages: 0, blocks: 0, occurrences: 0, atlas_pages: 0, toc_pages: 0, frontmatter_pages: 0 },
    candidate_sequence: 0, body_tail: 'checklists', chapters: 0, atlas_records: 0, toc: { chapter: 0, start: 0 },
    frontmatter: { stage: 'cover', toc: 0, atlas: 0, part: 'map', index: 0 } }
}
