import { guardServerSafeHtml, resolveServerRichTextHtml } from '@/utils/serverSafeHtml'

describe('guardServerSafeHtml', () => {
  it('keeps benign server-sanitized markup untouched', () => {
    const html =
      '<h2 id="part1">Заголовок</h2><p class="lead">Текст <a href="https://metravel.by/travels/abc">ссылка</a></p>' +
      '<figure><img src="https://metravel.by/gallery/1.jpg" alt="Фото" width="800" height="450"></figure>'

    expect(guardServerSafeHtml(html)).toBe(html)
  })

  it('strips script and style blocks including stray tags', () => {
    const result = guardServerSafeHtml(
      '<p>ok</p><script>alert(1)</script><style>.x{color:red}</style><script src="https://evil.example/x.js">',
    )

    expect(result).toBe('<p>ok</p>')
  })

  it('removes on* event-handler attributes', () => {
    const result = guardServerSafeHtml(
      '<p onclick="alert(1)">text</p><img src="https://metravel.by/a.jpg" onerror=\'alert(2)\' alt="x">',
    )

    expect(result).not.toMatch(/onclick/i)
    expect(result).not.toMatch(/onerror/i)
    expect(result).toContain('<p>text</p>')
    expect(result).toContain('src="https://metravel.by/a.jpg"')
  })

  it('drops javascript:/vbscript:/data:text URLs but keeps safe ones', () => {
    const result = guardServerSafeHtml(
      '<a href="javascript:alert(1)">a</a>' +
        '<a href=" JaVaScRiPt:alert(2)">b</a>' +
        '<a href="data:text/html;base64,PHNjcmlwdD4=">c</a>' +
        '<a href="https://metravel.by/map">d</a>' +
        '<img src="data:image/png;base64,iVBOR" alt="inline">',
    )

    expect(result).not.toMatch(/javascript:/i)
    expect(result).not.toMatch(/data:text/i)
    expect(result).toContain('href="https://metravel.by/map"')
    expect(result).toContain('src="data:image/png;base64,iVBOR"')
  })

  it('keeps allowlisted iframes and removes foreign-host iframes', () => {
    const youtube = '<iframe src="https://www.youtube.com/embed/abc123" allowfullscreen></iframe>'
    const instagram = '<iframe class="ql-video" src="https://www.instagram.com/p/XYZ/embed/captioned/" height="640"></iframe>'
    const evil = '<iframe src="https://evil.example/steal"></iframe>'
    const srcless = '<iframe></iframe>'

    const result = guardServerSafeHtml(`${youtube}${instagram}${evil}${srcless}`)

    expect(result).toContain('youtube.com/embed/abc123')
    expect(result).toContain('instagram.com/p/XYZ')
    expect(result).not.toContain('evil.example')
    expect(result).not.toMatch(/<iframe(?![^>]*src=)/i)
  })

  it('returns empty string for empty input', () => {
    expect(guardServerSafeHtml('')).toBe('')
    expect(guardServerSafeHtml(null as unknown as string)).toBe('')
  })
})

describe('resolveServerRichTextHtml', () => {
  it('uses safe_html as canonical when present', () => {
    const resolved = resolveServerRichTextHtml(
      { safe_html: '<p>canonical</p>', plain_text: 'canonical' },
      '<p>legacy</p>',
    )

    expect(resolved).toEqual({ html: '<p>canonical</p>', serverSanitized: true })
  })

  it('falls back to legacy html when rich_text block is absent', () => {
    expect(resolveServerRichTextHtml(undefined, '<p>legacy</p>')).toEqual({
      html: '<p>legacy</p>',
      serverSanitized: false,
    })
    expect(resolveServerRichTextHtml(null, '<p>legacy</p>')).toEqual({
      html: '<p>legacy</p>',
      serverSanitized: false,
    })
  })

  it('falls back when safe_html is empty or whitespace-only', () => {
    expect(resolveServerRichTextHtml({ safe_html: '', plain_text: '' }, '<p>legacy</p>')).toEqual({
      html: '<p>legacy</p>',
      serverSanitized: false,
    })
    expect(resolveServerRichTextHtml({ safe_html: '   \n', plain_text: '' }, '<p>legacy</p>')).toEqual({
      html: '<p>legacy</p>',
      serverSanitized: false,
    })
  })

  it('normalizes nullish legacy html to empty string', () => {
    expect(resolveServerRichTextHtml(undefined, null)).toEqual({ html: '', serverSanitized: false })
    expect(resolveServerRichTextHtml(undefined, undefined)).toEqual({ html: '', serverSanitized: false })
  })
})
