import { createHash } from 'node:crypto'
import { Parser as OriginalParser } from 'htmlparser2'
import { Parser } from '@/workers/book-renderer/htmlCheckpoint/Parser'
import type { ContextStore } from '@/workers/book-renderer/htmlCheckpoint/contextStore'
import type { TagStore } from '@/workers/book-renderer/htmlCheckpoint/tagStackStore'
import type { TextStore } from '@/workers/book-renderer/htmlCheckpoint/sourceText'
import { validateTokenizerCheckpoint } from '@/workers/book-renderer/htmlCheckpoint/state'
import type { ParserCheckpoint, TokenizerCheckpoint } from '@/workers/book-renderer/htmlCheckpoint/state'
import { htmlDecodeTree } from '@/workers/book-renderer/htmlCheckpoint/entities/htmlDecodeTree'

function memoryStores(): { context: ContextStore; tags: TagStore; text: TextStore } {
  const nodes = new Map<string, string>(); const blocks = new Map<number, string>()
  const linked = {
    put(value: unknown): string {
      const encoded = JSON.stringify(value); const hash = createHash('sha256').update(encoded).digest('hex')
      nodes.set(hash, encoded); return hash
    },
    get(hash: string): unknown { return JSON.parse(nodes.get(hash)!) as unknown },
  }
  return { context: linked, tags: linked, text: {
    put(ordinal, value) { blocks.set(ordinal, value) },
    get(ordinal) { return blocks.get(ordinal)! },
  } }
}

describe('paused named entity prefix rewind across tiny feeds', () => {
  const options = { decodeEntities: true, lowerCaseTags: false, lowerCaseAttributeNames: true }
  const limits = { maxInputChars: 256, maxCarryChars: 65536, maxDepth: 32 }

  it.each(['<p>&notit; &copy next &noti; END</p>', '<title>&notit; &copy next &noti; END</title>'])('retains exact source text for %s after every one-unit checkpoint', (source) => {
    let expected = ''; let actual = ''; let rewinds = 0
    const original = new OriginalParser({ ontext(value) { expected += value } }, options)
    const stores = memoryStores()
    let parser = new Parser({ ontext(value) { actual += value } }, { ...options, boundedTextCallbacks: true }, stores, limits)
    for (const char of source) {
      original.write(char); parser.write(char)
      while (parser.needsDrain()) {
        parser.advance(1)
        const state = parser.save()
        if (state.tokenizer.index < state.tokenizer.offset) rewinds++
        parser = new Parser({ ontext(value) { actual += value } }, { ...options, boundedTextCallbacks: true }, stores, limits)
        parser.restore(JSON.parse(JSON.stringify(state)) as unknown)
      }
      const state: ParserCheckpoint = parser.save()
      parser = new Parser({ ontext(value) { actual += value } }, { ...options, boundedTextCallbacks: true }, stores, limits)
      parser.restore(JSON.parse(JSON.stringify(state)) as unknown)
    }
    original.end(); parser.end(); while (parser.needsDrain()) parser.advance(1)
    expect(rewinds).toBeGreaterThan(0)
    expect(actual).toBe(expected)
    expect(actual).toBe('¬it; © next ¬i; END')
  })

  it('rejects unrelated forged offsets and inconsistent entity rewind receipts', () => {
    // Legal paused state immediately after `&not` wins over the failed `&notit` trie branch.
    const state: TokenizerCheckpoint = { version: 1, state: 1, baseState: 1, buffer: 't', offset: 28, index: 27,
      sectionStart: 27, entityStart: 23, isSpecial: false, running: false, finished: false,
      currentSequence: null, sequenceIndex: 0,
      entity: { version: 1, state: 4, consumed: 4, result: 8615, treeIndex: -1, excess: 2, decodeMode: 0, runConsumed: 0 } }
    const validate = (value: TokenizerCheckpoint) => validateTokenizerCheckpoint(value, 256, htmlDecodeTree.length)
    expect(validate(state)).toEqual(state)
    const invalid = [
      { ...state, running: true }, { ...state, state: 3 }, { ...state, baseState: 3 },
      { ...state, index: 26 }, { ...state, sectionStart: 26 }, { ...state, offset: 29 },
      ...[{ decodeMode: 1 }, { state: 2 }, { treeIndex: 0 }, { consumed: 3 }, { excess: 1 }, { result: 0 }]
        .map((entity) => ({ ...state, entity: { ...state.entity, ...entity } })),
    ]
    for (const value of invalid) expect(() => validate(value)).toThrow('HTML_CHECKPOINT_INVALID')
  })
})
