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
    expect(out).toContain(`src="https://metravel.by/travel-description-image/540/description/abc.JPG?v=3315${AMP}w=800${AMP}q=80${AMP}fit=contain"`)
    // полная desktop-лестница присутствует в srcset (jsdom innerWidth 1024 > 768)
    for (const w of [480, 640, 800, 960, 1920]) {
      expect(out).toContain(`w=${w}${AMP}q=80${AMP}fit=contain ${w}w`)
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
    // #1195: family-роут отдаёт мастер с `no-store`, поэтому conversion-ключ тела
    // статьи греется через `legacy_conversion` — тот же файл, но по лестнице.
    expect(buildStableContentPrefetchUrl(first!)).toBe(
      'https://metravel.by/media-resize/legacy/540/conversions/abc-detail_hd.jpg?w=800&q=80&fit=contain',
    )
    expect(buildStableContentPrefetchUrl(first!)).not.toBe(raw)
  })

  // #1213: префетч первой картинки тела и `<img>` обязаны попасть в ОДИН URL.
  // На проде 2026-08-02 они расходились: браузер брал по srcset w=1920, а
  // `<link rel=prefetch>` тянул фиксированный w=800 — 29 252 B и 96 912 B лишних
  // на двух статьях. Ступень проверяем через реальную сборку URL, а не мок.
  describe('first-image prefetch lands on the rung the browser will pick (#1213)', () => {
    const RAW = 'https://metravel.by/travel-description-image/540/description/abc.JPG'

    const withWebViewport = <T,>(width: number, dpr: number, run: () => T): T => {
      const originalOs = Platform.OS
      const originalWidth = window.innerWidth
      const originalDpr = window.devicePixelRatio
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
      Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true })
      try {
        return run()
      } finally {
        Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
        Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
        Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
      }
    }

    /** Кандидаты из реально отрендеренного `srcset`, в неэкранированном виде. */
    const srcSetCandidates = (html: string): string[] =>
      (html.match(/srcset="([^"]+)"/i)?.[1] ?? '')
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0]?.replace(/&amp;/g, '&') ?? '')
        .filter(Boolean)

    it.each([
      { label: 'desktop 1280 @2x', width: 1280, dpr: 2, expected: 1920 },
      { label: 'desktop 1280 @1x', width: 1280, dpr: 1, expected: 800 },
      { label: 'desktop 1920 @1x', width: 1920, dpr: 1, expected: 960 },
      { label: 'desktop 1920 @2x', width: 1920, dpr: 2, expected: 1920 },
      { label: 'mobile 390 @3x', width: 390, dpr: 3, expected: 800 },
    ])('$label prefetches w=$expected, and that URL is a real srcset candidate', ({ width, dpr, expected }) => {
      const { prefetch, candidates } = withWebViewport(width, dpr, () => {
        const prepared = prepareStableContentHtml(`<p><img src="${RAW}" /></p>`)
        const first = extractFirstImgSrc(prepared)!
        return { prefetch: buildStableContentPrefetchUrl(first), candidates: srcSetCandidates(prepared) }
      })

      expect(prefetch).toBe(`${RAW}?w=${expected}&q=80&fit=contain`)
      // Главное условие тикета: греется ровно та ступень, что есть в лестнице
      // этого вьюпорта, — иначе слот скачивается двумя разными URL.
      expect(candidates).toContain(prefetch)
    })

    it('falls back to the fixed rung outside web, where there is no prefetch at all', () => {
      const prepared = prepareStableContentHtml(`<p><img src="${RAW}" /></p>`)
      expect(buildStableContentPrefetchUrl(extractFirstImgSrc(prepared)!)).toBe(
        `${RAW}?w=800&q=80&fit=contain`,
      )
    })
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
        expect(out).toContain(`w=${w}${AMP}q=80${AMP}fit=contain ${w}w`)
      }
      // #1160: потолок подняли только на desktop. На мобиле слот 100vw и картинки
      // тела ленивые — лишние ступени здесь платятся мобильным трафиком, а прирост
      // резкости на 390 CSS не виден.
      expect(out).not.toContain(`w=960${AMP}q=80${AMP}fit=contain 960w`)
      expect(out).not.toContain(`w=1920${AMP}q=80${AMP}fit=contain 1920w`)
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
    expect(out).toContain(`q=80`)
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

  // #1163: внешняя картинка отдаётся со своего origin, без стороннего ресайзера.
  // Прежний путь через `images.weserv.nl` стоял в критическом пути отрисовки статьи и
  // отваливался под холодным кэшем; нашу лестницу к чужому хосту применить нельзя —
  // прокси до него не дотягивается.
  it('leaves a third-party image on its own origin, unproxied and without our srcset', () => {
    const html = '<p><img src="https://example.com/remote/pic.jpg" /></p>'
    const out = prepareStableContentHtml(html)
    expect(out).not.toContain('images.weserv.nl')
    expect(out).toContain('src="https://example.com/remote/pic.jpg"')
    expect(out).not.toContain('sizes="(max-width: 768px) 100vw, (max-width: 1439px) 720px, 920px"')
  })

  it('unwraps a deeply nested legacy weserv chain and lands it on our resize route', () => {
    const origin = 'metravelprod.s3.eu-north-1.amazonaws.com/uploads/legacy-photo.jpg'
    const nested = [0, 1, 2, 3, 4, 5].reduce(
      (current) => `https://images.weserv.nl/?url=${encodeURIComponent(current)}&w=1600&fit=inside`,
      origin,
    )

    const out = prepareStableContentHtml(`<p><img src="${nested}" /></p>`, {
      serverSanitized: true,
    })

    // #1163: `unwrapWeservImageUrl` остаётся нужен, пока такие URL лежат в БД, но
    // новый слой обёртки больше не создаётся — цепочка схлопывается до оригинала.
    // #1176: развёрнутый оригинал — ключ нашего бакета, поэтому он не остаётся
    // прямой ссылкой на S3, а уходит на первопартийный роут с лестницей ширин.
    expect(out).not.toContain('images.weserv.nl')
    expect(out).not.toContain('metravelprod.s3')
    expect(out).toContain(
      `src="https://metravel.by/media-resize/uploads/legacy-photo.jpg?w=800${AMP}q=80${AMP}fit=contain"`,
    )
  })

  it('does not wrap a malformed weserv URL again when its source is missing', () => {
    const malformed = 'https://images.weserv.nl/?w=800&q=60'

    const out = prepareStableContentHtml(`<p><img src="${malformed}" /></p>`, {
      serverSanitized: true,
    })

    expect((out.match(/images\.weserv\.nl/g) ?? [])).toHaveLength(1)
    expect(out).toContain('src="https://images.weserv.nl/?w=800&amp;q=60"')
  })

  // #1176: тела легаси-статей ссылаются прямо на бакет. S3 не понимает `w` и отдаёт
  // мастер (замер прода 2026-08-02: 141 354 B против 7 820 B на `?w=320` через свой
  // роут), и пока такие ссылки живы, анонимное чтение бакета нельзя закрыть.
  it('rewrites a legacy bucket link onto the first-party resize route with the full ladder', () => {
    const html =
      '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1591620319350_original.jpg" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).not.toContain('metravelprod.s3')
    expect(out).not.toContain('images.weserv.nl')
    expect(out).toContain(
      `src="https://metravel.by/media-resize/uploads/1591620319350_original.jpg?w=800${AMP}q=80${AMP}fit=contain"`,
    )
    // Лестница та же, что у первопартийных картинок тела: отдельного набора
    // ширин для легаси не заводим — именно так уже разъезжались копии (#1170).
    for (const w of [480, 640, 800, 960, 1920]) {
      expect(out).toContain(
        `https://metravel.by/media-resize/uploads/1591620319350_original.jpg?w=${w}${AMP}q=80${AMP}fit=contain ${w}w`,
      )
    }
    expect(out).toContain('sizes="(max-width: 768px) 100vw, (max-width: 1439px) 720px, 920px"')
  })

  it('routes a legacy conversions key through the legacy resize route', () => {
    const html =
      '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/3994/conversions/HcQK-detail_hd.jpg" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).not.toContain('metravelprod.s3')
    expect(out).toContain(
      `src="https://metravel.by/media-resize/legacy/3994/conversions/HcQK-detail_hd.jpg?w=800${AMP}q=80${AMP}fit=contain"`,
    )
  })

  it('preserves an encoded legacy key while stripping weserv and S3 signatures', () => {
    const origin =
      'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/%D0%98%D0%B7%D0%BE%D0%B1%D1%80%D0%B0%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5%201.jpg?v=42&X-Amz-Signature=secret'
    const wrapped = `https://images.weserv.nl/?url=${encodeURIComponent(origin)}&w=1600`
    const out = prepareStableContentHtml(`<p><img src="${wrapped}" /></p>`, {
      serverSanitized: true,
    })

    expect(out).not.toContain('images.weserv.nl')
    expect(out).not.toContain('metravelprod.s3')
    expect(out).not.toContain('X-Amz-')
    expect(out).toContain(
      `src="https://metravel.by/media-resize/uploads/%D0%98%D0%B7%D0%BE%D0%B1%D1%80%D0%B0%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5%201.jpg?v=42${AMP}w=800${AMP}q=80${AMP}fit=contain"`,
    )
  })

  it('leaves a bucket class without a legacy route on its original url', () => {
    // Выдумать роут под `**/responsive-images/**` нельзя: префикс удалён в #1157,
    // и переписывание превратило бы мёртвую ссылку в мёртвую ссылку на наш хост.
    const html =
      '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/540/responsive-images/x.jpg" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).toContain(
      'src="https://metravelprod.s3.eu-north-1.amazonaws.com/540/responsive-images/x.jpg"',
    )
    expect(out).not.toContain('media-resize')
  })

  it('does not rewrite a responsive-images key even when conversions is nested below it', () => {
    const raw =
      'https://metravelprod.s3.eu-north-1.amazonaws.com/540/responsive-images/conversions/x.jpg'
    const out = prepareStableContentHtml(`<p><img src="${raw}" /></p>`)

    expect(out).toContain(`src="${raw}"`)
    expect(out).not.toContain('media-resize')
    expect(out).not.toContain('srcset=')
  })

  it('reserves a stable aspect ratio for images that arrive without dimensions', () => {
    const html = '<p><img src="https://metravel.by/gallery/540/gallery/unknown.webp" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).toContain('style="display:block;height:auto;margin:0 auto;aspect-ratio:800/450"')
    expect(out).toContain('width="800" height="450"')
    expect(out).toContain('--travel-rich-image-aspect:800/450')
  })
})
