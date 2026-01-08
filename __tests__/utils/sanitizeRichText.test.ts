import { sanitizeRichText, sanitizeRichTextForPdf } from '@/src/utils/sanitizeRichText'

describe('sanitizeRichText', () => {
  it('keeps instagram embeds intact', () => {
    const html = [
      '<p>Follow us on Instagram</p>',
      '<iframe class="ql-video" frameborder="0" allowfullscreen="true"',
      'src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/" height="640"></iframe>',
    ].join('')

    const sanitized = sanitizeRichText(html)

    expect(sanitized).toContain('<iframe')
    expect(sanitized).toContain('https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/')
    expect(sanitized).toContain('height="640"')
  })

  it('still strips disallowed iframe hosts', () => {
    const html = '<iframe src="https://malicious.example.com/embed" height="400"></iframe>'

    const sanitized = sanitizeRichText(html)

    expect(sanitized).not.toContain('<iframe')
    expect(sanitized).toBe('<div></div>')
  })

  it('preserves anchor ids and hash links', () => {
    const html = [
      '<p><a id="day-3" href="#day-3">Go</a></p>',
      '<p><span id="day-3"></span>Target</p>',
    ].join('')

    const sanitized = sanitizeRichText(html)

    expect(sanitized).toContain('href="#day-3"')
    expect(sanitized).toContain('id="day-3"')
    expect(sanitized).toContain('id="day-3"')
  })

  it('sanitizeRichTextForPdf preserves formatting and images', () => {
    const html = [
      '<h2>Маршрут</h2>',
      '<p>Абзац 1</p>',
      '<ul><li>Пункт 1</li><li>Пункт 2</li></ul>',
      '<p>Картинка ниже:</p>',
      '<figure><img data-src="https://example.com/img.jpg" alt="альт"/><figcaption>Подпись</figcaption></figure>',
      '<p>Ссылка: <a href="https://example.com">example</a></p>',
    ].join('')

    const sanitized = sanitizeRichTextForPdf(html)

    expect(sanitized).toContain('<h2>')
    expect(sanitized).toContain('<p>')
    expect(sanitized).toContain('<ul>')
    expect(sanitized).toContain('<figure>')
    expect(sanitized).toContain('<img')
    expect(sanitized).toContain('images.weserv.nl')
    expect(sanitized).toContain('<figcaption>')
    expect(sanitized).toContain('<a href="https://example.com/"')
    expect(sanitized).toContain('rel="noopener noreferrer"')
  })
})

