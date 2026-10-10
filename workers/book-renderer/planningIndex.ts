import { open } from 'node:fs/promises'
import type { BookDocument, BookMediaChunk, BookSnapshotChunk } from '@/types/bookDocument'
import { toBookPlanEntry, validateSnapshotChunk } from '@/services/pdf-export/segments/snapshotAdapter'
import { CheckpointSha256 } from './checkpointHash'
import { canonicalJson, privatePath, sha256 } from './filesystem'
import { readRecordWindow } from './recordCursor'
import { PlanningStorage } from './planningStorage'
import type { IndexCounts, PlanningCheckpoint, SnapshotIndexState } from './planningTypes'

export function emptyIndexCounts(): IndexCounts { return { kinds: {}, roles: {}, fields: {}, photos: 0, locations: 0 } }

function addSafe(value: number, amount: number): number {
  const result = value + amount
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('WORKER_PLANNING_COUNTER_OVERFLOW')
  return result
}

export function initialSnapshotIndex(pinned: BookDocument): SnapshotIndexState {
  const hash = new CheckpointSha256()
  updateJsonHash(hash, [2, 1, pinned.selection_hash, pinned.settings_hash, pinned.entitlement])
  return { manifest_done: false, manifest_hash: hash.snapshot(), summary: { travels: 0, countries: 0, days: 0, photos: 0,
    points: 0, mapped_travels: 0, sources: 0, included_media_occurrences: 0 }, current_counts: emptyIndexCounts(), global_counts: emptyIndexCounts() }
}

function updateJsonHash(hash: CheckpointSha256, value: unknown): void {
  const bytes = Buffer.from(canonicalJson(value))
  if (bytes.length > 524_288) throw new Error('WORKER_RECORD_BUDGET_EXCEEDED')
  for (let offset = 0; offset < bytes.length; offset += 65_536) hash.update(bytes.subarray(offset, offset + 65_536))
}

function includedMedia(chunk: BookMediaChunk, pinned: BookDocument): boolean {
  const role = chunk.metadata.role
  return role === 'cover' || role === 'inline' || (role === 'gallery' && pinned.settings.includeGallery) ||
    (role === 'route-image' && pinned.settings.includeMap) ||
    (role === 'book-cover' && !!pinned.settings.coverImage && !['gradient', 'first-photo'].includes(pinned.settings.coverType))
}

async function finishTravel(state: SnapshotIndexState, storage: PlanningStorage): Promise<void> {
  if (state.current_travel === undefined) return
  await storage.put(`index/travel/${state.current_travel}/counts.json`, state.current_counts)
  if (state.current_counts.locations) state.summary.mapped_travels = addSafe(state.summary.mapped_travels, 1)
}

async function finishRoute(state: SnapshotIndexState, storage: PlanningStorage): Promise<void> {
  if (!state.current_route) return
  await storage.put(`index/travel/${state.current_travel}/route-categories/${state.current_route.id}/counts.json`, state.current_route)
  delete state.current_route
}

async function firstPosition(storage: PlanningStorage, ref: string, position: number, value: unknown): Promise<boolean> {
  const existing = await storage.readIndex<{ first_position: number; value: unknown }>(ref)
  if (existing !== undefined) {
    if (!Number.isSafeInteger(existing.first_position) || existing.first_position > position ||
        canonicalJson(existing.value) !== canonicalJson(value)) throw new Error('WORKER_PLANNING_MEMBERSHIP_CONFLICT')
    return existing.first_position === position
  }
  await storage.put(ref, { first_position: position, value })
  return true
}

