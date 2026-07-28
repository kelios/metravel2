import { Platform } from 'react-native'

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: jest.fn((html: string) => html),
}))

jest.mock('@/components/article/articleEditorConfig', () => ({
  normalizeArticleEditorHtmlForInput: jest.fn((html: string) => html),
}))

import {
  buildStableContentPrefetchUrl,
  extractFirstImgSrc,
  prepareStableContentHtml,
} from '@/components/travel/stableContent/htmlTransform'

// srcset/sizes атрибуты HTML-экранируют `&` -> `&amp;`; сравниваем в этой форме.
const AMP = '&amp;'

describe('normalizeImgTags responsive delivery for first-party metravel images (#815)', () => {
  it('rebuilds a first-party description image as a responsive srcset ladder', () => {
    const html =
      '<p><img src="https://metravel.by/travel-description-image/540/description/abc.JPG?v=3315&amp;w=1600" /></p>'
    const out = prepareStableContentHtml(html)

    // src падает на fallback-ступень, а не отдаёт оригинал
    expect(out).toContain(`src="https://metravel.by/travel-description-image/540/description/abc.JPG?v=3315${AMP}w=800${AMP}q=78${AMP}fit=contain"`)
    // полная desktop-лестница присутствует в srcset (jsdom innerWidth 1024 > 768)
    for (const w of [480, 640, 800]) {
      expect(out).toContain(`w=${w}${AMP}q=78${AMP}fit=contain ${w}w`)
    }
    // #1113: 1024 не входит в whitelist ширин прокси — на такой запрос он отдаёт
    // исходный файл целиком и игнорирует `q` (замер прода 2026-07-28: w=800 → 53 104 B,
    // w=1024 → 132 344 B = оригинал). Именно этот кандидат выбирал retina-десктоп.
    expect(out).not.toContain(`w=1024${AMP}q=78${AMP}fit=contain 1024w`)
    expect(out).toContain('sizes="(max-width: 768px) 100vw, (max-width: 1439px) 720px, 920px"')
    // cache-buster сохранён
    expect(out).toContain(`v=3315`)
    // ниже сгиба всё ещё lazy
    expect(out).toContain('loading="lazy"')
  })

  it('keeps the first-image prefetch on the responsive fallback instead of the raw origin', () => {
    const raw = 'https://metravel.by/gallery/540/conversions/abc-detail_hd.jpg'
    const prepared = prepareStableContentHtml(`<p><img src="${raw}" /></p>`)
    const first = extractFirstImgSrc(prepared)

    expect(first).not.toBeNull()
    expect(buildStableContentPrefetchUrl(first!)).toBe(
      `${raw}?w=800&q=78&fit=contain`,
    )
    expect(buildStableContentPrefetchUrl(first!)).not.toBe(raw)
  })

  it('keeps the mobile viewport on a lower ladder so body images do not blow the network budget', () => {
    // Лестница выбирается по вьюпорту только на web: Platform.OS в jest — 'ios',
    // поэтому подменяем и его (как в htmlTransform.lazyGate.test.ts), и innerWidth.
    const originalOs = Platform.OS
    const originalWidth = window.innerWidth
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
    try {
      const html = '<p><img src="https://metravel.by/travel-description-image/540/description/abc.JPG" /></p>'
      const out = prepareStableContentHtml(html)

      for (const w of [320, 480, 640, 800]) {
        expect(out).toContain(`w=${w}${AMP}q=78${AMP}fit=contain ${w}w`)
      }
      // 800 — верхняя ступень на обоих вьюпортах (см. #1113 выше).
      expect(out).not.toContain(`w=1024${AMP}q=78${AMP}fit=contain 1024w`)
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
      Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
    }
  })

  it('caps to the supported width ladder and drops any pre-existing size params', () => {
    const html = '<p><img src="https://metravel.by/gallery/540/gallery/x.JPG?w=4000&amp;q=95&amp;dpr=3" /></p>'
    const out = prepareStableContentHtml(html)
    expect(out).not.toContain('w=4000')
    expect(out).not.toContain('dpr=3')
    expect(out).toContain(`q=78`)
    // 800 — последняя ширина, которую прокси реально ресайзит; выше ступеней не выдаём
    expect(out).not.toContain('w=1280')
    expect(out).not.toContain('w=1024')
  })

  it('leaves third-party images on the weserv proxy path (no first-party srcset)', () => {
    const html = '<p><img src="https://example.com/remote/pic.jpg" /></p>'
    const out = prepareStableContentHtml(html)
    expect(out).toContain('images.weserv.nl')
    // третьесторонним не навешиваем нашу лестницу sizes
    expect(out).not.toContain('sizes="(max-width: 768px) 100vw, (max-width: 1439px) 720px, 920px"')
  })

  it('reserves a stable aspect ratio for images that arrive without dimensions', () => {
    const html = '<p><img src="https://metravel.by/gallery/540/gallery/unknown.webp" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).toContain('style="display:block;height:auto;margin:0 auto;aspect-ratio:800/450"')
    expect(out).toContain('width="800" height="450"')
    expect(out).toContain('--travel-rich-image-aspect:800/450')
  })
})
