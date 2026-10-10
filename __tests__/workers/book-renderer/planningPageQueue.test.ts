/** @jest-environment node */
import { mkdirSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { DomUtils, parseDocument } from 'htmlparser2'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { incrementalContent } from '@/services/pdf-export/parsers/incrementalContent'
import { continueContentOnPage } from '@/services/pdf-export/segments/contentContinuation'
import { canonicalJson, sha256 } from '@/workers/book-renderer/filesystem'
import { incrementalContentStep, type IncrementalContentCheckpoint } from '@/workers/book-renderer/htmlCheckpoint/incrementalStep'
import { createDiskCheckpointStores } from '@/workers/book-renderer/htmlCheckpoint/diskStores'
import { advancePageQueue, initialPageQueue, MAX_PAGE_QUEUE_FRAMES, restorePageQueue, stagePageQueueParser } from '@/workers/book-renderer/planningPageQueue'
import type { PageQueuePorts, PageQueueState } from '@/workers/book-renderer/planningPageQueue'
import { PlanningStorage, readPlanningFile } from '@/workers/book-renderer/planningStorage'
import { mockWorkerDurability } from '../../helpers/mockWorkerDurability'

const LIMITS = { input_bytes: 65_536, output_bytes: 2_097_152, output_records: 24, probes: 1 }
const CONTEXT = { start_page: 1, folio_area_mm: 12 }
const frozen = (source: BookSegmentSource): BookSegmentSource => ({ ...source, source_schema_version: 5,
  resource_bindings: [], resource_bindings_hash: 'a'.repeat(64), resource_policy_hash: 'b'.repeat(64), encoder_identity_hash: 'c'.repeat(64) })

describe('durable depth-first page subdivision', () => {
  let scratch: string
  beforeEach(async () => {
    mockWorkerDurability()
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    scratch = await mkdtemp(path.join(root, 'book-page-queue-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(scratch, { recursive: true, force: true }) })

  function ports(storage: PlanningStorage, fits: (source: BookSegmentSource) => boolean): PageQueuePorts {
    return {
      read: async (file, maximum) => JSON.parse((await readPlanningFile(scratch, file, maximum)).toString('utf8')) as unknown,
      put: (ref, value, maximum) => storage.put(ref, value, maximum),
      admit: (records, bytes) => storage.admit(records, bytes),
      parserReadStores: scope => createDiskCheckpointStores(path.join(scratch, scope), { readonly: true }),
      parserStores: scope => {
        const root = path.join(scratch, scope)
        mkdirSync(root, { recursive: true, mode: 0o700 })
        return createDiskCheckpointStores(root, { onwrite: file => storage.recordExternalReceipt({
          ref: `${scope}/${file.ref}`, checksum: file.checksum, size_bytes: file.size_bytes,
        }) })
      },
      // This deterministic unit port verifies queue behavior, not physical page fit.
      probe: async source => ({ source: frozen(source), measurement: { pages: fits(source) ? 1 : 2, fits: fits(source) } }),
    }
  }

  async function drain(source: BookSegmentSource, fits: (source: BookSegmentSource) => boolean) {
    const file = await new PlanningStorage(scratch, LIMITS).put('initial.json', source)
    let state = initialPageQueue(file, 'queue')
    const accepted: BookSegmentSource[] = []
    for (let transitions = 0; ; transitions++) {
      expect(transitions).toBeLessThan(2000)
      const storage = new PlanningStorage(scratch, LIMITS)
      const previous = JSON.stringify(state)
      const step = await advancePageQueue(state, ports(storage, fits), CONTEXT)
      const replay = await advancePageQueue(state, ports(new PlanningStorage(scratch, LIMITS), fits), CONTEXT)
      expect(replay).toEqual(step)
      expect(JSON.stringify(state)).toBe(previous)
      expect(step.probes).toBeLessThanOrEqual(1)
      expect(step.state.stack.length).toBeLessThanOrEqual(MAX_PAGE_QUEUE_FRAMES)
      expect(storage.outputs.length).toBeLessThanOrEqual(LIMITS.output_records)
      if (step.accepted) {
        expect(step.accepted.ordinal).toBe(accepted.length)
        expect(step.accepted.source.ref).toBe(`queue/accepted/${accepted.length}.json`)
        accepted.push(step.accepted.source_value)
      }
      state = restorePageQueue(JSON.parse(JSON.stringify(step.state)) as unknown)
      if (step.done) { expect(state.accepted).toBe(accepted.length); return accepted }
    }
  }

  it('resumes through a gallery tree in source order and detaches captions without duplicating images', async () => {
    const source: BookSegmentSource = { source_schema_version: 2, page: { type: 'gallery', aspects: {}, start_index: 10, total_photos: 20,
      travel: { id: 9, name: 'Gallery', gallery: [1, 2, 3].map(id => ({ id, url: `image-${id}`, caption: id === 2 ? 'Second & caption' : undefined })) } },
      blocks: ['g1', 'g2', 'g3'], occurrences: ['m1', 'm2', 'm3'] }
    const accepted = await drain(source, item => item.page.type !== 'gallery' ||
      (item.page.travel.gallery?.length === 1 && (!item.page.travel.gallery[0].caption || item.page.caption_policy === 'detached')))
    expect(accepted.map(item => item.page.type)).toEqual(['gallery', 'gallery', 'gallery-caption', 'gallery'])
    expect(accepted.flatMap(item => item.blocks)).toEqual(['g1', 'g2', 'g2:caption', 'g3'])
    expect(accepted.flatMap(item => item.occurrences)).toEqual(source.occurrences)
    expect(accepted.map(item => item.page.type === 'gallery' ? item.page.start_index : item.page.type === 'gallery-caption' ? item.page.photo_ordinal : undefined)).toEqual([10, 11, 12, 12])
    expect(accepted.every(item => item.source_schema_version === 5)).toBe(true)
  })

  it('keeps arbitrary Unicode text, ordered lists and inline media through fresh parser stores on every transition', async () => {
    const prefix = 'bare 😀界 & text '.repeat(25)
    const list = 'numbered item '.repeat(60)
    const suffix = 'tail '.repeat(40)
    const source: BookSegmentSource = { page: { type: 'content', travel: { id: 7, name: 'Text' }, field: 'description',
      html: `${prefix.replace(/&/g, '&amp;')}<ol start="7"><li>${list}</li></ol><img src="image-1">${suffix}`, first: true, last: true, qr: 'original-qr' },
      blocks: ['description'], occurrences: ['inline-image'] }
    const accepted = await drain(source, item => item.blocks[0] !== 'description')
    const html = accepted.map(item => item.page.type === 'content' ? item.page.html : '')
    expect(accepted.length).toBeGreaterThan(1)
    expect(html.map(value => DomUtils.textContent(parseDocument(value))).join('')).toBe(prefix + list + suffix)
    expect(html.join('').match(/<img\b/g)).toHaveLength(1)
    expect(accepted.flatMap(item => item.occurrences)).toEqual(['inline-image'])
    expect(new Set(accepted.flatMap(item => item.blocks)).size).toBe(accepted.length)
    expect(accepted.filter(item => item.page.type === 'content' && item.page.first)).toHaveLength(1)
    expect(accepted.every(item => item.page.type === 'content' && !item.page.last && item.page.qr === '')).toBe(true)
    expect(html.filter(value => /<ol\b/.test(value)).every(value => /start="7"/.test(value))).toBe(true)
  })

  it('does not mutate a checkpoint when admission rejects the next physical probe', async () => {
    const source: BookSegmentSource = { page: { type: 'checklists' }, blocks: [], occurrences: [] }
    const file = await new PlanningStorage(scratch, LIMITS).put('initial.json', source)
    const state = initialPageQueue(file, 'queue')
    const previous = JSON.stringify(state)
    let probed = false
    const storage = new PlanningStorage(scratch, { ...LIMITS, output_records: 0 })
    const bounded = ports(storage, () => { probed = true; return true })
    await expect(advancePageQueue(state, bounded, CONTEXT)).rejects.toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(probed).toBe(false)
    expect(storage.outputs).toEqual([])
    expect(JSON.stringify(state)).toBe(previous)
  })

  it('matches canonical legacy subdivision for nested disclosures and rejects unfrozen acceptance', async () => {
    const source = frozen({ page: { type: 'content', travel: { id: 8, name: 'FAQ' }, field: 'description',
      html: `<details id="faq"><summary>Question</summary><ol start="4"><li>${'Answer 😀 '.repeat(140)}</li></ol><img src="image-1"></details>`,
      first: true, last: true, qr: '' }, blocks: ['faq'], occurrences: ['faq-image'] })
    const expected: BookSegmentSource[] = []
    // Independent legacy parser and pre-extraction mapping oracle, no subdivision helper.
    let media = 0
    let ordinal = 0
    if (source.page.type !== 'content') throw new Error('Invalid fixture')
    for await (const fragment of incrementalContent((async function* () { yield source.page.type === 'content' ? source.page.html : '' })(), {
      maxFragmentChars: 1024, preserveListStarts: true, expandDisclosures: true,
    })) {
      expected.push(frozen({ source_schema_version: 2, page: { ...source.page,
        html: continueContentOnPage(fragment).html, first: ordinal === 0, last: false, qr: '' },
      blocks: [`faq:part:${ordinal++}`], occurrences: source.occurrences.slice(media, media + fragment.imageOccurrences.length) }))
      media += fragment.imageOccurrences.length
    }
    const accepted = await drain(source, item => item.blocks[0] !== 'faq')
    expect(accepted).toEqual(expected)
    const file = await new PlanningStorage(scratch, LIMITS).put('unfrozen.json', { page: { type: 'checklists' }, blocks: [], occurrences: [] })
    const state = initialPageQueue(file, 'unfrozen')
    const bounded = ports(new PlanningStorage(scratch, LIMITS), () => true)
    bounded.probe = async original => ({ source: original, measurement: { pages: 1, fits: true } })
    await expect(advancePageQueue(state, bounded, CONTEXT)).rejects.toThrow('WORKER_PAGE_QUEUE_UNFROZEN_SOURCE')
  })

  it('keeps map field order and point/media ordinals through binary splitting and prefragmented detached text', async () => {
    const source: BookSegmentSource = { source_schema_version: 2, page: { type: 'map', travel: { id: 9, name: 'Map' },
      point_start: 4, show_coordinates: true, locations: [
        { id: 'a', address: 'Address A', categoryName: 'Cat A', coord: '1,2', thumbnailUrl: 'img-a' },
        { id: 'b', address: 'Address B', categoryName: 'Cat B', coord: '3,4' },
      ] }, blocks: ['pa', 'pb'], occurrences: ['media-a'] }
    const accepted = await drain(source, item => item.page.type !== 'map' || (item.page.locations.length === 1 && item.page.text_policy === 'detached'))
    expect(accepted.map(item => item.page.type)).toEqual(['map', 'map-text', 'map-text', 'map-text', 'map', 'map-text', 'map-text', 'map-text'])
    expect(accepted.map(item => item.page.type === 'map' ? item.page.point_start : item.page.type === 'map-text' ? item.page.point_ordinal : undefined)).toEqual([4, 5, 5, 5, 5, 6, 6, 6])
    expect(accepted.flatMap(item => item.occurrences)).toEqual(['media-a'])
    expect(accepted.filter(item => item.page.type === 'map-text').map(item => item.page.type === 'map-text' ? item.page.html : '')).toEqual([
      '<p>Address A</p>', '<p>Cat A</p>', '<p>1,2</p>', '<p>Address B</p>', '<p>Cat B</p>', '<p>3,4</p>',
    ])
    expect(accepted.flatMap(item => item.blocks)).toEqual(['pa', 'pa:text:address:part:0', 'pa:text:category:part:0', 'pa:text:coord:part:0',
      'pb', 'pb:text:address:part:0', 'pb:text:category:part:0', 'pb:text:coord:part:0'])
  })

  it('keeps TOC first-page offsets and thumbnail occurrence slices in exact DFS order', async () => {
    const source: BookSegmentSource = { page: { type: 'toc', start: 7, total: 30, entries: [0, 1, 2, 3, 4].map(id => ({
      travel: { id, name: `Travel ${id}`, travel_image_url: id % 2 ? undefined : `image-${id}` },
      hasGallery: false, hasMap: false, locations: [], startPage: id * 10 + 5,
    })) }, blocks: ['t0', 't1', 't2', 't3', 't4'], occurrences: ['m0', 'm2', 'm4'] }
    const accepted = await drain(source, item => item.page.type === 'toc' && item.page.entries.length === 1)
    expect(accepted.map(item => item.page.type === 'toc' ? item.page.start : undefined)).toEqual([7, 8, 9, 10, 11])
    expect(accepted.map(item => item.page.type === 'toc' ? item.page.entries[0].startPage : undefined)).toEqual([5, 15, 25, 35, 45])
    expect(accepted.flatMap(item => item.occurrences)).toEqual(['m0', 'm2', 'm4'])
    expect(accepted.flatMap(item => item.blocks)).toEqual(source.blocks)
  })

  it('rejects an exact parser budget before opening a fresh store directory or publishing any file', async () => {
    const source: BookSegmentSource = { page: { type: 'content', travel: { id: 3, name: 'Text' }, field: 'description',
      html: '<p>First text</p>', first: true, last: true, qr: '' }, blocks: ['text'], occurrences: [] }
    const sourceFile = await new PlanningStorage(scratch, LIMITS).put('source.json', source)
    const prepared = await advancePageQueue(initialPageQueue(sourceFile, 'queue'), ports(new PlanningStorage(scratch, LIMITS), () => false), CONTEXT)
    const state = restorePageQueue(JSON.parse(JSON.stringify(prepared.state)) as unknown)
    const before = JSON.stringify(state)
    const storage = new PlanningStorage(scratch, { ...LIMITS, output_bytes: 0 })
    const bounded = ports(storage, () => false)
    const open = jest.fn(bounded.parserStores)
    const publish = jest.fn(bounded.put)
    bounded.parserStores = open; bounded.put = publish
    await expect(advancePageQueue(state, bounded, CONTEXT)).rejects.toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(open).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
    expect(storage.outputs).toEqual([])
    expect(JSON.stringify(state)).toBe(before)
    const { readdir } = await import('node:fs/promises')
    expect(await readdir(path.join(scratch, 'queue'))).toEqual(['sources'])
  })

  it('measures lone-surrogate node JSON exactly and rejects the old 640KiB reserve before publishing', () => {
    let opened = 0
    const writes: unknown[] = []
    const staged = stagePageQueueParser(() => { opened++; return {
      context: { get: () => { throw new Error('Unexpected read') }, put: node => { writes.push(node); return sha256(JSON.stringify(node)) } },
      tags: { get: () => { throw new Error('Unexpected read') }, put: node => { writes.push(node); return sha256(JSON.stringify(node)) } },
      text: { get: () => { throw new Error('Unexpected read') }, put: (ordinal, block) => { writes.push([ordinal, block]) } },
    } }, () => { throw new Error('Unexpected committed read') })
    const name = 'x' + '\ud800'.repeat(60_000)
    const node = { name, next: null, count: 1 }
    const hash = staged.stores.tags.put(node)
    expect(staged.stores.tags.get(hash)).toEqual(node)
    const retained = { pending: { kind: 'open', name, tokenEnd: null } }
    const exactBytes = staged.bytes + Buffer.byteLength(canonicalJson(retained))
    expect(exactBytes).toBeGreaterThan(655_360)
    const limited = new PlanningStorage(scratch, { ...LIMITS, output_bytes: 655_360 })
    expect(() => limited.admit(staged.records + 1, exactBytes)).toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(opened).toBe(0); expect(writes).toEqual([])
    staged.publish()
    expect(opened).toBe(1); expect(writes).toEqual([node])
    expect(staged.bytes).toBe(Buffer.byteLength(JSON.stringify(node)))
  })

  it('admits actual long-name lexical completion by exact node and checkpoint bytes', async () => {
    const root = path.join(scratch, 'long-tag')
    mkdirSync(root, { mode: 0o700 })
    const published: Array<{ checksum: string; size_bytes: number }> = []
    const writable = () => createDiskCheckpointStores(root, { onwrite: file => published.push(file) })
    const readable = () => createDiskCheckpointStores(root, { readonly: true })
    const source = '<x' + '\ud800'.repeat(60_000)
    let checkpoint: IncrementalContentCheckpoint | undefined
    for (let offset = 0; offset < source.length; offset += 256) {
      const staged = stagePageQueueParser(writable, readable)
      const step = incrementalContentStep(source.slice(offset, offset + 256), checkpoint, { stores: staged.stores, maxSemanticTransitions: 1 })
      staged.publish()
      checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
    }
    // Complete the lexical name with a fresh bounded feed. The retained original name
    // is copied into one immutable stack node and the next parser checkpoint.
    const staged = stagePageQueueParser(writable, readable)
    const before = published.length
    const step = incrementalContentStep(' ', checkpoint, { stores: staged.stores, maxSemanticTransitions: 1 })
    const bytes = staged.bytes + Buffer.byteLength(canonicalJson(step.checkpoint))
    expect(bytes).toBeGreaterThan(655_360)
    expect(published).toHaveLength(before)
    const limited = new PlanningStorage(scratch, { ...LIMITS, output_bytes: 655_360 })
    expect(() => limited.admit(staged.records + 1, bytes)).toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(published).toHaveLength(before)
    const admitted = new PlanningStorage(scratch, LIMITS)
    admitted.admit(staged.records + 1, bytes)
    staged.publish()
    expect(published.slice(before).reduce((total, receipt) => total + receipt.size_bytes, 0)).toBe(staged.bytes)
  })

  it('opens only the readonly store port when a restored parser step has no output capacity', async () => {
    const source: BookSegmentSource = { page: { type: 'content', travel: { id: 3, name: 'Text' }, field: 'description',
      html: '<p>Restored text</p>', first: true, last: true, qr: '' }, blocks: ['text'], occurrences: [] }
    const sourceFile = await new PlanningStorage(scratch, LIMITS).put('source.json', source)
    let step = await advancePageQueue(initialPageQueue(sourceFile, 'queue'), ports(new PlanningStorage(scratch, LIMITS), () => false), CONTEXT)
    step = await advancePageQueue(step.state, ports(new PlanningStorage(scratch, LIMITS), () => false), CONTEXT)
    const previous = JSON.stringify(step.state)
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(scratch, { recursive: true })
    const storage = new PlanningStorage(scratch, { ...LIMITS, output_records: 0 })
    const bounded = ports(storage, () => false)
    const writable = jest.fn(bounded.parserStores)
    const publish = jest.fn(bounded.put)
    bounded.parserStores = writable; bounded.put = publish
    await expect(advancePageQueue(step.state, bounded, CONTEXT)).rejects.toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(writable).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled()
    expect(storage.outputs).toEqual([])
    expect(await readdir(scratch, { recursive: true })).toEqual(files)
    expect(JSON.stringify(step.state)).toBe(previous)
  })

  it('bounds speculative store calls and inherited name size independently of request budgets', () => {
    const open = jest.fn(() => { throw new Error('Must not open') })
    const staged = stagePageQueueParser(open, open)
    expect(() => staged.stores.tags.put({ name: 'a'.repeat(65_537), next: null, count: 1 })).toThrow('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
    for (let count = 1; count <= 4; count++) staged.stores.context.put({ value: false, next: null, count })
    expect(() => staged.stores.context.put({ value: false, next: null, count: 5 })).toThrow('WORKER_PAGE_QUEUE_PARSER_BUDGET_EXCEEDED')
    expect(open).not.toHaveBeenCalled()
  })

  it('rejects excessive depth, sibling stack frames and cross-scope parser refs at restore', () => {
    const file = { ref: 'initial.json', checksum: 'a'.repeat(64), size_bytes: 10 }
    const parent = { source: file, path: '0', content_budget: 1024, phase: 'split', split: { item: 0 } }
    const child = { ...parent, path: '0.0.0', phase: 'probe', split: undefined }
    expect(() => restorePageQueue({ version: 1, scope: 'queue', accepted: 0,
      stack: Array.from({ length: MAX_PAGE_QUEUE_FRAMES + 1 }, () => parent) })).toThrow('WORKER_PAGE_QUEUE_INVALID')
    expect(() => restorePageQueue({ version: 1, scope: 'queue', accepted: 0,
      stack: [parent, child, { ...child, path: '0.1.0' }] })).toThrow('WORKER_PAGE_QUEUE_INVALID')
    const state: PageQueueState = { version: 1, scope: 'queue', accepted: 0, stack: [{ ...parent, phase: 'split',
      split: { item: 0, text: { offset: 1, ordinal: 0, media: 0, serial: 1, done: false, needs_drain: false,
        checkpoint: { ...file, ref: 'other/work/0/i0/s0.parser.json' } } } }] }
    expect(() => restorePageQueue(state)).toThrow('WORKER_PAGE_QUEUE_INVALID')
  })
})
