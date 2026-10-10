import { open } from 'node:fs/promises'
import { privatePath } from './filesystem'

const MAX_RECORD_CHARS = 65_536
const MAX_CARRY_BYTES = MAX_RECORD_CHARS * 4
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const CURSOR_KEYS = ['version', 'file_ref', 'file_size', 'offset', 'records', 'carry_base64']

/** Store this bounded state in a checksummed private checkpoint, not the DB cursor. */
export interface RecordCursor {
  version: 1
  file_ref: string
  file_size: number
  offset: number
  records: number
  carry_base64: string
}

export interface RecordWindow<T> {
  rows: T[]
  cursor: RecordCursor
  done: boolean
  read_bytes: number
}

function validInteger(value: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum && !Object.is(value, -0)
}

function restore(value: unknown, ref: string, size: number): { cursor: RecordCursor; carry: Buffer } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WORKER_RECORD_CURSOR_INVALID')
  const keys = Object.keys(value)
  if (keys.length !== CURSOR_KEYS.length || keys.some(key => !CURSOR_KEYS.includes(key))) throw new Error('WORKER_RECORD_CURSOR_INVALID')
  const cursor = value as RecordCursor
  if (cursor.version !== 1 || cursor.file_ref !== ref || cursor.file_size !== size || !validInteger(cursor.file_size) ||
      !validInteger(cursor.offset, size) || !validInteger(cursor.records) ||
      typeof cursor.carry_base64 !== 'string' || cursor.carry_base64.length > Math.ceil(MAX_CARRY_BYTES / 3) * 4) {
    throw new Error('WORKER_RECORD_CURSOR_INVALID')
  }
  const carry = Buffer.from(cursor.carry_base64, 'base64')
  if (carry.length > MAX_CARRY_BYTES || carry.length > cursor.offset ||
      cursor.records > cursor.offset - carry.length || carry.toString('base64') !== cursor.carry_base64) {
    throw new Error('WORKER_RECORD_CURSOR_INVALID')
  }
  return { cursor: { version: 1, file_ref: ref, file_size: size, offset: cursor.offset,
    records: cursor.records, carry_base64: cursor.carry_base64 }, carry }
}

/** Pull bounded NDJSON bytes at a durable byte offset; never replay the file prefix. */
export async function readRecordWindow<T>(
  root: string,
  ref: string,
  previous?: RecordCursor,
  limits: { bytes?: number; records?: number } = {},
): Promise<RecordWindow<T>> {
  const bytes = limits.bytes ?? 65_536
  const records = limits.records ?? 100
  if (!validInteger(bytes, 65_536) || bytes < 1 || !validInteger(records, 100) || records < 1) {
    throw new Error('WORKER_READ_BUDGET_INVALID')
  }
  const file = await privatePath(root, ref)
  const handle = await open(file, 'r')
  try {
    const info = await handle.stat()
    if (!info.isFile() || !validInteger(info.size)) throw new Error('WORKER_SOURCE_INVALID')
    const initial: RecordCursor = {
      version: 1, file_ref: ref, file_size: info.size, offset: 0, records: 0, carry_base64: '',
    }
    const restored = restore(previous === undefined ? initial : previous, ref, info.size)
    const cursor = restored.cursor
    let carry = restored.carry
    let offset = cursor.offset
    let used = 0
    const rows: T[] = []
    const parse = (line: Buffer) => {
      const value = decoder.decode(line)
      if (value.length > MAX_RECORD_CHARS) throw new Error('WORKER_RECORD_BUDGET_EXCEEDED')
      if (value.trim()) rows.push(JSON.parse(value) as T)
    }
    // Parsing buffered lines also consumes the row budget, including empty lines.
    let consumed = 0
    while (consumed < records) {
      const newline = carry.indexOf(10)
      if (newline >= 0) {
        parse(carry.subarray(0, newline))
        carry = carry.subarray(newline + 1)
        consumed++
        continue
      }
      if (offset === info.size) {
        if (carry.length) { parse(carry); consumed++; carry = Buffer.alloc(0) }
        break
      }
      if (used === bytes) break
      const available = MAX_CARRY_BYTES - carry.length
      if (!available) throw new Error('WORKER_RECORD_BUDGET_EXCEEDED')
      const chunk = Buffer.alloc(Math.min(bytes - used, info.size - offset, available))
      const result = await handle.read(chunk, 0, chunk.length, offset)
      if (!result.bytesRead) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
      carry = Buffer.concat([carry, chunk.subarray(0, result.bytesRead)])
      offset += result.bytesRead
      used += result.bytesRead
    }
    if ((await handle.stat()).size !== info.size || !validInteger(cursor.records + consumed)) {
      throw new Error('SNAPSHOT_INTEGRITY_FAILED')
    }
    return {
      rows,
      cursor: { ...cursor, offset, records: cursor.records + consumed, carry_base64: carry.toString('base64') },
      done: offset === info.size && carry.length === 0,
      read_bytes: used,
    }
  } finally { await handle.close() }
}
