import { sanitizeRichText } from '@/src/utils/sanitizeRichText'

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
})

