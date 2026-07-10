jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: jest.fn((html: string) => html),
}))

jest.mock('@/components/article/articleEditorConfig', () => ({
  normalizeArticleEditorHtmlForInput: jest.fn((html: string) => html),
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'

// A weserv-proxied (third-party / S3) body image sits in a `.rich-image-frame`. The blur
// backdrop is a CSS `url(...)` fed from the img markup. HTML attributes carry `&amp;`, but CSS
// url() does not decode entities — so a double-encoded var makes ::before fetch a different,
// malformed URL than the foreground <img>, doubling the weserv request per framed image.
describe('rich-image-frame backdrop URL matches the foreground image (no double-fetch)', () => {
  const S3 = 'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1607344305DSC01553.JPG'

  it('does not double-encode ampersands in --travel-rich-image', () => {
    const out = prepareStableContentHtml(`<p><img src="${S3}" /></p>`)
    expect(out).toContain('--travel-rich-image')
    // Double-encoded ampersand would make the CSS backdrop URL differ from the <img> src.
    expect(out).not.toContain('&amp;amp;')
  })

  it('backdrop var carries the same weserv URL the <img> loads', () => {
    const out = prepareStableContentHtml(`<p><img src="${S3}" /></p>`)
    // The foreground <img> src (weserv-wrapped, HTML-escaped once).
    const imgSrc = out.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1] ?? ''
    expect(imgSrc).toContain('images.weserv.nl')
    // The backdrop url() (quotes HTML-escaped to &#39; inside the style attr) must carry the
    // byte-identical URL the <img> loads — so the browser dedupes it to a single request.
    const backdrop = out.match(/--travel-rich-image:url\(&#39;(.*?)&#39;\)/)?.[1] ?? ''
    expect(backdrop).toBe(imgSrc)
  })
})
