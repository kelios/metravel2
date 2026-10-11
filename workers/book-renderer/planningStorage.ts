import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { link, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
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

/** fsync one already-published leaf or directory without following a symlink. */
async function syncPath(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try { await handle.sync() } finally { await handle.close() }
}

/** Uncommitted bytes have no authority: replace any crash debris atomically, never verify it in place. */
async function replaceUncommittedLeaf(target: string, bytes: Uint8Array): Promise<void> {
  const temporary = resolve(dirname(target), `.pending-${randomBytes(12).toString('hex')}`)
  const handle = await open(temporary, 'wx', 0o600)
  try {
    try { await handle.writeFile(bytes) } finally { await handle.close() }
    await rename(temporary, target)
  } catch (error) { await unlink(temporary).catch(() => undefined); throw error }
}

export interface PlanningStorageOptions {
  /**
   * Generation durability barrier (#2384). Writes are not fsynced one by one; `flush()` at the
   * commit point fsyncs every output and every directory on its path before the step returns,
   * i.e. before B3 can commit a receipt. Requires committed authority: only receipts the B3
   * index confirms are verified in place, every other existing leaf is replaced.
   */
  deferred_durability?: boolean
}
export interface PlanningStorageMark { outputs: number; bytes: number }

/** Complete bytes become visible atomically; retries verify an existing immutable value. */
export class PlanningStorage {
  readonly outputs: PlanningFile[] = []
  private bytes = 0
  private reservedRecords = 0
  private reservedBytes = 0
  private readonly admitted = new Map<string, PlanningFile>()
  readonly deferredDurability: boolean
  constructor(readonly root: string, private readonly limits: PlanningLimits, private readonly committed?: CommittedPlanningLookup, options: PlanningStorageOptions = {}) {
    if (options.deferred_durability && !committed) throw new Error('WORKER_PLANNING_COMMITTED_LOOKUP_REQUIRED')
    this.deferredDurability = !!options.deferred_durability
  }

  get hasCommittedAuthority(): boolean { return !!this.committed }

  /** Receipt already admitted into this candidate generation, if any (synchronous, no B3 lookup). */
  admittedReceipt(ref: string): PlanningFile | undefined { return this.admitted.get(ref) }

  /** Position before one transition; `rollback` drops that transition's receipts from the candidate. */
  mark(): PlanningStorageMark { return { outputs: this.outputs.length, bytes: this.bytes } }

  /** Rolled-back leaves stay on disk as uncommitted debris; a later generation replaces or re-admits them. */
  rollback(mark: PlanningStorageMark): void {
    if (mark.outputs > this.outputs.length || mark.bytes > this.bytes) throw new Error('WORKER_PLANNING_OUTPUT_BUDGET_INVALID')
    for (const file of this.outputs.splice(mark.outputs)) this.admitted.delete(file.ref)
    this.bytes = mark.bytes
  }

  /** Commit-point barrier: file data first, then every directory between a leaf and the plan root. */
  async flush(): Promise<void> {
    if (!this.deferredDurability) return
    const base = await realpath(this.root)
    const directories = new Set<string>([base])
    for (const file of this.outputs) {
      const path = resolve(base, file.ref)
      if (!path.startsWith(`${base}${sep}`)) throw new Error('WORKER_PLANNING_PATH_INVALID')
      await syncPath(path)
      for (let directory = dirname(path); directory.startsWith(`${base}${sep}`); directory = dirname(directory)) directories.add(directory)
    }
    // Deepest first: a directory entry is synced only after its own entries.
    for (const directory of [...directories].sort((a, b) => b.length - a.length)) await syncPath(directory)
  }

  async receipt(ref: string): Promise<PlanningFile | null> {
    const file = this.admitted.get(ref) ?? await this.committed?.(ref) ?? null
    if (file && file.ref !== ref) throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    return file
  }

  async readByRef(ref: string, checksum: string, maximum: number): Promise<Buffer> {
    const trusted = this.admitted.get(ref) ?? await this.committed?.(ref)
    if (!trusted || trusted.ref !== ref || trusted.checksum !== checksum) throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    // `trusted` is already the authority receipt; read() would repeat the same lookup.
    return readPlanningFile(this.root, trusted, maximum)
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
    if (this.deferredDurability) {
      if (!prior) await this.putDeferred(file, bytes, maximum)
      this.recordExternalReceipt(file)
      return file
    }
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

  /** A committed leaf is durable and verified in place; anything else is (re)written for this generation's barrier. */
  private async putDeferred(file: PlanningFile, bytes: Buffer, maximum: number): Promise<void> {
    const trusted = await this.committed!(file.ref)
    if (trusted) {
      if (trusted.ref !== file.ref || trusted.checksum !== file.checksum || trusted.size_bytes !== file.size_bytes) throw new Error('WORKER_PLANNING_IMMUTABLE_CONFLICT')
      await readPlanningFile(this.root, file, maximum)
      return
    }
    await replaceUncommittedLeaf(await destination(this.root, file.ref), bytes)
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
