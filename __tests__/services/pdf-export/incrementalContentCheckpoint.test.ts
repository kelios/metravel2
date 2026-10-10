import { createHash } from 'node:crypto'
import { Parser as OriginalParser } from 'htmlparser2'
import { Parser as CheckpointParser } from '@/workers/book-renderer/htmlCheckpoint/Parser'
import { ForeignContext } from '@/workers/book-renderer/htmlCheckpoint/contextStore'
import type { ContextNode, ContextStore } from '@/workers/book-renderer/htmlCheckpoint/contextStore'
import type { TagStore } from '@/workers/book-renderer/htmlCheckpoint/tagStackStore'
import type { TextStore } from '@/workers/book-renderer/htmlCheckpoint/sourceText'
import { incrementalContentStep } from '@/workers/book-renderer/htmlCheckpoint/incrementalStep'
import type { IncrementalContentCheckpoint } from '@/workers/book-renderer/htmlCheckpoint/incrementalStep'
import { FragmentWriter, incrementalContent } from '@/services/pdf-export/parsers/incrementalContent'
import type { IncrementalContentOptions, SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'

function memoryStores(): {context: ContextStore; text: TextStore; tags: TagStore; operations: {get: number; put: number}} {
  const nodes = new Map<string, string>(); const blocks = new Map<number, string>(); const operations = {get: 0, put: 0}
  return {operations, tags: {
    put(node): string { const value = JSON.stringify(node); const hash = createHash('sha256').update(value).digest('hex'); nodes.set(hash, value); return hash },
    get(hash): unknown { const value = nodes.get(hash); if (!value) throw new Error('Missing tag'); return JSON.parse(value) as unknown },
  }, context: {
    put(node: ContextNode): string { operations.put++; const value = JSON.stringify(node); const sha = createHash('sha256').update(value).digest('hex'); nodes.set(sha, value); return sha },
    get(hash: string): unknown { operations.get++; const value = nodes.get(hash); if (!value) throw new Error('Missing context'); return JSON.parse(value) as unknown },
  }, text: {
    put(index: number, value: string): void { const existing = blocks.get(index); if (existing !== undefined && existing !== value) throw new Error('Immutable source mismatch'); blocks.set(index, value) },
    get(index: number): string { const value = blocks.get(index); if (value === undefined) throw new Error('Missing source block'); return value },
  }}
}
async function* chunks(source: string, size: number): AsyncGenerator<string> {
  for (let index = 0; index < source.length; index += size) yield source.slice(index, index + size)
}
async function legacy(source: string, read: number, options: IncrementalContentOptions): Promise<SafeContentFragment[]> {
  const result: SafeContentFragment[] = []
  for await (const fragment of incrementalContent(chunks(source, read), options)) result.push(fragment)
  return result
}
function durable(source: string, read: number, options: IncrementalContentOptions): SafeContentFragment[] {
  const stores = memoryStores(); const result: SafeContentFragment[] = []; let checkpoint: IncrementalContentCheckpoint | undefined
  const feedSize = Math.min(256, Math.floor((options.maxFragmentChars ?? 1024) / 4))
  for (let outer = 0; outer < source.length; outer += read) {
    const chunk = source.slice(outer, outer + read)
    for (let offset = 0; offset < chunk.length; offset += feedSize) {
      const step = incrementalContentStep(chunk.slice(offset, offset + feedSize), checkpoint, {stores, ...options})
      result.push(...step.fragments)
      checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
      let draining = step.needsDrain
      while (draining) {
        const next = incrementalContentStep('', checkpoint, {stores, ...options})
        result.push(...next.fragments); checkpoint = JSON.parse(JSON.stringify(next.checkpoint)) as IncrementalContentCheckpoint; draining = next.needsDrain
      }
    }
  }
  let ending = incrementalContentStep('', checkpoint, {stores, ...options, eof: true})
  result.push(...ending.fragments)
  while (!ending.done) { ending = incrementalContentStep('', ending.checkpoint, {stores, ...options}); result.push(...ending.fragments) }
  return result
}
const htmlCases = [
  '<p>&#' + '9'.repeat(400) + '; &#x' + 'F'.repeat(400) + '; END</p>',
  '<p>A &amp; B &notin; C &notit; &#x1F600; &#128512; &#0; &#x80; &copy next\r\n\t</p>',
  '<p>FIRST<p>SECOND<ul><li>ONE<li>TWO<ol start="7"><li>THREE</ol></ul></p></br>TAIL',
  '<table><thead><tr><th>H1<th>H2</thead><tbody><tr><td>' + 'CELL😀 '.repeat(180) + '<td>LAST<tr><td>ROW2</table>',
  '<details id="faq"><summary>QUESTION</summary><p>ANSWER &amp; '+ 'A😀'.repeat(180) + '</p><details><summary>NESTED</summary><ol><li>ONE<li>TWO</ol></details></details>',
  '<script>IGNORE <foo>&amp;</script><style>IGNORE</style><textarea>&copy;</textarea><xmp>RAW <tag> &amp;</xmp><title>Title &amp; &copy;</title>TAIL',
  '<!-- comment with <tag> and -- < -->A<![CDATA[<data> &amp; ]]]>B<?pi foo?><!doctype html>C',
  '<svg><foreignobject></svg><div/>TAIL' + '<svg><foreignobject></svg>'.repeat(70) + '</svg>'.repeat(69) + '<section/>END',
  '<SVG><g attr="<&amp;\'">TEXT</g></SVG><annotation-xml><div/>D</annotation-xml><mi>M</mi>',
  '<h2 id="heading">TITLE</h2><a href="#heading">link</a><img data-src="https://example.com/a?x=1&amp;y=2"><img src="https://example.com/b.jpg">',
  '<div data-x="ends &noti" data-y=&#x1F600; data-z="&quot;">😀\ud800X\udc00 &unfinished',
  '<p>TEXT<!-- unfinished comment',
]
describe('owned durable canonical content checkpoint', () => {
  it.each(['<p>A<p>B</p>', '<img><IMG></IMG>TAIL', '<svg><g/></svg><br></br><p>', '<DIV><IMG><IMG></DIV>TAIL'])('restores a same-character opening delimiter after every transition: %s', source => {
    const actual: unknown[] = []; const original: unknown[] = []; const stores = memoryStores()
    const options = {lowerCaseTags: false, lowerCaseAttributeNames: true}
    const limits = {maxInputChars: 256, maxCarryChars: 65536, maxDepth: 32}
    let port: CheckpointParser
    let upstream: OriginalParser
    const handler = (target: unknown[], parser: () => CheckpointParser | OriginalParser) => ({
      onopentagname: (name: string) => target.push(['name', name, parser().startIndex, parser().endIndex]),
      onopentag: (name: string, attrs: Record<string, string>, implied: boolean) => target.push(['open', name, attrs, implied, parser().startIndex, parser().endIndex]),
      onclosetag: (name: string, implied: boolean) => target.push(['close', name, implied, parser().startIndex, parser().endIndex]),
      ontext: (value: string) => target.push(['text', value, parser().startIndex, parser().endIndex]),
      onend: () => target.push(['end', parser().startIndex, parser().endIndex]),
    })
    upstream = new OriginalParser(handler(original, () => upstream), options)
    const fresh = (): CheckpointParser => new CheckpointParser(handler(actual, () => port), options, stores, limits)
    port = fresh(); upstream.write(source); port.write(source)
    expect(actual).toEqual([])
    expect(port.save().pending).toMatchObject({kind: 'open', tokenEnd: source.indexOf('>')})
    const restore = (): void => { const state = JSON.parse(JSON.stringify(port.save())) as unknown; port = fresh(); port.restore(state) }
    restore()
    while (port.needsDrain()) { port.advance(1); restore() }
    upstream.end(); port.end(); restore()
    const eofStack = port.save().stack
    while (port.needsDrain()) { port.advance(1); restore(); expect(port.save().stack).toEqual(eofStack) }
    expect(actual).toEqual(original)
    expect(actual.filter(event => (event as unknown[])[0] === 'end')).toHaveLength(1)
  })
  it.each([1, 17, 257, 65536])('keeps exact legacy fragments after fresh restoration for read=%d', async read => {
    for (const [fixture, source] of htmlCases.entries()) {
      const options = {maxFragmentChars: 512, expandDisclosures: true, preserveListStarts: true}
      try { expect(durable(source, read, options)).toEqual(await legacy(source, read, options)) }
      catch (error) { throw new Error(`Checkpoint parity fixture=${fixture} read=${read}: ${error instanceof Error ? error.message : String(error)}`) }
    }
  })
  it.each(['&#65', '&#x1F600', '&copy', '&noti'])('retains exact genuine EOF entity behavior for %s', async source => {
    expect(durable(source, 1, {})).toEqual(await legacy(source, 1, {}))
  })
  it('checkpoints the CDATA prefix matcher independently of a stale preceding comment matcher', async () => {
    const stores = memoryStores(); const prefix = '<!-- X --><![CDAT'
    const first = incrementalContentStep(prefix, undefined, {stores})
    expect(first.checkpoint.parser.tokenizer.currentSequence).toBe('CommentEnd')
    expect(first.checkpoint.parser.tokenizer.sequenceIndex).toBe(4)
    let end = incrementalContentStep('A[body]]>TAIL', first.checkpoint, {stores, eof: true})
    const output = [...first.fragments, ...end.fragments]
    while (!end.done) { end = incrementalContentStep('', end.checkpoint, {stores}); output.push(...end.fragments) }
    expect(output).toEqual(await legacy(prefix + 'A[body]]>TAIL', 17, {}))
  })
  it('retains accepted legacy uppercase void elements with a disk stack and bounded EOF drains', async () => {
    const source = '<IMG src="https://example.com/a.jpg">'.repeat(40)
    const expected = await legacy(source, 17, {})
    expect(expected.flatMap(fragment => fragment.imageOccurrences)).toHaveLength(40)
    expect(durable(source, 17, {})).toEqual(expected)
  })
  it('preserves default disclosure policy, anchors, media ordinals and plain huge paragraphs', async () => {
    const source = '<details><summary>Q</summary><p>' + 'hello😀 &amp; '.repeat(2000) + '</p></details>'
      + '<ol><li>' + 'long '.repeat(600) + '</li><li>LAST</li></ol><img src="https://example.com/a.jpg">'
    expect(durable(source, 17, {})).toEqual(await legacy(source, 17, {}))
    const bare = 'Bare paragraph 😀 &amp; '.repeat(6000)
    expect(durable(bare, 17, {})).toEqual(await legacy(bare, 17, {}))
    const linked = '<h2>H</h2><p><a href="#anchor-1">GO</a></p>'
    const options = {headingAnchorResolver: (ordinal: number) => `anchor-${ordinal}`}
    const stores = memoryStores(); const first = incrementalContentStep(linked.slice(0, 8), undefined, {...options, stores, anchorPolicy: 'index-1'})
    expect(() => incrementalContentStep(linked.slice(8), first.checkpoint, {...options, stores, anchorPolicy: 'index-2', eof: true})).toThrow('FRAGMENT_CHECKPOINT_POLICY_MISMATCH')
  })
  it('retains hidden foreign contexts with O(1) restore work and distinguishes empty from false', () => {
    const stores = memoryStores(); const context = new ForeignContext(stores.context)
    expect(context.peek()).toBeUndefined(); context.unshift(false); expect(context.peek()).toBe(false)
    for (let index = 0; index < 20000; index++) context.unshift(index % 2 === 0)
    const cursor = context.save(); const before = stores.operations.get
    const resumed = new ForeignContext(stores.context); resumed.restore(JSON.parse(JSON.stringify(cursor)) as unknown)
    expect(stores.operations.get - before).toBe(1)
    expect(resumed.shift()).toBe(false); expect(resumed.peek()).toBe(true)
    expect(resumed.save().count).toBe(20000)
  })
  it('preserves public callback order for malformed foreign HTML and split entities/raw text', () => {
    for (const source of htmlCases) {
      const original: unknown[] = []; const actual: unknown[] = []
      const handler = (target: unknown[]) => ({onopentag: (name: string, attrs: Record<string, string>, implied: boolean) => target.push(['open', name, attrs, implied]),
        onclosetag: (name: string, implied: boolean) => target.push(['close', name, implied]), ontext: (text: string) => target.push(['text', text]),
        oncomment: (text: string) => target.push(['comment', text])})
      const options = {decodeEntities: true, lowerCaseTags: false, lowerCaseAttributeNames: true}
      const upstream = new OriginalParser(handler(original), options); const stores = memoryStores()
      let port = new CheckpointParser(handler(actual), options, stores, {maxInputChars: 256, maxCarryChars: 65536, maxDepth: 32})
      for (let offset = 0; offset < source.length; offset += 17) {
        const chunk = source.slice(offset, offset + 17); upstream.write(chunk); port.write(chunk); while (port.needsDrain()) port.advance(1)
        const checkpoint: unknown = JSON.parse(JSON.stringify(port.save()))
        port = new CheckpointParser(handler(actual), options, stores, {maxInputChars: 256, maxCarryChars: 65536, maxDepth: 32}); port.restore(checkpoint)
      }
      upstream.end(); port.end(); while (port.needsDrain()) port.advance(1); expect(actual).toEqual(original)
    }
  })
  it('rejects invalid policy/state, duplicate EOF and indivisible lexical oversize without returning partial success', () => {
    const stores = memoryStores(); const first = incrementalContentStep('<p>hello', undefined, {stores})
    expect(() => incrementalContentStep('tail', first.checkpoint, {stores, expandDisclosures: true})).toThrow('FRAGMENT_CHECKPOINT_POLICY_MISMATCH')
    const corrupted = {...first.checkpoint, parser: {...first.checkpoint.parser, sourceText: {...first.checkpoint.parser.sourceText, length: 999}}}
    expect(() => incrementalContentStep('tail', corrupted, {stores})).toThrow('HTML_CHECKPOINT_INVALID')
    const done = incrementalContentStep('</p>', first.checkpoint, {stores, eof: true})
    expect(() => incrementalContentStep('', done.checkpoint, {stores, eof: true})).toThrow('CONTENT_CHECKPOINT_FINISHED_OR_INVALID')
    const huge = '&#' + '0'.repeat(200)
    let state: IncrementalContentCheckpoint | undefined; const hugeStores = memoryStores()
    expect(() => { for (let offset = 0; offset < huge.length; offset += 32) state = incrementalContentStep(huge.slice(offset, offset + 32), state, {stores: hugeStores, maxTokenChars: 64}).checkpoint }).toThrow('HTML_CHECKPOINT_TOKEN_LIMIT')
  })
  it('backpressures a retained feed and drains deep lookup/EOF one transition at a time without source replay', async () => {
    const source = '<DIV>' + '<IMG src="https://example.com/a.jpg">'.repeat(180) + '</DIV>TAIL'
    const stores = memoryStores(); const actual: SafeContentFragment[] = []; let checkpoint: IncrementalContentCheckpoint | undefined
    let maxState = 0; let drains = 0
    for (let offset = 0; offset < source.length; offset += 64) {
      let step = incrementalContentStep(source.slice(offset, offset + 64), checkpoint, {stores, maxSemanticTransitions: 1})
      expect(step.acceptedChars).toBe(source.slice(offset, offset + 64).length)
      actual.push(...step.fragments); checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
      if (step.needsDrain) expect(() => incrementalContentStep('NEW', checkpoint, {stores})).toThrow('CONTENT_CHECKPOINT_BACKPRESSURE')
      while (step.needsDrain) {
        step = incrementalContentStep('', checkpoint, {stores, maxSemanticTransitions: 1}); drains++
        expect(step.acceptedChars).toBe(0); actual.push(...step.fragments)
        maxState = Math.max(maxState, JSON.stringify(step.checkpoint).length)
        checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
      }
    }
    let ending = incrementalContentStep('', checkpoint, {stores, eof: true, maxSemanticTransitions: 1}); actual.push(...ending.fragments)
    while (!ending.done) { ending = incrementalContentStep('', JSON.parse(JSON.stringify(ending.checkpoint)) as unknown, {stores, maxSemanticTransitions: 1}); actual.push(...ending.fragments); drains++ }
    expect(actual).toEqual(await legacy(source, 64, {})); expect(drains).toBeGreaterThan(360); expect(maxState).toBeLessThan(16000)
    const eofSource = '<IMG src="https://example.com/a.jpg">'.repeat(2000)
    expect(durable(eofSource, 257, {})).toEqual(await legacy(eofSource, 257, {}))
  })
  it('bounds accepted unfinished processing-instruction EOF text without changing exact tiny-payload fragments', async () => {
    const source = '<div data-x="' + 'a'.repeat(234) + '"><?' + 'X'.repeat(60000)
    const expected = await legacy(source, 257, {maxFragmentChars: 512})
    expect(expected.length).toBeGreaterThan(50000)
    const stores = memoryStores(); const actual: SafeContentFragment[] = []; let checkpoint: IncrementalContentCheckpoint | undefined
    let maxFragments = 0; let maxState = 0; let eofRange = false
    const accept = (step: ReturnType<typeof incrementalContentStep>): void => {
      maxFragments = Math.max(maxFragments, step.fragments.length); actual.push(...step.fragments)
      maxState = Math.max(maxState, JSON.stringify(step.checkpoint).length)
      eofRange ||= step.checkpoint.parser.ended && step.checkpoint.parser.textQueue.some(event => event.kind === 'source' && event.end - event.start > 50000)
      checkpoint = JSON.parse(JSON.stringify(step.checkpoint)) as IncrementalContentCheckpoint
    }
    for (let offset = 0; offset < source.length; offset += 128) {
      let step = incrementalContentStep(source.slice(offset, offset + 128), checkpoint, {stores, maxFragmentChars: 512, maxSemanticTransitions: 1}); accept(step)
      while (step.needsDrain) { step = incrementalContentStep('', checkpoint, {stores, maxFragmentChars: 512, maxSemanticTransitions: 1}); accept(step) }
    }
    let end = incrementalContentStep('', checkpoint, {stores, maxFragmentChars: 512, maxSemanticTransitions: 1, eof: true}); accept(end)
    while (!end.done) { end = incrementalContentStep('', checkpoint, {stores, maxFragmentChars: 512, maxSemanticTransitions: 1}); accept(end) }
    expect(eofRange).toBe(true); expect(maxFragments).toBeLessThanOrEqual(2); expect(maxState).toBeLessThan(16000)
    expect(actual).toEqual(expected)
  }, 120000)
  it('retains entity fanout and original text-event source indices while draining before special-tag close/EOF', () => {
    const source = '<title>prefix &NotEqualTilde; suffix</title>TAIL &noti'
    const stores = memoryStores(); const actual: Array<[string, number, number]> = []; const original: Array<[string, number, number]> = []
    const upstream = new OriginalParser({ontext: value => original.push([value, upstream.startIndex, upstream.endIndex])}, {lowerCaseTags: false})
    const port = new CheckpointParser({ontext: value => actual.push([value, port.startIndex, port.endIndex])}, {lowerCaseTags: false, boundedTextCallbacks: true}, stores, {maxInputChars: 256, maxCarryChars: 65536, maxDepth: 32})
    upstream.write(source); upstream.end(); port.write(source)
    let maxQueue = port.save().textQueue.length
    while (port.needsDrain()) { port.advance(1); maxQueue = Math.max(maxQueue, port.save().textQueue.length) }
    port.end(); while (port.needsDrain()) { port.advance(1); maxQueue = Math.max(maxQueue, port.save().textQueue.length) }
    const coalesce = (events: Array<[string, number, number]>): Array<[string, number, number]> => events.reduce<Array<[string, number, number]>>((result, event) => {
      const previous = result.at(-1)
      if (previous && previous[1] === event[1] && previous[2] === event[2]) previous[0] += event[0]
      else result.push([...event])
      return result
    }, [])
    expect(maxQueue).toBeGreaterThanOrEqual(2); expect(maxQueue).toBeLessThanOrEqual(4)
    expect(coalesce(actual)).toEqual(coalesce(original))
  })
  it('requires drained queues and copies writer state without mutating saved checkpoints', () => {
    const writer = new FragmentWriter(512, 32); writer.open('p', {}); writer.text('Hello')
    const state = writer.save(); writer.text(' more'); expect(state.textChars).toBe(5)
    const resumed = new FragmentWriter(512, 32); resumed.restore(JSON.parse(JSON.stringify(state)) as unknown)
    resumed.close('p'); expect(() => resumed.save()).toThrow('FRAGMENT_CHECKPOINT_QUEUE_NOT_DRAINED')
    expect(resumed.ready[0].sourceTextChars).toBe(5)
  })
})
