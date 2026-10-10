import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

/** Synthetic RGBA fixtures exercise native alpha tiles; they are never editorial media. */
export function printFixturePng(singleAlpha: boolean, rotated = false, orientation = 6): Buffer {
  const width = 2501, height = 2
  const crc32 = (bytes: Buffer) => {
    let value = 0xffffffff
    for (const byte of bytes) {
      value ^= byte
      for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1
    }
    return (value ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, bytes: Buffer) => {
    const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4)
    size.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])))
    return Buffer.concat([size, name, bytes, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  const pixels = Buffer.alloc(height * (1 + width * 4))
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const offset = row * (1 + width * 4) + 1 + column * 4
    pixels[offset] = column % 251; pixels[offset + 1] = 80; pixels[offset + 2] = 160
    pixels[offset + 3] = singleAlpha && row === 1 && column === 2400 ? 0 : 255
  }
  const exif = Buffer.from('4d4d002a00000008000101120003000000010006000000000000', 'hex')
  exif.writeUInt16BE(orientation, 18)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    ...(rotated ? [chunk('eXIf', exif)] : []), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}

/** Existing placeholder bytes plus fixed EXIF6 metadata; no browser/encoder needed to build the fixture. */
async function rotatedWebpFixture(root: string, orientation = 6): Promise<Buffer> {
  const original = await readFile(path.join(root, 'assets/no-data.webp'))
  if (sha256(original) !== '712415eb90b04c42c97526dd8daefd7a3c5049e72c76d1d761b249e7944cacf6') throw new Error('PRINT_FIXTURE_BYTES_CHANGED')
  const vp8x = Buffer.alloc(18)
  vp8x.write('VP8X'); vp8x.writeUInt32LE(10, 4); vp8x[8] = 0x08
  vp8x.writeUIntLE(299, 12, 3); vp8x.writeUIntLE(199, 15, 3)
  const exif = Buffer.from('4d4d002a00000008000101120003000000010006000000000000', 'hex')
  exif.writeUInt16BE(orientation, 18)
  const exifHeader = Buffer.alloc(8); exifHeader.write('EXIF'); exifHeader.writeUInt32LE(exif.length, 4)
  const body = Buffer.concat([Buffer.from('WEBP'), vp8x, original.subarray(12), exifHeader, exif])
  const header = Buffer.alloc(8); header.write('RIFF'); header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

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
    record('route', `route:${index + 1}`, { id: index + 1, address: travel.routeAddresses?.[index] ?? `Pinned route point ${index + 1}`, country_id: 1,
      lat: '53.9000000', lng: '27.5600000', coord: travel.routeCoordinates?.[index] ?? '53.9,27.56', image: travel.routeThumbnails ? RESOURCE_KEY : '', image_detail: '', image_landscape: '' })
    record('route-category', `route:${index + 1}:category:2`, { id: 2, name: travel.routeCategories?.[index] ?? 'Pinned route category', route_id: index + 1 })
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
  routeAddresses?: string[]
  routeCategories?: string[]
  routeCoordinates?: string[]
  routeThumbnails?: boolean
  cover?: boolean
}

export interface SnapshotFixtureOptions {
  travels: SnapshotFixtureTravel[]
  settings?: Partial<BookSettings>
  locale?: BookSettingsLocale
  seed?: string
  durableTextWindow?: number
  mediaFixture?: 'opaque-rgba' | 'single-alpha' | 'rotated-png' | 'rotated-webp'
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
    print_orientation_by_checksum: Record<string, { original_orientation: number; raw_width: number; raw_height: number; normalized_decode_checksum: string; normalized_decode_bytes: number; normalization_working_bytes: number }>
    print_media?: { source_has_alpha: boolean; served_mime: 'image/jpeg' | 'image/png'; oriented_width?: number; oriented_height?: number }
  }
}

/** Writes a real B1-shaped private source; only test fixtures are collected here. */
export async function buildSnapshotFixture(jobDir: string, options: SnapshotFixtureOptions): Promise<SnapshotFixture> {
  const root = path.resolve(__dirname, '../../..')
  const scratch = path.join(root, '.codex-temp', 'tests') + path.sep
  if (!path.resolve(jobDir).startsWith(scratch)) throw new Error('Snapshot fixtures belong in ignored .codex-temp/tests/')
  const mediaBytes = options.mediaFixture === 'rotated-webp' ? await rotatedWebpFixture(root)
    : options.mediaFixture ? printFixturePng(options.mediaFixture === 'single-alpha', options.mediaFixture === 'rotated-png') : PNG_BYTES
  const rotated = options.mediaFixture === 'rotated-png' || options.mediaFixture === 'rotated-webp'
  const neutralBytes = options.mediaFixture === 'rotated-webp' ? await rotatedWebpFixture(root, 1)
    : options.mediaFixture === 'rotated-png' ? printFixturePng(false, true, 1) : mediaBytes
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
    print_orientation_by_checksum: { [sha256(mediaBytes)]: { original_orientation: rotated ? 6 : 1,
      raw_width: options.mediaFixture === 'rotated-webp' ? 300 : options.mediaFixture ? 2501 : 1,
      raw_height: options.mediaFixture === 'rotated-webp' ? 200 : options.mediaFixture ? 2 : 1,
      normalized_decode_checksum: sha256(neutralBytes), normalized_decode_bytes: neutralBytes.length, normalization_working_bytes: rotated ? neutralBytes.length : 0 } },
    ...(options.mediaFixture ? { print_media: { source_has_alpha: options.mediaFixture === 'single-alpha', served_mime: options.mediaFixture === 'single-alpha' ? 'image/png' as const : 'image/jpeg' as const,
      ...(options.mediaFixture === 'rotated-png' ? { oriented_width: 2, oriented_height: 2501 } : options.mediaFixture === 'rotated-webp' ? { oriented_width: 200, oriented_height: 300 } : {}) } } : {}),
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
      await emit('media', `${role}:${occurrence}`, mediaBytes, {
        role, resource_key: RESOURCE_KEY, version: sha256(mediaBytes),
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
      if (row.kind === 'route' && 'image' in row.metadata && row.metadata.image) await image('route-image')
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
