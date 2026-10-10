import { randomBytes } from 'node:crypto'
import { link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { canonicalJson, privatePath, readBoundedBytes, sha256 } from './filesystem'
import type { PlanningFile, PlanningLimits } from './planningTypes'

const MAX_INDEX_BYTES = 524_288

async function destination(root: string, ref: string): Promise<string> {
  if (typeof ref !== 'string' || !ref || isAbsolute(ref) || ref.includes('\\') || ref.split('/').some(part => !part || part === '..' || part === '.')) {
    throw new Error('WORKER_PLANNING_PATH_INVALID')
  }
  const base = await realpath(root)
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || (rootInfo.mode & 0o077)) throw new Error('WORKER_PLANNING_DIRECTORY_INVALID')
  let directory = base
  for (const part of ref.split('/').slice(0, -1)) {
    directory = resolve(directory, part)
    try { await mkdir(directory, { mode: 0o700 }) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error('WORKER_PLANNING_DIRECTORY_INVALID')
  }
  const target = resolve(base, ref)
  if (!target.startsWith(`${base}${sep}`)) throw new Error('WORKER_PLANNING_PATH_INVALID')
  return target
}

export async function readPlanningFile(root: string, file: PlanningFile, maximum: number): Promise<Buffer> {
  if (!file || typeof file.ref !== 'string' || !/^[a-f0-9]{64}$/.test(file.checksum) ||
      !Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0 || file.size_bytes > maximum) throw new Error('WORKER_PLANNING_REFERENCE_INVALID')
  const path = await privatePath(root, file.ref)
  const info = await lstat(path)
  if (!info.isFile() || (info.mode & 0o077)) throw new Error('WORKER_PLANNING_FILE_INVALID')
  const bytes = await readBoundedBytes(path, maximum)
  if (bytes.length !== file.size_bytes || sha256(bytes) !== file.checksum) throw new Error('WORKER_PLANNING_CHECKSUM_MISMATCH')
  return bytes
}

/** Complete bytes become visible atomically; retries verify an existing immutable value. */
export class PlanningStorage {
  readonly outputs: PlanningFile[] = []
  private bytes = 0
  constructor(readonly root: string, private readonly limits: PlanningLimits) {}

  async put(ref: string, value: unknown, maximum = MAX_INDEX_BYTES): Promise<PlanningFile> {
    const bytes = Buffer.from(canonicalJson(value))
    if (bytes.length > maximum || this.bytes + bytes.length > this.limits.output_bytes || this.outputs.length >= this.limits.output_records) {
      throw new Error('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    }
    const file = { ref, checksum: sha256(bytes), size_bytes: bytes.length }
    const target = await destination(this.root, ref)
    const temporary = resolve(dirname(target), `.pending-${randomBytes(12).toString('hex')}`)
    let created = false
    try {
      const handle = await open(temporary, 'wx', 0o600)
      created = true
      try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
      try { await link(temporary, target) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        const existing = await readPlanningFile(this.root, file, maximum)
        if (!existing.equals(bytes)) throw new Error('WORKER_PLANNING_IMMUTABLE_CONFLICT')
      }
      const directory = await open(dirname(target), 'r')
      try { await directory.sync() } finally { await directory.close() }
    } finally { if (created) await unlink(temporary) }
    this.bytes += bytes.length
    this.outputs.push(file)
    return file
  }

  async readIndex<T>(ref: string): Promise<T | undefined> {
    let path: string
    try { path = await privatePath(this.root, ref) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
    const info = await lstat(path)
    if (!info.isFile() || (info.mode & 0o077)) throw new Error('WORKER_PLANNING_FILE_INVALID')
    return JSON.parse((await readBoundedBytes(path, MAX_INDEX_BYTES)).toString('utf8')) as T
  }
}
