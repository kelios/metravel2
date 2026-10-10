import { open } from 'node:fs/promises'
import type { BookDocument, BookSnapshotChunk, BookTextField } from '@/types/bookDocument'
import { validateSnapshotChunk } from '@/services/pdf-export/segments/snapshotAdapter'
import { privatePath } from './filesystem'
import { CheckpointSha256, type Sha256CheckpointV1 } from './checkpointHash'
import type { PlanningStorage } from './planningStorage'

export interface FieldSourceCursor {
  version: 1
  row: number
  byte_offset: number
  utf8_carry_base64: string
  row_characters: number
  row_hash: Sha256CheckpointV1
  next_character_offset: number
  durable: boolean
  ended: boolean
}

const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const CURSOR_KEYS = ['version', 'row', 'byte_offset', 'utf8_carry_base64', 'row_characters', 'row_hash', 'next_character_offset', 'durable', 'ended']

export function initialFieldSource(): FieldSourceCursor {
  return { version: 1, row: 0, byte_offset: 0, utf8_carry_base64: '', row_characters: 0, row_hash: new CheckpointSha256().snapshot(), next_character_offset: 1, durable: false, ended: false }
}

export function restoreFieldSource(value: unknown, total: number): FieldSourceCursor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WORKER_TEXT_CURSOR_INVALID')
  const cursor = value as FieldSourceCursor
  if (Object.keys(cursor).length !== CURSOR_KEYS.length || Object.keys(cursor).some(key => !CURSOR_KEYS.includes(key)) || cursor.version !== 1 ||
      !Number.isSafeInteger(total) || total < 0 || typeof cursor.durable !== 'boolean' || typeof cursor.ended !== 'boolean') throw new Error('WORKER_TEXT_CURSOR_INVALID')
  for (const [key, maximum, minimum] of [['row', total, 0], ['byte_offset', 65_536, 0], ['row_characters', 16_384, 0], ['next_character_offset', Number.MAX_SAFE_INTEGER, 1]] as const) {
    const count = cursor[key]
    if (!Number.isSafeInteger(count) || count < minimum || count > maximum || Object.is(count, -0)) throw new Error('WORKER_TEXT_CURSOR_INVALID')
  }
  if (typeof cursor.utf8_carry_base64 !== 'string' || cursor.utf8_carry_base64.length > 4) throw new Error('WORKER_TEXT_CURSOR_INVALID')
  const carry = Buffer.from(cursor.utf8_carry_base64, 'base64')
  if (carry.length > 3 || carry.length > cursor.byte_offset || carry.toString('base64') !== cursor.utf8_carry_base64 ||
      (cursor.row === total && (carry.length || cursor.byte_offset || cursor.row_characters))) throw new Error('WORKER_TEXT_CURSOR_INVALID')
  if (new CheckpointSha256(cursor.row_hash).snapshot().total_bytes !== cursor.byte_offset) throw new Error('WORKER_TEXT_CURSOR_INVALID')
  return { ...cursor }
}

/** Only a valid incomplete final UTF8 code point may cross a feed boundary. */
function decodeFeed(bytes: Buffer): { text: string; carry: Buffer } {
  let carryBytes = 0
  if (bytes.length) {
    let start = bytes.length - 1
    while (start >= Math.max(0, bytes.length - 3) && (bytes[start] & 0xc0) === 0x80) start--
    if (start >= 0) {
      const lead = bytes[start]
      const width = lead >= 0xc2 && lead <= 0xdf ? 2 : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 0
      if (width && bytes.length - start < width) {
        for (let at = start + 1; at < bytes.length; at++) if ((bytes[at] & 0xc0) !== 0x80) throw new Error('SNAPSHOT_TEXT_UTF8_INVALID')
        carryBytes = bytes.length - start
      }
    }
  }
  try { return { text: UTF8.decode(bytes.subarray(0, bytes.length - carryBytes)), carry: bytes.subarray(bytes.length - carryBytes) } }
  catch { throw new Error('SNAPSHOT_TEXT_UTF8_INVALID') }
}

export async function readIndexedSource(storage: PlanningStorage, pinned: BookDocument, ref: string, committedSources: number, travelId: number, kind: BookSnapshotChunk['kind']): Promise<BookSnapshotChunk> {
  const chunk = validateSnapshotChunk(await storage.readIndex<unknown>(ref), pinned)
  if (chunk.position >= committedSources || chunk.travel_id !== travelId || chunk.kind !== kind) throw new Error('WORKER_PLANNING_PREFIX_MISMATCH')
  return chunk
}

