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

describe('normalizeImgTags native lazy loading for body images', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  }
  const originalOs = Platform.OS

  beforeEach(() => setPlatformOs('web'))
  afterEach(() => setPlatformOs(originalOs))

  it('keeps real responsive sources on every web image', () => {
    const html = Array.from({ length: 5 }, (_, i) => buildImg(i)).join('')
    const out = prepareStableContentHtml(html)

    for (let i = 0; i < 5; i += 1) {
      expect(out).toContain(
        `src="https://metravel.by/gallery/540/gallery/pic${i}.JPG?w=720`,
      )
    }
    expect(out).toContain('pic4.JPG?w=320&amp;q=72&amp;fit=contain 320w')
    expect(out).not.toContain('data-lazy-src')
    expect(out).not.toContain('rich-lazy-img')
    expect(out).not.toContain('data:image/gif;base64')
    expect(out.match(/loading="lazy"/g) || []).toHaveLength(5)
  })

  it('does not eagerly reference image URLs in blur backdrop CSS', () => {
    const html = Array.from({ length: 3 }, (_, i) => buildImg(i)).join('')
    const out = prepareStableContentHtml(html)
    expect(out).not.toContain('--travel-rich-image:url')
    expect(out).toContain('--travel-rich-image-aspect:800/450')
  })

  it('keeps the same real-source contract on native', () => {
    setPlatformOs('ios')
    const html = Array.from({ length: 5 }, (_, i) => buildImg(i)).join('')
    const out = prepareStableContentHtml(html)
    expect(out).not.toContain('data-lazy-src')
    expect(out).not.toContain('rich-lazy-img')
    expect(out).toContain('pic4.JPG?w=720')
  })
})
