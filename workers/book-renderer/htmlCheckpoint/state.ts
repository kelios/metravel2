import { semanticPending, pendingText, type PendingText, type SemanticPending } from '@/workers/book-renderer/htmlCheckpoint/semanticState'
import { HTML_PORT_UPSTREAM_PIN } from '@/workers/book-renderer/htmlCheckpoint/protocol'
import { State, Sequences } from '@/workers/book-renderer/htmlCheckpoint/lexicalDefinitions'

export const HTML_CHECKPOINT_PROTOCOL = 1 as const
export interface CheckpointLimits { maxInputChars: number; maxCarryChars: number; maxDepth: number }
export interface ContextCursor { head: string | null; count: number }
export interface TextCursor { blocks: number; tail: string; length: number }
export interface EntityCheckpoint {
  version: 1; state: number; consumed: number; result: number | 'positive_infinity'
  treeIndex: number; excess: number; decodeMode: number; runConsumed: number
}
export interface TokenizerCheckpoint {
  version: 1; state: number; buffer: string; sectionStart: number; index: number; entityStart: number
  baseState: number; isSpecial: boolean; running: boolean; finished: boolean; offset: number
  currentSequence: keyof typeof Sequences | null; sequenceIndex: number; entity: EntityCheckpoint
}
export interface ParserCheckpoint {
  version: 1; upstreamPin: typeof HTML_PORT_UPSTREAM_PIN; limits: CheckpointLimits; options: {xmlMode: boolean; decodeEntities: boolean; lowerCaseTags: boolean; lowerCaseAttributeNames: boolean; recognizeSelfClosing: boolean; recognizeCDATA: boolean; boundedTextCallbacks: boolean}
  startIndex: number; endIndex: number; openTagStart: number; tagname: string; attribname: string
  attribvalue: string; attribs: Record<string, string> | null; stack: ContextCursor; ended: boolean; pending: SemanticPending | null; textQueue: PendingText[]; completed: boolean
  foreignContext: ContextCursor; sourceText: TextCursor; tokenizer: TokenizerCheckpoint
}
export function fail(): never { throw new Error('HTML_CHECKPOINT_INVALID') }
export function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const result = value as Record<string, unknown>
  if (Object.keys(result).length !== keys.length || keys.some(key => !Object.hasOwn(result, key))) return fail()
  return result
}
export function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) return fail()
  return value
}
export function boolean(value: unknown): boolean { if (typeof value !== 'boolean') return fail(); return value }
export function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum) return fail()
  return value
}
export function limits(value: unknown): CheckpointLimits {
  const state = object(value, ['maxInputChars', 'maxCarryChars', 'maxDepth'])
  return { maxInputChars: integer(state.maxInputChars, 1, 65536), maxCarryChars: integer(state.maxCarryChars, 64, 1048576), maxDepth: integer(state.maxDepth, 1, 128) }
}
export function contextCursor(value: unknown): ContextCursor {
  const state = object(value, ['head', 'count']); const count = integer(state.count)
  if (state.head !== null && (typeof state.head !== 'string' || !/^[a-f0-9]{64}$/.test(state.head))) return fail()
  if ((state.head === null) !== (count === 0)) return fail()
  return { head: state.head as string | null, count }
}
export function textCursor(value: unknown): TextCursor {
  const state = object(value, ['blocks', 'tail', 'length'])
  const result = { blocks: integer(state.blocks, 0, Math.floor(Number.MAX_SAFE_INTEGER / 1024)), tail: text(state.tail, 1023), length: integer(state.length) }
  if (result.length !== result.blocks * 1024 + result.tail.length) return fail()
  return result
}
export function attributes(value: unknown, maximum: number): Record<string, string> | null {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const entries = Object.entries(value as Record<string, unknown>); let size = 0
  const result: Record<string, string> = {}
  for (const [key, item] of entries) {
    size += key.length + text(item, maximum).length
    if (size > maximum || key === '__proto__') return fail()
    result[key] = item as string
  }
  return result
}
export function validateEntityCheckpoint(value: unknown, treeLength: number): EntityCheckpoint {
  const state = object(value, ['version', 'state', 'consumed', 'result', 'treeIndex', 'excess', 'decodeMode', 'runConsumed'])
  if (state.version !== 1) return fail()
  const result = state.result === 'positive_infinity' ? state.result : state.result
  if (result !== 'positive_infinity' && (typeof result !== 'number' || !Number.isFinite(result) || result < 0 || !Number.isInteger(result))) return fail()
  return {version: 1, state: integer(state.state, 0, 4), consumed: integer(state.consumed, 1), result,
    treeIndex: integer(state.treeIndex, -1, treeLength - 1), excess: integer(state.excess, 0), decodeMode: integer(state.decodeMode, 0, 2), runConsumed: integer(state.runConsumed)}
}
export function validateTokenizerCheckpoint(value: unknown, maximum: number, treeLength: number): TokenizerCheckpoint {
  const state = object(value, ['version', 'state', 'buffer', 'sectionStart', 'index', 'entityStart', 'baseState', 'isSpecial', 'running', 'finished', 'offset', 'currentSequence', 'sequenceIndex', 'entity'])
  if (state.version !== 1) return fail()
  const sequence = state.currentSequence
  if (sequence !== null && (typeof sequence !== 'string' || !Object.hasOwn(Sequences, sequence))) return fail()
  const result: TokenizerCheckpoint = {version: 1, state: integer(state.state, 1, State.InEntity), buffer: text(state.buffer, maximum),
    sectionStart: integer(state.sectionStart, -1), index: integer(state.index), entityStart: integer(state.entityStart),
    baseState: integer(state.baseState, 1, State.InEntity), isSpecial: boolean(state.isSpecial), running: boolean(state.running), finished: boolean(state.finished), offset: integer(state.offset),
    currentSequence: sequence as keyof typeof Sequences | null, sequenceIndex: integer(state.sequenceIndex, 0, 12), entity: validateEntityCheckpoint(state.entity, treeLength)}
  const sourceEnd = result.offset + result.buffer.length
  if (result.finished) {
    // EOF entity decoding can rewind index to its consumed prefix without a
    // following parse-loop increment. Trailing original text is still emitted.
    if (result.state === State.InEntity || result.index > sourceEnd || result.sectionStart > sourceEnd
      || result.sectionStart > result.index + 1 || result.index < Math.max(0, result.entityStart - 1)) return fail()
  } else {
    // A legacy named entity can settle on an earlier prefix (`&notit;` ->
    // `&not` + `it;`). A bounded text callback pauses after the lexical rewind,
    // before the remaining original source is reconsumed across tiny feeds.
    const entityRewind = !result.running && result.state === result.baseState &&
      (result.state === State.Text || result.state === State.InSpecialTag) &&
      result.entity.state === 4 && result.entity.decodeMode === 0 && result.entity.treeIndex === -1 &&
      typeof result.entity.result === 'number' && result.entity.result > 0 &&
      result.entity.consumed > 1 && result.index === result.entityStart + result.entity.consumed &&
      result.sectionStart === result.index && result.offset - result.index < result.entity.excess
    if ((result.index < result.offset && !entityRewind) || result.index > sourceEnd + 1 || result.sectionStart > result.index) return fail()
  }
  if (result.state === State.CDATASequence) {
    if (result.sequenceIndex > Sequences.Cdata.length) return fail()
  } else if ([State.SpecialStartSequence, State.InSpecialTag, State.InCommentLike].includes(result.state)) {
    if (!result.currentSequence || result.sequenceIndex > Sequences[result.currentSequence].length) return fail()
  }
  return result
}
export function validateParserCheckpoint(value: unknown, treeLength: number): ParserCheckpoint {
  const state = object(value, ['version', 'upstreamPin', 'limits', 'options', 'startIndex', 'endIndex', 'openTagStart', 'tagname', 'attribname', 'attribvalue', 'attribs', 'stack', 'ended', 'pending', 'textQueue', 'completed', 'foreignContext', 'sourceText', 'tokenizer'])
  if (state.version !== 1 || state.upstreamPin !== HTML_PORT_UPSTREAM_PIN) return fail()
  const bound = limits(state.limits); const optionsState = object(state.options, ['xmlMode', 'decodeEntities', 'lowerCaseTags', 'lowerCaseAttributeNames', 'recognizeSelfClosing', 'recognizeCDATA', 'boundedTextCallbacks'])
  const options = {xmlMode: boolean(optionsState.xmlMode), decodeEntities: boolean(optionsState.decodeEntities), lowerCaseTags: boolean(optionsState.lowerCaseTags),
    lowerCaseAttributeNames: boolean(optionsState.lowerCaseAttributeNames), recognizeSelfClosing: boolean(optionsState.recognizeSelfClosing), recognizeCDATA: boolean(optionsState.recognizeCDATA), boundedTextCallbacks: boolean(optionsState.boundedTextCallbacks)}
  const stack = contextCursor(state.stack); const pending = semanticPending(state.pending, bound.maxCarryChars, stack.count)
  const completed = boolean(state.completed)
  const ended = boolean(state.ended); const sourceText = textCursor(state.sourceText)
  const textQueue = pendingText(state.textQueue, sourceText.length, bound.maxCarryChars)
  if (!options.boundedTextCallbacks && textQueue.length) return fail()
  const tokenizer = validateTokenizerCheckpoint(state.tokenizer, bound.maxInputChars, treeLength)
  if (sourceText.length !== tokenizer.offset + tokenizer.buffer.length) return fail()
  if ((pending || textQueue.length) && tokenizer.running) return fail()
  if (completed && (!ended || !tokenizer.finished || pending || textQueue.length)) return fail()
  if (tokenizer.finished && (!ended || (!completed && pending?.kind !== 'eof'))) return fail()
  if (pending?.kind === 'eof' && (!ended || !tokenizer.finished)) return fail()
  return {version: 1, upstreamPin: HTML_PORT_UPSTREAM_PIN, limits: bound, options, startIndex: integer(state.startIndex), endIndex: integer(state.endIndex, -1), openTagStart: integer(state.openTagStart),
    tagname: text(state.tagname, bound.maxCarryChars), attribname: text(state.attribname, bound.maxCarryChars), attribvalue: text(state.attribvalue, bound.maxCarryChars),
    attribs: attributes(state.attribs, bound.maxCarryChars), stack, ended, pending, textQueue, completed, foreignContext: contextCursor(state.foreignContext),
    sourceText, tokenizer}
}
