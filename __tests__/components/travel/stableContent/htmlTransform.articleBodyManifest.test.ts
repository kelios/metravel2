// #1256: тело статьи потребляет готовые адреса из `media.article_body` вместо
// собственной сборки медиа-URL. Проверяется ровно то, что тикет объявил Done gate:
// адреса берутся из манифеста, `q=`/`fit=` из разметки исчезают, ключ вне манифеста
// остаётся на прежнем пути, а префетч по-прежнему попадает в кандидата из `srcset`.
import { Platform } from 'react-native'

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: jest.fn((html: string) => html),
}))

jest.mock('@/components/article/articleEditorConfig', () => ({
  normalizeArticleEditorHtmlForInput: jest.fn((html: string) => html),
}))

import { buildArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia'
import {
  buildStableContentPrefetchUrl,
  extractFirstImgSrc,
  prepareStableContentHtml,
} from '@/components/travel/stableContent/htmlTransform'
import {
  ARTICLE_BODY_ADDRESS_IMAGE,
  ARTICLE_BODY_ADDRESS_IMAGE_URL,
  ARTICLE_BODY_DESCRIPTION_IMAGE,
  ARTICLE_BODY_DESCRIPTION_IMAGE_URL,
  ARTICLE_BODY_LEGACY_UPLOAD_URL,
  PROD_ARTICLE_BODY_GROUP,
} from '@/__tests__/fixtures/prodArticleBodyManifest'

const MEDIA = buildArticleBodyMediaIndex(PROD_ARTICLE_BODY_GROUP)

// Conversion-ключ манифеста приезжает в разметку по своему resize-роуту: этот
// перевод делает общий `resolveMediaVariantUrl`, тот же, что у каталога и галереи
// (#1195). Важно, что адрес один на весь фронт, а не что он дословно из манифеста.
const ADDRESS_IMAGE_RESOLVED =
  'https://metravel.by/media-resize/legacy/15601/conversions/db981e7dac4f45cb840ae19a5722ed22.webp'

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

/** Кандидаты `srcset` в неэкранированном виде. */
const srcSetCandidates = (html: string): string[] =>
  (html.match(/srcset="([^"]+)"/i)?.[1] ?? '')
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0]?.replace(/&amp;/g, '&') ?? '')
    .filter(Boolean)

const emittedWidths = (html: string): number[] =>
  Array.from(new Set(Array.from(html.matchAll(/[?&]w=(\d+)/g), (m) => Number(m[1])))).sort(
    (a, b) => a - b,
  )

const prepare = (rawSrc: string, media = MEDIA) =>
  prepareStableContentHtml(`<p><img src="${rawSrc}" /></p>`, { articleBodyMedia: media })

