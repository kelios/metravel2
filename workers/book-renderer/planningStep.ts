import { lstat, mkdir } from 'node:fs/promises'
import type { BookDocument } from '@/types/bookDocument'
import { assertBookDocument, validateSnapshotChunk } from '@/services/pdf-export/segments/snapshotAdapter'
import { PRINT_DESCRIPTOR_MAX_BYTES } from '@/services/pdf-export/segments/printAssetsTypes'
import { CheckpointSha256 } from './checkpointHash'
import { canonicalJson, sha256 } from './filesystem'
import { initialSnapshotIndex, prepareSnapshotIndexStep } from './planningIndex'
import { PlanningStorage, type CommittedPlanningLookup } from './planningStorage'
import { readGenerationLedger, sealGenerationLedger, MAX_GENERATION_LEDGER_BYTES, MAX_PLANNING_OUTPUT_FILE_BYTES } from './planningLedger'
import { initialBookPlanning, restoreBookPlanning, type BookPlanningPorts } from './planningBookTypes'
import { advanceBookPlanning } from './planningBody'
import { initialDescriptors, restoreDescriptors, advanceDescriptors } from './planningDescriptors'
import { createPlanningPorts, type CommittedParserLookup } from './planningPorts'
import { DEFAULT_RENDERER_RESOURCE_PROFILE, validateRendererResourceProfile, type RendererResourceProfile } from './measurement'
import { planningIdentity, type PlanningPhysicalSession } from './planningSession'
import { resolve } from 'node:path'
import { MAX_PLANNING_CHECKPOINT_BYTES, PLANNING_PROTOCOL_VERSION, type IndexCounts, type PlanningCheckpoint, type PlanningLimits,
  type PlanningRequest, type PlanningStepResult, type SnapshotIndexState } from './planningTypes'

const KINDS = ['travel', 'text', 'media', 'gallery', 'route', 'route-category', 'country', 'month', 'category', 'transport', 'overnight', 'author']
const ROLES = ['cover', 'inline', 'gallery', 'route-image', 'route-image_detail', 'route-image_landscape', 'book-cover']
const FIELDS = ['description', 'plus', 'minus', 'recommendation']
const SUMMARY = ['travels', 'countries', 'days', 'photos', 'points', 'mapped_travels', 'sources', 'included_media_occurrences']
// Post-index checkpoints retain bounded cursors/references, never manifest carry.
const MAX_BOOK_CHECKPOINT_BYTES = 65_536

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
  return value as Record<string, unknown>
}
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum || Object.is(value, -0)) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
  return value
}
function keys(value: Record<string, unknown>, allowed: string[], required = allowed): void {
  if (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.prototype.hasOwnProperty.call(value, key))) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
}
function validateCounts(value: unknown): IndexCounts {
  const counts = record(value)
  keys(counts, ['kinds', 'roles', 'fields', 'photos', 'locations'])
  for (const [field, allowed] of [['kinds', KINDS], ['roles', ROLES], ['fields', FIELDS]] as const) {
    const map = record(counts[field])
    keys(map, allowed, [])
    for (const amount of Object.values(map)) integer(amount)
  }
  integer(counts.photos); integer(counts.locations)
  return value as IndexCounts
}
function validateIndex(value: unknown, pinned: BookDocument): SnapshotIndexState {
  const index = record(value)
  keys(index, ['manifest', 'manifest_done', 'manifest_hash', 'verification', 'summary', 'current_travel', 'current_route', 'current_counts', 'global_counts', 'first_cover_position', 'book_cover_position'],
    ['manifest_done', 'manifest_hash', 'summary', 'current_counts', 'global_counts'])
  if (typeof index.manifest_done !== 'boolean') throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
  new CheckpointSha256(index.manifest_hash)
  const summary = record(index.summary)
  keys(summary, [...SUMMARY, 'first_travel', 'min_year', 'max_year'], SUMMARY)
  for (const field of SUMMARY) integer(summary[field])
  for (const field of ['first_travel', 'min_year', 'max_year']) if (summary[field] !== undefined) integer(summary[field], Number.MAX_SAFE_INTEGER, 1)
  validateCounts(index.current_counts); validateCounts(index.global_counts)
  if (index.current_travel !== undefined) integer(index.current_travel, Number.MAX_SAFE_INTEGER, 1)
  if (index.current_route !== undefined) {
    const route = record(index.current_route)
    keys(route, ['id', 'position', 'categories', 'media'])
    integer(route.id, Number.MAX_SAFE_INTEGER, 1); integer(route.position, integer(summary.sources) - 1); integer(route.categories)
    if (index.current_travel === undefined) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    if (!Array.isArray(route.media) || route.media.length > 3) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    for (const value of route.media) {
      const media = record(value)
      keys(media, ['role', 'resource_key'])
      if (!['route-image', 'route-image_detail', 'route-image_landscape'].includes(String(media.role)) || typeof media.resource_key !== 'string' ||
          !media.resource_key.length || media.resource_key.length > 65_536) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    }
  }
  for (const field of ['first_cover_position', 'book_cover_position']) if (index[field] !== undefined) integer(index[field], integer(summary.sources) - 1)
  if (index.manifest) {
    const cursor = record(index.manifest)
    keys(cursor, ['version', 'file_ref', 'file_size', 'offset', 'records', 'carry_base64'])
    if (cursor.version !== 1 || cursor.file_ref !== 'manifest.ndjson' || typeof cursor.carry_base64 !== 'string' || cursor.carry_base64.length > 349_528) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    integer(cursor.file_size); integer(cursor.offset, integer(cursor.file_size)); integer(cursor.records)
    const carry = Buffer.from(cursor.carry_base64, 'base64')
    if (carry.length > 262_144 || carry.length > integer(cursor.offset) || carry.toString('base64') !== cursor.carry_base64 ||
        cursor.records !== integer(summary.sources) + (index.verification ? 1 : 0) ||
        (index.manifest_done && (cursor.offset !== cursor.file_size || carry.length))) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
  } else if (integer(summary.sources) || index.manifest_done || index.verification) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
  if (index.verification) {
    const verification = record(index.verification)
    keys(verification, ['chunk', 'offset', 'hash'])
    const chunk = validateSnapshotChunk(verification.chunk, pinned)
    const offset = integer(verification.offset, chunk.size_bytes)
    if (chunk.position !== summary.sources || new CheckpointSha256(verification.hash).snapshot().total_bytes !== offset) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
  }
  return value as SnapshotIndexState
}

