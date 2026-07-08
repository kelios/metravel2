import { Platform } from 'react-native'

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: jest.fn((html: string) => html),
}))

jest.mock('@/components/article/articleEditorConfig', () => ({
  normalizeArticleEditorHtmlForInput: jest.fn((html: string) => html),
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'

const buildImg = (n: number) =>
  `<p><img src="https://metravel.by/gallery/540/gallery/pic${n}.JPG" /></p>`

describe('normalizeImgTags network gate for deep body images (web)', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  }
  const originalOs = Platform.OS

  beforeEach(() => setPlatformOs('web'))
  afterEach(() => setPlatformOs(originalOs))

  it('keeps the first two images eager (real src) and gates the rest on web', () => {
    const html = Array.from({ length: 5 }, (_, i) => buildImg(i)).join('')
    const out = prepareStableContentHtml(html)

    expect(out).toContain('src="https://metravel.by/gallery/540/gallery/pic0.JPG?w=720')
    expect(out).toContain('src="https://metravel.by/gallery/540/gallery/pic1.JPG?w=720')

    expect(out).toContain('data-lazy-src="https://metravel.by/gallery/540/gallery/pic2.JPG?w=720')
    expect(out).toContain('rich-lazy-img')
    expect(out).toContain('data:image/gif;base64')

    const lazyCount = (out.match(/data-lazy-src="/g) || []).length
    expect(lazyCount).toBe(3)
  })

  it('does not eagerly reference the gated image url in the blur backdrop var', () => {
    const html = Array.from({ length: 3 }, (_, i) => buildImg(i)).join('')
    const out = prepareStableContentHtml(html)
    expect(out).not.toContain("--travel-rich-image:url('https://metravel.by/gallery/540/gallery/pic2.JPG")
    expect(out).toContain('data-lazy-src="https://metravel.by/gallery/540/gallery/pic2.JPG?w=720')
  })

  it('does not gate on native (react-native-render-html cannot swap data-lazy-src)', () => {
    setPlatformOs('ios')
    const html = Array.from({ length: 5 }, (_, i) => buildImg(i)).join('')
    const out = prepareStableContentHtml(html)
    expect(out).not.toContain('data-lazy-src')
    expect(out).not.toContain('rich-lazy-img')
  })
})