describe('article body consumes ready-made manifest urls (#1256)', () => {
  it('emits manifest urls verbatim and stops constructing quality/fit params', () => {
    const out = withWebViewport(1920, 1, () => prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL))

    expect(out).not.toContain('q=80')
    expect(out).not.toContain('fit=contain')
    // Каждый кандидат — это адрес прямо из `srcset` манифеста, а не наша сборка.
    const manifestUrls = String(ARTICLE_BODY_DESCRIPTION_IMAGE.srcset)
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0])
    for (const candidate of srcSetCandidates(out)) {
      expect(manifestUrls).toContain(candidate)
    }
    expect(out).toContain('sizes="(max-width: 768px) 100vw, (max-width: 1439px) 720px, 920px"')
  })

  /**
   * Ширина 1920 у этого ключа — ТОЛЬКО мастер `hero_1920` в `variants`: shrink-
   * профиль бэкенда (`9136878`) снял производную `content_1920`, в `srcset`
   * манифеста такой ступени нет, и точную ширину мастера backend отдаёт мастером
   * с `no-store`. Лестница обязана не звать её вовсе — ни из своей сборки, ни из
   * `variants.hero_1920` (#1373, обе фазы дрейфа).
   */
  it('never asks for the 1920 master that lives only in variants', () => {
    const out = withWebViewport(1920, 2, () => prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL))

    expect(emittedWidths(out)).not.toContain(1920)
    expect(String(ARTICLE_BODY_DESCRIPTION_IMAGE.srcset)).not.toContain('1920w')
    expect(out).not.toContain('q=80')
  })

  // Манифест перечисляет всю лестницу семейства, но слот решает, какие ступени ему
  // предлагать. Без этого мобильный слот 100vw @DPR3 выбрал бы 1600: замер прода
  // 2026-08-04 на 10 кадрах статьи 544 — 1 403 792 B против 946 638 B на 800.
  it('keeps the mobile slot off the top rungs the manifest offers', () => {
    const out = withWebViewport(390, 3, () => prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL))

    expect(emittedWidths(out)).toEqual([480, 800])
  })

  it('offers the desktop slot the wider rungs of the same manifest', () => {
    const out = withWebViewport(1920, 1, () => prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL))

    expect(emittedWidths(out)).toEqual([480, 800, 960, 1600])
  })

  // #1261: у ключа чужого семейства лестницу теперь обрывает САМ манифест — после
  // #1260 её определяет профиль источника (`route_point`, верхняя производная 960),
  // а не слот-потребитель. Своего потолка у фронта больше нет, и верхняя ступень
  // здесь обязана прийти из манифеста, а не из фронтовой таблицы семейств.
  it('takes a foreign-family ladder from the manifest without clamping it itself', () => {
    const out = withWebViewport(1920, 2, () => prepare(ARTICLE_BODY_ADDRESS_IMAGE_URL))

    // Адреса всё-таки из манифеста: своя сборка добавила бы `q=`/`fit=`.
    expect(out).not.toContain('q=80')
    expect(out).toContain(`${ADDRESS_IMAGE_RESOLVED}?w=960 960w`)
    // Манифест route_point предлагает и 640, но отбор под слот оставляет только
    // ступени набора тела статьи, а у него 640 больше нет (shrink `9136878`).
    // Потолок при этом манифестный: 960 остаётся, 1600 не появляется.
    expect(emittedWidths(out)).toEqual([480, 800, 960])
    // Ступени 1600 нет в манифесте этого ключа — и просить её неоткуда.
    expect(out).not.toContain('w=1600')
    expect(ARTICLE_BODY_ADDRESS_IMAGE.srcset).not.toContain('1600')
  })

  // Обратная сторона снятого клэмпа: фронт больше не «спасает» переобещанный
  // манифест, он его отражает. Если бэкенд снова начнёт раздавать чужому семейству
  // ступень, которой нет, фронт её и подставит — ловит это не клиентский код, а
  // пост-деплой гейт, обходящий каждую ступень `srcset`. Тест фиксирует ровно это
  // разделение ответственности, чтобы клэмп не вернули «на всякий случай».
  it('mirrors the manifest verbatim instead of second-guessing the backend', () => {
    const overPromised = {
      ...ARTICLE_BODY_ADDRESS_IMAGE,
      srcset: [320, 960, 1600]
        .map((w) => `${ARTICLE_BODY_ADDRESS_IMAGE_URL}?w=${w} ${w}w`)
        .join(', '),
      srcset_contain: null,
    }
    const media = buildArticleBodyMediaIndex({ gallery: [overPromised] })
    const out = withWebViewport(1920, 2, () => prepare(ARTICLE_BODY_ADDRESS_IMAGE_URL, media))

    // 320 отсеял отбор под слот — он к семействам отношения не имеет. А вот 1600
    // осталась: раньше её срезал бы фронтовой потолок `route_point`.
    expect(emittedWidths(out)).toEqual([960, 1600])
  })

  describe('prefetch stays inside the emitted candidate set (#1213)', () => {
    it.each([
      { label: 'desktop 1920 @1x', width: 1920, dpr: 1, expected: 960 },
      // Слот 920 CSS @DPR2 просит 1840 и закрывается верхней производной 1600 с
      // апскейлом ×1.15: ступени выше в shrink-профиле нет (`9136878`), а 1920 —
      // мастер с `no-store`, греть его нельзя (#1373).
      { label: 'desktop 1920 @2x', width: 1920, dpr: 2, expected: 1600 },
      { label: 'desktop 1280 @1x', width: 1280, dpr: 1, expected: 800 },
      { label: 'mobile 390 @3x', width: 390, dpr: 3, expected: 800 },
    ])('$label warms w=$expected', ({ width, dpr, expected }) => {
      const { prefetch, candidates } = withWebViewport(width, dpr, () => {
        const prepared = prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL)
        return {
          prefetch: buildStableContentPrefetchUrl(extractFirstImgSrc(prepared)!, MEDIA),
          candidates: srcSetCandidates(prepared),
        }
      })

      expect(prefetch).toBe(`${ARTICLE_BODY_DESCRIPTION_IMAGE_URL}?w=${expected}`)
      expect(candidates).toContain(prefetch)
    })

    it('stays inside the emitted set for a foreign-family key', () => {
      const { prefetch, candidates } = withWebViewport(1920, 2, () => {
        const prepared = prepare(ARTICLE_BODY_ADDRESS_IMAGE_URL)
        return {
          prefetch: buildStableContentPrefetchUrl(extractFirstImgSrc(prepared)!, MEDIA),
          candidates: srcSetCandidates(prepared),
        }
      })

      expect(prefetch).toBe(`${ADDRESS_IMAGE_RESOLVED}?w=960`)
      expect(candidates).toContain(prefetch)
    })
  })

  describe('matching markup to the manifest', () => {
    it('matches by image key, not by position in the gallery', () => {
      // Второй элемент манифеста — `address-image`, но в разметке он идёт первым.
      const out = withWebViewport(1920, 2, () => prepare(ARTICLE_BODY_ADDRESS_IMAGE_URL))
      expect(out).toContain(ADDRESS_IMAGE_RESOLVED)
      expect(out).not.toContain(ARTICLE_BODY_DESCRIPTION_IMAGE_URL)
    })

    it('matches through a cache-buster and a sibling media host', () => {
      const raw = ARTICLE_BODY_DESCRIPTION_IMAGE_URL.replace('metravel.by', 'cdn.metravel.by')
      const out = withWebViewport(1920, 1, () => prepare(`${raw}?v=3315`))

      expect(out).not.toContain('q=80')
      expect(out).toContain(`${ARTICLE_BODY_DESCRIPTION_IMAGE_URL}?w=800`)
      // Cache-buster жил в разметке, а не в манифесте: адрес теперь целиком с бэка.
      expect(out).not.toContain('v=3315')
    })
  })

  describe('fallback stays intact where the manifest has nothing to offer', () => {
    it('keeps a legacy uploads key off the bucket url the manifest reports', () => {
      const out = withWebViewport(1920, 1, () => prepare(ARTICLE_BODY_LEGACY_UPLOAD_URL))

      expect(out).not.toContain('metravelprod.s3')
      expect(out).toContain('/media-resize/uploads/1591620319350_original.jpg')
      expect(out).not.toMatch(/[?&](?:amp;)?f=/)
    })

    // Манифест сегодня отдаёт `uploads/**` пустой `srcset`, но отбраковка держится
    // на КЛЮЧЕ, а не на этом факте: durable-производных у класса нет, любая ступень
    // отдаёт мастер целиком (v16, `v1_then_master_no_transform`). Появись у него
    // лестница в манифесте — она обещала бы вес, которого не будет (#1233, #1753).
    it('ignores manifest rungs for the uploads class even when the backend fills srcset', () => {
      const resized = 'https://metravel.by/media-resize/uploads/1591620319350_original.jpg'
      const filled = {
        ...PROD_ARTICLE_BODY_GROUP.gallery[2],
        srcset: [320, 480, 640, 800].map((w) => `${resized}?w=${w} ${w}w`).join(', '),
      }
      const media = buildArticleBodyMediaIndex({ gallery: [filled] })
      const out = withWebViewport(1920, 1, () => prepare(ARTICLE_BODY_LEGACY_UPLOAD_URL, media))

      expect(media).toBeNull()
      expect(out).not.toMatch(/[?&](?:amp;)?f=/)
      expect(Array.from(out.matchAll(/[?&]w=(\d+)/g), (m) => m[1])).toEqual(['800'])
    })

    // Прежде здесь стоял случай «лестница манифеста целиком выше потолка семейства
    // → уходим в фолбэк». Он держался на фронтовой таблице потолков и вместе с ней
    // снят (#1261): после #1260 лестницу задаёт профиль источника, поэтому ступеней
    // вне своего семейства манифест не выдаёт вовсе. Что делает фронт, если бэкенд
    // всё-таки переобещает, проверяет тест «mirrors the manifest verbatim» выше.

    it('keeps a key outside the manifest on the client-built ladder', () => {
      const raw = 'https://metravel.by/travel-description-image/540/description/abc.JPG'
      const out = withWebViewport(1920, 1, () => prepare(raw))

      expect(out).toContain('q=80')
      expect(out).toContain('fit=contain')
      // Полный desktop-набор `articleBody` — четыре ступени shrink-профиля
      // (#1373): ключ идёт своим семейством, потолок 1600 совпадает с набором.
      expect(emittedWidths(out)).toEqual([480, 800, 960, 1600])
    })

    it('keeps every image on the client-built ladder when no manifest is passed', () => {
      const out = withWebViewport(1920, 1, () => prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL, null))

      expect(out).toContain('q=80')
      expect(out).toContain('fit=contain')
    })
  })

  describe('buildArticleBodyMediaIndex', () => {
    it('drops entries whose only address is the storage bucket', () => {
      expect(buildArticleBodyMediaIndex({ gallery: [PROD_ARTICLE_BODY_GROUP.gallery[2]] })).toBeNull()
    })

    it('returns null for an absent or empty manifest', () => {
      expect(buildArticleBodyMediaIndex(null)).toBeNull()
      expect(buildArticleBodyMediaIndex(undefined)).toBeNull()
      expect(buildArticleBodyMediaIndex({ gallery: [] })).toBeNull()
    })
  })
})
