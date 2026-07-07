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

// srcset/sizes атрибуты HTML-экранируют `&` -> `&amp;`; сравниваем в этой форме.
const AMP = '&amp;'

describe('normalizeImgTags responsive delivery for first-party metravel images (#815)', () => {
  it('rebuilds a first-party description image as a responsive srcset ladder', () => {
    const html =
      '<p><img src="https://metravel.by/travel-description-image/540/description/abc.JPG?v=3315&amp;w=1600" /></p>'
    const out = prepareStableContentHtml(html)

    // src падает на 720px, а не отдаёт оригинал
    expect(out).toContain(`src="https://metravel.by/travel-description-image/540/description/abc.JPG?v=3315${AMP}w=720${AMP}q=72${AMP}fit=contain"`)
    // полная лестница присутствует в srcset
    for (const w of [320, 480, 640, 720]) {
      expect(out).toContain(`w=${w}${AMP}q=72${AMP}fit=contain ${w}w`)
    }
    expect(out).toContain('sizes="(max-width: 768px) 100vw, 720px"')
    // cache-buster сохранён
    expect(out).toContain(`v=3315`)
    // ниже сгиба всё ещё lazy
    expect(out).toContain('loading="lazy"')
  })

  it('caps to the supported width ladder and drops any pre-existing size params', () => {
    const html = '<p><img src="https://metravel.by/gallery/540/gallery/x.JPG?w=4000&amp;q=95&amp;dpr=3" /></p>'
    const out = prepareStableContentHtml(html)
    expect(out).not.toContain('w=4000')
    expect(out).not.toContain('dpr=3')
    expect(out).toContain(`q=72`)
  })

  it('leaves third-party images on the weserv proxy path (no first-party srcset)', () => {
    const html = '<p><img src="https://example.com/remote/pic.jpg" /></p>'
    const out = prepareStableContentHtml(html)
    expect(out).toContain('images.weserv.nl')
    // третьесторонним не навешиваем нашу лестницу sizes
    expect(out).not.toContain('sizes="(max-width: 768px) 100vw, 720px"')
  })

  it('reserves a stable aspect ratio for images that arrive without dimensions', () => {
    const html = '<p><img src="https://metravel.by/gallery/540/gallery/unknown.webp" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).toContain('style="display:block;height:auto;margin:0 auto;aspect-ratio:800/450"')
    expect(out).toContain('width="800" height="450"')
    expect(out).toContain('--travel-rich-image-aspect:800/450')
  })
})