/** One <=255-byte feed leaves room for a restored UTF8 code point in the <=256 UTF16 parser port. */
export async function readFieldSourceFeed(
  jobRoot: string, storage: PlanningStorage, pinned: BookDocument, committedSources: number, travelId: number, field: BookTextField,
  totalRows: number, previous: unknown = initialFieldSource(), inputBudget = 255,
): Promise<{ text: string; cursor: FieldSourceCursor; eof: boolean; read_bytes: number }> {
  if (!Number.isSafeInteger(inputBudget) || inputBudget < 1 || inputBudget > 65_536) throw new Error('WORKER_READ_BUDGET_INVALID')
  const cursor = restoreFieldSource(previous, totalRows)
  if (cursor.row === totalRows) {
    if (cursor.durable && !cursor.ended) throw new Error('SNAPSHOT_TEXT_FIELD_INCOMPLETE')
    return { text: '', cursor, eof: true, read_bytes: 0 }
  }
  if (cursor.ended) throw new Error('SNAPSHOT_TEXT_WINDOW_ORDER_MISMATCH')
  const chunk = await readIndexedSource(storage, pinned, `index/travel/${travelId}/fields/${field}/${cursor.row}.json`, committedSources, travelId, 'text')
  if (chunk.kind !== 'text' || chunk.metadata.field !== field || chunk.metadata.offset !== cursor.next_character_offset || cursor.byte_offset > chunk.size_bytes) throw new Error('SNAPSHOT_TEXT_WINDOW_ORDER_MISMATCH')
  const path = await privatePath(jobRoot, chunk.file_ref)
  const handle = await open(path, 'r')
  let used = 0
  let decoded: { text: string; carry: Buffer }
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size !== chunk.size_bytes) throw new Error('SNAPSHOT_BYTES_UNAVAILABLE')
    const bytes = Buffer.alloc(Math.min(inputBudget, 255, info.size - cursor.byte_offset))
    if (bytes.length) {
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, cursor.byte_offset)
      if (!bytesRead) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
      used = bytesRead
    }
    decoded = decodeFeed(Buffer.concat([Buffer.from(cursor.utf8_carry_base64, 'base64'), bytes.subarray(0, used)]))
    const hash = new CheckpointSha256(cursor.row_hash)
    hash.update(bytes.subarray(0, used)); cursor.row_hash = hash.snapshot()
    if ((await handle.stat()).size !== info.size) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
  } finally { await handle.close() }
  cursor.byte_offset += used
  cursor.utf8_carry_base64 = decoded.carry.toString('base64')
  cursor.row_characters += Array.from(decoded.text).length
  const room = chunk.metadata.canonical_key ? 16_384 - ((chunk.metadata.offset - 1) % 16_384) : 16_384
  if (cursor.row_characters > room || decoded.text.length > 256) throw new Error('SNAPSHOT_TEXT_WINDOW_BUDGET_EXCEEDED')
  if (cursor.byte_offset === chunk.size_bytes) {
    if (decoded.carry.length) throw new Error('SNAPSHOT_TEXT_UTF8_INVALID')
    if (new CheckpointSha256(cursor.row_hash).digestHex() !== chunk.checksum) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
    cursor.next_character_offset += cursor.row_characters
    if (!Number.isSafeInteger(cursor.next_character_offset)) throw new Error('WORKER_PLANNING_COUNTER_OVERFLOW')
    cursor.row++; cursor.byte_offset = 0; cursor.row_characters = 0
    cursor.row_hash = new CheckpointSha256().snapshot()
    cursor.durable ||= chunk.metadata.canonical_key !== undefined
    cursor.ended = chunk.metadata.field_end === true
    if (cursor.ended && cursor.row !== totalRows) throw new Error('SNAPSHOT_TEXT_WINDOW_ORDER_MISMATCH')
  }
  const eof = cursor.row === totalRows
  if (eof && cursor.durable && !cursor.ended) throw new Error('SNAPSHOT_TEXT_FIELD_INCOMPLETE')
  return { text: decoded.text, cursor, eof, read_bytes: used }
}
