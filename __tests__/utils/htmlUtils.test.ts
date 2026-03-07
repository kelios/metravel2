import { appendPlainTextToHtml, plainTextToHtml, stripBase64Images } from '@/utils/htmlUtils'

describe('stripBase64Images', () => {
  it('removes img tags with base64 data-URI src', () => {
    const html = '<p>Before</p><img src="data:image/png;base64,abc123==" /><p>After</p>'
    expect(stripBase64Images(html)).toBe('<p>Before</p><p>After</p>')
  })

  it('removes multiple base64 images', () => {
    const html = '<img src="data:image/jpeg;base64,AAA" /><p>text</p><img src="data:image/gif;base64,BBB" />'
    expect(stripBase64Images(html)).toBe('<p>text</p>')
  })

  it('preserves normal http img tags', () => {
    const html = '<img src="https://example.com/photo.jpg" />'
    expect(stripBase64Images(html)).toBe(html)
  })

  it('preserves mixed content and only removes base64 images', () => {
    const html = '<p>Hello</p><img src="https://example.com/ok.jpg" /><img src="data:image/webp;base64,XYZ" /><p>World</p>'
    expect(stripBase64Images(html)).toBe('<p>Hello</p><img src="https://example.com/ok.jpg" /><p>World</p>')
  })

  it('handles empty and null-ish input', () => {
    expect(stripBase64Images('')).toBe('')
    expect(stripBase64Images(null as any)).toBe('')
    expect(stripBase64Images(undefined as any)).toBe('')
  })

  it('handles self-closing and non-self-closing img tags', () => {
    const selfClosing = '<img src="data:image/png;base64,abc"/>'
    const nonSelfClosing = '<img src="data:image/png;base64,abc">'
    expect(stripBase64Images(selfClosing)).toBe('')
    expect(stripBase64Images(nonSelfClosing)).toBe('')
  })
})

describe('htmlUtils plain text helpers', () => {
  it('plainTextToHtml converts paragraphs and line breaks', () => {
    const input = 'Line 1\nLine 2\n\nPara 2'
    const out = plainTextToHtml(input)
    expect(out).toBe('<p>Line 1<br/>Line 2</p><p>Para 2</p>')
  })

  it('appendPlainTextToHtml appends with separator', () => {
    const base = '<p>Existing</p>'
    const out = appendPlainTextToHtml(base, 'Next')
    expect(out).toBe('<p>Existing</p><p><br/></p><p>Next</p>')
  })

  it('appendPlainTextToHtml returns base on empty addition', () => {
    const base = '<p>Existing</p>'
    const out = appendPlainTextToHtml(base, '   ')
    expect(out).toBe(base)
  })
})

