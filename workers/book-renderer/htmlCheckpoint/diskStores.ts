import type { TagStore } from '@/workers/book-renderer/htmlCheckpoint/tagStackStore'
import { createHash, randomBytes } from 'node:crypto'
import { closeSync, constants, fsyncSync, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { ContextNode, ContextStore } from '@/workers/book-renderer/htmlCheckpoint/contextStore'
import { SOURCE_BLOCK_CHARS, type TextStore } from '@/workers/book-renderer/htmlCheckpoint/sourceText'
import { integer, object, text } from '@/workers/book-renderer/htmlCheckpoint/state'

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')
const blockSha256 = (value: string): string => createHash('sha256').update(Buffer.from(value, 'utf16le')).digest('hex')
function privateDirectory(path: string, create = false): string {
  if (create) {
    try { mkdirSync(path, {mode: 0o700}) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  }
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700 || realpathSync(path) !== resolve(path)) throw new Error('HTML_CHECKPOINT_DIRECTORY_INVALID')
  return resolve(path)
}
function syncDirectory(path: string): void {
  const handle = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try { fsyncSync(handle) } finally { closeSync(handle) }
}
export function readPrivateCheckpointFile(path: string, maximum: number): string {
  const handle = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = fstatSync(handle)
    if (!stat.isFile() || stat.size > maximum || (stat.mode & 0o777) !== 0o600) throw new Error('HTML_CHECKPOINT_FILE_INVALID')
    const buffer = Buffer.alloc(stat.size + 1); let length = 0
    while (length < buffer.length) {
      const count = readSync(handle, buffer, length, buffer.length - length, null)
      if (!count) break
      length += count
    }
    if (length !== stat.size || length > maximum) throw new Error('HTML_CHECKPOINT_FILE_INVALID')
    const bytes = buffer.subarray(0, length); const decoded = bytes.toString('utf8')
    if (!Buffer.from(decoded, 'utf8').equals(bytes)) throw new Error('HTML_CHECKPOINT_ENCODING_INVALID')
    return decoded
  } finally { closeSync(handle) }
}
function immutable(path: string, value: string, maximum: number): boolean {
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`
  let created = false; let published = false
  try {
    writeFileSync(temporary, value, {flag: 'wx', mode: 0o600}); created = true
    const handle = openSync(temporary, constants.O_RDONLY | constants.O_NOFOLLOW)
    try { fsyncSync(handle) } finally { closeSync(handle) }
    try { linkSync(temporary, path); published = true } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || readPrivateCheckpointFile(path, maximum) !== value) throw error
    }
  } finally {
    if (created) { unlinkSync(temporary); syncDirectory(dirname(path)) }
  }
  return published
}

/** Caller supplies an existing canonical epoch-private0700 root and binds outputs to its snapshot. */
export interface CheckpointStoreReceipt {ref: string; checksum: string; size_bytes: number; created: boolean}
export function createDiskCheckpointStores(root: string, options: {onwrite?: (file: CheckpointStoreReceipt) => void; onread?: (file: Omit<CheckpointStoreReceipt, 'created'>) => void; readonly?: boolean} = {}): {context: ContextStore; text: TextStore; tags: TagStore} {
  const base = privateDirectory(root)
  privateDirectory(join(base, 'contexts'), !options.readonly); privateDirectory(join(base, 'text'), !options.readonly)
  privateDirectory(join(base, 'stack'), !options.readonly)
  if (!options.readonly) syncDirectory(base)
  const publish = (ref: string, encoded: string, maximum: number): void => {
    if (options.readonly) throw new Error('HTML_CHECKPOINT_STORE_READONLY')
    if (Buffer.byteLength(encoded) > maximum) throw new Error('HTML_CHECKPOINT_OUTPUT_LIMIT')
    const created = immutable(join(base, ref), encoded, maximum)
    options.onwrite?.({ref, checksum: sha256(encoded), size_bytes: Buffer.byteLength(encoded), created})
  }
  const load = (ref: string, maximum: number): string => {
    const encoded = readPrivateCheckpointFile(join(base, ref), maximum)
    options.onread?.({ref, checksum: sha256(encoded), size_bytes: Buffer.byteLength(encoded)})
    return encoded
  }
  return {
    tags: {
      put(node): string {
        const encoded = JSON.stringify({name: node.name, next: node.next, count: node.count})
        const hash = sha256(encoded); publish(`stack/${hash}.json`, encoded, 6291712); return hash
      },
      get(hash): unknown {
        if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('HTML_CHECKPOINT_STACK_REF_INVALID')
        const encoded = load(`stack/${hash}.json`, 6291712)
        if (sha256(encoded) !== hash) throw new Error('HTML_CHECKPOINT_STACK_HASH_MISMATCH')
        return JSON.parse(encoded) as unknown
      },
    },
    context: {
      put(node: ContextNode): string {
        const encoded = JSON.stringify({value: node.value, next: node.next, count: node.count})
        const hash = sha256(encoded); publish(`contexts/${hash}.json`, encoded, 256)
        return hash
      },
      get(hash: string): unknown {
        if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('HTML_CHECKPOINT_CONTEXT_REF_INVALID')
        const encoded = load(`contexts/${hash}.json`, 256)
        if (sha256(encoded) !== hash) throw new Error('HTML_CHECKPOINT_CONTEXT_HASH_MISMATCH')
        return JSON.parse(encoded) as unknown
      },
    },
    text: {
      put(ordinal: number, block: string): void {
        integer(ordinal); text(block, SOURCE_BLOCK_CHARS)
        if (block.length !== SOURCE_BLOCK_CHARS) throw new Error('HTML_CHECKPOINT_BLOCK_INVALID')
        const encoded = JSON.stringify({ordinal, text: block, sha256: blockSha256(block)})
        publish(`text/${ordinal}.json`, encoded, 8192)
      },
      get(ordinal: number): string {
        integer(ordinal)
        const state = object(JSON.parse(load(`text/${ordinal}.json`, 8192)) as unknown, ['ordinal', 'text', 'sha256'])
        const block = text(state.text, SOURCE_BLOCK_CHARS)
        if (state.ordinal !== ordinal || block.length !== SOURCE_BLOCK_CHARS || state.sha256 !== blockSha256(block)) throw new Error('HTML_CHECKPOINT_BLOCK_HASH_MISMATCH')
        return block
      },
    },
  }
}
