import { boolean, contextCursor, integer, object, type ContextCursor } from '@/workers/book-renderer/htmlCheckpoint/state'

export interface ContextNode { value: boolean; next: string | null; count: number }
export interface ContextStore { put(node: ContextNode): string; get(hash: string): unknown }

/** One immutable node per push; restore/pop never traverse the earlier source. */
export class ForeignContext {
  private cursor: ContextCursor = {head: null, count: 0}
  constructor(private readonly store: ContextStore) {}
  save(): ContextCursor { return {...this.cursor} }
  restore(state: unknown): void { this.cursor = contextCursor(state); if (this.cursor.head) this.node() }
  reset(): void { this.cursor = {head: null, count: 0} }
  private node(): ContextNode | undefined {
    if (!this.cursor.head) return undefined
    const state = object(this.store.get(this.cursor.head), ['value', 'next', 'count'])
    const next = contextCursor({head: state.next, count: integer(state.count, 1) - 1})
    if (state.count !== this.cursor.count) throw new Error('HTML_CONTEXT_COUNT_MISMATCH')
    return {value: boolean(state.value), next: next.head, count: this.cursor.count}
  }
  peek(): boolean | undefined { return this.node()?.value }
  unshift(value: boolean): void {
    const node = {value, next: this.cursor.head, count: integer(this.cursor.count + 1, 1)}
    this.cursor = contextCursor({head: this.store.put(node), count: node.count})
  }
  shift(): boolean | undefined {
    const node = this.node()
    if (!node) return undefined
    this.cursor = {head: node.next, count: node.count - 1}
    return node.value
  }
}
