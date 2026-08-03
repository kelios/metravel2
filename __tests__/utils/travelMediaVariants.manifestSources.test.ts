// #1203: фронт берёт кандидатов из готовых `srcset*` манифеста, а не из разбора
// имён `variants`. Тест держит два инварианта сразу:
//
//   1. ПАРИТЕТ. Ступени и адреса, которые запрашивают ключевые слоты, совпадают с
//      замером до перехода (прод-манифест travel 544, 2026-08-03). Переход на
//      готовые источники не имеет права ни утяжелить страницу, ни сменить адрес:
//      расхождение здесь означает, что тот же файл поедет во второй ступени.
//   2. ИСТОЧНИК. Кандидаты приходят из `srcset*`, мастер в них не попадает, а
//      разбор `variants` остаётся только фолбэком для непокрытых семейств.

import { Platform } from 'react-native'

import { buildResponsiveImagePropsFromMedia } from '@/utils/travelMediaVariants'
import type { TravelMediaImage } from '@/types/types'
import { PROD_COVER, PROD_GALLERY_ITEM, PROD_ROUTE_POINT } from '../fixtures/prodMediaManifest'

const withWeb = <T,>(fn: () => T): T => {
  const original = Platform.OS
  ;(Platform as { OS: string }).OS = 'web'
  try {
    return fn()
  } finally {
    ;(Platform as { OS: string }).OS = original
  }
}

const widthsOf = (srcSet: string | undefined): number[] =>
  Array.from(String(srcSet ?? '').matchAll(/\s(\d+)w/g)).map((match) => Number(match[1]))

const widthOfUrl = (url: string | undefined): number | null => {
  const match = /[?&]w=(\d+)/.exec(String(url ?? ''))
  return match ? Number(match[1]) : null
}

// Слоты в тех же параметрах, в которых их вызывает продовый код:
// `TravelListItem` (каталог), `TravelDetailsOptimizedLCPHero` (hero),
// `sliderParts/utils.ts` (галерея), карточка точки маршрута.
const SLOTS = [
  {
    name: 'каталог, обычная карточка',
    entry: PROD_COVER,
    options: { maxWidth: 640, widths: [160, 320, 480, 640], sizes: '100vw' },
    expectedSrcWidth: 640,
    expectedSrcSetWidths: [160, 320, 480, 640],
  },
  {
    name: 'каталог, первая карточка',
    entry: PROD_COVER,
    options: { maxWidth: 720, widths: [160, 320, 480, 640, 720], sizes: '100vw' },
    expectedSrcWidth: 720,
    expectedSrcSetWidths: [160, 320, 480, 640, 720],
  },
  {
    name: 'hero mobile',
    entry: PROD_COVER,
    options: { maxWidth: 720, widths: [320, 480, 640, 720], fit: 'contain' as const, sizes: '100vw' },
    expectedSrcWidth: 720,
    expectedSrcSetWidths: [320, 480, 640, 720],
  },
  {
    name: 'hero desktop',
    entry: PROD_COVER,
    options: {
      maxWidth: 1280,
      widths: [720, 960, 1280],
      fit: 'contain' as const,
      sizes: '(max-width: 1024px) 92vw, 720px',
    },
    expectedSrcWidth: 1280,
    expectedSrcSetWidths: [720, 960, 1280],
  },
  {
    name: 'слайдер галереи mobile',
    entry: PROD_GALLERY_ITEM,
    options: {
      maxWidth: 720,
      widths: [320, 640, 720, 960, 1280],
      fit: 'contain' as const,
      sizes: '100vw',
    },
    expectedSrcWidth: 720,
    expectedSrcSetWidths: [320, 640, 720, 960, 1280],
  },
  {
    name: 'слайдер галереи desktop',
    entry: PROD_GALLERY_ITEM,
    options: {
      maxWidth: 1280,
      widths: [320, 640, 720, 960, 1280],
      fit: 'contain' as const,
      sizes: '(max-width: 1280px) 100vw, 1280px',
    },
    expectedSrcWidth: 1280,
    expectedSrcSetWidths: [320, 640, 720, 960, 1280],
  },
  {
    name: 'точка маршрута',
    entry: PROD_ROUTE_POINT,
    options: { maxWidth: 640, widths: [320, 480, 640] },
    expectedSrcWidth: 640,
    expectedSrcSetWidths: [320, 480, 640],
  },
]

