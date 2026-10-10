import { integer, text, textCursor, type TextCursor } from '@/workers/book-renderer/htmlCheckpoint/state'

export const SOURCE_BLOCK_CHARS = 1024
export interface TextStore { put(ordinal: number, block: string): void; get(ordinal: number): string }

/** Direct UTF16 addressing preserves even a surrogate split across transfer chunks. */
export class SourceText {
  private cursor: TextCursor = {blocks: 0, tail: '', length: 0}
  constructor(private readonly store: TextStore, private readonly maximumSlice: number) {}
  save(): TextCursor { return {...this.cursor} }
  restore(state: unknown): void { this.cursor = textCursor(state) }
  reset(): void { this.cursor = {blocks: 0, tail: '', length: 0} }
  append(chunk: string): void {
    const length = integer(this.cursor.length + chunk.length)
    let tail = this.cursor.tail + chunk
    let blocks = this.cursor.blocks
    while (tail.length >= SOURCE_BLOCK_CHARS) {
      this.store.put(blocks++, tail.slice(0, SOURCE_BLOCK_CHARS))
      tail = tail.slice(SOURCE_BLOCK_CHARS)
    }
    this.cursor = {blocks, tail, length}
  }
  slice(start: number, end: number): string {
    integer(start); integer(end, start, this.cursor.length)
    if (end - start > this.maximumSlice) throw new Error('HTML_CHECKPOINT_SLICE_LIMIT')
    const parts: string[] = []
    for (let offset = start; offset < end;) {
      const index = Math.floor(offset / SOURCE_BLOCK_CHARS)
      const block = index === this.cursor.blocks ? this.cursor.tail : text(this.store.get(index), SOURCE_BLOCK_CHARS)
      if (index < this.cursor.blocks && block.length !== SOURCE_BLOCK_CHARS) throw new Error('HTML_CHECKPOINT_BLOCK_INVALID')
      const local = offset % SOURCE_BLOCK_CHARS; const count = Math.min(end - offset, block.length - local)
      if (count <= 0) throw new Error('HTML_CHECKPOINT_BLOCK_MISSING')
      parts.push(block.slice(local, local + count)); offset += count
    }
    return parts.join('')
  }
}
