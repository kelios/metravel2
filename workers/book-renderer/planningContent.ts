import type { BookMediaChunk, BookTextField } from '@/types/bookDocument'
import type { TravelForBook } from '@/types/pdf-export'
import type { SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { continueContentOnPage, mergeContentContinuation } from '@/services/pdf-export/segments/contentContinuation'
import { incrementalContentStep, type IncrementalContentCheckpoint } from './htmlCheckpoint/incrementalStep'
import { initialAnchorLedger, beginAnchorFragment, advanceAnchorTarget, sealAnchorLedger, sealedAnchorResolver } from './planningAnchors'
import { initialFieldSource, readFieldSourceFeed, readIndexedSource } from './planningSource'
import { type PlanningStorage } from './planningStorage'
import { BOOK_FIELDS, type BookPlanningContext, type ContentPlanningState, type SmallContentState } from './planningBookTypes'
import { bookImageDimensions, bookCounter } from './planningBookTypes'
import type { IndexCounts, PlanningFile } from './planningTypes'
import { assetUrl, sourceImageKey } from './snapshot'
import { canonicalJson } from './filesystem'
import { stagePageQueueParser } from './planningPageQueue'

const MAX_CONTENT_RECORD = 524_288
interface RewrittenFragment { fragment: SafeContentFragment; html: string; occurrences: string[] }
export async function readBookRecord<T>(storage: PlanningStorage, file: PlanningFile, maximum = MAX_CONTENT_RECORD): Promise<T> {
  return JSON.parse((await storage.read(file, maximum)).toString('utf8')) as T
}
function contentScope(id: number, state: ContentPlanningState): string { return `book/content/${id}/${BOOK_FIELDS[state.field]}/${state.pass}` }
async function contentRecord(storage: PlanningStorage, id: number, state: ContentPlanningState, value: unknown): Promise<PlanningFile> {
  const sequence = state.sequence; state.sequence = bookCounter(sequence)
  return storage.put(`${contentScope(id, state)}/${sequence}.json`, value, MAX_CONTENT_RECORD)
}
export function initialContentPlanning(id: number, first = true, emitted = false, inline = 0, field = 0): ContentPlanningState {
  return { field, pass: 'anchors', source: initialFieldSource(), parser_done: false, needs_drain: false,
    fragment_total: 0, fragment_cursor: 0, anchors: initialAnchorLedger(id, BOOK_FIELDS[field]), first, emitted, inline, sequence: 0 }
}

/** The legacy 8192 UTF16 aggregate is a rendering branch, not an archive input cap. */
export async function advanceSmallContent(
  context: BookPlanningContext, storage: PlanningStorage, id: number, counts: IndexCounts, previous: SmallContentState, inputBudget: number,
): Promise<{ state: SmallContentState; consumed_bytes: number; excluded: boolean; done: boolean; fields?: Partial<Record<BookTextField, string>> }> {
  const state = structuredClone(previous)
  const fields = state.raw ? await readBookRecord<Partial<Record<BookTextField, string>>>(storage, state.raw, 65_536) : {}
  if (state.field === BOOK_FIELDS.length) return { state, consumed_bytes: 0, excluded: false, done: true, fields }
  const field = BOOK_FIELDS[state.field]
  const feed = await readFieldSourceFeed(context.jobRoot, storage, context.pinned, context.summary.sources, id, field, counts.fields[field] ?? 0, state.source, inputBudget)
  state.characters += feed.text.length
  if (state.characters > 8192) return { state: previous, consumed_bytes: feed.read_bytes, excluded: true, done: true }
  const text = (fields[field] ?? '') + feed.text
  if (/<(?:table|img)\b/i.test(text)) return { state: previous, consumed_bytes: feed.read_bytes, excluded: true, done: true }
  fields[field] = text
  state.source = feed.cursor
  state.raw = await storage.put(`book/small/${id}/${state.sequence}.json`, fields, 65_536)
  state.sequence = bookCounter(state.sequence)
  if (feed.eof) { state.field++; state.source = initialFieldSource() }
  return { state, consumed_bytes: feed.read_bytes, excluded: false, done: state.field === BOOK_FIELDS.length, fields: state.field === BOOK_FIELDS.length ? fields : undefined }
}

async function parserStep(context: BookPlanningContext, storage: PlanningStorage, id: number, counts: IndexCounts, state: ContentPlanningState, inputBudget: number): Promise<number> {
  const field = BOOK_FIELDS[state.field]
  let input = ''; let eof = state.parser_done; let consumed = 0
  if (!state.needs_drain) {
    const feed = await readFieldSourceFeed(context.jobRoot, storage, context.pinned, context.summary.sources, id, field, counts.fields[field] ?? 0, state.source, inputBudget)
    input = feed.text; eof = feed.eof; state.source = feed.cursor; consumed = feed.read_bytes
  }
  const prior = state.parser ? await readBookRecord<IncrementalContentCheckpoint>(storage, state.parser) : undefined
  const resolver = state.pass === 'body' ? await sealedAnchorResolver(storage, state.anchor_seal!, context.ports.anchor_receipt) : undefined
  // One retained lexical transition can publish a bounded fragment batch. The source cursor
  // stays still while needsDrain is true; process restart never replays a field prefix.
  const scope = `${contentScope(id, state)}/stores`
  const staged = stagePageQueueParser(() => context.ports.parserStores(scope), () => context.ports.parserReadStores(scope))
  const result = incrementalContentStep(input, prior, { stores: staged.stores,
    eof, maxSemanticTransitions: 1, expandDisclosures: true, anchorPolicy: resolver?.policy, headingAnchorResolver: resolver?.resolve })
  const parserBytes = Buffer.byteLength(canonicalJson(result.checkpoint))
  const fragmentBytes = result.fragments.length ? Buffer.byteLength(canonicalJson(result.fragments)) : 0
  if (parserBytes > MAX_CONTENT_RECORD || fragmentBytes > MAX_CONTENT_RECORD || result.fragments.length > 16) throw new Error('WORKER_CONTENT_FRAGMENT_OUTPUT_BUDGET_EXCEEDED')
  context.ports.admit(staged.records + 1 + (result.fragments.length ? 1 : 0), staged.bytes + parserBytes + fragmentBytes)
  staged.publish()
  state.parser_done = result.done; state.needs_drain = result.needsDrain
  state.parser = await contentRecord(storage, id, state, result.checkpoint)
  if (result.fragments.length > 16) throw new Error('WORKER_CONTENT_FRAGMENT_OUTPUT_BUDGET_EXCEEDED')
  if (result.fragments.length) {
    state.fragments = await contentRecord(storage, id, state, result.fragments)
    state.fragment_cursor = 0; state.fragment_total = result.fragments.length
  }
  return consumed
}

function clearFragments(state: ContentPlanningState): void { delete state.fragments; state.fragment_total = 0; state.fragment_cursor = 0 }
function contentSource(travel: TravelForBook, field: BookTextField, html: string, first: boolean, blocks: string[], occurrences: string[]): BookSegmentSource {
  return { page: { type: 'content', travel: { ...travel, url: undefined }, field, html, first, last: false, qr: '' }, blocks, occurrences }
}

/** One feed, anchor membership, inline image, or greedy physical fit; never an entire field. */
export async function advanceContentPlanning(
  context: BookPlanningContext, storage: PlanningStorage, id: number, travel: TravelForBook, counts: IndexCounts,
  previous: ContentPlanningState, inputBudget: number, pageNumber: number,
): Promise<{ state: ContentPlanningState; consumed_bytes: number; probes: number; source?: BookSegmentSource; done: boolean }> {
  let state = structuredClone(previous)
  const result = (source?: BookSegmentSource, probes = 0, consumed_bytes = 0) => ({ state, source, probes, consumed_bytes, done: state.field === BOOK_FIELDS.length })
  if (state.field === BOOK_FIELDS.length) {
    if (state.inline !== (counts.roles.inline ?? 0)) throw new Error('SNAPSHOT_INLINE_MEDIA_COVERAGE_MISMATCH')
    return result()
  }
  const field = BOOK_FIELDS[state.field]
  if (state.pass === 'anchors' && state.anchors.pending) { state.anchors = await advanceAnchorTarget(storage, state.anchors); return result() }
  if (state.fragments && state.fragment_cursor < state.fragment_total) {
    const fragments = await readBookRecord<SafeContentFragment[]>(storage, state.fragments)
    if (!Array.isArray(fragments) || fragments.length !== state.fragment_total) throw new Error('WORKER_CONTENT_FRAGMENTS_INVALID')
    const fragment = fragments[state.fragment_cursor]
    if (state.pass === 'anchors') {
      state.anchors = await beginAnchorFragment(storage, state.anchors, fragment)
      state.fragment_cursor++
      if (state.fragment_cursor === state.fragment_total) clearFragments(state)
      return result()
    }
    if (!state.rewriting) {
      const images = Array.from(fragment.html.matchAll(/<img\b[^>]*>/gi))
      if (images.length !== fragment.imageOccurrences.length) throw new Error('SNAPSHOT_INLINE_MEDIA_COVERAGE_MISMATCH')
      state.rewriting = { fragment: await contentRecord(storage, id, state, { fragment, html: fragment.html, occurrences: [] } satisfies RewrittenFragment), image: 0, inline: state.inline }
      return result()
    }
    const rewritten = await readBookRecord<RewrittenFragment>(storage, state.rewriting.fragment)
    if (rewritten.fragment.index !== fragment.index || state.rewriting.image > fragment.imageOccurrences.length) throw new Error('WORKER_CONTENT_REWRITE_INVALID')
    if (state.rewriting.image < fragment.imageOccurrences.length) {
      const media = await readIndexedSource(storage, context.pinned, `index/travel/${id}/media/inline/${state.inline}.json`, context.summary.sources, id, 'media')
      const occurrence = fragment.imageOccurrences[state.rewriting.image]
      if (media.kind !== 'media' || media.metadata.role !== 'inline' || media.metadata.resource_key !== await sourceImageKey(occurrence.source)) throw new Error('SNAPSHOT_INLINE_MEDIA_ORDER_MISMATCH')
      const dimensions = await bookImageDimensions(context, storage, media as BookMediaChunk)
      const images = Array.from(rewritten.html.matchAll(/<img\b[^>]*>/gi))
      const image = images[state.rewriting.image]
      if (!image || image.index === undefined) throw new Error('WORKER_CONTENT_REWRITE_INVALID')
      const tag = image[0].replace(/\s(?:src|srcset|data-src|data-original|data-lazy-src|width|height)=(["']).*?\1/gi, '')
        .replace(/\/?\s*>$/, ` src="${assetUrl(media)}" width="${dimensions.width}" height="${dimensions.height}">`)
      rewritten.html = rewritten.html.slice(0, image.index) + tag + rewritten.html.slice(image.index + image[0].length)
      rewritten.occurrences.push(media.occurrence_key)
      state.inline = bookCounter(state.inline); state.rewriting.image++
      state.rewriting.fragment = await contentRecord(storage, id, state, rewritten)
      return result()
    }
    rewritten.html = rewritten.html.replace(/<iframe\b[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, '<a href="$1">$1</a>')
    const packed = state.packed ? await readBookRecord<BookSegmentSource>(storage, state.packed) : undefined
    if (packed && packed.page.type !== 'content') throw new Error('WORKER_CONTENT_PACK_INVALID')
    const html = mergeContentContinuation(packed?.page.type === 'content' ? packed.page.html : '', { ...fragment, html: rewritten.html })
    const blocks = packed?.blocks ?? []; const occurrences = packed?.occurrences ?? []
    let fits = false; let probes = 0
    if (!state.rewriting.skip_fit && html.length <= 24_000 && blocks.length < 128 && occurrences.length + rewritten.occurrences.length <= 32) {
      const measured = await context.ports.probe(contentSource(travel, field, html, state.first, blocks, occurrences), { start_page: pageNumber, folio_area_mm: 12 })
      probes = 1; fits = measured.measurement.pages === 1 && measured.measurement.fits
    }
    if (!fits && packed) {
      // Preserve the candidate fragment while the previous page drains. A new page
      // must use continueContentOnPage, exactly as the canonical legacy greedy packer.
      delete state.packed
      state.rewriting.skip_fit = true
      state.first = false; state.emitted = true
      return result(packed, probes)
    }
    const nextHtml = packed?.page.type === 'content' ? mergeContentContinuation(packed.page.html, { ...fragment, html: rewritten.html }) : continueContentOnPage({ ...fragment, html: rewritten.html }).html
    state.packed = await contentRecord(storage, id, state, contentSource(travel, field, nextHtml, state.first,
      [...blocks, `${id}:${field}:fragment:${fragment.index}`], [...occurrences, ...rewritten.occurrences]))
    delete state.rewriting
    state.fragment_cursor++
    if (state.fragment_cursor === state.fragment_total) clearFragments(state)
    return result(undefined, probes)
  }
  if (state.parser_done) {
    if (state.pass === 'anchors') {
      const parser = await readBookRecord<IncrementalContentCheckpoint>(storage, state.parser!)
      state.anchor_seal = await sealAnchorLedger(storage, state.anchors, { parser_done: true, produced_fragments: parser.writer.metrics.fragments })
      state.pass = 'body'; state.source = initialFieldSource(); state.parser_done = false; state.needs_drain = false; delete state.parser
      return result()
    }
    if (state.packed) {
      const source = await readBookRecord<BookSegmentSource>(storage, state.packed)
      delete state.packed; state.first = false; state.emitted = true
      return result(source)
    }
    const next = state.field + 1
    if (next === BOOK_FIELDS.length) { state.field = next; return result() }
    state = initialContentPlanning(id, state.first, state.emitted, state.inline, next)
    return result()
  }
  return result(undefined, 0, await parserStep(context, storage, id, counts, state, inputBudget))
}
