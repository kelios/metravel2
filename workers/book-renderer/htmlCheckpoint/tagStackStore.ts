import { contextCursor, integer, object, text, type ContextCursor } from '@/workers/book-renderer/htmlCheckpoint/state'

export interface TagNode { name: string; next: string | null; count: number }
export interface TagStore { put(node: TagNode): string; get(hash: string): unknown }
export class TagStack {
  private cursor: ContextCursor = {head: null, count: 0}
  constructor(private readonly store: TagStore, private readonly maximumName: number) {}
  save(): ContextCursor { return {...this.cursor} }
  restore(value: unknown): void { this.cursor = contextCursor(value); if (this.cursor.head) this.peek() }
  reset(): void { this.cursor = {head: null, count: 0} }
  peek(): TagNode | undefined {
    if (!this.cursor.head) return undefined
    const value = object(this.store.get(this.cursor.head), ['name', 'next', 'count'])
    const next = contextCursor({head: value.next, count: integer(value.count, 1) - 1})
    if (value.count !== this.cursor.count) throw new Error('HTML_TAG_STACK_COUNT_MISMATCH')
    return {name: text(value.name, this.maximumName), next: next.head, count: this.cursor.count}
  }
  push(name: string): void {
    text(name, this.maximumName)
    const node = {name, next: this.cursor.head, count: integer(this.cursor.count + 1, 1)}
    this.cursor = contextCursor({head: this.store.put(node), count: node.count})
  }
  pop(): TagNode | undefined {
    const node = this.peek()
    if (node) this.cursor = {head: node.next, count: node.count - 1}
    return node
  }
}
