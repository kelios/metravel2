import type { BookDocument } from '@/types/bookDocument'
import type { TravelForBook } from '@/types/pdf-export'
import { canonicalJson } from './filesystem'
import { readIndexedSource } from './planningSource'
import type { PlanningStorage } from './planningStorage'
import type { IndexCounts, PlanningFile } from './planningTypes'
import { appendMetadataLabel, assetUrl, travelMetadataBase } from './snapshot'

const LABEL_KINDS = ['country', 'author', 'month'] as const
export interface TravelMetadataCursor {
  version: 1
  travel_id: number
  counts: IndexCounts
  travel: TravelForBook
  label_kind: number
  label_ordinal: number
  complete: boolean
}

function validateTravelBudget(travel: TravelForBook): void {
  if (canonicalJson(travel).length > 32_768 || Buffer.byteLength(canonicalJson(travel)) > 131_072) throw new Error('WORKER_METADATA_BUDGET_EXCEEDED')
}
function validCount(value: number): boolean { return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) }

export async function startTravelMetadata(storage: PlanningStorage, pinned: BookDocument, committedSources: number, travelId: number): Promise<TravelMetadataCursor> {
  const chunk = await readIndexedSource(storage, pinned, `index/travel/${travelId}/travel/0.json`, committedSources, travelId, 'travel')
  const counts = await storage.readIndex<IndexCounts>(`index/travel/${travelId}/counts.json`)
  if (!counts || !validCount(counts.photos) || !validCount(counts.locations) || counts.kinds.travel !== 1 ||
      LABEL_KINDS.some(kind => !validCount(counts.kinds[kind] ?? 0)) || !validCount(counts.roles.cover ?? 0)) throw new Error('WORKER_PLANNING_COUNTS_INVALID')
  const travel = travelMetadataBase(chunk.metadata as unknown as Record<string, unknown>, travelId, { photos: counts.photos, locations: counts.locations })
  validateTravelBudget(travel)
  return { version: 1, travel_id: travelId, counts, travel, label_kind: 0, label_ordinal: 0, complete: false }
}

/** One related metadata row or one cover descriptor; no chapter-sized related-record scan. */
export async function advanceTravelMetadata(storage: PlanningStorage, pinned: BookDocument, committedSources: number, previous: TravelMetadataCursor): Promise<{ cursor: TravelMetadataCursor; file?: PlanningFile }> {
  const cursor: TravelMetadataCursor = { ...previous, travel: { ...previous.travel } }
  if (cursor.version !== 1 || !Number.isSafeInteger(cursor.travel_id) || cursor.travel_id < 1 || cursor.travel.id !== cursor.travel_id ||
      !Number.isSafeInteger(cursor.label_kind) || cursor.label_kind < 0 || cursor.label_kind > LABEL_KINDS.length ||
      !validCount(cursor.label_ordinal) || cursor.complete) throw new Error('WORKER_TRAVEL_CURSOR_INVALID')
  validateTravelBudget(cursor.travel)
  const kind = LABEL_KINDS[cursor.label_kind]
  if (kind) {
    const total = cursor.counts.kinds[kind] ?? 0
    if (!validCount(total) || cursor.label_ordinal > total) throw new Error('WORKER_TRAVEL_CURSOR_INVALID')
    if (cursor.label_ordinal < total) {
      const chunk = await readIndexedSource(storage, pinned, `index/travel/${cursor.travel_id}/${kind}/${cursor.label_ordinal}.json`, committedSources, cursor.travel_id, kind)
      if (chunk.kind === 'country') cursor.travel.countryName = appendMetadataLabel(cursor.travel.countryName, chunk.metadata.title_ru || chunk.metadata.title_en)
      if (chunk.kind === 'author') cursor.travel.userName = appendMetadataLabel(cursor.travel.userName, chunk.metadata.name)
      if (chunk.kind === 'month') cursor.travel.monthName = appendMetadataLabel(cursor.travel.monthName, chunk.metadata.name)
      cursor.label_ordinal++
    } else { cursor.label_kind++; cursor.label_ordinal = 0 }
    validateTravelBudget(cursor.travel)
    return { cursor }
  }
  if (cursor.counts.roles.cover) {
    const cover = await readIndexedSource(storage, pinned, `index/travel/${cursor.travel_id}/media/cover/0.json`, committedSources, cursor.travel_id, 'media')
    if (cover.kind !== 'media' || cover.metadata.role !== 'cover') throw new Error('WORKER_PLANNING_PREFIX_MISMATCH')
    cursor.travel.travel_image_url = assetUrl(cover)
  }
  validateTravelBudget(cursor.travel)
  cursor.complete = true
  return { cursor, file: await storage.put(`metadata/${cursor.travel_id}.json`, cursor.travel, 131_072) }
}
