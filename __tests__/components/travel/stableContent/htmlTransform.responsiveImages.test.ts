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

/** jsdom-окно 1024×768 — десктопный слот; платформу задаём явно (см. #1268). */
const withWeb = <T,>(run: () => T): T => {
  const originalOs = Platform.OS
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
  try {
    return run()
  } finally {
    Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
  }
}

describe('normalizeImgTags responsive delivery for first-party metravel images (#815)', () => {
  it('rebuilds a first-party description image as a responsive srcset ladder', () => {
    const html =
      '<p><img src="https://metravel.by/travel-description-image/540/description/abc.JPG?v=3315&amp;w=1600" /></p>'
    // Кейс про DESKTOP web, поэтому платформа задаётся явно. Раньше тест проходил
    // на дефолтном `Platform.OS === 'ios'`: набор был десктопным просто потому, что
    // «не web», а не из-за ширины окна. С #1268 набор выбирается по вьюпорту на
    // любой платформе, и такая подмена смысла теста больше не проходит молча.
    const out = withWeb(() => prepareStableContentHtml(html))

    // src падает на fallback-ступень, а не отдаёт оригинал
    expect(out).toContain(`src="https://metravel.by/travel-description-image/540/description/abc.JPG?v=3315${AMP}w=800${AMP}q=80${AMP}fit=contain"`)
    // полная desktop-лестница присутствует в srcset (jsdom innerWidth 1024 > 768):
    // четыре ступени shrink-профиля `article_body` (бэкенд-коммит `9136878`)
    for (const w of [480, 800, 960, 1600]) {
      expect(out).toContain(`w=${w}${AMP}q=80${AMP}fit=contain ${w}w`)
    }
    // Ступень 1920 дважды входила в набор и дважды снята. #1160 поднял ею потолок,
    // когда это была ширина МАСТЕРА: fail-closed чтение отвечало 400 (замер прода
    // 2026-08-03), потолок опустили до 1600. Backend завёл `content_1920`
    // производной (#1215), ступень вернули (#1373) — и тем же днём shrink `9136878`
    // производную снял: точная 1920 снова только мастер с `no-store`, звать её нельзя.
    expect(out).not.toContain(`w=1920${AMP}q=80${AMP}fit=contain 1920w`)
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
      { label: 'desktop 1280 @2x', width: 1280, dpr: 2, expected: 1600 },
      { label: 'desktop 1280 @1x', width: 1280, dpr: 1, expected: 800 },
      { label: 'desktop 1920 @1x', width: 1920, dpr: 1, expected: 960 },
      // Слот 920 CSS @DPR2 просит 1840 и закрывается верхней производной 1600 с
      // апскейлом ×1.15: ступени выше в shrink-профиле нет, а 1920 — мастер с
      // `no-store` (#1373).
      { label: 'desktop 1920 @2x', width: 1920, dpr: 2, expected: 1600 },
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

      // Две ступени мобильного набора: 320/640 у shrink-профиля больше нет (#1373).
      for (const w of [480, 800]) {
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

  // #1233: наборы `articleBody*` описывают СЛОТ, а не то, что есть у файла. В телах
  // статей лежат ключи чужих семейств, и у `address-image` (профиль `routePoint`,
  // мастер 1200, верхняя производная 960) ступени 1600 нет вовсе. Замер прода
  // 2026-08-04 на `address-image/15601/conversions/…webp`: `w=800`/`w=960` → 200,
  // `w=1600` → 400. На desktop @DPR2 браузер выбирал именно 1600 — 13 из 13 таких
  // ключей в `/travels/zabroshennye-dvortsy-…` не отрисовывались (30 фото в 5 статьях).
  describe('body ladder is clamped to the family ceiling of the source (#1233)', () => {
    const withViewport = <T,>(viewport: number, run: () => T): T => {
      const originalOs = Platform.OS
      const originalWidth = window.innerWidth
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
      Object.defineProperty(window, 'innerWidth', { value: viewport, configurable: true })
      try {
        return run()
      } finally {
        Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
        Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
      }
    }

    const rungs = (html: string): number[] =>
      Array.from(
        new Set(Array.from(html.matchAll(/[?&]w=(\d+)/g), (m) => Number(m[1]))),
      ).sort((a, b) => a - b)

    it('never asks address-image for a width above its 960 derivative', () => {
      const out = withViewport(1920, () =>
        prepareStableContentHtml(
          '<p><img src="https://metravel.by/address-image/15601/conversions/db981e7dac4f45cb840ae19a5722ed22.webp" /></p>',
        ),
      )

      expect(out).toContain('/media-resize/legacy/15601/conversions/')
      expect(rungs(out)).toEqual([480, 800, 960])
      expect(out).not.toContain('w=1600')
    })

    it('leaves gallery on the full slot ladder — 1600 is a real derivative there', () => {
      const out = withViewport(1920, () =>
        prepareStableContentHtml(
          '<p><img src="https://metravel.by/gallery/3514/conversions/UEx4Q47U0LQBOYhC7zs2d2Kchu5JHYdogjYDNCC2-detail_hd.jpg" /></p>',
        ),
      )

      expect(rungs(out)).toEqual([480, 800, 960, 1600])
    })

    // #1213: префетч обязан попасть в кандидата из `srcset`. Клэмп по семейству
    // должен применяться в обоих местах, иначе префетч греет 400.
    it('keeps the prefetch inside the clamped candidate set', () => {
      const prepared = withViewport(1920, () =>
        prepareStableContentHtml(
          '<p><img src="https://metravel.by/address-image/15601/conversions/db981e7dac4f45cb840ae19a5722ed22.webp" /></p>',
        ),
      )
      const prefetch = withViewport(1920, () =>
        buildStableContentPrefetchUrl(extractFirstImgSrc(prepared)!),
      )
      const candidates = (prepared.match(/srcset="([^"]+)"/i)?.[1] ?? '')
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0]?.replace(/&amp;/g, '&') ?? '')
        .filter(Boolean)

      expect(candidates).toContain(prefetch)
      expect(prefetch).not.toContain('w=1600')
    })
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
  it('rewrites a legacy bucket link onto the first-party resize route', () => {
    const html =
      '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1591620319350_original.jpg" /></p>'
    const out = prepareStableContentHtml(html)

    expect(out).not.toContain('metravelprod.s3')
    expect(out).not.toContain('images.weserv.nl')
    expect(out).toContain(
      `src="https://metravel.by/media-resize/uploads/1591620319350_original.jpg?w=800${AMP}q=80${AMP}fit=contain"`,
    )
  })

  // #1753: класс `uploads/**` спрашивается БЕЗ параметра формата. Обход #1233
  // просил его явным `f=jpeg`, пока proxy-contract объявлял для `legacy_upload`
  // `explicit_format_overrides: {jpeg: transform}`. В v16 то же поле объявлено как
  // `unsupported_format`: замер прода 2026-09-04,
  // `uploads/1620061579IMG_6533.JPG?w=800&q=80&fit=contain` — с `&f=jpeg` 400
  // `unsupported-format`, без него 200 `stored-master-fallback` 190 060 B. На живой
  // опубликованной странице обход давал 17 запросов и 17 ответов 400.
  describe('legacy uploads class asks the branch that actually answers (#1753)', () => {
    const LEGACY = 'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1642189225IMG_6113.jpg'

    it('emits the single width without a format override', () => {
      const out = prepareStableContentHtml(`<p><img src="${LEGACY}" /></p>`)
      const src = out.match(/\bsrc="([^"]+)"/i)?.[1] ?? ''

      expect(src).toContain('/media-resize/uploads/')
      expect(src).toContain(`w=800`)
      expect(src).not.toContain('f=')
    })

    // Лестница у класса `uploads/**` бессмысленна: обмер 160 мастеров 2026-08-04 —
    // 500…1000 px, шире 1024 нет ни одного. Ступени выше 800 отдают либо байт в
    // байт тот же файл (`upscale: false`, 56% класса), либо те же пиксели на 40–70%
    // тяжелее (`DSC_0089`: w800 110 500 B против w1600 185 587 B). Поэтому одна
    // ширина и НИ ОДНОГО `srcset`/`sizes` — браузеру не из чего выбирать.
    it.each([
      { label: 'mobile 390', viewport: 390 },
      { label: 'desktop 1920', viewport: 1920 },
    ])('emits one fixed width and no ladder on $label', ({ viewport }) => {
      const originalOs = Platform.OS
      const originalWidth = window.innerWidth
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
      Object.defineProperty(window, 'innerWidth', { value: viewport, configurable: true })
      try {
        const out = prepareStableContentHtml(`<p><img src="${LEGACY}" /></p>`)

        expect(out).not.toContain('srcset=')
        expect(out).not.toContain('sizes=')
        expect(Array.from(out.matchAll(/[?&]w=(\d+)/g), (m) => m[1])).toEqual(['800'])
      } finally {
        Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
        Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
      }
    })

    // #1213: префетч обязан попасть в тот же URL, что и `<img>`, иначе слот
    // качается дважды. Без лестницы это значит «ту же единственную ширину», а не
    // ступень, выбранную по вьюпорту.
    it('warms the prefetch on exactly the url the img will request', () => {
      const prepared = prepareStableContentHtml(`<p><img src="${LEGACY}" /></p>`)
      const src = (prepared.match(/\bsrc="([^"]+)"/i)?.[1] ?? '').replace(/&amp;/g, '&')

      expect(buildStableContentPrefetchUrl(extractFirstImgSrc(prepared)!)).toBe(src)
    })

    // #1753: карве-аута больше нет — `f` не ставится НИ ОДНОМУ классу, и эти два
    // случая держат границу с другой стороны: попытка вернуть точечный обход не
    // должна расползтись на здоровые роуты. У conversion-ключей производные
    // забэкфиллены и вся лестница отвечает 200 `stored-derivative` (замер
    // 2026-08-04, `legacy/5741/…-detail_hd.jpg`), то есть явный формат тут был бы
    // чистой потерей webp-производной.
    it('leaves the healthy legacy conversions route on the default webp branch', () => {
      const out = prepareStableContentHtml(
        '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/3994/conversions/HcQK-detail_hd.jpg" /></p>',
      )

      expect(out).toContain('/media-resize/legacy/3994/conversions/HcQK-detail_hd.jpg')
      expect(out).not.toContain('f=jpeg')
    })

    it('leaves the canonical article-body family route on the default webp branch', () => {
      const out = prepareStableContentHtml(
        '<p><img src="https://metravel.by/travel-description-image/540/description/abc.JPG" /></p>',
      )

      expect(out).not.toContain('f=jpeg')
    })
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

  /**
   * Ссылка в бакет переписывается на `/media-resize/legacy/…`, где первый сегмент —
   * `media-resize`, а не роут семейства: профиль по адресу не читается, и до #1373
   * такая лестница не клэмпилась вовсе. Держалось это на том, что набор сам
   * обрывался на 1600.
   *
   * За legacy-роутом стоят ровно два профиля — `travel` (верхняя производная 1600) и
   * `route_point` (960), — и какой именно, по адресу не узнать. Поэтому потолок
   * берётся по САМОМУ УЗКОМУ: лишняя ступень здесь стоит 400 и битого фото (замер
   * прода: `address-image/15601/conversions/…` → `w=1600` → 400,
   * `legacy/682/conversions/…` → `w=1920` → 400), а заниженная — только резкости.
   */
  it('clamps an unresolved legacy key to the narrowest profile behind that route', () => {
    const originalOs = Platform.OS
    const originalWidth = window.innerWidth
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    try {
      const out = prepareStableContentHtml(
        '<p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/3994/conversions/HcQK-detail_hd.jpg" /></p>',
      )

      const widths = Array.from(out.matchAll(/[?&](?:amp;)?w=(\d+)/g), (m) => Number(m[1]))
      expect(Math.max(...widths)).toBe(960)
      expect(out).not.toContain('1920w')
      expect(out).not.toContain('1600w')
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
      Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
    }
  })

  /**
   * Тот же клэмп обязан работать и на префетче, причём именно на DPR2: `src` в
   * разметке у conversion-ключа УЖЕ переписан на legacy-роут, семейство по нему не
   * читается, и без потолка слот 920 CSS @DPR2 (нужно 1840) грел бы ступень,
   * которой у `route_point` нет, — то есть `<link rel=prefetch>` уходил бы в 400 и
   * мимо кандидатов `srcset` (#1213 + #1233).
   */
  it('keeps the prefetch of a rewritten address-image key inside the candidate set @DPR2', () => {
    const originalOs = Platform.OS
    const originalWidth = window.innerWidth
    const originalDpr = window.devicePixelRatio
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    try {
      const prepared = prepareStableContentHtml(
        '<p><img src="https://metravel.by/address-image/15601/conversions/db981e7dac4f45cb840ae19a5722ed22.webp" /></p>',
      )
      const prefetch = buildStableContentPrefetchUrl(extractFirstImgSrc(prepared)!)
      const candidates = (prepared.match(/srcset="([^"]+)"/i)?.[1] ?? '')
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0]?.replace(/&amp;/g, '&') ?? '')
        .filter(Boolean)

      expect(new URL(prefetch).searchParams.get('w')).toBe('960')
      expect(candidates).toContain(prefetch)
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
      Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
    }
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
