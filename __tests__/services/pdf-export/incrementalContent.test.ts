import { incrementalContent, IncrementalContentError } from '@/services/pdf-export/parsers/incrementalContent'
import type { IncrementalContentMetrics, IncrementalContentOptions, SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'
import { continueContentOnPage, mergeContentContinuation } from '@/services/pdf-export/segments/contentContinuation'
import { subdivideSource } from '@/services/pdf-export/segments/subdivideSource'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { ContentParser } from '@/services/pdf-export/parsers/ContentParser'
import { parseHtmlBody } from '@/services/pdf-export/parsers/contentParser/htmlTree.parse5'
import { parseHtmlBody as parseWebHtmlBody } from '@/services/pdf-export/parsers/contentParser/htmlTree.web'
import { sanitizeRichTextForPdf } from '@/utils/sanitizeRichText'

async function* chunks(html: string, size: number): AsyncGenerator<string> {
  for (let offset = 0; offset < html.length; offset += size) yield html.slice(offset, offset + size)
}

async function collect(source: AsyncIterable<string>, maxFragmentChars = 1024, options: IncrementalContentOptions = {}): Promise<SafeContentFragment[]> {
  const result: SafeContentFragment[] = []
  for await (const fragment of incrementalContent(source, { maxFragmentChars, ...options })) result.push(fragment)
  return result
}

function textOf(html: string): string {
  return parseHtmlBody(html)?.textContent || ''
}

describe('incremental book content ingestion', () => {
  it('expands the real closed Luxembourg FAQ answer before print measurement without changing default ingestion', async () => {
    const question = 'Сколько дней нужно на Mullerthal Trail?'
    const answer = 'Весь маршрут — 112 км в трёх кольцах. Я прошла его за шесть дней с большим рюкзаком, и самый длинный день вышел больше 35 км. Если хочется идти без спешки и заходить в замки, закладывайте семь-восемь дней.'
    const source = `<section class="seo-faq"><details><summary><strong>${question}</strong></summary><div><div><p>${answer}</p></div></div></details></section>`
    const normal = await collect(chunks(source, 17), 4096)
    expect(await collect(chunks(source, 17), 4096, { expandDisclosures: false })).toEqual(normal)
    expect(normal.map(fragment => fragment.html).join('')).toContain('<details>')
    const expanded = await collect(chunks(source, 1), 4096, { expandDisclosures: true })
    const html = expanded.reduce((previous, fragment) => mergeContentContinuation(previous, fragment), '')
    expect(html).not.toMatch(/<\/?(?:details|summary)\b/)
    expect(parseHtmlBody(html)?.querySelector('h4')?.textContent).toBe(question)
    expect(textOf(html)).toBe(question + answer)
    const opened = source.replace('<details>', '<details open>')
    expect((await collect(chunks(opened, 17), 4096, { expandDisclosures: true })).map(fragment => textOf(fragment.html)).join('')).toBe(question + answer)
  })

  it('keeps long nested questions, answers, links, images, table cells and list numbering across disclosure continuations', async () => {
    const source = '<details id="faq"><summary id="question">' + 'Question 😀 '.repeat(50)
      + '<a href="#answer">question link</a><img src="https://example.com/question.jpg"></summary>'
      + '<details id="nested"><summary>Nested question</summary><p id="answer">'
      + 'Answer 界 '.repeat(80) + '<a href="https://example.com/answer">answer link</a>'
      + '<img src="https://example.com/answer.jpg"></p><table><tr><td>' + 'Cell '.repeat(70)
      + '</td><td>LAST_CELL</td></tr></table><ol><li>' + 'Item '.repeat(90)
      + '</li><li>' + 'Second item '.repeat(90) + 'LAST_ITEM</li></ol></details></details><summary>Standalone summary</summary>'
    const fragments = await collect(chunks(source, 1), 512, { expandDisclosures: true })
    expect(fragments).toEqual(await collect(chunks(source, 257), 512, { expandDisclosures: true }))
    expect(fragments.some(fragment => fragment.continuationPath.includes('h4'))).toBe(true)
    expect(fragments.some(fragment => fragment.continuationPath.includes('td'))).toBe(true)
    expect(fragments.every(fragment => !fragment.continuationPath.includes('details') && !fragment.continuationPath.includes('summary'))).toBe(true)
    expect(fragments.flatMap(fragment => fragment.imageOccurrences)).toEqual([
      { index: 0, source: 'https://example.com/question.jpg' },
      { index: 1, source: 'https://example.com/answer.jpg' },
    ])
    const expected = textOf(sanitizeRichTextForPdf(source))
    expect(fragments.map(fragment => textOf(fragment.html)).join('')).toBe(expected)
    const pages = fragments.map(fragment => continueContentOnPage(fragment))
    expect(pages.map(fragment => textOf(fragment.html)).join('')).toBe(expected)
    expect(fragments.some(fragment => fragment.listContinuation?.some(list => list.item === 2))).toBe(true)
    expect(pages.some(fragment => /<ol start="2"/.test(fragment.html))).toBe(true)
    const html = fragments.reduce((previous, fragment) => mergeContentContinuation(previous, fragment), '')
    expect(textOf(html)).toBe(expected)
    expect(html).not.toMatch(/<\/?details\b/)
    expect(parseHtmlBody(html)?.querySelectorAll('h4')).toHaveLength(2)
    expect(parseHtmlBody(html)?.querySelector('summary')?.textContent).toBe('Standalone summary')
    for (const id of ['faq', 'question', 'nested', 'answer']) {
      expect(fragments.map(fragment => fragment.html).join('').match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1)
    }
    expect(fragments.reduce((sum, fragment) => sum + fragment.sourceTextChars, 0)).toBe(expected.length)
  })

  it('preserves empty and summary-free disclosure content without inventing a Details label', async () => {
    const source = '<details></details><details><p>Answer without question</p><details><p>Nested answer</p></details></details>'
    const fragments = await collect(chunks(source, 3), 512, { expandDisclosures: true })
    const html = fragments.reduce((previous, fragment) => mergeContentContinuation(previous, fragment), '')
    expect(textOf(html)).toBe('Answer without questionNested answer')
    expect(html).not.toMatch(/<\/?(?:details|summary|h4)\b/)
  })

  it('expands raw worker4 disclosures during adaptive subdivision but preserves published worker3 semantics', async () => {
    const source: BookSegmentSource = { source_schema_version: 4, resource_bindings: [],
      resource_bindings_hash: 'a'.repeat(64), resource_policy_hash: 'b'.repeat(64), encoder_identity_hash: 'c'.repeat(64),
      page: { type: 'content', travel: { id: 761, name: 'Disclosure source' }, field: 'description', first: false, last: false, qr: '',
        html: '<details><summary>Question</summary><p>' + 'Answer 😀 '.repeat(70) + '<img src="https://example.com/answer.jpg"></p></details>' },
      blocks: ['761:description:faq'], occurrences: ['761:inline:answer'] }
    const portions: BookSegmentSource[] = []
    for await (const portion of subdivideSource(source, 512)) portions.push(portion)
    expect(portions.length).toBeGreaterThan(2)
    const html = portions.map(portion => 'html' in portion.page ? portion.page.html : '').join('')
    expect(html).not.toMatch(/<\/?(?:details|summary)\b/)
    expect(textOf(html)).toBe('Question' + 'Answer 😀 '.repeat(70))
    expect(portions.flatMap(portion => portion.occurrences)).toEqual(source.occurrences)
    const legacy: BookSegmentSource[] = []
    for await (const portion of subdivideSource({ ...source, source_schema_version: 3 }, 512)) legacy.push(portion)
    expect(legacy.some(portion => 'html' in portion.page && portion.page.html.includes('<details>'))).toBe(true)
  })

  it('preserves small rich-text semantics with the canonical sanitizer and both parser adapters', async () => {
    const source = '<h2 id="route">Route</h2><p>Before <a href="https://example.com/path">link</a> '
      + '<strong>bold</strong> &amp; after.</p><ul><li>One</li><li>Two</li></ul>'
      + '<table><thead><tr><th>Place</th><th>Price</th></tr></thead>'
      + '<tbody><tr><td>A</td><td>12</td></tr></tbody></table>'
      + '<figure><img src="https://example.com/photo.jpg" width="200" height="300">'
      + '<figcaption>Portrait</figcaption></figure><script>alert(1)</script>'
    const fragments = await collect(chunks(source, 7), 8192)
    for (const adapter of [parseHtmlBody, parseWebHtmlBody]) {
      const parser = new ContentParser(adapter)
      expect(parser.parse(fragments.map((entry) => entry.html).join('')))
        .toEqual(parser.parse(sanitizeRichTextForPdf(source)))
    }
    expect(fragments.flatMap((entry) => entry.imageOccurrences)).toEqual([
      { index: 0, source: 'https://example.com/photo.jpg' },
    ])
    expect(fragments.every((entry) => entry.html.length <= 8192)).toBe(true)
    expect(fragments.map((entry) => entry.html).join('')).not.toContain('alert(1)')
  })

  it('produces identical fragments for tiny UTF-16/entity/tag chunks and normal transfer chunks', async () => {
    const source = '<div><p><a href="https://example.com/a?b=1&amp;c=2">'
      + 'ёжик 😀 &amp; &lt; letter '.repeat(220) + '</a></p>'
      + '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>'
      + 'cell 😀 '.repeat(110) + '</td></tr></tbody></table></div>'
    const expected = await collect(chunks(source, 4096))
    for (const size of [1, 3, 31, 257]) {
      expect(await collect(chunks(source, size))).toEqual(expected)
    }
    expect(expected.filter((fragment) => fragment.continuation).length).toBeGreaterThan(0)
    expect(expected.some((fragment) => fragment.continuationPath.includes('td'))).toBe(true)
    expect(expected.map((fragment) => textOf(fragment.html)).join('')).toBe(textOf(sanitizeRichTextForPdf(source)))
  })

  it('streams a huge single paragraph without retaining the field or changing text/image order', async () => {
    const repeat = 'token 😀 <a href="https://example.com">linked</a> &amp; '
    const iterations = 10000
    let metrics: IncrementalContentMetrics | undefined
    async function* source(): AsyncGenerator<string> {
      yield '<p>'
      for (let index = 0; index < iterations; index++) {
        yield repeat
        if (index % 1000 === 0) yield '<img src="https://example.com/repeated.jpg">'
      }
      yield '</p>'
    }
    let chars = 0
    let images = 0
    let fragments = 0
    for await (const fragment of incrementalContent(source(), { onMetrics: (value) => { metrics = value } })) {
      chars += textOf(fragment.html).length
      images += fragment.imageOccurrences.length
      fragments++
      expect(fragment.html.length).toBeLessThanOrEqual(1024)
      expect(fragment.html).not.toContain('\uFFFD')
    }
    expect(chars).toBe('token 😀 linked & '.length * iterations)
    expect(images).toBe(10)
    expect(fragments).toBeGreaterThan(1000)
    expect(metrics?.peakBufferedChars).toBeLessThanOrEqual(512)
    expect(metrics?.sourceTextChars).toBe(chars)
    expect(metrics?.peakDepth).toBe(2)
  })

  it('continues a huge table, a huge cell and its inline link with all source text preserved', async () => {
    async function* source(): AsyncGenerator<string> {
      yield '<table><thead><tr><th>Heading</th></tr></thead><tbody>'
      for (let row = 0; row < 1200; row++) {
        yield `<tr><td>Row ${row}</td><td><a href="https://example.com/cell">`
        for (let run = 0; run < 30; run++) yield `value${row} `
        yield '</a></td></tr>'
      }
      yield '</tbody></table>'
    }
    let actualTextChars = 0
    let continuedCells = 0
    let fragmentCount = 0
    for await (const fragment of incrementalContent(source())) {
      actualTextChars += textOf(fragment.html).length
      if (fragment.continuationPath.includes('td')) continuedCells++
      expect(fragment.html.length).toBeLessThanOrEqual(1024)
      expect(parseHtmlBody(fragment.html)?.querySelector('table')).not.toBeNull()
      fragmentCount++
    }
    const expected = 'Heading'.length + Array.from({ length: 1200 }, (_, row) =>
      `Row ${row}`.length + `value${row} `.length * 30).reduce((sum, count) => sum + count, 0)
    expect(actualTextChars).toBe(expected)
    expect(continuedCells).toBeGreaterThan(0)
    expect(fragmentCount).toBeGreaterThan(500)
  })

  it('emits output before requesting the remaining source', async () => {
    let emitted = false
    async function* source(): AsyncGenerator<string> {
      yield '<p>first</p>'
      expect(emitted).toBe(true)
      yield '<p>last</p>'
    }
    for await (const _fragment of incrementalContent(source())) emitted = true
  })

  it('applies the existing URL/style/RN sanitizer policy before fragments reach the tree parser', async () => {
    const source = '<View><Text><p onclick="steal()" style="text-align:center;color:red;background-image:url(x)">'
      + '<a href="javascript:alert(1)">safe</a><img src="https://example.com/x.jpg" onerror="steal()"></p>'
      + '</Text><ScrollView><p>removed</p></ScrollView></View>'
    const fragments = await collect(chunks(source, 3))
    const html = fragments.map((fragment) => fragment.html).join('')
    expect(html).not.toMatch(/steal|javascript|background-image|removed|view|scrollview/i)
    expect(html).toContain('text-align:center')
    expect(textOf(html)).toBe('safe')
    expect(fragments.flatMap((fragment) => fragment.imageOccurrences)).toHaveLength(1)
  })

  it('resolves forward hash links without loading the remaining field and emits each heading ID once', async () => {
    const source = '<h2>1. ' + '2. heading '.repeat(150) + '</h2>'
      + '<h2 id="authored">2. Authored</h2><h2>3. Last</h2>'
      + '<p><a href="#future-one">one</a><a href="#authored">two</a><a href="#future-three">three</a></p>'
    const fragments: SafeContentFragment[] = []
    for await (const fragment of incrementalContent(chunks(source, 3), {
      headingAnchorResolver: (ordinal) => ordinal === 1 ? 'future-one' : ordinal === 3 ? 'future-three' : undefined,
    })) fragments.push(fragment)
    const ids = fragments.flatMap((fragment) => Array.from(parseHtmlBody(fragment.html)?.querySelectorAll('h2') || [])
      .map((heading) => heading.getAttribute('id')).filter(Boolean))
    expect(ids).toEqual(['future-one', 'authored', 'future-three'])
    expect(fragments.some((fragment) => fragment.continuationPath.includes('h2'))).toBe(true)
    expect(fragments.map((fragment) => textOf(fragment.html)).join('')).toBe(textOf(sanitizeRichTextForPdf(source)))
  })

  it('keeps default anchor policy and safely escapes a disk-resolved ID', () => {
    const ordinary = '<h2>1. Place</h2><p><a href="#place&amp;name">visit</a></p>'
    expect(parseHtmlBody(sanitizeRichTextForPdf(ordinary))?.querySelector('h2')?.getAttribute('id'))
      .toBe('place&name')
    const resolved = sanitizeRichTextForPdf('<h2>1. Place</h2>', {
      headingAnchorResolver: () => 'place" onclick="alert(1)&name',
    })
    const heading = parseHtmlBody(resolved)?.querySelector('h2')
    expect(heading?.getAttribute('id')).toBe('place" onclick="alert(1)&name')
    expect(heading?.getAttribute('onclick')).toBeNull()
    expect(sanitizeRichTextForPdf('<h2>1. Place</h2>', { headingAnchorResolver: () => undefined }))
      .toBe(sanitizeRichTextForPdf('<h2>1. Place</h2>'))
  })

  it.each([
    '<p title="' + 'a'.repeat(10000),
    '<!--' + 'a'.repeat(10000),
    '<![CDATA[' + 'a'.repeat(10000),
  ])('fails visibly on an unfinished unbounded token', async (source) => {
    await expect((async () => {
      for await (const _fragment of incrementalContent(chunks(source, 13), { maxTokenChars: 512 })) { /* consume */ }
    })()).rejects.toMatchObject({ code: 'SOURCE_TOKEN_TOO_LARGE' })
  })

  it('enforces nesting and individual transfer budgets without a total content cap', async () => {
    await expect((async () => {
      for await (const _fragment of incrementalContent(chunks('<div>'.repeat(40), 17), { maxDepth: 8 })) { /* consume */ }
    })()).rejects.toMatchObject({ code: 'SOURCE_NESTING_TOO_DEEP' })
    await expect(collect(chunks('a'.repeat(70000), 70000))).rejects.toMatchObject({ code: 'SOURCE_CHUNK_TOO_LARGE' })
    await expect(collect(chunks('<p>a</p>', 1), 1)).rejects.toBeInstanceOf(IncrementalContentError)
  })
})
