import { appendPlainTextToHtml, plainTextToHtml } from '@/utils/htmlUtils'

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

