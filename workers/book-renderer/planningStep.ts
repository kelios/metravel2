import { lstat, mkdir } from 'node:fs/promises'
import type { BookDocument } from '@/types/bookDocument'
import { assertBookDocument, validateSnapshotChunk } from '@/services/pdf-export/segments/snapshotAdapter'
import { CheckpointSha256 } from './checkpointHash'
import { canonicalJson, sha256 } from './filesystem'
import { initialSnapshotIndex, prepareSnapshotIndexStep } from './planningIndex'
import { PlanningStorage, readPlanningFile } from './planningStorage'
import { MAX_PLANNING_CHECKPOINT_BYTES, PLANNING_PROTOCOL_VERSION, type IndexCounts, type PlanningCheckpoint, type PlanningLimits,
  type PlanningRequest, type PlanningStepResult, type SnapshotIndexState } from './planningTypes'

const KINDS = ['travel', 'text', 'media', 'gallery', 'route', 'route-category', 'country', 'month', 'category', 'transport', 'overnight', 'author']
const ROLES = ['cover', 'inline', 'gallery', 'route-image', 'route-image_detail', 'route-image_landscape', 'book-cover']
const FIELDS = ['description', 'plus', 'minus', 'recommendation']
const SUMMARY = ['travels', 'countries', 'days', 'photos', 'points', 'mapped_travels', 'sources', 'included_media_occurrences']

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

function validateLimits(value: PlanningRequest['limits']): PlanningLimits {
  if (value !== undefined) keys(record(value), ['input_bytes', 'output_bytes', 'output_records', 'probes'], [])
  return { input_bytes: integer(value?.input_bytes ?? 65_536, 65_536, 1), output_bytes: integer(value?.output_bytes ?? 2_097_152, 4_194_304, 1),
    output_records: integer(value?.output_records ?? 24, 128, 1), probes: integer(value?.probes ?? 1, 8, 1) }
}

/** Each call creates an immutable candidate; only B2's fenced commit makes it consumable. */
export async function preparePlanningStep(jobRoot: string, planRoot: string, pinned: BookDocument, request: PlanningRequest): Promise<PlanningStepResult> {
  assertBookDocument(pinned)
  if (sha256(canonicalJson(pinned.settings)) !== pinned.settings_hash) throw new Error('SNAPSHOT_SETTINGS_HASH_MISMATCH')
  if (!request || !/^[a-f0-9]{64}$/.test(request.renderer_content_hash)) throw new Error('WORKER_PLANNING_RENDERER_PIN_INVALID')
  integer(request.generation, Number.MAX_SAFE_INTEGER, 1)
  const limits = validateLimits(request.limits)
  const identity = sha256(canonicalJson({ version: PLANNING_PROTOCOL_VERSION, renderer_content_hash: request.renderer_content_hash, document: pinned }))
  await mkdir(planRoot, { recursive: true, mode: 0o700 })
  const info = await lstat(planRoot)
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error('WORKER_PLANNING_DIRECTORY_INVALID')
  const storage = new PlanningStorage(planRoot, limits)
  let checkpoint: PlanningCheckpoint
  if (request.checkpoint) {
    if (request.checkpoint.ref !== `checkpoints/${request.checkpoint.checksum}.json`) throw new Error('WORKER_PLANNING_REFERENCE_INVALID')
    const restored = record(JSON.parse((await readPlanningFile(planRoot, request.checkpoint, MAX_PLANNING_CHECKPOINT_BYTES)).toString('utf8')) as unknown)
    keys(restored, ['version', 'identity', 'generation', 'phase', 'index'])
    if (restored.version !== PLANNING_PROTOCOL_VERSION || restored.identity !== identity || integer(restored.generation) + 1 !== request.generation ||
        !['index', 'indexed'].includes(String(restored.phase))) throw new Error('WORKER_PLANNING_CHECKPOINT_INVALID')
    checkpoint = { version: PLANNING_PROTOCOL_VERSION, identity, generation: request.generation, phase: restored.phase as PlanningCheckpoint['phase'], index: validateIndex(restored.index, pinned) }
  } else {
    if (request.generation !== 1) throw new Error('WORKER_PLANNING_CHECKPOINT_REQUIRED')
    checkpoint = { version: PLANNING_PROTOCOL_VERSION, identity, generation: 1, phase: 'index', index: initialSnapshotIndex(pinned) }
  }
  if (checkpoint.phase === 'indexed') throw new Error('WORKER_PLANNING_INDEX_ALREADY_COMPLETE')
  await storage.put('identity.json', { version: PLANNING_PROTOCOL_VERSION, identity, renderer_content_hash: request.renderer_content_hash })
  const before = { ...checkpoint.index.summary }
  const consumed = await prepareSnapshotIndexStep(jobRoot, pinned, checkpoint, storage, limits.input_bytes)
  validateIndex(checkpoint.index, pinned)
  const encoded = canonicalJson(checkpoint)
  const saved = await storage.put(`checkpoints/${sha256(encoded)}.json`, checkpoint, MAX_PLANNING_CHECKPOINT_BYTES)
  return { planning_protocol_version: PLANNING_PROTOCOL_VERSION, generation: request.generation, checkpoint: saved, phase: checkpoint.phase,
    outputs: storage.outputs, consumed_bytes: consumed, deltas: { sources: checkpoint.index.summary.sources - before.sources,
      travels: checkpoint.index.summary.travels - before.travels, included_media_occurrences: checkpoint.index.summary.included_media_occurrences - before.included_media_occurrences } }
}
