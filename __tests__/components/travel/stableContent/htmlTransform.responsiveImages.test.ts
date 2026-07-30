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
    for (const w of [480, 640, 800, 960, 1920]) {
      expect(out).toContain(`w=${w}${AMP}q=78${AMP}fit=contain ${w}w`)
    }
    // #1160: потолок поднят с 800 до 1920. Прежнее обоснование «выше 800 прокси
    // отдаёт оригинал и игнорирует q» устарело — после #1112/#1130 он округляет
    // вверх по whitelist и не апскейлит. Слот тела ~920 CSS на 1920vw: DPR 1 берёт
    // 960, DPR 2 — 1920, вместо апскейла 800 → 1840.
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
      // #1160: потолок подняли только на desktop. На мобиле слот 100vw и картинки
      // тела ленивые — лишние ступени здесь платятся мобильным трафиком, а прирост
      // резкости на 390 CSS не виден.
      expect(out).not.toContain(`w=960${AMP}q=78${AMP}fit=contain 960w`)
      expect(out).not.toContain(`w=1920${AMP}q=78${AMP}fit=contain 1920w`)
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
    // 1920 — потолок мастера, выше него прокси не апскейлит (#1160)
    expect(out).not.toContain('w=2500')
  })

  // #1160: набор ширин тела статьи — третья копия лестницы в проекте. Расхождение с
  // прокси стоило шести тикетов подряд, поэтому здесь оно ловится тестом, а не
  // комментарием. Источник ступеней — `DIMENSION_LADDER` в `utils/imageProxy.ts`,
  // сверенный с `GET /api/media/proxy-contract` в `imageProxy.ladder.test.ts`.
  it('emits only widths that exist on the proxy ladder, on both viewports', () => {
    const PROXY_LADDER = [32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500]
    const originalOs = Platform.OS
    const originalWidth = window.innerWidth
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      for (const viewport of [390, 1920]) {
        Object.defineProperty(window, 'innerWidth', { value: viewport, configurable: true })
        const out = prepareStableContentHtml(
          '<p><img src="https://metravel.by/travel-description-image/540/description/abc.JPG" /></p>',
        )
        const emitted = Array.from(out.matchAll(/w=(\d+)/g), (m) => Number(m[1]))
        expect(emitted.length).toBeGreaterThan(0)
        expect({ viewport, offLadder: emitted.filter((w) => !PROXY_LADDER.includes(w)) })
          .toEqual({ viewport, offLadder: [] })
      }
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
      Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
    }
  })

  it('leaves third-party images on the weserv proxy path (no first-party srcset)', () => {
    const html = '<p><img src="https://example.com/remote/pic.jpg" /></p>'
    const out = prepareStableContentHtml(html)
    expect(out).toContain('images.weserv.nl')
    // третьесторонним не навешиваем нашу лестницу sizes
    expect(out).not.toContain('sizes="(max-width: 768px) 100vw, (max-width: 1439px) 720px, 920px"')
  })

  it('collapses a deeply nested legacy weserv chain to one canonical proxy URL', () => {
    const origin = 'metravelprod.s3.eu-north-1.amazonaws.com/uploads/legacy-photo.jpg'
    const nested = [0, 1, 2, 3, 4, 5].reduce(
      (current) => `https://images.weserv.nl/?url=${encodeURIComponent(current)}&w=1600&fit=inside`,
      origin,
    )

    const out = prepareStableContentHtml(`<p><img src="${nested}" /></p>`, {
      serverSanitized: true,
    })

    expect((out.match(/images\.weserv\.nl/g) ?? [])).toHaveLength(1)
    expect(out).toContain('url=metravelprod.s3.eu-north-1.amazonaws.com%2Fuploads%2Flegacy-photo.jpg')
    expect(out).toContain('w=800')
    expect(out).toContain('q=60')
    expect(out).toContain('output=webp')
  })

  it('does not wrap a malformed weserv URL again when its source is missing', () => {
    const malformed = 'https://images.weserv.nl/?w=800&q=60'

    const out = prepareStableContentHtml(`<p><img src="${malformed}" /></p>`, {
      serverSanitized: true,
    })

    expect((out.match(/images\.weserv\.nl/g) ?? [])).toHaveLength(1)
    expect(out).toContain('src="https://images.weserv.nl/?w=800&amp;q=60"')
  })

  it('reserves a stable aspect ratio for images that arrive without dimensions', () => {
    const html = '<p><img src="https://metravel.by/gallery/540/gallery/unknown.webp" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).toContain('style="display:block;height:auto;margin:0 auto;aspect-ratio:800/450"')
    expect(out).toContain('width="800" height="450"')
    expect(out).toContain('--travel-rich-image-aspect:800/450')
  })
})
