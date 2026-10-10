import { randomBytes } from 'node:crypto'
import { link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { canonicalJson, privatePath, readBoundedBytes, sha256 } from './filesystem'
import type { PlanningFile, PlanningLimits } from './planningTypes'

const MAX_INDEX_BYTES = 524_288
/** B3 resolves committed receipts by indexed job/ref lookup; the filesystem is not commit authority. */
export type CommittedPlanningLookup = (ref: string) => Promise<PlanningFile | null>

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
  private reservedRecords = 0
  private reservedBytes = 0
  private readonly admitted = new Map<string, PlanningFile>()
  constructor(readonly root: string, private readonly limits: PlanningLimits, private readonly committed?: CommittedPlanningLookup) {}

  get hasCommittedAuthority(): boolean { return !!this.committed }

  async receipt(ref: string): Promise<PlanningFile | null> {
    const file = this.admitted.get(ref) ?? await this.committed?.(ref) ?? null
    if (file && file.ref !== ref) throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    return file
  }

  async readByRef(ref: string, checksum: string, maximum: number): Promise<Buffer> {
    const trusted = this.admitted.get(ref) ?? await this.committed?.(ref)
    if (!trusted || trusted.ref !== ref || trusted.checksum !== checksum) throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    return this.read(trusted, maximum)
  }

  /** Checkpoint-nested hashes are integrity witnesses, never commit authority. */
  async read(file: PlanningFile, maximum: number): Promise<Buffer> {
    if (this.committed) {
      const trusted = this.admitted.get(file.ref) ?? await this.committed(file.ref)
      if (!trusted || trusted.ref !== file.ref || trusted.checksum !== file.checksum || trusted.size_bytes !== file.size_bytes) {
        throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
      }
    }
    return readPlanningFile(this.root, file, maximum)
  }

  get remainingRecords(): number { return this.limits.output_records - this.outputs.length - this.reservedRecords }
  get remainingBytes(): number { return this.limits.output_bytes - this.bytes - this.reservedBytes }

  /** Leave room for the generation ledger and checkpoint before starting work. */
  reserve(records: number, bytes: number): void {
    this.admit(records, bytes)
    this.reservedRecords += records
    this.reservedBytes += bytes
  }

  releaseReservation(): void { this.reservedRecords = 0; this.reservedBytes = 0 }

  admit(records: number, bytes: number): void {
    if (!Number.isSafeInteger(records) || records < 0 || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('WORKER_PLANNING_OUTPUT_BUDGET_INVALID')
    if (records > this.remainingRecords || bytes > this.remainingBytes) {
      const error = new Error('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED') as Error & { required_budget: { output_records: number; output_bytes: number } }
      error.required_budget = { output_records: records + this.outputs.length + this.reservedRecords,
        output_bytes: bytes + this.bytes + this.reservedBytes }
      throw error
    }
  }

  /** Synchronous receipt admission for the private parser's fsynced files. */
  recordExternalReceipt(file: PlanningFile): void {
    if (!file || typeof file.ref !== 'string' || !file.ref || isAbsolute(file.ref) || file.ref.includes('\\') ||
        file.ref.split('/').some(part => !part || part === '..' || part === '.') || !/^[a-f0-9]{64}$/.test(file.checksum) ||
        !Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0) throw new Error('WORKER_PLANNING_REFERENCE_INVALID')
    const prior = this.admitted.get(file.ref)
    if (prior) {
      if (prior.checksum !== file.checksum || prior.size_bytes !== file.size_bytes) throw new Error('WORKER_PLANNING_IMMUTABLE_CONFLICT')
      return
    }
    this.admit(1, file.size_bytes)
    const admitted = { ref: file.ref, checksum: file.checksum, size_bytes: file.size_bytes }
    this.bytes += file.size_bytes
    this.outputs.push(admitted)
    this.admitted.set(file.ref, admitted)
  }

  async put(ref: string, value: unknown, maximum = MAX_INDEX_BYTES): Promise<PlanningFile> {
    const bytes = Buffer.from(canonicalJson(value))
    if (bytes.length > maximum) {
      throw new Error('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    }
    const file = { ref, checksum: sha256(bytes), size_bytes: bytes.length }
    const prior = this.admitted.get(ref)
    if (!prior) this.admit(1, bytes.length)
    else if (prior.checksum !== file.checksum || prior.size_bytes !== file.size_bytes) throw new Error('WORKER_PLANNING_IMMUTABLE_CONFLICT')
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
    this.recordExternalReceipt(file)
    return file
  }

  async readIndex<T>(ref: string): Promise<T | undefined> {
    const candidate = this.admitted.get(ref)
    if (candidate) return JSON.parse((await readPlanningFile(this.root, candidate, MAX_INDEX_BYTES)).toString('utf8')) as T
    if (this.committed) {
      const file = await this.committed(ref)
      if (file === null) return undefined
      if (file.ref !== ref) throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
      return JSON.parse((await readPlanningFile(this.root, file, MAX_INDEX_BYTES)).toString('utf8')) as T
    }
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
