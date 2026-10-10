import { Parser } from '@/workers/book-renderer/htmlCheckpoint/Parser'
import type { ContextStore } from '@/workers/book-renderer/htmlCheckpoint/contextStore'
import type { TagStore } from '@/workers/book-renderer/htmlCheckpoint/tagStackStore'
import type { TextStore } from '@/workers/book-renderer/htmlCheckpoint/sourceText'
import { object, limits, type ParserCheckpoint } from '@/workers/book-renderer/htmlCheckpoint/state'
import { FragmentWriter, IncrementalContentError, TokenBudget } from '@/services/pdf-export/parsers/incrementalContent'
import type { IncrementalContentOptions, SafeContentFragment, TokenBudgetCheckpoint } from '@/services/pdf-export/parsers/incrementalContent'
import type { FragmentWriterCheckpoint } from '@/services/pdf-export/parsers/incrementalContentState'

/** Constructor receipt plus at most one 1024-unit source block for a <=256-unit feed. */
export const MAX_FIXED_CHECKPOINT_STORE_WRITES_PER_STEP = 2
/** An opening name can publish one tag-stack node and one foreign-context node. */
export const MAX_CHECKPOINT_STORE_WRITES_PER_TRANSITION = 2
/** <=3 atomic writer callbacks plus <=2 open/void callbacks while resuming the retained feed. Each flushes <=2 fragments. */
export const MAX_FRAGMENT_OUTPUTS_PER_TRANSITION = 10
/** Initial lexical resume may finish one open/void pair; final Writer.finish adds <=2. */
export const MAX_FIXED_FRAGMENT_OUTPUTS_PER_STEP = 6

export interface IncrementalContentCheckpoint {
  version: 1; parser: ParserCheckpoint; writer: FragmentWriterCheckpoint; token: TokenBudgetCheckpoint; done: boolean; eofRequested: boolean
}
export interface IncrementalStepOptions extends IncrementalContentOptions {
  stores: {context: ContextStore; text: TextStore; tags: TagStore}
  /** Immutable anchor-index identity; the function itself is never serialized. */
  anchorPolicy?: string
  eof?: boolean
  maxSemanticTransitions?: number
}

/** A bounded original feed; only true field EOF ends the canonical parser/writer. */
export function incrementalContentStep(input: string, prior: unknown | undefined, options: IncrementalStepOptions): {
  fragments: SafeContentFragment[]; checkpoint: IncrementalContentCheckpoint; done: boolean; needsDrain: boolean; acceptedChars: number
} {
  const maxFragment = options.maxFragmentChars ?? 1024; const maxDepth = options.maxDepth ?? 32
  if (!Number.isSafeInteger(maxFragment) || maxFragment < 256 || maxFragment > 1048576) throw new IncrementalContentError('INVALID_INGESTION_BUDGET')
  const bound = limits({maxInputChars: Math.min(256, Math.floor(maxFragment / 4)), maxCarryChars: options.maxTokenChars ?? 65536, maxDepth})
  if (typeof input !== 'string' || input.length > bound.maxInputChars) throw new IncrementalContentError('SOURCE_CHUNK_TOO_LARGE')
  const maximum = options.maxSemanticTransitions ?? 32
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 128) throw new IncrementalContentError('INVALID_SEMANTIC_BUDGET')
  const writer = new FragmentWriter(maxFragment, maxDepth, options.headingAnchorResolver, options.preserveListStarts, options.expandDisclosures)
  const token = new TokenBudget(bound.maxCarryChars)
  const parser = new Parser({onopentag: (name, attrs) => writer.open(name, attrs), onclosetag: name => writer.close(name), ontext: value => writer.text(value),
    onerror: error => { throw error }}, {decodeEntities: true, lowerCaseTags: false, lowerCaseAttributeNames: true, boundedTextCallbacks: true}, options.stores, bound)
  let eofRequested = false
  if (prior !== undefined) {
    const state = object(prior, ['version', 'parser', 'writer', 'token', 'done', 'eofRequested'])
    if (state.version !== 1 || state.done !== false) throw new IncrementalContentError('CONTENT_CHECKPOINT_FINISHED_OR_INVALID')
    if (typeof state.eofRequested !== 'boolean') throw new IncrementalContentError('CONTENT_CHECKPOINT_INVALID')
    eofRequested = state.eofRequested
    parser.restore(state.parser); writer.restore(state.writer, options.anchorPolicy); token.restore(state.token)
  }
  if (input.length && (eofRequested || parser.needsDrain())) throw new IncrementalContentError('CONTENT_CHECKPOINT_BACKPRESSURE')
  if (input.length) { token.feed(input); parser.write(input) }
  eofRequested ||= options.eof === true
  const used = parser.advance(maximum)
  if (eofRequested && !parser.needsDrain() && !parser.eofRequested()) {
    parser.end(); parser.advance(maximum - used)
  }
  const done = parser.isComplete()
  if (done) writer.finish()
  const fragments = writer.ready.splice(0)
  const checkpoint: IncrementalContentCheckpoint = {version: 1, parser: parser.save(), writer: writer.save(options.anchorPolicy), token: token.save(), done, eofRequested}
  if (done) options.onMetrics?.({...writer.metrics})
  return {fragments, checkpoint, done, needsDrain: parser.needsDrain() || (eofRequested && !done), acceptedChars: input.length}
}
