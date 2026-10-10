import { contextCursor, integer, object, text, type ContextCursor } from '@/workers/book-renderer/htmlCheckpoint/state'

export type SemanticPending =
  | {kind: 'open'; name: string; tokenEnd: number | null}
  | {kind: 'close'; name: string; tokenEnd: number; phase: 'find' | 'pop' | 'finish'; scan: ContextCursor; target: string | null}
  | {kind: 'eof'; scan: ContextCursor}
export function semanticPending(value: unknown, maximumName: number, stackCount: number): SemanticPending | null {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('HTML_SEMANTIC_CHECKPOINT_INVALID')
  const kind = (value as {kind?: unknown}).kind
  if (kind === 'open') {
    const state = object(value, ['kind', 'name', 'tokenEnd'])
    return {kind, name: text(state.name, maximumName), tokenEnd: state.tokenEnd === null ? null : integer(state.tokenEnd)}
  }
  if (kind === 'eof') {
    const state = object(value, ['kind', 'scan']); const scan = contextCursor(state.scan)
    if (scan.count > stackCount) throw new Error('HTML_SEMANTIC_CHECKPOINT_INVALID')
    return {kind, scan}
  }
  if (kind === 'close') {
    const state = object(value, ['kind', 'name', 'tokenEnd', 'phase', 'scan', 'target'])
    const scan = contextCursor(state.scan); if (scan.count > stackCount) throw new Error('HTML_SEMANTIC_CHECKPOINT_INVALID')
    if (!['find', 'pop', 'finish'].includes(state.phase as string)) throw new Error('HTML_SEMANTIC_CHECKPOINT_INVALID')
    if (state.target !== null && (typeof state.target !== 'string' || !/^[a-f0-9]{64}$/.test(state.target))) throw new Error('HTML_SEMANTIC_CHECKPOINT_INVALID')
    if (state.phase === 'pop' && !state.target) throw new Error('HTML_SEMANTIC_CHECKPOINT_INVALID')
    return {kind, name: text(state.name, maximumName), tokenEnd: integer(state.tokenEnd), phase: state.phase as 'find' | 'pop' | 'finish', scan, target: state.target as string | null}
  }
  throw new Error('HTML_SEMANTIC_CHECKPOINT_INVALID')
}


export type PendingText = ({kind: 'source'; start: number; end: number} | {kind: 'literal'; value: string}) & {eventStartIndex: number; eventEndIndex: number}
/** A tokenizer character can emit a source prefix and at most two entity code points; EOF adds trailing text. */
export function pendingText(value: unknown, sourceLength: number, maximumRange: number): PendingText[] {
  if (!Array.isArray(value) || value.length > 4) throw new Error('HTML_TEXT_CHECKPOINT_INVALID')
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('HTML_TEXT_CHECKPOINT_INVALID')
    if ((item as {kind?: unknown}).kind === 'source') {
      const state = object(item, ['kind', 'start', 'end', 'eventStartIndex', 'eventEndIndex']); const start = integer(state.start, 0, sourceLength)
      const end = integer(state.end, start + 1, Math.min(sourceLength, start + maximumRange))
      return {kind: 'source', start, end, eventStartIndex: integer(state.eventStartIndex, 0, sourceLength), eventEndIndex: integer(state.eventEndIndex, -1, sourceLength)}
    }
    const state = object(item, ['kind', 'value', 'eventStartIndex', 'eventEndIndex'])
    if (state.kind !== 'literal') throw new Error('HTML_TEXT_CHECKPOINT_INVALID')
    const result = text(state.value, 2)
    if (!result) throw new Error('HTML_TEXT_CHECKPOINT_INVALID')
    return {kind: 'literal', value: result, eventStartIndex: integer(state.eventStartIndex, 0, sourceLength), eventEndIndex: integer(state.eventEndIndex, -1, sourceLength)}
  })
}