const DEFAULT_OUTPUT_BYTES = 4_194_304
/** A retried generation must admit one maximal binary+descriptor pair on top of the default envelope. */
export function maxPlanningOutputBytes(profile: RendererResourceProfile): number {
  return DEFAULT_OUTPUT_BYTES + profile.encoded_resource_bytes + PRINT_DESCRIPTOR_MAX_BYTES
}
function validateLimits(value: PlanningRequest['limits'], profile: RendererResourceProfile): PlanningLimits {
  if (value !== undefined) keys(record(value), ['input_bytes', 'output_bytes', 'output_records', 'probes'], [])
  return { input_bytes: integer(value?.input_bytes ?? 65_536, 65_536, 1),
    output_bytes: integer(value?.output_bytes ?? DEFAULT_OUTPUT_BYTES, maxPlanningOutputBytes(profile), 1),
    output_records: integer(value?.output_records ?? 24, 128, 1), probes: integer(value?.probes ?? 1, 8, 1) }
}

export interface PlanningStepOptions {
  /** Bound by B3 to its trusted job/epoch/committed-generation ledger head. */
  committed: CommittedPlanningLookup
  committed_parser?: CommittedParserLookup
  fonts_dir?: string
  /** Unit/protocol fixtures only; a resulting plan is explicitly measured:false. */
  ports_factory?: (storage: PlanningStorage) => BookPlanningPorts
  physical_session?: PlanningPhysicalSession
}

