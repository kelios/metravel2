import { incrementalContent } from '@/services/pdf-export/parsers/incrementalContent'
import type { SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'
import { continueContentOnPage, mergeContentContinuation } from '@/services/pdf-export/segments/contentContinuation'
import { sanitizeRichTextForPdf } from '@/utils/sanitizeRichText'
import { parseHtmlBody } from '@/services/pdf-export/parsers/contentParser/htmlTree.parse5'

async function* chunks(html: string, size: number): AsyncGenerator<string> {
  for (let at = 0; at < html.length; at += size) yield html.slice(at, at + size)
}

async function merged(html: string, read: number, fragment: number): Promise<string> {
  let output = ''
  for await (const next of incrementalContent(chunks(html, read), { maxFragmentChars: fragment })) {
    output = mergeContentContinuation(output, next)
  }
  return output
}

const continued = (html: string, continuationPath: string[]): SafeContentFragment => ({
  index: 1, html, continuation: true, continuationPath, sourceTextChars: 0, imageOccurrences: [],
})

describe('measured-page content continuation', () => {
  it('reconnects huge paragraphs and links to exactly the canonical unsplit markup', async () => {
    const html = '<div class="story"><p id="once"><a name="destination" href="https://example.com?a=1&amp;b=2" title="a &gt; b">'
      + 'word 😀 &amp; next '.repeat(450) + '</a></p><p>Next paragraph</p></div>'
    const reference = sanitizeRichTextForPdf(html)
    for (const [read, fragment] of [[1, 512], [17, 1024], [4096, 2048]]) {
      const result = await merged(html, read, fragment)
      expect(result).toBe(reference)
      expect(Array.from(parseHtmlBody(result)?.querySelectorAll('p') || [])).toHaveLength(2)
      expect(result.match(/id="once"/g)).toHaveLength(1)
      expect(result.match(/name="destination"/g)).toHaveLength(1)
    }
  })

  it('reconnects giant table cells and row boundaries without synthesizing extra rows/cells', async () => {
    const html = '<table class="route"><thead><tr><th>Place</th><th>Description</th></tr></thead><tbody>'
      + '<tr><td>One</td><td id="cell"><a href="https://example.com">' + 'linked cell '.repeat(600) + '</a></td></tr>'
      + '<tr><td>Two</td><td>' + 'next '.repeat(700) + '</td></tr></tbody></table>'
    const reference = sanitizeRichTextForPdf(html)
    for (const [read, fragment] of [[1, 512], [101, 1024], [4096, 2048]]) {
      const result = await merged(html, read, fragment)
      expect(result).toBe(reference)
      const table = parseHtmlBody(result)?.querySelector('table')
      expect(Array.from(table?.querySelectorAll('tr') || [])).toHaveLength(3)
      expect(Array.from(table?.querySelectorAll('td') || [])).toHaveLength(4)
    }
  })

  it('removes only source wrappers that were discarded by the canonical sanitizer', async () => {
    const source = '<custom-wrapper><div><p><strong>' + 'retained '.repeat(800) + '</strong></p></div></custom-wrapper>'
    expect(await merged(source, 3, 1024)).toBe(sanitizeRichTextForPdf(source))
  })

  it('keeps a balanced continued cell on a new physical page', () => {
    const fragment = continued('<table><tbody><tr><td><a href="https://example.com">rest</a></td></tr></tbody></table>',
      ['table', 'tbody', 'tr', 'td', 'a'])
    expect(mergeContentContinuation('', fragment)).toBe(fragment.html)
  })

  it('restores source column positions and a bounded persisted header after a physical page break', () => {
    const fragment = {
      ...continued('<table><tbody><tr><td><a href="https://example.com">rest</a></td></tr></tbody></table>',
        ['table', 'tbody', 'tr', 'td', 'a']),
      tableContinuation: { tableIndex: 0, rowIndex: 5, cellIndex: 1, header: false },
      sourceTextChars: 4,
    }
    const nextPage = continueContentOnPage(fragment, '<thead id="source-header"><tr><th id="place">Place</th><th>Info</th></tr></thead>')
    const table = parseHtmlBody(nextPage.html)?.querySelector('table')
    expect(table?.querySelector('thead')?.textContent).toBe('PlaceInfo')
    const cells = Array.from(table?.querySelector('tbody')?.querySelectorAll('td') || [])
    expect(cells.map((entry) => entry.textContent)).toEqual(['', 'rest'])
    expect(cells[0].getAttribute('aria-hidden')).toBe('true')
    expect(nextPage.html).not.toMatch(/id=/)
    expect(nextPage.sourceTextChars).toBe(4)
    expect(nextPage.imageOccurrences).toBe(fragment.imageOccurrences)
    const mergedPage = mergeContentContinuation(nextPage.html,
      continued('<table><tbody><tr><td><a href="https://example.com"> more</a></td></tr></tbody></table>',
        ['table', 'tbody', 'tr', 'td', 'a']))
    expect(parseHtmlBody(mergedPage)?.querySelector('tbody')?.querySelectorAll('td').length).toBe(2)
    expect(parseHtmlBody(mergedPage)?.querySelector('tbody')?.textContent).toBe('rest more')
  })

  it('continues an oversized header cell without recursively repeating its own header', () => {
    const fragment = {
      ...continued('<table><thead><tr><th>continued heading</th></tr></thead></table>', ['table', 'thead', 'tr', 'th']),
      tableContinuation: { tableIndex: 0, rowIndex: 0, cellIndex: 2, header: true },
    }
    const continuedHeader = continueContentOnPage(fragment, '<thead><tr><th>must not repeat</th></tr></thead>')
    expect(continuedHeader.html).not.toContain('must not repeat')
    expect(Array.from(parseHtmlBody(continuedHeader.html)?.querySelectorAll('th') || [])
      .map((entry) => entry.textContent)).toEqual(['', '', 'continued heading'])
  })

  it('checks the derived column/header budget before allocating placeholder arrays', () => {
    const fragment = {
      ...continued('<table><tr><td>rest</td></tr></table>', ['table', 'tr', 'td']),
      tableContinuation: { tableIndex: 0, rowIndex: 0, cellIndex: 1000000, header: false },
    }
    expect(() => continueContentOnPage(fragment)).toThrow('CONTENT_CONTINUATION_BUDGET_EXCEEDED')
    expect(() => continueContentOnPage({ ...fragment,
      tableContinuation: { ...fragment.tableContinuation, cellIndex: 0 } }, '<thead>' + 'x'.repeat(5000)))
      .toThrow('CONTENT_CONTINUATION_BUDGET_EXCEEDED')
  })

  it('preserves the semantic boundary between differently normalized Quill list runs', () => {
    const result = mergeContentContinuation('<div><ol><li>numbered</li></ol></div>',
      continued('<div><ul><li>bullet</li></ul></div>', ['div', 'ol']))
    expect(result).toBe('<div><ol><li>numbered</li></ol><ul><li>bullet</li></ul></div>')
  })

  it('preserves source item numbers across page breaks and merges continued items on the same page', async () => {
    const source = '<ol><li>first</li><li>' + 'second item '.repeat(90) + '</li><li>third</li></ol>'
    const fragments: SafeContentFragment[] = []
    for await (const fragment of incrementalContent(chunks(source, 17), { maxFragmentChars: 512 })) {
      fragments.push(fragment)
    }
    const secondAt = fragments.findIndex(fragment => fragment.listContinuation?.[0].item === 2)
    expect(secondAt).toBeGreaterThan(0)
    const page = continueContentOnPage(fragments[secondAt])
    expect(parseHtmlBody(page.html)?.querySelector('ol')?.getAttribute('start')).toBe('2')
    const next = fragments[secondAt + 1]
    expect(next.listContinuation?.[0].item).toBe(2)
    const mergedPage = mergeContentContinuation(page.html, next)
    expect(parseHtmlBody(mergedPage)?.querySelector('ol')?.getAttribute('start')).toBe('2')
    expect(parseHtmlBody(mergedPage)?.textContent).toBe(
      parseHtmlBody(page.html)?.textContent! + parseHtmlBody(next.html)?.textContent!)
    expect(await merged(source, 17, 512)).toBe(sanitizeRichTextForPdf(source))
  })

  it('restarts numbering for a canonical Quill ordered run after bullets and skips omitted items', async () => {
    const source = '<ol><li data-list="bullet">bullet</li><li data-list="ordered">'
      + 'first numbered '.repeat(90) + '</li><li data-list="ordered">' + 'second numbered '.repeat(90) + '</li></ol>'
    const fragments: SafeContentFragment[] = []
    for await (const fragment of incrementalContent(chunks(source, 17), { maxFragmentChars: 512 })) fragments.push(fragment)
    const first = fragments.find(fragment => fragment.continuation && fragment.html.includes('first numbered'))!
    const second = fragments.find(fragment => fragment.continuation && fragment.html.includes('second numbered')
      && !fragment.html.includes('first numbered'))!
    expect(parseHtmlBody(continueContentOnPage(first).html)?.querySelector('ol')?.getAttribute('start')).toBe('1')
    expect(parseHtmlBody(continueContentOnPage(second).html)?.querySelector('ol')?.getAttribute('start')).toBe('2')
    expect(await merged(source, 17, 512)).toBe(sanitizeRichTextForPdf(source))
    const nativeWrapper = '<ol><li>first</li><ScrollView><li>omitted</li></ScrollView><li>' + 'second '.repeat(90) + '</li></ol>'
    for await (const fragment of incrementalContent(chunks(nativeWrapper, 17), { maxFragmentChars: 512 })) {
      if (fragment.continuation) expect(fragment.listContinuation?.[0].item).toBe(2)
    }
  })

  it.each([
    ['<p>before</p>', '<div>after</div>', ['p']],
    ['<p>before</div>', '<p>after</p>', ['p']],
    ['<p><a href="https://a.example">before</a></p>', '<p><a href="https://b.example">after</a></p>', ['p', 'a']],
    ['<table><tr><td>before</td></tr></table>', '<table><tr><th>after</th></tr></table>', ['table', 'tr', 'td']],
  ])('fails visibly for broken or unrelated continuation wrappers', (previous, next, path) => {
    expect(() => mergeContentContinuation(previous, continued(next, path as string[])))
      .toThrow('CONTENT_CONTINUATION_INVALID')
  })

  it('does not admit a whole book into its working set', () => {
    expect(() => mergeContentContinuation('x'.repeat(32768), continued('<p>x</p>', ['p'])))
      .toThrow('CONTENT_CONTINUATION_BUDGET_EXCEEDED')
  })
})
