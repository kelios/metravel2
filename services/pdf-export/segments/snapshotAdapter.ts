import {
  BOOK_DOCUMENT_SCHEMA_VERSION,
  BOOK_RENDERER_VERSION,
  BOOK_SNAPSHOT_MANIFEST_PAGE_SIZE,
  BOOK_SNAPSHOT_READ_BYTES,
  BOOK_SNAPSHOT_TEXT_CHARACTERS,
} from '@/types/bookDocument'
import type {
  BookDocument,
  BookPlanEntry,
  BookSnapshotChunk,
  BookSnapshotManifestPage,
  BookTextChunk,
  BookTextField,
} from '@/types/bookDocument'

export type BookSnapshotErrorCode =
  | 'SNAPSHOT_CONTRACT_INVALID'
  | 'SNAPSHOT_INTEGRITY_FAILED'
  | 'SNAPSHOT_RESOURCE_BUDGET_EXCEEDED'

/** Stable internal codes: callers map them to their localized lifecycle feedback. */
export class BookSnapshotContractError extends Error {
  constructor(public readonly code: BookSnapshotErrorCode, detail: string) {
    super(detail)
    this.name = 'BookSnapshotContractError'
  }
}

export interface BookSnapshotReader {
  manifestPage(request: { after_position: number; limit: number }): Promise<unknown>
  /** Verify checksum/size and access before exposing bytes, as B1 read_chunk does. */
  verifyChunk(chunk: BookSnapshotChunk): Promise<void>
  readChunk(chunk: BookSnapshotChunk): AsyncIterable<Uint8Array>
}

export interface BookSnapshotReadOptions {
  page_size?: number
  /** Per source-record budget; original media is streamed to the bounded decoder. */
  max_source_chunk_bytes?: number
}

const SHA256 = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const KINDS = new Set<BookSnapshotChunk['kind']>([
  'travel', 'text', 'media', 'gallery', 'route', 'route-category', 'country',
  'month', 'category', 'transport', 'overnight', 'author',
])
const TEXT_FIELDS = new Set<BookTextField>(['description', 'plus', 'minus', 'recommendation'])
const MEDIA_ROLES = new Set(['cover', 'inline', 'gallery', 'route-image', 'route-image_detail', 'route-image_landscape', 'book-cover'])

