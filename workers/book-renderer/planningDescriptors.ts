import type { BookDocument } from '@/types/bookDocument'
import { assertBookSegmentSourceSchema, type BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import { canonicalJson, sha256 } from './filesystem'
import type { PageQueuePorts } from './planningPageQueue'
import type { BookPlanningState, PlannedPageRecord } from './planningBookTypes'
import type { PlanningFile } from './planningTypes'
import { PlanningStorage } from './planningStorage'

export interface PlanningDescriptor {
  version: 1
  order: number
  travel_id: number
  type: BookSegmentSource['page']['type']
  source: PlanningFile
  page_context: { start_page: number; folio_area_mm: 12 }
  blocks: string[]
  occurrences: string[]
  source_schema_version: 5
  resource_bindings_hash: string
  resource_policy_hash: string
  encoder_identity_hash: string
}
export interface DescriptorState {
  version: 1
  phase: 'pages' | 'coverage' | 'source-coverage' | 'done'
  order: number
  blocks: number
  occurrences: number
  source_occurrences: number
  coverage_kind: 'blocks' | 'occurrences'
  coverage_offset: number
  pending?: PlanningFile
  summary?: PlanningFile
}
export interface DescriptorIdentity { identity: string; renderer_content_hash: string; resource_profile_hash: string; measured: boolean; planning_protocol_version: 2 }
const counter = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && !Object.is(n, -0)
export function initialDescriptors(): DescriptorState {
  return { version: 1, phase: 'pages', order: 0, blocks: 0, occurrences: 0, source_occurrences: 0, coverage_kind: 'blocks', coverage_offset: 0 }
}
export function restoreDescriptors(value: DescriptorState, book: BookPlanningState, sourceOccurrences: number): DescriptorState {
  if (!value || value.version !== 1 || !['pages', 'coverage', 'source-coverage', 'done'].includes(value.phase) ||
      !['blocks', 'occurrences'].includes(value.coverage_kind) ||
      [value.order, value.blocks, value.occurrences, value.source_occurrences, value.coverage_offset].some(n => !counter(n)) ||
      value.order > book.counts.pages + book.counts.frontmatter_pages || value.blocks > book.counts.blocks ||
      value.occurrences > book.counts.occurrences || value.source_occurrences > sourceOccurrences ||
      (value.phase === 'coverage') !== !!value.pending || value.coverage_offset > 256 ||
      Object.keys(value).some(key => !['version','phase','order','blocks','occurrences','source_occurrences','coverage_kind','coverage_offset','pending','summary'].includes(key))) {
    throw new Error('WORKER_DESCRIPTOR_CHECKPOINT_INVALID')
  }
  if (value.pending && (value.pending.ref !== `descriptors/${value.order}.json` || !/^[a-f0-9]{64}$/.test(value.pending.checksum) || !counter(value.pending.size_bytes) || value.pending.size_bytes > BOOK_SEGMENT_LIMITS.source_bytes || Object.keys(value.pending).length !== 3)) throw new Error('WORKER_DESCRIPTOR_CHECKPOINT_INVALID')
  const completePages = value.order === book.counts.pages + book.counts.frontmatter_pages && value.blocks === book.counts.blocks && value.occurrences === book.counts.occurrences
  if ((value.phase === 'source-coverage' || value.phase === 'done') && !completePages ||
      (value.phase === 'done') !== !!value.summary || (value.phase === 'done' && value.source_occurrences !== sourceOccurrences) ||
      (value.summary && (value.summary.ref !== 'plan-summary.json' || !/^[a-f0-9]{64}$/.test(value.summary.checksum) || !counter(value.summary.size_bytes) || value.summary.size_bytes > 65_536 || Object.keys(value.summary).length !== 3))) throw new Error('WORKER_DESCRIPTOR_CHECKPOINT_INVALID')
  return structuredClone(value)
}
async function read<T>(storage: PlanningStorage, file: PlanningFile, maximum: number): Promise<T> {
  return JSON.parse((await storage.read(file, maximum)).toString('utf8')) as T
}
function checkedSource(value: unknown): BookSegmentSource {
  const source = value as BookSegmentSource
  assertBookSegmentSourceSchema(source)
  if (source.blocks.length > 256 || source.occurrences.length > 64 ||
      source.blocks.some(key => typeof key !== 'string') || source.occurrences.some(key => typeof key !== 'string')) throw new Error('SEGMENT_PLAN_INVALID')
  return source
}
/** One final-page probe, one placement receipt, or one original-occurrence check per call. */
export async function advanceDescriptors(storage: PlanningStorage, pinned: BookDocument, book: BookPlanningState,
  sourceOccurrences: number, previous: DescriptorState, ports: PageQueuePorts, identity: DescriptorIdentity): Promise<{ state: DescriptorState; probes: 0 | 1 }> {
  const state = restoreDescriptors(previous, book, sourceOccurrences)
  if (book.phase !== 'done') throw new Error('WORKER_BOOK_PLAN_NOT_SEALED')
  const total = book.counts.pages + book.counts.frontmatter_pages
  if (state.phase === 'pages') {
    if (state.order === total) { state.phase = 'source-coverage'; return { state, probes: 0 } }
    const front = state.order < book.counts.frontmatter_pages
    const ordinal = front ? state.order : state.order - book.counts.frontmatter_pages
    const row = await storage.readIndex<PlannedPageRecord>(`book/${front ? 'frontmatter' : 'body'}/${ordinal}.json`)
    if (!row || row.ordinal !== ordinal || !counter(row.travel_id)) throw new Error('WORKER_DESCRIPTOR_SOURCE_INVALID')
    const original = checkedSource(await read(storage, row.source, BOOK_SEGMENT_LIMITS.source_bytes))
    const page_context = { start_page: state.order + 1, folio_area_mm: 12 as const }
    // Final absolute folios are frozen and measured after frontmatter length is sealed.
    ports.admit(3, 2 * BOOK_SEGMENT_LIMITS.source_bytes + 65_536)
    const result = await ports.probe(original, page_context)
    const source = checkedSource(result.source)
    if (result.measurement.pages !== 1 || !result.measurement.fits || source.source_schema_version !== 5 ||
        canonicalJson(source.blocks) !== canonicalJson(original.blocks) || canonicalJson(source.occurrences) !== canonicalJson(original.occurrences) ||
        [source.resource_bindings_hash, source.resource_policy_hash, source.encoder_identity_hash].some(hash => !/^[a-f0-9]{64}$/.test(hash ?? ''))) throw new Error('WORKER_FINAL_PAGE_GEOMETRY_MISMATCH')
    const sourceFile = await storage.put(`pages/${sha256(canonicalJson(source))}.json`, source, BOOK_SEGMENT_LIMITS.source_bytes)
    const descriptor: PlanningDescriptor = { version: 1, order: state.order, travel_id: row.travel_id, type: source.page.type,
      source: sourceFile, page_context, blocks: source.blocks, occurrences: source.occurrences, source_schema_version: 5,
      resource_bindings_hash: source.resource_bindings_hash!, resource_policy_hash: source.resource_policy_hash!, encoder_identity_hash: source.encoder_identity_hash! }
    state.pending = await storage.put(`descriptors/${state.order}.json`, descriptor, BOOK_SEGMENT_LIMITS.source_bytes)
    state.phase = 'coverage'; state.coverage_kind = 'blocks'; state.coverage_offset = 0
    return { state, probes: 1 }
  }
  if (state.phase === 'coverage') {
    const descriptor = await read<PlanningDescriptor>(storage, state.pending!, BOOK_SEGMENT_LIMITS.source_bytes)
    if (descriptor.order !== state.order || descriptor.version !== 1 || !counter(descriptor.travel_id) ||
        descriptor.source_schema_version !== 5 || descriptor.page_context?.start_page !== state.order + 1 || descriptor.page_context.folio_area_mm !== 12 ||
        !Array.isArray(descriptor.blocks) || descriptor.blocks.length > 256 || descriptor.blocks.some(key => typeof key !== 'string') ||
        !Array.isArray(descriptor.occurrences) || descriptor.occurrences.length > 64 || descriptor.occurrences.some(key => typeof key !== 'string') ||
        [descriptor.resource_bindings_hash, descriptor.resource_policy_hash, descriptor.encoder_identity_hash].some(hash => !/^[a-f0-9]{64}$/.test(hash))) throw new Error('WORKER_DESCRIPTOR_SOURCE_INVALID')
    const source = checkedSource(await read(storage, descriptor.source, BOOK_SEGMENT_LIMITS.source_bytes))
    if (source.source_schema_version !== 5 || source.page.type !== descriptor.type || canonicalJson(source.blocks) !== canonicalJson(descriptor.blocks) ||
        canonicalJson(source.occurrences) !== canonicalJson(descriptor.occurrences) || source.resource_bindings_hash !== descriptor.resource_bindings_hash ||
        source.resource_policy_hash !== descriptor.resource_policy_hash || source.encoder_identity_hash !== descriptor.encoder_identity_hash) throw new Error('WORKER_DESCRIPTOR_SOURCE_INVALID')
    const keys = descriptor[state.coverage_kind]
    if (state.coverage_offset > keys.length) throw new Error('WORKER_DESCRIPTOR_CHECKPOINT_INVALID')
    if (state.coverage_offset < keys.length) {
      const key = keys[state.coverage_offset]
      const ref = `coverage/${state.coverage_kind}/${sha256(key)}.json`
      const prior = await storage.readIndex<{ key: string; order: number }>(ref)
      if (prior && (prior.key !== key || prior.order !== state.order)) throw new Error('WORKER_COVERAGE_DUPLICATED')
      if (keys.indexOf(key) !== state.coverage_offset) throw new Error('WORKER_COVERAGE_DUPLICATED')
      await storage.put(ref, { key, order: state.order })
      state[state.coverage_kind]++; state.coverage_offset++
    } else if (state.coverage_kind === 'blocks') { state.coverage_kind = 'occurrences'; state.coverage_offset = 0 }
    else { state.order++; state.phase = 'pages'; delete state.pending; state.coverage_offset = 0 }
    return { state, probes: 0 }
  }
  if (state.phase === 'source-coverage') {
    if (state.source_occurrences === sourceOccurrences) {
      if (state.blocks !== book.counts.blocks || state.occurrences !== book.counts.occurrences || state.order !== total) throw new Error('WORKER_COVERAGE_MISMATCH')
      state.summary = await storage.put('plan-summary.json', { version: 1, ...identity, snapshot_hash: pinned.snapshot_hash, settings_hash: pinned.settings_hash,
        renderer_version: pinned.renderer_version, source_schema_version: 5, pages: total, blocks: state.blocks,
        occurrences: state.occurrences, included_media_occurrences: sourceOccurrences, descriptor_prefix: 'descriptors/',
        book_counts: book.counts, seals: { body: book.body_seal, toc: book.toc_seal, frontmatter: book.frontmatter_seal } }, 65_536)
      state.phase = 'done'
    } else {
      const expected = await storage.readIndex<{ key: string; position: number }>(`index/occurrences/${state.source_occurrences}.json`)
      if (!expected || typeof expected.key !== 'string' || !counter(expected.position)) throw new Error('WORKER_SOURCE_MEDIA_COVERAGE_MISMATCH')
      const found = await storage.readIndex<{ key: string; order: number }>(`coverage/occurrences/${sha256(expected.key)}.json`)
      if (!found || found.key !== expected.key || !counter(found.order) || found.order >= total) throw new Error('WORKER_SOURCE_MEDIA_COVERAGE_MISMATCH')
      state.source_occurrences++
    }
  }
  return { state, probes: 0 }
}