async function commitSource(state: SnapshotIndexState, chunk: BookSnapshotChunk, pinned: BookDocument, storage: PlanningStorage): Promise<void> {
  if (chunk.position !== state.summary.sources) throw new Error('SNAPSHOT_MANIFEST_ORDER_INVALID')
  const injectedRouteMedia = chunk.kind === 'media' && state.current_route?.media.some(item =>
    item.role === chunk.metadata.role && item.resource_key === chunk.metadata.resource_key)
  if (chunk.kind !== 'route-category' && !injectedRouteMedia) await finishRoute(state, storage)
  if (chunk.kind === 'travel') {
    if (!await firstPosition(storage, `index/travels-seen/${chunk.travel_id}.json`, chunk.position, chunk.travel_id)) {
      throw new Error('SNAPSHOT_TRAVEL_ORDER_INVALID')
    }
    await finishTravel(state, storage)
    state.current_travel = chunk.travel_id!
    state.current_counts = emptyIndexCounts()
    await storage.put(`index/travels/${state.summary.travels}.json`, { id: chunk.travel_id, position: chunk.position })
    state.summary.travels = addSafe(state.summary.travels, 1)
    state.summary.first_travel ??= state.current_travel
    state.summary.days = addSafe(state.summary.days, Math.max(0, chunk.metadata.number_days || 0))
    const year = Number(chunk.metadata.year)
    if (year > 0) {
      state.summary.min_year = Math.min(state.summary.min_year ?? year, year)
      state.summary.max_year = Math.max(state.summary.max_year ?? year, year)
    }
  } else if (chunk.travel_id !== null && chunk.travel_id !== state.current_travel) throw new Error('SNAPSHOT_TRAVEL_ORDER_INVALID')
  const prefix = chunk.travel_id === null ? 'index/book' : `index/travel/${chunk.travel_id}`
  const counts = chunk.travel_id === null ? state.global_counts : state.current_counts
  const ordinal = counts.kinds[chunk.kind] ?? 0
  await storage.put(`index/rows/${chunk.position}.json`, chunk)
  await storage.put(`index/source-plan/${chunk.position}.json`, toBookPlanEntry(chunk))
  await storage.put(`${prefix}/${chunk.kind}/${ordinal}.json`, chunk)
  counts.kinds[chunk.kind] = addSafe(ordinal, 1)
  if (chunk.kind === 'text') {
    const fieldOrdinal = counts.fields[chunk.metadata.field] ?? 0
    await storage.put(`${prefix}/fields/${chunk.metadata.field}/${fieldOrdinal}.json`, chunk)
    counts.fields[chunk.metadata.field] = addSafe(fieldOrdinal, 1)
  }
  if (chunk.kind === 'media') {
    const role = chunk.metadata.role
    const roleOrdinal = counts.roles[role] ?? 0
    await storage.put(`${prefix}/media/${role}/${roleOrdinal}.json`, chunk)
    counts.roles[role] = addSafe(roleOrdinal, 1)
    const assetRef = `assets/${chunk.checksum}.json`
    const firstAsset = await storage.readIndex<BookMediaChunk>(assetRef)
    if (firstAsset) {
      if (firstAsset.kind !== 'media' || firstAsset.checksum !== chunk.checksum || firstAsset.size_bytes !== chunk.size_bytes ||
          !Number.isSafeInteger(firstAsset.position) || firstAsset.position > chunk.position) throw new Error('SNAPSHOT_ASSET_CONFLICT')
    } else await storage.put(assetRef, chunk)
    if (includedMedia(chunk, pinned)) {
      const keyRef = `index/expected-occurrences/${sha256(chunk.occurrence_key)}.json`
      if (!await firstPosition(storage, keyRef, chunk.position, chunk.occurrence_key)) throw new Error('SNAPSHOT_OCCURRENCE_DUPLICATED')
      await storage.put(`index/occurrences/${state.summary.included_media_occurrences}.json`, { key: chunk.occurrence_key, position: chunk.position })
      state.summary.included_media_occurrences = addSafe(state.summary.included_media_occurrences, 1)
    }
    if (role === 'cover' && state.first_cover_position === undefined) {
      state.first_cover_position = chunk.position
      await storage.put('index/first-cover.json', chunk)
    }
    if (role === 'book-cover') {
      if (state.book_cover_position !== undefined) throw new Error('SNAPSHOT_BOOK_COVER_DUPLICATED')
      state.book_cover_position = chunk.position
      await storage.put('index/book-cover.json', chunk)
    }
  }
  if (chunk.kind === 'gallery') { state.summary.photos = addSafe(state.summary.photos, 1); counts.photos = addSafe(counts.photos, 1) }
  if (chunk.kind === 'route') {
    if (!await firstPosition(storage, `${prefix}/routes-seen/${chunk.metadata.id}.json`, chunk.position, chunk.metadata.id)) throw new Error('SNAPSHOT_ROUTE_DUPLICATED')
    state.current_route = { id: chunk.metadata.id, position: chunk.position, categories: 0, media:
      [['route-image', chunk.metadata.image], ['route-image_detail', chunk.metadata.image_detail], ['route-image_landscape', chunk.metadata.image_landscape]]
        .filter((item): item is [string, string] => typeof item[1] === 'string' && !!item[1]).map(([role, resource_key]) => ({ role, resource_key })) }
    state.summary.points = addSafe(state.summary.points, 1); counts.locations = addSafe(counts.locations, 1)
  }
  if (chunk.kind === 'route-category') {
    if (!state.current_route || state.current_route.id !== chunk.metadata.route_id) throw new Error('SNAPSHOT_ROUTE_CATEGORY_ORDER_INVALID')
    if (!await firstPosition(storage, `${prefix}/route-category-seen/${chunk.metadata.route_id}/${chunk.metadata.id}.json`, chunk.position, chunk.metadata.id)) throw new Error('SNAPSHOT_ROUTE_CATEGORY_DUPLICATED')
    await storage.put(`${prefix}/route-categories/${chunk.metadata.route_id}/${state.current_route.categories}.json`, chunk)
    state.current_route.categories = addSafe(state.current_route.categories, 1)
  }
  if (chunk.kind === 'country' && await firstPosition(storage, `index/countries/${chunk.metadata.country_id}.json`, chunk.position, chunk.metadata.country_id)) state.summary.countries = addSafe(state.summary.countries, 1)
  const hash = new CheckpointSha256(state.manifest_hash)
  updateJsonHash(hash, [chunk.position, chunk.travel_id, chunk.kind, chunk.source_key, chunk.occurrence_key, chunk.checksum, chunk.size_bytes, chunk.metadata])
  state.manifest_hash = hash.snapshot()
  state.summary.sources = addSafe(state.summary.sources, 1)
}

