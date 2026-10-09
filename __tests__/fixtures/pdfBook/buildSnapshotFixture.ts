import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  BOOK_RENDERER_VERSION,
  BOOK_SNAPSHOT_TEXT_CHARACTERS,
} from '@/types/bookDocument'
import type { BookDocument, BookSnapshotChunk, BookTextField } from '@/types/bookDocument'
import { DEFAULT_BOOK_SETTINGS, toBookSettingsDto } from '@/types/bookSettings'
import type { BookSettings, BookSettingsLocale } from '@/types/bookSettings'

const FIXTURE_ID = '91b4a743-a987-45dc-8119-502a29c4ef10'
const FIXTURE_CLOCK = '2026-10-09T12:00:00.000Z'
const TEXT_FIELDS: BookTextField[] = ['description', 'plus', 'minus', 'recommendation']
const RESOURCE_KEY = 'uploads/fixture-shared.png'
export const SNAPSHOT_FIXTURE_IMAGE_SRC = `/media/${RESOURCE_KEY}`
// Synthetic 1x1 PNG bytes for protocol tests, never published article media.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWOYNm3afwAGSgLC3tfsoQAAAABJRU5ErkJggg==',
  'base64',
)

/** Independent implementation of B1 ensure_ascii=False/sorted-keys JSON. */
export function fixtureCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fixtureCanonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${fixtureCanonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

interface FixtureSourceRow {
  kind: BookSnapshotChunk['kind']
  key: string
  bytes: Buffer
  metadata: BookSnapshotChunk['metadata']
}

function sourceRows(travel: SnapshotFixtureTravel, durableWindow?: number): FixtureSourceRow[] {
  const rows: FixtureSourceRow[] = []
  const record = (kind: FixtureSourceRow['kind'], key: string, metadata: Record<string, unknown>) => {
    rows.push({ kind, key, bytes: Buffer.from(fixtureCanonicalJson(metadata)), metadata: metadata as unknown as FixtureSourceRow['metadata'] })
  }
  record('travel', `travel:${travel.id}`, {
    id: travel.id, name: travel.title, slug: `snapshot-fixture-${travel.id}`, year: 2012,
    image: travel.cover === false ? '' : RESOURCE_KEY, created_at: FIXTURE_CLOCK,
    number_days: 2, number_peoples: 1, budget: 100, youtube_link: '',
  })
  for (const field of TEXT_FIELDS) {
    const characters = Array.from(travel[field] ?? '')
    for (let start = 0; start < characters.length || durableWindow; ) {
      const canonical = Math.floor(start / BOOK_SNAPSHOT_TEXT_CHARACTERS) * BOOK_SNAPSHOT_TEXT_CHARACTERS
      const window = Math.min(durableWindow ?? BOOK_SNAPSHOT_TEXT_CHARACTERS, BOOK_SNAPSHOT_TEXT_CHARACTERS - (start - canonical))
      const part = characters.slice(start, start + window)
      rows.push({ kind: 'text', key: `${field}:${start + 1}`,
        bytes: Buffer.from(part.join('')),
        metadata: { field, offset: start + 1, ...(durableWindow ? { canonical_key: `${field}:${canonical + 1}`, field_end: part.length < window } : {}) } })
      start += window
      if (part.length < window) break
    }
  }
  record('country', 'country:1', { country_id: 1, title_ru: 'Беларусь', title_en: 'Belarus', country_code: 'BY' })
  for (let index = 0; index < (travel.photos ?? 0); index++) {
    record('gallery', `gallery:${index + 1}`, { id: index + 1, image: RESOURCE_KEY,
      caption: travel.captions?.[index] ?? `Pinned caption ${index + 1}`, file_name: 'fixture.png', mime_type: 'image/png', order: index })
  }
  for (let index = 0; index < (travel.points ?? 0); index++) {
    record('route', `route:${index + 1}`, { id: index + 1, address: `Pinned route point ${index + 1}`, country_id: 1,
      lat: '53.9000000', lng: '27.5600000', coord: '53.9,27.56', image: '', image_detail: '', image_landscape: '' })
    record('route-category', `route:${index + 1}:category:2`, { id: 2, name: 'Pinned route category', route_id: index + 1 })
  }
  record('author', 'author:1', { id: 1, name: 'Fixture author' })
  return rows
}

export interface SnapshotFixtureTravel {
  id: number
  title: string
  description?: string
  plus?: string
  minus?: string
  recommendation?: string
  photos?: number
  captions?: string[]
  points?: number
  cover?: boolean
}

export interface SnapshotFixtureOptions {
  travels: SnapshotFixtureTravel[]
  settings?: Partial<BookSettings>
  locale?: BookSettingsLocale
  seed?: string
  durableTextWindow?: number
}

export interface SnapshotFixture {
  jobDir: string
  document: BookDocument
  manifest: BookSnapshotChunk[]
  expected: {
    travel_ids: number[]
    text_by_field: Record<number, Partial<Record<BookTextField, string>>>
    media_occurrence_keys: string[]
    unique_media_hashes: string[]
  }
}

/** Writes a real B1-shaped private source; only test fixtures are collected here. */
export async function buildSnapshotFixture(jobDir: string, options: SnapshotFixtureOptions): Promise<SnapshotFixture> {
  const root = path.resolve(__dirname, '../../..')
  const scratch = path.join(root, '.codex-temp', 'tests') + path.sep
  if (!path.resolve(jobDir).startsWith(scratch)) throw new Error('Snapshot fixtures belong in ignored .codex-temp/tests/')
  const namespace = options.durableTextWindow ? `${FIXTURE_ID}/attempt-1` : FIXTURE_ID
  await mkdir(path.join(jobDir, namespace), { recursive: true, mode: 0o700 })
  const settings = toBookSettingsDto({ ...DEFAULT_BOOK_SETTINGS, ...options.settings }, options.locale ?? 'RU')
  const settingsHash = sha256(fixtureCanonicalJson(settings))
  const sources = options.travels.map((travel) => {
    const rows = sourceRows(travel, options.durableTextWindow)
    const revision = createHash('sha256')
    for (const row of rows) revision.update(fixtureCanonicalJson([row.kind, row.key, row.bytes.length])).update(row.bytes)
    return { travel, rows, revision: revision.digest('hex') }
  })
  const selection = createHash('sha256')
  sources.forEach((source, index) => selection.update(fixtureCanonicalJson([index, source.travel.id, source.revision])))
  const selectionHash = selection.digest('hex')
  const entitlement = { premium: true, policy_version: 1 }
  const snapshotHash = createHash('sha256')
  snapshotHash.update(fixtureCanonicalJson([2, 1, selectionHash, settingsHash, entitlement]))
  const manifest: BookSnapshotChunk[] = []
  const expected: SnapshotFixture['expected'] = {
    travel_ids: options.travels.map((travel) => travel.id),
    text_by_field: {},
    media_occurrence_keys: [],
    unique_media_hashes: [],
  }

  const emit = async (
    kind: BookSnapshotChunk['kind'],
    sourceKey: string,
    bytes: Buffer,
    metadata: BookSnapshotChunk['metadata'],
    travelId: number | null,
    occurrenceKey = '',
  ): Promise<void> => {
    const checksum = sha256(bytes)
    const fileRef = `${namespace}/${checksum}`
    await writeFile(path.join(jobDir, fileRef), bytes, { mode: 0o600 })
    const chunk = {
      position: manifest.length, travel_id: travelId, kind, source_key: sourceKey,
      occurrence_key: occurrenceKey, file_ref: fileRef, checksum, size_bytes: bytes.length,
      metadata: kind === 'media' ? { ...metadata, version: checksum } : metadata,
    } as BookSnapshotChunk
    snapshotHash.update(fixtureCanonicalJson([
      chunk.position, travelId, kind, sourceKey, occurrenceKey, checksum, bytes.length, chunk.metadata,
    ]))
    manifest.push(chunk)
    if (kind === 'media') {
      expected.media_occurrence_keys.push(occurrenceKey)
      if (!expected.unique_media_hashes.includes(checksum)) expected.unique_media_hashes.push(checksum)
    }
  }

  for (const { travel, rows, revision } of sources) {
    let occurrence = 0
    const image = async (role: string): Promise<void> => {
      occurrence++
      await emit('media', `${role}:${occurrence}`, PNG_BYTES, {
        role, resource_key: RESOURCE_KEY, version: sha256(PNG_BYTES),
      }, travel.id, `${travel.id}:${role}:${occurrence}`)
    }
    const first = rows[0]
    await emit(first.kind, first.key, first.bytes, { ...first.metadata, travel_revision: revision }, travel.id)
    if (travel.cover !== false) await image('cover')
    expected.text_by_field[travel.id] = {}
    for (const field of TEXT_FIELDS) {
      const html = travel[field] ?? ''
      expected.text_by_field[travel.id][field] = html
      // B1 emits inline media after the text window in which an img tag closes.
      const imageEndOffsets = [...html.matchAll(/<img\b[^>]*>/gi)]
        .map((match) => Array.from(html.slice(0, match.index + match[0].length)).length)
      let imageIndex = 0
      for (const row of rows.filter((candidate) => candidate.kind === 'text' && 'field' in candidate.metadata && candidate.metadata.field === field)) {
        const offset = 'offset' in row.metadata ? row.metadata.offset : 1
        await emit(row.kind, row.key, row.bytes, row.metadata, travel.id)
        while (imageIndex < imageEndOffsets.length && imageEndOffsets[imageIndex] < offset + Array.from(row.bytes.toString('utf8')).length) {
          await image('inline')
          imageIndex++
        }
      }
    }
    for (const row of rows.filter((candidate) => candidate.kind !== 'travel' && candidate.kind !== 'text')) {
      await emit(row.kind, row.key, row.bytes, row.metadata, travel.id)
      if (row.kind === 'gallery') await image('gallery')
    }
  }

  const document: BookDocument = {
    schema_version: 1, contract_version: 2, settings_version: 1, snapshot_id: FIXTURE_ID,
    snapshot_hash: snapshotHash.digest('hex'), selection_hash: selectionHash, settings_hash: settingsHash,
    renderer_version: BOOK_RENDERER_VERSION, seed: options.seed ?? 'fixture-pinned-seed',
    generated_at: FIXTURE_CLOCK, settings, entitlement,
  }
  await writeFile(path.join(jobDir, 'document.json'), fixtureCanonicalJson(document), { mode: 0o600 })
  await writeFile(path.join(jobDir, 'manifest.ndjson'), manifest.map((chunk) => `${fixtureCanonicalJson(chunk)}\n`).join(''), { mode: 0o600 })
  return { jobDir, document, manifest, expected }
}
