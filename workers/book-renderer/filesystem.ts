import { createReadStream } from 'node:fs'
import { lstat, mkdir, open, realpath, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { isAbsolute, resolve, relative, sep } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import type { BookDocument, BookSnapshotChunk } from '@/types/bookDocument'
import type { BookSnapshotReader } from '@/services/pdf-export/segments/snapshotAdapter'

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => item === undefined ? 'null' : canonicalJson(item)).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Reject long lines before readline/JSON parsing can allocate an unbounded record. */
export async function* jsonLines<T>(file: string, maxChars = 65_536): AsyncGenerator<T> {
  const decoder = new StringDecoder('utf8')
  let pending = ''
  try {
    for await (const bytes of createReadStream(file, { highWaterMark: 16_384 })) {
      pending += decoder.write(bytes)
      let newline: number
      while ((newline = pending.indexOf('\n')) >= 0) {
        if (newline > maxChars) throw new Error('WORKER_RECORD_BUDGET_EXCEEDED')
        const line = pending.slice(0, newline)
        pending = pending.slice(newline + 1)
        if (line.trim()) yield JSON.parse(line) as T
      }
      if (pending.length > maxChars) throw new Error('WORKER_RECORD_BUDGET_EXCEEDED')
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  pending += decoder.end()
  if (pending.length > maxChars) throw new Error('WORKER_RECORD_BUDGET_EXCEEDED')
  if (pending.trim()) yield JSON.parse(pending) as T
}

export async function appendRecord(file: string, value: unknown): Promise<void> {
  const handle = await open(file, 'a', 0o600)
  try { await handle.write(`${canonicalJson(value)}\n`) } finally { await handle.close() }
}

export async function readBoundedJson<T>(file: string, maxBytes = 65_536): Promise<T> {
  return JSON.parse((await readBoundedBytes(file, maxBytes)).toString('utf8')) as T
}

export async function readBoundedBytes(file: string, maxBytes = 65_536): Promise<Buffer> {
  const handle = await open(file, 'r')
  try {
    if (!(await handle.stat()).isFile()) throw new Error('WORKER_SOURCE_INVALID')
    const buffer = Buffer.alloc(maxBytes + 1)
    let size = 0
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size)
      if (!bytesRead) break
      size += bytesRead
    }
    if (size > maxBytes) throw new Error('WORKER_RECORD_BUDGET_EXCEEDED')
    return buffer.subarray(0, size)
  } finally { await handle.close() }
}

export async function privatePath(root: string, ref: string): Promise<string> {
  if (isAbsolute(ref) || ref.split(/[\\/]/).includes('..')) throw new Error('SNAPSHOT_PRIVATE_PATH_INVALID')
  const base = await realpath(root)
  const target = resolve(base, ref)
  const rel = relative(base, target)
  if (rel.startsWith(`..${sep}`) || rel === '..' || resolve(base, rel) === base) throw new Error('SNAPSHOT_PRIVATE_PATH_INVALID')
  let component = base
  for (const part of rel.split(sep)) {
    component = resolve(component, part)
    if ((await lstat(component)).isSymbolicLink()) throw new Error('SNAPSHOT_PRIVATE_PATH_INVALID')
  }
  return target
}

export async function verifyFile(root: string, chunk: BookSnapshotChunk): Promise<string> {
  const file = await privatePath(root, chunk.file_ref)
  const info = await stat(file)
  if (!info.isFile() || info.size !== chunk.size_bytes) throw new Error('SNAPSHOT_BYTES_UNAVAILABLE')
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(file, { highWaterMark: 65_536 })) hash.update(bytes)
  if (hash.digest('hex') !== chunk.checksum) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
  return file
}

/** B2/B3 must perform ACL verification before placing a private job envelope here. */
export function filesystemReader(root: string, pinned: BookDocument, readBytes = 65_536): BookSnapshotReader {
  if (!Number.isSafeInteger(readBytes) || readBytes < 1 || readBytes > 65_536) throw new Error('WORKER_READ_BUDGET_INVALID')
  const rows = jsonLines<BookSnapshotChunk>(resolve(root, 'manifest.ndjson'))[Symbol.asyncIterator]()
  let previous = -1
  let peek: IteratorResult<BookSnapshotChunk> | undefined
  return {
    async manifestPage({ after_position, limit }) {
      if (after_position !== previous) throw new Error('SNAPSHOT_CURSOR_INVALID')
      const chunks: BookSnapshotChunk[] = []
      while (chunks.length < limit) {
        const next = peek || await rows.next()
        peek = undefined
        if (next.done) break
        chunks.push(next.value)
      }
      peek = await rows.next()
      previous = chunks.at(-1)?.position ?? previous
      return { snapshot_id: pinned.snapshot_id, snapshot_hash: pinned.snapshot_hash,
        selection_hash: pinned.selection_hash, settings_hash: pinned.settings_hash,
        chunks, has_more: !peek.done, next_position: previous }
    },
    async verifyChunk(chunk) { await verifyFile(root, chunk) },
    async *readChunk(chunk) {
      const file = await privatePath(root, chunk.file_ref)
      for await (const bytes of createReadStream(file, { highWaterMark: readBytes })) yield bytes
    },
  }
}

export async function makePrivateDirectory(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 })
}