function fail(code: BookSnapshotErrorCode, detail: string): never {
  throw new BookSnapshotContractError(code, detail)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function hash(value: unknown): value is string {
  return typeof value === 'string' && SHA256.test(value)
}

function validateSourceMetadata(kind: string, metadata: Record<string, unknown>): void {
  const string = (value: unknown) => typeof value === 'string'
  const nullableString = (value: unknown) => value === null || string(value)
  const nullableInteger = (value: unknown) => value === null || (typeof value === 'number' && Number.isSafeInteger(value))
  const coordinate = (value: unknown) => value === null || string(value) || (typeof value === 'number' && Number.isFinite(value))
  let valid = true
  switch (kind) {
    case 'travel':
      valid = isInteger(metadata.id, 1) && nullableString(metadata.name) && string(metadata.slug) &&
        nullableInteger(metadata.year) && nullableString(metadata.image) && nullableString(metadata.created_at) &&
        nullableInteger(metadata.number_days) && nullableInteger(metadata.number_peoples) &&
        nullableInteger(metadata.budget) && nullableString(metadata.youtube_link)
      break
    case 'gallery':
      valid = isInteger(metadata.id, 1) && string(metadata.image) && string(metadata.caption) &&
        string(metadata.file_name) && nullableString(metadata.mime_type) && isInteger(metadata.order, 0)
      break
    case 'route':
      valid = isInteger(metadata.id, 1) && string(metadata.address) && isInteger(metadata.country_id, 1) &&
        coordinate(metadata.lat) && coordinate(metadata.lng) && string(metadata.coord) &&
        ['image', 'image_detail', 'image_landscape'].every((field) => nullableString(metadata[field]))
      break
    case 'route-category':
      valid = isInteger(metadata.id, 1) && nullableString(metadata.name) && isInteger(metadata.route_id, 1)
      break
    case 'country':
      valid = isInteger(metadata.country_id, 1) &&
        ['title_ru', 'title_en', 'country_code'].every((field) => nullableString(metadata[field]))
      break
    case 'author':
      valid = isInteger(metadata.id, 1) && string(metadata.name)
      break
    case 'month':
    case 'category':
    case 'transport':
    case 'overnight':
      valid = isInteger(metadata.id, 1) && nullableString(metadata.name)
      break
  }
  if (!valid) fail('SNAPSHOT_CONTRACT_INVALID', 'Invalid pinned source-record metadata.')
}

function sourceBudget(options: BookSnapshotReadOptions): number {
  const value = options.max_source_chunk_bytes ?? BOOK_SNAPSHOT_READ_BYTES
  if (!isInteger(value, 1)) fail('SNAPSHOT_CONTRACT_INVALID', 'Invalid source-record byte budget.')
  return value
}

export function assertBookDocument(header: BookDocument): void {
  if (
    header.schema_version !== BOOK_DOCUMENT_SCHEMA_VERSION || header.contract_version !== 2 ||
    header.settings_version !== 1 || !UUID.test(header.snapshot_id) ||
    !hash(header.snapshot_hash) || !hash(header.selection_hash) || !hash(header.settings_hash) ||
    header.renderer_version !== BOOK_RENDERER_VERSION || !nonempty(header.seed) ||
    typeof header.generated_at !== 'string' || !ISO_DATE.test(header.generated_at) ||
    !Number.isFinite(Date.parse(header.generated_at))
  ) fail('SNAPSHOT_CONTRACT_INVALID', 'Invalid or unsupported pinned document header.')
}

function validateChunk(value: unknown, snapshotId: string, maxBytes: number): BookSnapshotChunk {
  if (
    !isRecord(value) || !isInteger(value.position, 0) ||
    !(value.travel_id === null || isInteger(value.travel_id, 1)) ||
    !nonempty(value.source_key) || typeof value.occurrence_key !== 'string' ||
    !hash(value.checksum) || !isInteger(value.size_bytes, 0) ||
    typeof value.kind !== 'string' || !KINDS.has(value.kind as BookSnapshotChunk['kind']) ||
    !isRecord(value.metadata)
  ) fail('SNAPSHOT_CONTRACT_INVALID', 'Invalid snapshot source reference.')
  if (value.file_ref !== `${snapshotId}/${value.checksum}` &&
    !(typeof value.file_ref === 'string' && new RegExp(`^${snapshotId}/attempt-[1-9][0-9]*/${value.checksum}$`).test(value.file_ref))) {
    fail('SNAPSHOT_INTEGRITY_FAILED', 'Private source reference does not match its pinned checksum.')
  }
  if (value.kind !== 'media' && value.size_bytes > maxBytes) {
    fail('SNAPSHOT_RESOURCE_BUDGET_EXCEEDED', 'Source record exceeds the reader byte budget.')
  }
  if (value.kind !== 'media' && value.travel_id === null) {
    fail('SNAPSHOT_CONTRACT_INVALID', 'Source record is missing its travel identity.')
  }
  if (value.kind === 'text') {
    if (
      typeof value.metadata.field !== 'string' || !TEXT_FIELDS.has(value.metadata.field as BookTextField) ||
      !isInteger(value.metadata.offset, 1) ||
      value.source_key !== `${value.metadata.field}:${value.metadata.offset}` ||
      value.size_bytes > BOOK_SNAPSHOT_READ_BYTES
    ) fail('SNAPSHOT_CONTRACT_INVALID', 'Invalid bounded text-window reference.')
    if (value.metadata.canonical_key !== undefined && (
      value.metadata.canonical_key !== `${value.metadata.field}:${Math.floor((Number(value.metadata.offset) - 1) / BOOK_SNAPSHOT_TEXT_CHARACTERS) * BOOK_SNAPSHOT_TEXT_CHARACTERS + 1}` ||
      typeof value.metadata.field_end !== 'boolean'
    )) fail('SNAPSHOT_CONTRACT_INVALID', 'Invalid durable text-window framing.')
  }
  if (value.kind === 'media') {
    if (
      !nonempty(value.occurrence_key) || !nonempty(value.metadata.role) || !MEDIA_ROLES.has(value.metadata.role) ||
      !nonempty(value.metadata.resource_key) || value.metadata.version !== value.checksum ||
      (value.metadata.linked_travel_id !== undefined && !isInteger(value.metadata.linked_travel_id, 1))
    ) fail('SNAPSHOT_INTEGRITY_FAILED', 'Invalid immutable media resource or placement identity.')
  }
  if (value.kind === 'travel' && (
    value.metadata.id !== value.travel_id || !hash(value.metadata.travel_revision)
  )) fail('SNAPSHOT_INTEGRITY_FAILED', 'Travel identity or pinned source revision is invalid.')
  validateSourceMetadata(value.kind, value.metadata)
  // Related-record metadata passes through intact. Render adapters interpret only
  // the fields they use; no untrusted mutable URL becomes a media resolver here.
  return value as unknown as BookSnapshotChunk
}

export function validateSnapshotChunk(value: unknown, header: BookDocument, maxBytes = BOOK_SNAPSHOT_READ_BYTES): BookSnapshotChunk {
  return validateChunk(value, header.snapshot_id, maxBytes)
}

function validatePage(
  value: unknown,
  header: BookDocument,
  after: number,
  pageSize: number,
  maxBytes: number,
): BookSnapshotManifestPage {
  if (
    !isRecord(value) || !Array.isArray(value.chunks) || typeof value.has_more !== 'boolean' ||
    !isInteger(value.next_position, -1)
  ) fail('SNAPSHOT_CONTRACT_INVALID', 'Invalid snapshot manifest page.')
  for (const field of ['snapshot_id', 'snapshot_hash', 'selection_hash', 'settings_hash'] as const) {
    if (value[field] !== header[field]) fail('SNAPSHOT_INTEGRITY_FAILED', 'Manifest changed its pinned document identity.')
  }
  if (value.chunks.length > pageSize) {
    fail('SNAPSHOT_RESOURCE_BUDGET_EXCEEDED', 'Manifest exceeds the requested page budget.')
  }
  // Validate the bounded page before yielding any of its references.
  let previous = after
  for (const item of value.chunks) {
    const chunk = validateChunk(item, header.snapshot_id, maxBytes)
    if (chunk.position !== previous + 1) {
      fail('SNAPSHOT_INTEGRITY_FAILED', 'Manifest source order is duplicated, missing or changed.')
    }
    previous = chunk.position
  }
  if (value.next_position !== previous || (value.has_more && value.chunks.length === 0)) {
    fail('SNAPSHOT_INTEGRITY_FAILED', 'Manifest cursor does not advance to its last source reference.')
  }
  return value as unknown as BookSnapshotManifestPage
}

/** Pull-driven, one-page-at-a-time traversal; server order is authoritative. */
export async function* iterateSnapshotChunks(
  header: BookDocument,
  reader: Pick<BookSnapshotReader, 'manifestPage'>,
  options: BookSnapshotReadOptions = {},
): AsyncGenerator<BookSnapshotChunk> {
  assertBookDocument(header)
  const pageSize = options.page_size ?? BOOK_SNAPSHOT_MANIFEST_PAGE_SIZE
  if (!isInteger(pageSize, 1) || pageSize > BOOK_SNAPSHOT_MANIFEST_PAGE_SIZE) {
    fail('SNAPSHOT_CONTRACT_INVALID', 'Manifest page size must be between 1 and 100.')
  }
  const maxBytes = sourceBudget(options)
  let after = -1
  while (true) {
    const page = validatePage(await reader.manifestPage({ after_position: after, limit: pageSize }), header, after, pageSize, maxBytes)
    for (const chunk of page.chunks) yield chunk
    if (!page.has_more) return
    after = page.next_position
  }
}

/** Bounded field references; no whole-field string/tree is assembled here. */
export async function* iterateTextFieldRefs(
  source: AsyncIterable<BookSnapshotChunk>,
  travelId: number,
  field: BookTextField,
): AsyncGenerator<BookTextChunk> {
  let nextOffset = 1
  for await (const chunk of source) {
    if (chunk.kind !== 'text' || chunk.travel_id !== travelId || chunk.metadata.field !== field) continue
    if (chunk.metadata.canonical_key ? chunk.metadata.offset < nextOffset : chunk.metadata.offset !== nextOffset) {
      fail('SNAPSHOT_INTEGRITY_FAILED', 'Text windows are missing, duplicated or reordered.')
    }
    nextOffset = chunk.metadata.canonical_key ? chunk.metadata.offset + 1 : nextOffset + BOOK_SNAPSHOT_TEXT_CHARACTERS
    yield chunk
  }
}

/** The port checks checksum/access first; byte accounting remains enforced here. */
export async function* streamSnapshotChunk(
  reader: Pick<BookSnapshotReader, 'verifyChunk' | 'readChunk'>,
  chunk: BookSnapshotChunk,
): AsyncGenerator<Uint8Array> {
  await reader.verifyChunk(chunk)
  let bytesRead = 0
  for await (const part of reader.readChunk(chunk)) {
    if (!(part instanceof Uint8Array) || part.byteLength > BOOK_SNAPSHOT_READ_BYTES) {
      fail('SNAPSHOT_RESOURCE_BUDGET_EXCEEDED', 'Snapshot read part exceeds the bounded byte budget.')
    }
    if (part.byteLength === 0) fail('SNAPSHOT_CONTRACT_INVALID', 'Snapshot reader returned an empty part.')
    bytesRead += part.byteLength
    if (bytesRead > chunk.size_bytes) fail('SNAPSHOT_INTEGRITY_FAILED', 'Snapshot source exceeds its pinned byte length.')
    yield part
  }
  if (bytesRead !== chunk.size_bytes) fail('SNAPSHOT_INTEGRITY_FAILED', 'Snapshot source ended before its pinned byte length.')
}

export function toBookPlanEntry(chunk: BookSnapshotChunk): BookPlanEntry {
  return {
    block_key: `${chunk.position}:${chunk.source_key}`,
    travel_id: chunk.travel_id ?? 'book',
    type: chunk.kind,
    source_ref: chunk.file_ref,
    order: chunk.position,
    ...(chunk.kind === 'media' ? {
      resource_key: chunk.metadata.resource_key,
      occurrence_key: chunk.occurrence_key,
    } : {}),
  }
}
