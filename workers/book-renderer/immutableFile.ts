import { constants } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { link, lstat, open, realpath, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { isUint8Array } from 'node:util/types'
import { sha256 } from './filesystem'

const errno = (error: unknown, code: string): boolean => !!error && typeof error === 'object' && 'code' in error && error.code === code
function invalid(): never { throw new Error('WORKER_IMMUTABLE_PATH_INVALID') }

async function destination(root: string, ref: string): Promise<string> {
  if (!ref || isAbsolute(ref) || ref.includes('\\') || ref.split('/').some(part => !part || part === '.' || part === '..')) return invalid()
  const base = resolve(root)
  if (await realpath(root) !== base) return invalid()
  let directory = base
  const parts = ref.split('/')
  for (let index = 0; index < parts.length; index++) {
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o700) return invalid()
    if (index < parts.length - 1) directory = resolve(directory, parts[index])
  }
  const target = resolve(base, ref)
  if (!target.startsWith(`${base}${sep}`)) return invalid()
  // Existing leaves, including dangling symlinks, must fail before any temporary write.
  try {
    const info = await lstat(target)
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o600) return invalid()
  } catch (error) { if (!errno(error, 'ENOENT')) throw error }
  return target
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const info = await handle.stat()
    if (!info.isDirectory() || (info.mode & 0o777) !== 0o700) return invalid()
    await handle.sync()
  } finally { await handle.close() }
}

async function verifyExisting(path: string, expected: { checksum: string; size_bytes: number }, maximum: number): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const info = await handle.stat()
    if (!info.isFile() || (info.mode & 0o777) !== 0o600) return invalid()
    if (info.size !== expected.size_bytes || info.size > maximum) throw new Error('WORKER_IMMUTABLE_INTEGRITY_FAILED')
    const hash = createHash('sha256')
    const chunk = Buffer.alloc(Math.min(65_536, info.size + 1))
    let offset = 0
    // One extra byte detects an existing file that grows while being verified.
    while (offset <= info.size) {
      const length = Math.min(chunk.length, info.size + 1 - offset)
      if (!length) break
      const { bytesRead } = await handle.read(chunk, 0, length, offset)
      if (!bytesRead) break
      offset += bytesRead
      if (offset > info.size) throw new Error('WORKER_IMMUTABLE_INTEGRITY_FAILED')
      hash.update(chunk.subarray(0, bytesRead))
    }
    const after = await handle.stat()
    if (offset !== info.size || after.size !== info.size || hash.digest('hex') !== expected.checksum) throw new Error('WORKER_IMMUTABLE_INTEGRITY_FAILED')
  } finally { await handle.close() }
}

/** Publish exact immutable bytes; a failed write can never leave a partial canonical leaf. */
export async function publishImmutableFile(
  root: string, ref: string, payload: string | Uint8Array, maximum: number,
): Promise<{ checksum: string; size_bytes: number }> {
  if (!Number.isSafeInteger(maximum) || maximum < 0 || (typeof payload !== 'string' && !isUint8Array(payload))) throw new Error('WORKER_IMMUTABLE_BUDGET_INVALID')
  const length = typeof payload === 'string' ? Buffer.byteLength(payload) : payload.byteLength
  if (length > maximum) throw new Error('WORKER_IMMUTABLE_BYTE_LIMIT')
  // The print working-set ledger already owns the encoded binary; retain a view,
  // not another full-size allocation. Strings require their one UTF8 conversion.
  const bytes = typeof payload === 'string' ? Buffer.from(payload) : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength)
  const expected = { checksum: sha256(bytes), size_bytes: bytes.length }
  const target = await destination(root, ref)
  const directory = dirname(target)
  const temporary = resolve(directory, `.pending-${randomBytes(12).toString('hex')}`)
  let created = false
  try {
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    created = true
    try {
      const info = await handle.stat()
      if (!info.isFile() || (info.mode & 0o777) !== 0o600) return invalid()
      await handle.writeFile(bytes)
      await handle.sync()
    } finally { await handle.close() }
    // A caller-owned binary may change during awaited IO. Verify the fsynced private
    // temporary bytes against the original digest before exposing a canonical name.
    await verifyExisting(temporary, expected, maximum)
    try { await link(temporary, target) }
    catch (error) {
      if (!errno(error, 'EEXIST')) throw error
      await verifyExisting(target, expected, maximum)
    }
    await syncDirectory(directory)
    return expected
  } finally {
    if (created) { await unlink(temporary); await syncDirectory(directory) }
  }
}
