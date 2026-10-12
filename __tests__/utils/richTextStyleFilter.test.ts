/**
 * #2389: rich-text style allowlist moved from sanitize-html's postcss-backed
 * `allowedStyles` to `filterRichTextStyle`. Jest still has the real postcss, so
 * the old path is the oracle: well-formed styles must come out byte-identical,
 * malformed ones may only lose declarations, never gain them.
 */
import sanitizeHtml from 'sanitize-html'

import { RICH_TEXT_ALLOWED_STYLES, filterRichTextStyle, transformRichTextStyle } from '@/utils/richTextStyleFilter'

const BASE = {
  allowedTags: ['p', 'span', 'div', 'img'],
  allowedAttributes: { '*': ['style'], img: ['src', 'style'] },
} satisfies sanitizeHtml.IOptions

const oracle = (html: string) =>
  sanitizeHtml(html, { ...BASE, allowedStyles: RICH_TEXT_ALLOWED_STYLES as sanitizeHtml.IOptions['allowedStyles'] })

const filtered = (html: string) =>
  sanitizeHtml(html, {
    ...BASE,
    parseStyleAttributes: false,
    transformTags: { '*': transformRichTextStyle },
  })

const styleOf = (html: string) => /style="([^"]*)"/.exec(html)?.[1] ?? ''
const declarationsOf = (html: string) => styleOf(html).split(';').filter(Boolean)

const WELL_FORMED: [string, string][] = [
  ['p', 'text-align: center'],
  ['p', 'text-align:center;color:#333'],
  ['p', 'color: rgb(10, 20, 30); background-color: rgba(0,0,0,0.5)'],
  ['span', 'color: #ABCDEF !important'],
  ['span', 'color: red !IMPORTANT'],
  ['div', 'margin: 0 auto; padding: 4px 8px 4px 8px'],
  ['div', 'margin-left: auto; margin-right: -1.5em; margin-top: 12px; margin-bottom: 0'],
  ['div', 'float: left; display: inline-block'],
  ['div', 'position: fixed; top: 0; color: transparent'],
  ['p', 'Color: #000; text-align: center'],
  ['p', 'color: #000;;; text-align: right;'],
  ['p', '  color :  #fff  ;  '],
  ['p', 'background: url(javascript:steal()); color: #111'],
  ['p', 'font-family: "Helvetica; color: red"; color: #222'],
  ['p', 'color: /* note */ #333'],
  ['p', '/* lead */ color: #444; /* tail */'],
  ['p', 'color: #555; color: #666'],
  ['p', 'aspect-ratio: 3 / 2'],
  ['img', 'width: 100px; height: 50%; float: right'],
  ['img', 'width: 10em'],
  ['span', 'display: none'],
  ['p', 'margin: 0\n auto'],
  ['p', 'color: expression(alert(1))'],
  ['p', 'background: #fff url(x.png)'],
  ['p', 'width: 100px'],
]

const MALFORMED: [string, string][] = [
  ['p', 'color: red; } p { color: blue'],
  ['p', 'color: #000; a { b: c }'],
  ['p', 'color: "unclosed'],
  ['p', 'color: #000 /* unclosed'],
  ['p', 'color: rgb(0,0,0'],
  ['p', 'color #000; text-align: center'],
  ['p', 'text-align: center; garbage'],
  ['p', '*color: #000'],
  ['p', '_color: #000; text-align: left'],
  ['p', 'color: #000)'],
]

const tagged = ([tag, style]: [string, string]) =>
  tag === 'img' ? `<img src="a.png" style="${style.replace(/"/g, '&quot;')}">` : `<${tag} style="${style.replace(/"/g, '&quot;')}">t</${tag}>`

describe('filterRichTextStyle (#2389)', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())

  it.each(WELL_FORMED)('<%s style="%s"> matches the postcss path byte for byte', (tag, style) => {
    const html = tagged([tag, style])
    expect(filtered(html)).toBe(oracle(html))
  })

  it.each(MALFORMED)('<%s style="%s"> keeps no declaration the postcss path dropped', (tag, style) => {
    const html = tagged([tag, style])
    const kept = new Set(declarationsOf(oracle(html)))
    expect(declarationsOf(filtered(html)).filter((d) => !kept.has(d))).toEqual([])
  })

  it('keeps only allowlisted values and drops an empty result', () => {
    expect(filterRichTextStyle('p', 'color: #000; position: absolute')).toBe('color:#000')
    expect(filterRichTextStyle('p', 'position: absolute')).toBe('')
    expect(filterRichTextStyle('p', '')).toBe('')
    expect(filterRichTextStyle('p', null)).toBe('')
    expect(filtered('<p style="position:absolute">t</p>')).toBe('<p>t</p>')
  })

  it('applies tag rules on top of the global ones', () => {
    expect(filterRichTextStyle('img', 'width: 100px; color: #000')).toBe('width:100px;color:#000')
    expect(filterRichTextStyle('p', 'width: 100px; color: #000')).toBe('color:#000')
  })

  it('does not treat inherited object keys as allowed properties', () => {
    expect(filterRichTextStyle('p', 'constructor: 1; __proto__: 2; toString: 3')).toBe('')
  })
})
