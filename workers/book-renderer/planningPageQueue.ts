import type { BookDocument } from '@/types/bookDocument'
import { CanonicalPageRenderer } from '@/services/pdf-export/segments/CanonicalPageRenderer'
import { assertBookSegmentSourceSchema, type BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { subdivisionFragment, subdivisionItems, type SubdivisionItem } from '@/services/pdf-export/segments/subdivisionChildren'
import type { SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'
import { BOOK_SEGMENT_LIMITS, type BookPageContext } from '@/services/pdf-export/segments/types'
import { incrementalContentStep, MAX_FIXED_CHECKPOINT_STORE_WRITES_PER_STEP, MAX_CHECKPOINT_STORE_WRITES_PER_TRANSITION, type IncrementalStepOptions } from './htmlCheckpoint/incrementalStep'
import type { ContextNode } from './htmlCheckpoint/contextStore'
import type { TagNode } from './htmlCheckpoint/tagStackStore'
import { canonicalJson, sha256 } from './filesystem'
import type { PhysicalMeasurer, PageMeasurement } from './measurement'
import type { PlanningFile } from './planningTypes'
import { withWorkerLocale } from './locale'
import { withImageAnalysis } from './imageAnalysis'

export const MAX_PAGE_QUEUE_FRAMES = 16
const MAX_PARSER_CHECKPOINT_BYTES = 1_048_576
const MAX_FRAGMENT_BATCH_BYTES = 262_144
const MAX_BATCH_FRAGMENTS = 16
const OVERFLOW = new Set(['WORKER_PAGE_IMAGE_BUDGET_EXCEEDED', 'WORKER_DOM_BUDGET_EXCEEDED',
  'WORKER_HTML_BUDGET_EXCEEDED', 'WORKER_SEGMENT_PDF_BUDGET_EXCEEDED'])

interface TextCursor {
  offset: number; ordinal: number; media: number; serial: number; done: boolean; needs_drain: boolean
  checkpoint?: PlanningFile
  pending?: { file: PlanningFile; total: number; next: number }
}
interface QueueFrame {
  source: PlanningFile; path: string; content_budget: number
  phase: 'probe' | 'split'
  split?: { item: number; text?: TextCursor }
}
export interface PageQueueState { version: 1; scope: string; accepted: number; stack: QueueFrame[] }
export interface PageQueuePorts {
  read: (file: PlanningFile, maximum: number) => Promise<unknown>
  put: (ref: string, value: unknown, maximum: number) => Promise<PlanningFile>
  /** Reject before writes, retaining capacity for the enclosing checkpoint and acceptance ledger. */
  admit: (records: number, bytes: number) => void
  parserStores: (scope: string) => IncrementalStepOptions['stores']
  /** Existing store scopes only; opening this port must not mkdir, fsync or publish. */
  parserReadStores: (scope: string) => IncrementalStepOptions['stores']
  probe: (source: BookSegmentSource, context: BookPageContext) => Promise<{ source: BookSegmentSource; measurement: PageMeasurement }>
}
export interface PageQueueResult {
  state: PageQueueState; done: boolean; probes: 0 | 1
  accepted?: { source: PlanningFile; ordinal: number; source_value: BookSegmentSource; measurement: { pages: 1; fits: true } }
}
function invalid(): never { throw new Error('WORKER_PAGE_QUEUE_INVALID') }
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum && !Object.is(value, -0)
}
function exact(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const record = value as Record<string, unknown>
  if (required.some(key => !(key in record)) || Object.keys(record).some(key => !required.includes(key) && !optional.includes(key))) return invalid()
  return record
}
function reference(value: unknown, maximum: number): PlanningFile {
  const file = exact(value, ['ref', 'checksum', 'size_bytes'])
  if (typeof file.ref !== 'string' || !file.ref || file.ref.startsWith('/') || file.ref.includes('\\') ||
      file.ref.split('/').some(part => !part || part === '.' || part === '..') ||
      typeof file.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(file.checksum) || !count(file.size_bytes, maximum)) return invalid()
  return { ref: file.ref, checksum: file.checksum, size_bytes: file.size_bytes }
}
/** A strict private checkpoint, containing references rather than an authored HTML prefix. */
export function restorePageQueue(value: unknown): PageQueueState {
  const state = exact(value, ['version', 'scope', 'accepted', 'stack'])
  if (state.version !== 1 || typeof state.scope !== 'string' || state.scope.length > 256 ||
      !/^[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*$/.test(state.scope) || !count(state.accepted) ||
      !Array.isArray(state.stack) || state.stack.length > MAX_PAGE_QUEUE_FRAMES) return invalid()
  const scope = state.scope
  const stack: QueueFrame[] = state.stack.map((value, index) => {
    const frame = exact(value, ['source', 'path', 'content_budget', 'phase'], ['split'])
    if (typeof frame.path !== 'string' || !/^0(?:\.[0-9]+\.[0-9]+)*$/.test(frame.path) || frame.path.length > 256 ||
        !count(frame.content_budget, 1024) || frame.content_budget < 1 || (frame.phase !== 'probe' && frame.phase !== 'split')) return invalid()
    if (index === 0 ? frame.path !== '0' : !frame.path.startsWith(`${(state.stack as QueueFrame[])[index - 1].path}.`)) return invalid()
    const restored: QueueFrame = { source: reference(frame.source, BOOK_SEGMENT_LIMITS.source_bytes), path: frame.path,
      content_budget: frame.content_budget, phase: frame.phase }
    if (frame.phase === 'probe') { if (frame.split !== undefined) return invalid(); return restored }
    const split = exact(frame.split, ['item'], ['text'])
    if (!count(split.item, 4)) return invalid()
    restored.split = { item: split.item }
    if (split.text !== undefined) {
      const text = exact(split.text, ['offset', 'ordinal', 'media', 'serial', 'done', 'needs_drain'], ['checkpoint', 'pending'])
      if (![text.offset, text.ordinal, text.media, text.serial].every(value => count(value)) ||
          typeof text.done !== 'boolean' || typeof text.needs_drain !== 'boolean' || (text.done && text.needs_drain)) return invalid()
      const cursor: TextCursor = { offset: text.offset as number, ordinal: text.ordinal as number, media: text.media as number,
        serial: text.serial as number, done: text.done, needs_drain: text.needs_drain }
      if (text.checkpoint !== undefined) {
        cursor.checkpoint = reference(text.checkpoint, MAX_PARSER_CHECKPOINT_BYTES)
        if (!cursor.checkpoint.ref.startsWith(`${scope}/work/${restored.path}/i${split.item}/`)) return invalid()
      } else if (cursor.offset || cursor.ordinal || cursor.media || cursor.serial || cursor.done || cursor.needs_drain) return invalid()
      if (text.pending !== undefined) {
        const pending = exact(text.pending, ['file', 'total', 'next'])
        if (!count(pending.total, MAX_BATCH_FRAGMENTS) || pending.total < 1 || !count(pending.next) || pending.next >= pending.total || !cursor.checkpoint) return invalid()
        const file = reference(pending.file, MAX_FRAGMENT_BATCH_BYTES)
        if (!file.ref.startsWith(`${scope}/work/${restored.path}/i${split.item}/`)) return invalid()
        cursor.pending = { file, total: pending.total, next: pending.next }
      }
      restored.split.text = cursor
    }
    return restored
  })
  if (stack.slice(0, -1).some(frame => frame.phase !== 'split')) return invalid()
  return { version: 1, scope, accepted: state.accepted, stack }
}
export function initialPageQueue(source: PlanningFile, scope: string, contentBudget = 1024): PageQueueState {
  return restorePageQueue({ version: 1, scope, accepted: 0, stack: [{ source, path: '0', content_budget: contentBudget, phase: 'probe' }] })
}

/** Canonical images, geometry and legacy overflow classifications are retained. */
export function canonicalPageQueueProbe(pinned: BookDocument, physical: PhysicalMeasurer): PageQueuePorts['probe'] {
  const renderer = new CanonicalPageRenderer(pinned.settings.template)
  return async (original, context) => withWorkerLocale(pinned.settings.locale, () => withImageAnalysis(physical, async () => {
    let source = original
    if ((source.source_schema_version ?? 1) === 1 && source.page.type === 'map') throw new Error('SEGMENT_SOURCE_SCHEMA_UPGRADE_REQUIRED')
    try {
      const html = await renderer.renderBoundedPage(source.page, context, pinned, true)
      const prepared = await physical.prepareHtml(html, undefined, 5)
      source = { ...source, source_schema_version: 5, resource_bindings: prepared.resource_bindings,
        resource_bindings_hash: prepared.resource_bindings_hash, resource_policy_hash: prepared.resource_policy_hash,
        encoder_identity_hash: prepared.encoder_identity_hash }
      const measurement = await physical.measure(prepared.html)
      if (measurement.fits && measurement.pages === 1) physical.assertResourceServing()
      return { source, measurement }
    } catch (error) {
      if (!(error instanceof Error && OVERFLOW.has(error.message))) throw error
      return { source, measurement: { pages: 0, fits: false } }
    }
  }))
}
function size(value: unknown): number { return Buffer.byteLength(canonicalJson(value)) }
function next(value: number): number { if (!count(value + 1)) throw new Error('WORKER_PLANNING_COUNTER_OVERFLOW'); return value + 1 }
function childBudget(frame: QueueFrame, source: BookSegmentSource): number {
  return source.page.type === 'content' || source.page.type === 'gallery-caption' || source.page.type === 'map-text'
    ? Math.floor(frame.content_budget / 2) : frame.content_budget
}
async function pushChild(state: PageQueueState, frame: QueueFrame, ports: PageQueuePorts, source: BookSegmentSource, item: number, ordinal: number, parent: BookSegmentSource): Promise<void> {
  if (state.stack.length === MAX_PAGE_QUEUE_FRAMES) throw new Error('WORKER_PAGE_QUEUE_DEPTH_EXCEEDED')
  const path = `${frame.path}.${item}.${ordinal}`
  const bytes = size(source)
  ports.admit(1, bytes)
  const file = await ports.put(`${state.scope}/sources/${path}.json`, source, BOOK_SEGMENT_LIMITS.source_bytes)
  state.stack.push({ source: file, path, content_budget: childBudget(frame, parent), phase: 'probe' })
}
function fragments(value: unknown, expected: number, budget: number): SafeContentFragment[] {
  if (!Array.isArray(value) || value.length !== expected || value.length > MAX_BATCH_FRAGMENTS || value.some(fragment => !fragment ||
      typeof fragment.html !== 'string' || fragment.html.length > budget || !Array.isArray(fragment.imageOccurrences) ||
      !count(fragment.index))) throw new Error('WORKER_PAGE_QUEUE_FRAGMENT_INVALID')
  return value as SafeContentFragment[]
}

/**
 * One original semantic transition has <=2 fixed store calls plus <=2 transition calls.
 * JSON consumes at most six UTF8 bytes per UTF16 unit (including lone surrogates).
 * Name/source-block sizes follow the existing parser/store contracts, not request budgets.
 */
const MAX_TRANSACTION_WRITES = MAX_FIXED_CHECKPOINT_STORE_WRITES_PER_STEP + MAX_CHECKPOINT_STORE_WRITES_PER_TRANSITION
const MAX_TAG_NODE_BYTES = 6 * 65_536 + 128
const MAX_TRANSACTION_BYTES = MAX_TRANSACTION_WRITES * MAX_TAG_NODE_BYTES

type BufferedStoreWrite = { kind: 'context'; hash: string; node: ContextNode } |
  { kind: 'tags'; hash: string; node: TagNode } | { kind: 'text'; ordinal: number; block: string }

/** Buffer writes from ONE parser invocation; no replay and no fresh disk directory on rejection. */
export function stagePageQueueParser(openStores: () => IncrementalStepOptions['stores'], readStores: () => IncrementalStepOptions['stores']): {
  stores: IncrementalStepOptions['stores']; readonly records: number; readonly bytes: number; publish: () => void
} {
  const writes: BufferedStoreWrite[] = []
  let bytes = 0
  let calls = 0
  let reader: IncrementalStepOptions['stores'] | undefined
  const committed = () => reader ??= readStores()
  let backing: IncrementalStepOptions['stores'] | undefined
  const original = () => backing ??= openStores()
  const add = (write: BufferedStoreWrite, encoded: string, maximum: number): void => {
    const encodedBytes = Buffer.byteLength(encoded)
    calls++
    if (calls > MAX_TRANSACTION_WRITES || encodedBytes > maximum) {
      throw new Error('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
    }
    const previous = writes.find(prior => prior.kind === write.kind && (prior.kind === 'text' && write.kind === 'text'
      ? prior.ordinal === write.ordinal : prior.kind !== 'text' && write.kind !== 'text' && prior.hash === write.hash))
    if (previous) {
      if (previous.kind === 'text' && write.kind === 'text' && previous.block !== write.block) throw new Error('WORKER_PAGE_QUEUE_STORE_IDENTITY_MISMATCH')
      return
    }
    if (bytes + encodedBytes > MAX_TRANSACTION_BYTES) {
      throw new Error('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
    }
    writes.push(write); bytes += encodedBytes
  }
  const stores: IncrementalStepOptions['stores'] = {
    context: {
      put(node) {
        if (typeof node.value !== 'boolean' || !count(node.count) || node.count < 1 ||
            (node.next !== null && (typeof node.next !== 'string' || !/^[a-f0-9]{64}$/.test(node.next)))) throw new Error('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
        const saved = { value: node.value, next: node.next, count: node.count }
        const encoded = JSON.stringify(saved); const hash = sha256(encoded)
        add({ kind: 'context', hash, node: saved }, encoded, 256)
        return hash
      },
      get(hash) {
        const found = writes.find(write => write.kind === 'context' && write.hash === hash)
        return found?.kind === 'context' ? found.node : committed().context.get(hash)
      },
    },
    tags: {
      put(node) {
        if (typeof node.name !== 'string' || node.name.length > 65_536 || !count(node.count) || node.count < 1 ||
            (node.next !== null && (typeof node.next !== 'string' || !/^[a-f0-9]{64}$/.test(node.next)))) throw new Error('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
        const saved = { name: node.name, next: node.next, count: node.count }
        const encoded = JSON.stringify(saved); const hash = sha256(encoded)
        add({ kind: 'tags', hash, node: saved }, encoded, MAX_TAG_NODE_BYTES)
        return hash
      },
      get(hash) {
        const found = writes.find(write => write.kind === 'tags' && write.hash === hash)
        return found?.kind === 'tags' ? found.node : committed().tags.get(hash)
      },
    },
    text: {
      put(ordinal, block) {
        if (!count(ordinal) || typeof block !== 'string' || block.length !== 1024) throw new Error('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
        const encoded = JSON.stringify({ ordinal, text: block, sha256: sha256(Buffer.from(block, 'utf16le')) })
        add({ kind: 'text', ordinal, block }, encoded, 8192)
      },
      get(ordinal) {
        const found = writes.find(write => write.kind === 'text' && write.ordinal === ordinal)
        return found?.kind === 'text' ? found.block : committed().text.get(ordinal)
      },
    },
  }
  return { stores, get records() { return writes.length }, get bytes() { return bytes }, publish() {
    for (const write of writes) {
      if (write.kind === 'text') original().text.put(write.ordinal, write.block)
      else if (write.kind === 'context') {
        if (original().context.put(write.node) !== write.hash) throw new Error('WORKER_PAGE_QUEUE_STORE_IDENTITY_MISMATCH')
      } else if (original().tags.put(write.node) !== write.hash) throw new Error('WORKER_PAGE_QUEUE_STORE_IDENTITY_MISMATCH')
    }
  } }
}

/** One durable DFS transition; never more than one physical page probe. */
export async function advancePageQueue(previous: PageQueueState, ports: PageQueuePorts, context: BookPageContext): Promise<PageQueueResult> {
  const state = restorePageQueue(previous)
  const result = (probes: 0 | 1 = 0): PageQueueResult => ({ state, done: state.stack.length === 0, probes })
  const frame = state.stack[state.stack.length - 1]
  if (!frame) return result()
  const source = await ports.read(frame.source, BOOK_SEGMENT_LIMITS.source_bytes) as BookSegmentSource
  assertBookSegmentSourceSchema(source)
  if (frame.phase === 'probe') {
    // One source write plus enclosing acceptance ledger/checkpoint, before browser or filesystem work.
    ports.admit(1, BOOK_SEGMENT_LIMITS.source_bytes)
    const probed = await ports.probe(source, context)
    assertBookSegmentSourceSchema(probed.source)
    if (probed.measurement.fits && probed.measurement.pages === 1) {
      if (probed.source.source_schema_version !== 5) throw new Error('WORKER_PAGE_QUEUE_UNFROZEN_SOURCE')
      const ordinal = state.accepted
      const file = await ports.put(`${state.scope}/accepted/${ordinal}.json`, probed.source, BOOK_SEGMENT_LIMITS.source_bytes)
      state.accepted = next(state.accepted); state.stack.pop()
      return { ...result(1), accepted: { source: file, ordinal, source_value: probed.source, measurement: { pages: 1, fits: true } } }
    }
    if ((source.page.type === 'content' || source.page.type === 'gallery-caption' || source.page.type === 'map-text') && frame.content_budget < 256) {
      throw new Error('SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT')
    }
    // Preserve schema5 expansion policy after a successful prepare followed by an overflowing measure.
    if (canonicalJson(probed.source) !== canonicalJson(source)) {
      frame.source = await ports.put(`${state.scope}/sources/${frame.path}.prepared.json`, probed.source, BOOK_SEGMENT_LIMITS.source_bytes)
    }
    frame.phase = 'split'; frame.split = { item: 0 }
    return result(1)
  }
  const split = frame.split!
  const items = subdivisionItems(source)
  if (split.item > items.length) return invalid()
  if (split.item === items.length) { if (split.text) return invalid(); state.stack.pop(); return result() }
  const item: SubdivisionItem = items[split.item]
  if (item.kind === 'source') {
    if (split.text) return invalid()
    await pushChild(state, frame, ports, item.source, split.item, 0, source)
    split.item = next(split.item)
    return result()
  }
  const text = split.text ?? { offset: 0, ordinal: 0, media: 0, serial: 0, done: false, needs_drain: false }
  split.text = text
  if (text.offset > item.html.length || text.media > item.source.occurrences.length) return invalid()
  if (text.pending) {
    const pending = text.pending
    const batch = fragments(await ports.read(pending.file, MAX_FRAGMENT_BATCH_BYTES), pending.total, frame.content_budget)
    const fragment = batch[pending.next]
    if (fragment.index !== text.ordinal || text.media + fragment.imageOccurrences.length > item.source.occurrences.length) throw new Error('SEGMENT_MEDIA_SUBDIVISION_MISMATCH')
    const child = subdivisionFragment(item, fragment, text.ordinal, text.media)
    await pushChild(state, frame, ports, child, split.item, text.ordinal, source)
    text.ordinal = next(text.ordinal); text.media += fragment.imageOccurrences.length
    pending.next++
    if (pending.next === pending.total) delete text.pending
    return result()
  }
  if (text.done) {
    if (text.offset !== item.html.length || text.media !== item.source.occurrences.length) throw new Error('SEGMENT_MEDIA_SUBDIVISION_MISMATCH')
    split.item = next(split.item); delete split.text
    return result()
  }
  const checkpoint = text.checkpoint ? await ports.read(text.checkpoint, MAX_PARSER_CHECKPOINT_BYTES) : undefined
  const feed = text.needs_drain ? '' : item.html.slice(text.offset, text.offset + Math.min(256, Math.floor(frame.content_budget / 4)))
  const scope = `${state.scope}/work/${frame.path}/i${split.item}`
  const parserScope = `${state.scope}/parser/${frame.path}/i${split.item}`
  const staged = stagePageQueueParser(() => ports.parserStores(parserScope), () => ports.parserReadStores(parserScope))
  const step = incrementalContentStep(feed, checkpoint, { stores: staged.stores,
    maxFragmentChars: frame.content_budget, preserveListStarts: item.preserveListStarts, expandDisclosures: item.expandDisclosures,
    eof: text.offset + feed.length === item.html.length, maxSemanticTransitions: 1 })
  const checkpointBytes = size(step.checkpoint)
  const fragmentBytes = step.fragments.length ? size(step.fragments) : 0
  if (checkpointBytes > MAX_PARSER_CHECKPOINT_BYTES || fragmentBytes > MAX_FRAGMENT_BATCH_BYTES) {
    throw new Error('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
  }
  // The one original producer has run only in bounded memory. Admit the exact immutable
  // node, source-block, fragment and checkpoint DTOs together before publishing any of them.
  ports.admit(staged.records + 1 + (step.fragments.length ? 1 : 0), staged.bytes + checkpointBytes + fragmentBytes)
  if (step.acceptedChars !== feed.length || step.fragments.length > MAX_BATCH_FRAGMENTS) throw new Error('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
  staged.publish()
  if (step.fragments.length) {
    const file = await ports.put(`${scope}/s${text.serial}.fragments.json`, step.fragments, MAX_FRAGMENT_BATCH_BYTES)
    text.pending = { file, total: step.fragments.length, next: 0 }
  }
  text.checkpoint = await ports.put(`${scope}/s${text.serial}.parser.json`, step.checkpoint, MAX_PARSER_CHECKPOINT_BYTES)
  text.offset += step.acceptedChars; text.done = step.done; text.needs_drain = step.needsDrain; text.serial = next(text.serial)
  return result()
}