describe('#1203 источники медиа-URL из манифеста', () => {
  const previousApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = previousApiUrl
  })

  describe('паритет ступеней с замером до перехода', () => {
    it.each(SLOTS)('$name', ({ entry, options, expectedSrcWidth, expectedSrcSetWidths }) => {
      const result = withWeb(() => buildResponsiveImagePropsFromMedia(entry, options))

      expect(result).not.toBeNull()
      expect(widthOfUrl(result?.src)).toBe(expectedSrcWidth)
      expect(widthsOf(result?.srcSet)).toEqual(expectedSrcSetWidths)
    })

    // #1116: один и тот же мастер не должен приезжать двумя ступенями. Дескрипторы
    // внутри одного srcSet обязаны быть уникальными.
    it.each(SLOTS)('$name — без дублей ступеней', ({ entry, options }) => {
      const widths = widthsOf(withWeb(() => buildResponsiveImagePropsFromMedia(entry, options))?.srcSet)
      expect(widths).toEqual(Array.from(new Set(widths)))
    })
  })

  describe('источник кандидатов', () => {
    it('берёт ступени из готовых srcset, а не из имён variants', () => {
      // `variants` намеренно противоречит `srcset`: если кандидаты всё ещё берутся
      // оттуда, в наборе появится ширина 111.
      const entry: TravelMediaImage = {
        ...PROD_COVER,
        variants: { card_111: '/travel-image/544/conversions/x.webp?w=111' },
      }

      const widths = widthsOf(
        withWeb(() => buildResponsiveImagePropsFromMedia(entry, { maxWidth: 640, widths: [320, 640] }))
          ?.srcSet,
      )

      expect(widths).toEqual([320, 640])
      expect(widths).not.toContain(111)
    })

    // #1112: тихая отдача оригинала. Мастер точки (1200) лежит в `variants`, но в
    // `srcset` его нет — в кандидаты он попадать не должен.
    it('не поднимает мастер из variants в кандидаты', () => {
      const result = withWeb(() =>
        buildResponsiveImagePropsFromMedia(PROD_ROUTE_POINT, { maxWidth: 1200, widths: [1200] }),
      )

      expect(widthOfUrl(result?.src)).toBe(960)
      expect(widthsOf(result?.srcSet)).toEqual([960])
    })

    // Единственный оставшийся фолбэк — для семейств, которые манифест ещё не
    // покрывает (тело статьи, аватары; остаток #1202).
    it('без готовых srcset падает на разбор variants', () => {
      const entry: TravelMediaImage = {
        ...PROD_COVER,
        srcset: null,
        srcset_cover: null,
        srcset_contain: null,
        srcset_print: null,
      }

      const result = withWeb(() =>
        buildResponsiveImagePropsFromMedia(entry, { maxWidth: 640, widths: [320, 640] }),
      )

      expect(widthsOf(result?.srcSet)).toEqual([320, 640])
    })
  })

  describe('sizes', () => {
    it('подсказку слота берёт только вместе с его набором ступеней', () => {
      // У точки `sizes_hint_contain` обещает 1280px при пустом `srcset_contain`
      // и потолке производных 960 — такая подсказка увела бы браузер на верхнюю
      // ступень. Остаётся общая подсказка манифеста.
      const result = withWeb(() =>
        buildResponsiveImagePropsFromMedia(PROD_ROUTE_POINT, {
          maxWidth: 640,
          widths: [320, 640],
          fit: 'contain',
        }),
      )

      expect(PROD_ROUTE_POINT.sizes_hint_contain).toBe('(max-width: 768px) 100vw, 1280px')
      expect(result?.sizes).toBe(PROD_ROUTE_POINT.sizes_hint)
    })

    it('sizes вызывающего кода имеет приоритет над манифестом', () => {
      const result = withWeb(() =>
        buildResponsiveImagePropsFromMedia(PROD_COVER, { maxWidth: 640, sizes: '320px' }),
      )

      expect(result?.sizes).toBe('320px')
    })
  })

  // #1204: манифест адресует family-роут, но для conversion-ключей он отвечает
  // 404 — рабочий обход обязан пережить переход на готовые источники.
  it('conversion-ключи остаются на legacy-роуте', () => {
    const result = withWeb(() =>
      buildResponsiveImagePropsFromMedia(PROD_COVER, { maxWidth: 640, widths: [640] }),
    )

    expect(result?.src).toContain('/media-resize/legacy/544/conversions/')
    expect(result?.srcSet).toContain('/media-resize/legacy/544/conversions/')
  })
})
