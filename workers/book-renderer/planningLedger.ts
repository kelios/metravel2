import { canonicalJson, sha256 } from './filesystem'
import { PlanningStorage, readPlanningFile } from './planningStorage'
import { ASSET_BUDGET } from './measurement'
import type { PlanningFile } from './planningTypes'

export const MAX_GENERATION_LEDGER_BYTES = 65_536
/** The largest planning output is one canonical encoded print resource. */
export const MAX_PLANNING_OUTPUT_FILE_BYTES = ASSET_BUDGET.bytes
export interface PlanningGenerationLedger {
  version: 1
  identity: string
  generation: number
  previous: PlanningFile | null
  outputs: PlanningFile[]
}

function file(value: unknown): PlanningFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WORKER_PLANNING_LEDGER_INVALID')
  const item = value as PlanningFile
  if (Object.keys(item).length !== 3 || Object.keys(item).some(key => !['ref', 'checksum', 'size_bytes'].includes(key)) ||
      typeof item.ref !== 'string' || !item.ref || item.ref.startsWith('/') || item.ref.includes('\\') ||
      item.ref.split('/').some(part => !part || part === '.' || part === '..') ||
      !/^[a-f0-9]{64}$/.test(item.checksum) || !Number.isSafeInteger(item.size_bytes) || item.size_bytes < 0 || item.size_bytes > MAX_PLANNING_OUTPUT_FILE_BYTES) {
    throw new Error('WORKER_PLANNING_LEDGER_INVALID')
  }
  return { ref: item.ref, checksum: item.checksum, size_bytes: item.size_bytes }
}

/** The caller supplies a B2-committed checkpoint; this does not authenticate arbitrary heads. */
export async function readGenerationLedger(root: string, head: PlanningFile, identity: string, generation: number): Promise<PlanningGenerationLedger> {
  const pointer = file(head)
  if (pointer.ref !== `ledgers/${pointer.checksum}.json`) throw new Error('WORKER_PLANNING_LEDGER_INVALID')
  const ledger = JSON.parse((await readPlanningFile(root, pointer, MAX_GENERATION_LEDGER_BYTES)).toString('utf8')) as PlanningGenerationLedger
  if (!ledger || Array.isArray(ledger) || typeof ledger !== 'object' || Object.keys(ledger).length !== 5 ||
      Object.keys(ledger).some(key => !['version', 'identity', 'generation', 'previous', 'outputs'].includes(key)) ||
      ledger.version !== 1 || ledger.identity !== identity || ledger.generation !== generation ||
      !Number.isSafeInteger(generation) || generation < 1 || !Array.isArray(ledger.outputs) || ledger.outputs.length > 126) {
    throw new Error('WORKER_PLANNING_LEDGER_INVALID')
  }
  const previous = ledger.previous === null ? null : file(ledger.previous)
  if ((generation === 1) !== (previous === null) || (previous && previous.ref !== `ledgers/${previous.checksum}.json`)) throw new Error('WORKER_PLANNING_LEDGER_INVALID')
  const outputs = ledger.outputs.map(file)
  if (new Set(outputs.map(item => item.ref)).size !== outputs.length || outputs.some(item => /^(?:checkpoints|ledgers)\//.test(item.ref))) {
    throw new Error('WORKER_PLANNING_LEDGER_INVALID')
  }
  return { version: 1, identity, generation, previous, outputs }
}

/** A candidate generation binds every output before its final checkpoint is published. */
export async function sealGenerationLedger(storage: PlanningStorage, identity: string, generation: number, previous: PlanningFile | null): Promise<PlanningFile> {
  if (!/^[a-f0-9]{64}$/.test(identity) || !Number.isSafeInteger(generation) || generation < 1 ||
      (generation === 1) !== (previous === null)) throw new Error('WORKER_PLANNING_LEDGER_INVALID')
  const ledger: PlanningGenerationLedger = { version: 1, identity, generation, previous, outputs: storage.outputs.map(file) }
  const encoded = canonicalJson(ledger)
  return storage.put(`ledgers/${sha256(encoded)}.json`, ledger, MAX_GENERATION_LEDGER_BYTES)
}