export async function prepareSnapshotIndexStep(root: string, pinned: BookDocument, checkpoint: PlanningCheckpoint, storage: PlanningStorage, inputBytes: number): Promise<number> {
  const state = checkpoint.index
  let used = 0
  if (!state.verification && !state.manifest_done) {
    const window = await readRecordWindow<unknown>(root, 'manifest.ndjson', state.manifest, { bytes: inputBytes, records: 1 })
    used += window.read_bytes
    const previousRecords = state.manifest?.records ?? 0
    state.manifest = window.cursor
    state.manifest_done = window.done
    if (window.cursor.records - previousRecords !== window.rows.length) throw new Error('SNAPSHOT_MANIFEST_ORDER_INVALID')
    if (window.rows.length) {
      const chunk = validateSnapshotChunk(window.rows[0], pinned)
      if (chunk.position !== state.summary.sources) throw new Error('SNAPSHOT_MANIFEST_ORDER_INVALID')
      state.verification = { chunk, offset: 0, hash: new CheckpointSha256().snapshot() }
    }
  }
  if (state.verification) {
    const verification = state.verification
    const path = await privatePath(root, verification.chunk.file_ref)
    const handle = await open(path, 'r')
    try {
      const info = await handle.stat()
      if (!info.isFile() || info.size !== verification.chunk.size_bytes) throw new Error('SNAPSHOT_BYTES_UNAVAILABLE')
      const bytes = Buffer.alloc(Math.min(inputBytes - used, info.size - verification.offset))
      if (bytes.length) {
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, verification.offset)
        if (!bytesRead) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
        const hash = new CheckpointSha256(verification.hash)
        hash.update(bytes.subarray(0, bytesRead))
        verification.hash = hash.snapshot()
        verification.offset += bytesRead
        used += bytesRead
      }
      if ((await handle.stat()).size !== info.size) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
    } finally { await handle.close() }
    if (verification.offset === verification.chunk.size_bytes) {
      if (new CheckpointSha256(verification.hash).digestHex() !== verification.chunk.checksum) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
      await commitSource(state, verification.chunk, pinned, storage)
      delete state.verification
    }
  }
  if (state.manifest_done && !state.verification) {
    if (new CheckpointSha256(state.manifest_hash).digestHex() !== pinned.snapshot_hash) throw new Error('SNAPSHOT_MANIFEST_HASH_MISMATCH')
    if (!state.summary.travels) throw new Error('SNAPSHOT_SELECTION_EMPTY')
    await finishRoute(state, storage)
    await finishTravel(state, storage)
    await storage.put('index/book/counts.json', state.global_counts)
    await storage.put('index/summary.json', state.summary)
    checkpoint.phase = 'indexed'
  }
  return used
}