/** Each call creates an immutable candidate; only B2's fenced commit makes it consumable. */
export async function preparePlanningStep(jobRoot: string, planRoot: string, pinned: BookDocument, request: PlanningRequest, options: PlanningStepOptions): Promise<PlanningStepResult> {
  assertBookDocument(pinned)
  if (sha256(canonicalJson(pinned.settings)) !== pinned.settings_hash) throw new Error('SNAPSHOT_SETTINGS_HASH_MISMATCH')
  if (!request || !/^[a-f0-9]{64}$/.test(request.renderer_content_hash)) throw new Error('WORKER_PLANNING_RENDERER_PIN_INVALID')
  integer(request.generation, Number.MAX_SAFE_INTEGER, 1)
  const resourceProfile = request.resource_profile ?? DEFAULT_RENDERER_RESOURCE_PROFILE
  // A malformed profile is a request error, not checkpoint corruption.
  try { keys(record(resourceProfile), Object.keys(DEFAULT_RENDERER_RESOURCE_PROFILE)) } catch { throw new Error('WORKER_RESOURCE_PROFILE_INVALID') }
  validateRendererResourceProfile(resourceProfile)
  // Every planning output, including one served print resource, must stay ledgerable.
  if (resourceProfile.encoded_resource_bytes > MAX_PLANNING_OUTPUT_FILE_BYTES) throw new Error('WORKER_RESOURCE_PROFILE_INVALID')
  const limits = validateLimits(request.limits, resourceProfile)
  if (!options || typeof options.committed !== 'function') throw new Error('WORKER_PLANNING_COMMITTED_LOOKUP_REQUIRED')
  const profileHash = sha256(canonicalJson(resourceProfile))
  const identity = planningIdentity(pinned, request.renderer_content_hash, resourceProfile, !!options.ports_factory)
  if (options.physical_session && (options.ports_factory || options.physical_session.identity !== identity ||
      options.physical_session.jobRoot !== resolve(jobRoot) || options.physical_session.planRoot !== resolve(planRoot))) throw new Error('WORKER_PLANNING_SESSION_MISMATCH')
  await mkdir(planRoot, { recursive: true, mode: 0o700 })
  const info = await lstat(planRoot)
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error('WORKER_PLANNING_DIRECTORY_INVALID')
  const storage = new PlanningStorage(planRoot, limits, options.committed)
  // Restore first: an index resume still needs its bounded manifest carry reserve.
  let checkpoint: PlanningCheckpoint
  if (request.checkpoint) {
    if (request.checkpoint.ref !== `checkpoints/${request.checkpoint.checksum}.json`) throw new Error('WORKER_PLANNING_REFERENCE_INVALID')
    const restored = record(JSON.parse((await storage.read(request.checkpoint, MAX_PLANNING_CHECKPOINT_BYTES)).toString('utf8')) as unknown)
    keys(restored, ['version', 'identity', 'generation', 'phase', 'index', 'ledger', 'book', 'descriptors'], ['version', 'identity', 'generation', 'phase', 'index', 'ledger'])
    if (restored.version !== PLANNING_PROTOCOL_VERSION || restored.identity !== identity || integer(restored.generation) + 1 !== request.generation ||
        !['index', 'indexed', 'book', 'descriptors', 'plan_ready'].includes(String(restored.phase))) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    checkpoint = { version: PLANNING_PROTOCOL_VERSION, identity, generation: request.generation, phase: restored.phase as PlanningCheckpoint['phase'], index: validateIndex(restored.index, pinned), ledger: restored.ledger as PlanningCheckpoint['ledger'] }
    await storage.read(checkpoint.ledger!, MAX_GENERATION_LEDGER_BYTES)
    await readGenerationLedger(planRoot, checkpoint.ledger!, identity, request.generation - 1)
    if (['book', 'descriptors', 'plan_ready'].includes(checkpoint.phase)) checkpoint.book = restoreBookPlanning(restored.book as NonNullable<PlanningCheckpoint['book']>, checkpoint.index.summary)
    else if (restored.book !== undefined) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    if (['descriptors', 'plan_ready'].includes(checkpoint.phase)) {
      if (checkpoint.book?.phase !== 'done') throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
      checkpoint.descriptors = restoreDescriptors(restored.descriptors as NonNullable<PlanningCheckpoint['descriptors']>, checkpoint.book, checkpoint.index.summary.included_media_occurrences)
      if ((checkpoint.phase === 'plan_ready') !== (checkpoint.descriptors.phase === 'done')) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    } else if (restored.descriptors !== undefined) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    const indexed = checkpoint.index.manifest_done && !checkpoint.index.verification
    if ((checkpoint.phase === 'index') === indexed || (checkpoint.phase === 'book' && checkpoint.book?.phase === 'done')) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
  } else {
    if (request.generation !== 1) throw new Error('WORKER_PLANNING_CHECKPOINT_REQUIRED')
    checkpoint = { version: PLANNING_PROTOCOL_VERSION, identity, generation: 1, phase: 'index', index: initialSnapshotIndex(pinned) }
  }
  if (checkpoint.phase === 'plan_ready') throw new Error('WORKER_PLANNING_ALREADY_COMPLETE')
  const savedMaximum = checkpoint.phase === 'index' ? MAX_PLANNING_CHECKPOINT_BYTES : MAX_BOOK_CHECKPOINT_BYTES
  storage.reserve(2, savedMaximum + MAX_GENERATION_LEDGER_BYTES)
  const previousLedger = checkpoint.ledger ?? null
  await storage.put('identity.json', { version: PLANNING_PROTOCOL_VERSION, identity, renderer_content_hash: request.renderer_content_hash,
    resource_profile_hash: profileHash, measured: !options.ports_factory })
  const before = { ...checkpoint.index.summary }
  let consumed = 0; let consumedAssets = 0; let probes = 0
  if (checkpoint.phase === 'index') consumed = await prepareSnapshotIndexStep(jobRoot, pinned, checkpoint, storage, limits.input_bytes)
  else if (checkpoint.phase === 'indexed') { checkpoint.book = initialBookPlanning(); checkpoint.phase = 'book' }
  else {
    const physicalPorts = options.ports_factory ? undefined : await createPlanningPorts(jobRoot, storage, pinned, resourceProfile, options.fonts_dir, options.committed_parser!, options.physical_session)
    const ports = options.ports_factory?.(storage) ?? physicalPorts!.ports
    try {
      if (canonicalJson(ports.resource_profile) !== canonicalJson(resourceProfile)) throw new Error('WORKER_PLANNING_PROFILE_MISMATCH')
      if (checkpoint.phase === 'book') {
        const result = await advanceBookPlanning(jobRoot, storage, pinned, checkpoint.index.summary, checkpoint.book!, limits, ports)
        checkpoint.book = result.state; consumed = result.consumed_bytes; consumedAssets = result.consumed_asset_bytes; probes = result.probes
        if (result.done) { checkpoint.phase = 'descriptors'; checkpoint.descriptors = initialDescriptors() }
      } else {
        const result = await advanceDescriptors(storage, pinned, checkpoint.book!, checkpoint.index.summary.included_media_occurrences,
          checkpoint.descriptors!, ports, { identity, renderer_content_hash: request.renderer_content_hash, resource_profile_hash: profileHash,
            measured: !options.ports_factory, planning_protocol_version: PLANNING_PROTOCOL_VERSION })
        checkpoint.descriptors = result.state; probes = result.probes
        if (result.state.phase === 'done') checkpoint.phase = 'plan_ready'
      }
    } catch (error) {
      // Book and descriptor producers clone their input. If a probe filled the
      // generation with complete cache pairs, commit those pairs while retaining
      // the original planning cursor. The next committed generation can resume
      // preparation rather than rediscovering the same orphan files forever.
      if (!(error instanceof Error && error.message === 'WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED' &&
          storage.outputs.some(file => file.ref.startsWith('print-cache/')))) throw error
    } finally { await physicalPorts?.close() }
  }
  validateIndex(checkpoint.index, pinned)
  if (consumed > limits.input_bytes || probes > limits.probes || !Number.isSafeInteger(consumedAssets) || consumedAssets < 0) throw new Error('WORKER_PLANNING_STEP_BUDGET_EXCEEDED')
  storage.releaseReservation()
  checkpoint.ledger = await sealGenerationLedger(storage, identity, request.generation, previousLedger)
  const encoded = canonicalJson(checkpoint)
  const saved = await storage.put(`checkpoints/${sha256(encoded)}.json`, checkpoint, savedMaximum)
  return { planning_protocol_version: PLANNING_PROTOCOL_VERSION, generation: request.generation, checkpoint: saved, phase: checkpoint.phase,
    outputs: storage.outputs, consumed_bytes: consumed, consumed_asset_bytes: consumedAssets, probes, ledger: checkpoint.ledger,
    deltas: { sources: checkpoint.index.summary.sources - before.sources, travels: checkpoint.index.summary.travels - before.travels,
      included_media_occurrences: checkpoint.index.summary.included_media_occurrences - before.included_media_occurrences } }
}
