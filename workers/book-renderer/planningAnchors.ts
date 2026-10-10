import { lstatSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { BookTextField } from '@/types/bookDocument'
import type { SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import { canonicalJson, privatePath, sha256 } from './filesystem'
import { extractAnchorTargets } from './planner'
import type { PlanningStorage } from './planningStorage'
import { readPlanningFile } from './planningStorage'
import type { PlanningFile } from './planningTypes'
import { readPrivateCheckpointFile } from './htmlCheckpoint/diskStores'

const FIELD = '(?:description|plus|minus|recommendation)'
const SCOPE = new RegExp(`^fields/[1-9][0-9]*/${FIELD}/anchors$`)
interface AnchorTargetsFile { fragment: number; targets: string[] }
interface AnchorValue { target: string; ordinal: number; first_fragment: number }
export interface AnchorLedgerState {
  version: 1
  scope: string
  fragments: number
  anchors: number
  pending?: { file: PlanningFile; fragment: number; total: number; ordinal: number }
}
function count(value: number): boolean { return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) }
function validTarget(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[#?]/.test(value) }

export function initialAnchorLedger(travelId: number, field: BookTextField): AnchorLedgerState {
  const scope = `fields/${travelId}/${field}/anchors`
  if (!SCOPE.test(scope) || !Number.isSafeInteger(travelId)) throw new Error('WORKER_ANCHOR_SCOPE_INVALID')
  return { version: 1, scope, fragments: 0, anchors: 0 }
}

export function restoreAnchorLedger(value: AnchorLedgerState): AnchorLedgerState {
  if (!value || value.version !== 1 || typeof value.scope !== 'string' || !SCOPE.test(value.scope) || !count(value.fragments) || !count(value.anchors) ||
      Object.keys(value).some(key => !['version', 'scope', 'fragments', 'anchors', 'pending'].includes(key))) throw new Error('WORKER_ANCHOR_CURSOR_INVALID')
  if (value.pending) {
    const pending = value.pending
    if (!pending.file || !count(pending.fragment) || pending.fragment !== value.fragments || !count(pending.total) || pending.total < 1 || pending.total > BOOK_SEGMENT_LIMITS.content_chars ||
        !count(pending.ordinal) || pending.ordinal >= pending.total || pending.file.ref !== `${value.scope}/targets/${pending.fragment}.json` ||
        Object.keys(pending).length !== 4 || Object.keys(pending).some(key => !['file', 'fragment', 'total', 'ordinal'].includes(key))) throw new Error('WORKER_ANCHOR_CURSOR_INVALID')
  }
  return { ...value, ...(value.pending ? { pending: { ...value.pending } } : {}) }
}

/** Discovery is bounded by one canonical fragment; target publication is a separate cursor. */
export async function beginAnchorFragment(storage: PlanningStorage, previous: AnchorLedgerState, fragment: Pick<SafeContentFragment, 'index' | 'html'>): Promise<AnchorLedgerState> {
  const state = restoreAnchorLedger(previous)
  if (state.pending || !fragment || fragment.index !== state.fragments || typeof fragment.html !== 'string' ||
      fragment.html.length > BOOK_SEGMENT_LIMITS.content_chars) throw new Error('WORKER_ANCHOR_FRAGMENT_INVALID')
  const targets = extractAnchorTargets(fragment.html)
  if (targets.some(target => !validTarget(target)) || targets.reduce((total, target) => total + target.length, 0) > BOOK_SEGMENT_LIMITS.content_chars) throw new Error('WORKER_ANCHOR_BUDGET_EXCEEDED')
  if (!targets.length) {
    if (!count(state.fragments + 1)) throw new Error('WORKER_PLANNING_COUNTER_OVERFLOW')
    state.fragments++
    return state
  }
  const file = await storage.put(`${state.scope}/targets/${fragment.index}.json`, { fragment: fragment.index, targets }, 262_144)
  state.pending = { file, fragment: fragment.index, total: targets.length, ordinal: 0 }
  return state
}

/** At most one deduplicated target and its numbered value are committed per call. */
export async function advanceAnchorTarget(storage: PlanningStorage, previous: AnchorLedgerState): Promise<AnchorLedgerState> {
  const state = restoreAnchorLedger(previous)
  if (!state.pending) throw new Error('WORKER_ANCHOR_PENDING_REQUIRED')
  const pending = state.pending
  const file = JSON.parse((await storage.read(pending.file, 262_144)).toString('utf8')) as AnchorTargetsFile
  if (!file || file.fragment !== pending.fragment || !Array.isArray(file.targets) || file.targets.length !== pending.total ||
      file.targets.some(target => !validTarget(target)) || file.targets.reduce((total, target) => total + target.length, 0) > BOOK_SEGMENT_LIMITS.content_chars) {
    throw new Error('WORKER_ANCHOR_TARGETS_INVALID')
  }
  const target = file.targets[pending.ordinal]
  const seen = `${state.scope}/seen/${sha256(target)}.json`
  const existing = await storage.readIndex<AnchorValue>(seen)
  if (existing && (existing.target !== target || !count(existing.ordinal) || existing.ordinal < 1 || existing.ordinal > state.anchors + 1 ||
      !count(existing.first_fragment) || existing.first_fragment > pending.fragment ||
      (existing.ordinal === state.anchors + 1 && existing.first_fragment !== pending.fragment))) throw new Error('WORKER_ANCHOR_MEMBERSHIP_CONFLICT')
  if (!existing || existing.ordinal === state.anchors + 1) {
    const ordinal = state.anchors + 1
    if (!count(ordinal)) throw new Error('WORKER_PLANNING_COUNTER_OVERFLOW')
    const value: AnchorValue = { target, ordinal, first_fragment: pending.fragment }
    await storage.put(seen, value, 32_768)
    await storage.put(`${state.scope}/values/${ordinal}.json`, value, 32_768)
    state.anchors = ordinal
  } else {
    const numbered = await storage.readIndex<AnchorValue>(`${state.scope}/values/${existing.ordinal}.json`)
    if (!numbered || canonicalJson(numbered) !== canonicalJson(existing)) throw new Error('WORKER_ANCHOR_MEMBERSHIP_CONFLICT')
  }
  pending.ordinal++
  if (pending.ordinal === pending.total) {
    if (!count(state.fragments + 1)) throw new Error('WORKER_PLANNING_COUNTER_OVERFLOW')
    state.fragments++
    delete state.pending
  }
  return state
}

export async function sealAnchorLedger(storage: PlanningStorage, previous: AnchorLedgerState, proof: { parser_done: boolean; produced_fragments: number }): Promise<PlanningFile> {
  const state = restoreAnchorLedger(previous)
  if (state.pending || proof.parser_done !== true || proof.produced_fragments !== state.fragments) throw new Error('WORKER_ANCHOR_SEAL_PREMATURE')
  return storage.put(`${state.scope}/complete.json`, { version: 1, scope: state.scope, anchors: state.anchors, fragments: state.fragments })
}

export async function sealedAnchorResolver(storage: PlanningStorage | string, file: PlanningFile,
  committed?: (ref: string) => PlanningFile | null): Promise<{ policy: string; resolve: (ordinal: number) => string | undefined }> {
  const root = typeof storage === 'string' ? storage : storage.root
  if (typeof storage !== 'string' && storage.hasCommittedAuthority && !committed) throw new Error('WORKER_PLANNING_COMMITTED_LOOKUP_REQUIRED')
  const state = JSON.parse((await (typeof storage === 'string' ? readPlanningFile(root, file, 4096) : storage.read(file, 4096))).toString('utf8')) as { version: number; scope: string; anchors: number; fragments: number }
  if (!state || state.version !== 1 || !SCOPE.test(state.scope) || !count(state.anchors) || !count(state.fragments) ||
      file.ref !== `${state.scope}/complete.json`) throw new Error('WORKER_ANCHOR_SEAL_INVALID')
  const base = dirname(await privatePath(root, file.ref))
  const verified = (path: string, ref: string): unknown => {
    const encoded = readPrivateCheckpointFile(path, 32_768)
    if (committed) {
      const receipt = committed(ref)
      if (!receipt || receipt.ref !== ref || receipt.checksum !== sha256(encoded) || receipt.size_bytes !== Buffer.byteLength(encoded)) throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    }
    return JSON.parse(encoded) as unknown
  }
  return { policy: file.checksum, resolve(ordinal) {
    if (!count(ordinal) || ordinal < 1) throw new Error('WORKER_ANCHOR_ORDINAL_INVALID')
    if (ordinal > state.anchors) return undefined
    const path = resolve(base, 'values', `${ordinal}.json`)
    const directory = lstatSync(dirname(path))
    const info = lstatSync(path)
    if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o077) || !info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || info.size > 32_768) throw new Error('WORKER_ANCHOR_FILE_INVALID')
    const value = verified(path, `${state.scope}/values/${ordinal}.json`) as AnchorValue
    if (!value || value.ordinal !== ordinal || !validTarget(value.target) || !count(value.first_fragment) || value.first_fragment >= state.fragments) throw new Error('WORKER_ANCHOR_VALUE_INVALID')
    const seenPath = resolve(base, 'seen', `${sha256(value.target)}.json`)
    const seenDirectory = lstatSync(dirname(seenPath))
    const seenInfo = lstatSync(seenPath)
    if (!seenDirectory.isDirectory() || seenDirectory.isSymbolicLink() || (seenDirectory.mode & 0o077) || !seenInfo.isFile() || seenInfo.isSymbolicLink() ||
        (seenInfo.mode & 0o077) || seenInfo.size > 32_768 || canonicalJson(verified(seenPath, `${state.scope}/seen/${sha256(value.target)}.json`)) !== canonicalJson(value)) throw new Error('WORKER_ANCHOR_VALUE_INVALID')
    return value.target
  } }
}
