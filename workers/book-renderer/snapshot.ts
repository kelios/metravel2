import { createHash } from 'node:crypto'
import { access, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import type { BookDocument, BookMediaChunk, BookSnapshotChunk, BookTextField } from '@/types/bookDocument'
import { iterateSnapshotChunks, iterateTextFieldRefs, streamSnapshotChunk, toBookPlanEntry } from '@/services/pdf-export/segments/snapshotAdapter'
import type { TravelForBook } from '@/types/pdf-export'
import type { BookSummary } from '@/services/pdf-export/segments/types'
import { appendRecord, canonicalJson, filesystemReader, jsonLines, makePrivateDirectory, readBoundedJson, sha256 } from './filesystem'

export interface IndexedBookSummary extends BookSummary {
  points: number
  mapped_travels: number
  first_travel?: number
  min_year?: number
  max_year?: number
  sources: number
  included_media_occurrences: number
}

export async function indexSnapshot(root: string, out: string, pinned: BookDocument, readBytes = 65_536): Promise<IndexedBookSummary> {
  await access(resolve(root, 'manifest.ndjson'))
  const spool = resolve(out, 'sources')
  await makePrivateDirectory(spool)
  await makePrivateDirectory(resolve(out, 'assets'))
  await makePrivateDirectory(resolve(out, 'countries'))
  const summary: IndexedBookSummary = { travels: 0, countries: 0, days: 0, photos: 0, points: 0, mapped_travels: 0, sources: 0, included_media_occurrences: 0 }
  const hash = createHash('sha256')
  if (sha256(canonicalJson(pinned.settings)) !== pinned.settings_hash) throw new Error('SNAPSHOT_SETTINGS_HASH_MISMATCH')
  hash.update(canonicalJson([2, 1, pinned.selection_hash, pinned.settings_hash, pinned.entitlement]))
  const reader = filesystemReader(root, pinned, readBytes)
  let travelId: number | undefined
  let hasPoints = false
  let counts = { photos: 0, locations: 0 }
  const saveCounts = async () => {
    if (travelId) await writeFile(resolve(spool, String(travelId), 'counts.json'), canonicalJson(counts), { mode: 0o600 })
  }
  for await (const chunk of iterateSnapshotChunks(pinned, reader)) {
    await reader.verifyChunk(chunk)
    hash.update(canonicalJson([chunk.position, chunk.travel_id, chunk.kind, chunk.source_key, chunk.occurrence_key, chunk.checksum, chunk.size_bytes, chunk.metadata]))
    summary.sources++
    await appendRecord(resolve(out, 'sources-plan.ndjson'), toBookPlanEntry(chunk))
    if (chunk.kind === 'travel') {
      await saveCounts()
      counts = { photos: 0, locations: 0 }
      if (hasPoints) summary.mapped_travels++
      hasPoints = false
      if (chunk.travel_id === travelId) throw new Error('SNAPSHOT_TRAVEL_ORDER_INVALID')
      travelId = chunk.travel_id ?? undefined
      if (!travelId) throw new Error('SNAPSHOT_TRAVEL_ID_INVALID')
      const dir = resolve(spool, String(travelId))
      await makePrivateDirectory(dir)
      await makePrivateDirectory(resolve(dir, 'route-categories'))
      await appendRecord(resolve(out, 'travels.ndjson'), travelId)
      await writeFile(resolve(dir, 'travel.json'), canonicalJson(chunk.metadata), { mode: 0o600 })
      summary.travels++
      summary.first_travel ??= travelId
      summary.days += Math.max(0, chunk.metadata.number_days || 0)
      const year = Number(chunk.metadata.year)
      if (year > 0) {
        summary.min_year = Math.min(summary.min_year ?? year, year)
        summary.max_year = Math.max(summary.max_year ?? year, year)
      }
    } else if (chunk.travel_id !== null && chunk.travel_id !== travelId) {
      throw new Error('SNAPSHOT_TRAVEL_ORDER_INVALID')
    }
    const dir = chunk.travel_id === null ? out : resolve(spool, String(chunk.travel_id))
    await appendRecord(resolve(dir, `${chunk.kind}.ndjson`), chunk)
    if (chunk.kind === 'media') {
      const role = chunk.metadata.role
      const included = role === 'cover' || role === 'inline' ||
        (role === 'gallery' && pinned.settings.includeGallery) ||
        (role === 'route-image' && pinned.settings.includeMap) ||
        (role === 'book-cover' && !!pinned.settings.coverImage &&
          !['gradient', 'first-photo'].includes(pinned.settings.coverType))
      if (included) {
        await writeFile(resolve(out, 'expected-occurrences', sha256(chunk.occurrence_key)), chunk.occurrence_key, { flag: 'wx', mode: 0o600 })
        summary.included_media_occurrences++
      }
      await writeFile(resolve(out, 'assets', `${chunk.checksum}.json`), canonicalJson(chunk), { mode: 0o600 })
      await appendRecord(resolve(dir, `${chunk.metadata.role}.media.ndjson`), chunk)
      if (chunk.metadata.role === 'book-cover') await writeFile(resolve(out, 'book-cover.json'), canonicalJson(chunk), { mode: 0o600 })
      if (chunk.metadata.role === 'cover') {
        const first = resolve(out, 'first-cover.json')
        try { await access(first) } catch { await writeFile(first, canonicalJson(chunk), { flag: 'wx', mode: 0o600 }) }
      }
    }
    if (chunk.kind === 'gallery') { summary.photos++; counts.photos++ }
    if (chunk.kind === 'route') { summary.points++; hasPoints = true; counts.locations++ }
    if (chunk.kind === 'route-category') await appendRecord(resolve(dir, 'route-categories', `${chunk.metadata.route_id}.ndjson`), chunk)
    if (chunk.kind === 'country') {
      const file = resolve(out, 'countries', String(chunk.metadata.country_id))
      try { await access(file) } catch {
        await writeFile(file, '', { flag: 'wx', mode: 0o600 })
        summary.countries++
      }
    }
  }
  if (hasPoints) summary.mapped_travels++
  await saveCounts()
  if (hash.digest('hex') !== pinned.snapshot_hash) throw new Error('SNAPSHOT_MANIFEST_HASH_MISMATCH')
  if (!summary.travels) throw new Error('SNAPSHOT_SELECTION_EMPTY')
  await writeFile(resolve(out, 'summary.json'), canonicalJson(summary), { mode: 0o600 })
  return summary
}

export function travelDirectory(out: string, id: number): string { return resolve(out, 'sources', String(id)) }

export function appendMetadataLabel(previous: string | undefined, next: string | null | undefined): string | undefined {
  if (!next) return previous
  if ((previous ? previous.length + 2 : 0) + next.length > 32_768) throw new Error('WORKER_METADATA_BUDGET_EXCEEDED')
  return previous ? `${previous}, ${next}` : next
}

export async function travelMetadata(out: string, id: number): Promise<TravelForBook> {
  const dir = travelDirectory(out, id)
  const source = await readBoundedJson<Record<string, unknown>>(resolve(dir, 'travel.json'))
  const travel = travelMetadataBase(source, id, await readBoundedJson(resolve(dir, 'counts.json')))
  for await (const chunk of jsonLines<BookSnapshotChunk>(resolve(dir, 'country.ndjson'))) {
    if (chunk.kind === 'country') travel.countryName = appendMetadataLabel(travel.countryName, chunk.metadata.title_ru || chunk.metadata.title_en)
  }
  for await (const chunk of jsonLines<BookSnapshotChunk>(resolve(dir, 'author.ndjson'))) {
    if (chunk.kind === 'author') travel.userName = appendMetadataLabel(travel.userName, chunk.metadata.name)
  }
  for await (const chunk of jsonLines<BookSnapshotChunk>(resolve(dir, 'month.ndjson'))) {
    if (chunk.kind === 'month') travel.monthName = appendMetadataLabel(travel.monthName, chunk.metadata.name)
  }
  if (canonicalJson(travel).length > 32_768) throw new Error('WORKER_METADATA_BUDGET_EXCEEDED')
  return travel
}

export function travelMetadataBase(source: Record<string, unknown>, id: number, sourceCounts: { photos: number; locations: number }): TravelForBook {
  return { id, name: String(source.name || ''), slug: String(source.slug || ''),
    year: source.year === null ? undefined : Number(source.year), number_days: Number(source.number_days || 0),
    youtube_link: String(source.youtube_link || ''), url: `https://metravel.by/travels/${String(source.slug || id)}`, sourceCounts }
}

export async function* textSource(root: string, out: string, pinned: BookDocument, id: number, field: BookTextField, readBytes: number): AsyncGenerator<string> {
  const reader = filesystemReader(root, pinned, readBytes)
  const refs = iterateTextFieldRefs(jsonLines<BookSnapshotChunk>(resolve(travelDirectory(out, id), 'text.ndjson')), id, field)
  let nextOffset = 1
  let ended = false
  let durable = false
  for await (const ref of refs) {
    if (ended || ref.metadata.offset !== nextOffset) throw new Error('SNAPSHOT_TEXT_WINDOW_ORDER_MISMATCH')
    const decoder = new StringDecoder('utf8')
    let characters = 0
    for await (const bytes of streamSnapshotChunk(reader, ref)) {
      const part = decoder.write(Buffer.from(bytes))
      characters += Array.from(part).length
      yield part
    }
    const last = decoder.end()
    characters += Array.from(last).length
    if (last) yield last
    if (characters > 16_384 || (ref.metadata.canonical_key && characters > 16_384 - ((ref.metadata.offset - 1) % 16_384))) throw new Error('SNAPSHOT_TEXT_WINDOW_BUDGET_EXCEEDED')
    nextOffset += characters
    ended = ref.metadata.field_end === true
    durable ||= ref.metadata.canonical_key !== undefined
  }
  if (durable && !ended) throw new Error('SNAPSHOT_TEXT_FIELD_INCOMPLETE')
}

export const SNAPSHOT_ASSET_ORIGIN = 'https://book-snapshot.invalid'
export function assetUrl(chunk: BookMediaChunk): string { return `${SNAPSHOT_ASSET_ORIGIN}/assets/${chunk.checksum}` }

export async function firstMedia(out: string, id: number, role: string): Promise<BookMediaChunk | undefined> {
  for await (const media of jsonLines<BookMediaChunk>(resolve(travelDirectory(out, id), `${role}.media.ndjson`))) return media
  return undefined
}

export async function sourceImageKey(source: string): Promise<string> {
  if (source.startsWith('data:image/')) return `inline:${sha256(source)}`
  const url = new URL(source, 'https://metravel.by')
  let path = decodeURIComponent(url.pathname).replace(/^\//, '')
  if (/^s3[.-]/.test(url.hostname)) path = path.slice(path.indexOf('/') + 1)
  path = path.replace(/^api\//, '').replace(/^(media-resize\/legacy|media-resize|travel-description-image|address-image|travel-image|gallery|media)\//, '')
  return path
}

export async function loadAssetDescriptor(out: string, hash: string): Promise<BookMediaChunk> {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('SNAPSHOT_ASSET_INVALID')
  return readBoundedJson<BookMediaChunk>(resolve(out, 'assets', `${hash}.json`))
}
