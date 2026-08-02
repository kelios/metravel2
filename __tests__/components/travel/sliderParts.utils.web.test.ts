/**
 * @jest-environment jsdom
 */

import { Platform } from 'react-native'

import { buildUriWeb } from '@/components/travel/sliderParts/utils'

describe('sliderParts/utils buildUriWeb (web)', () => {
  const originalPlatform = Platform.OS
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    ;(window as any).devicePixelRatio = 1
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl
  })

  it('keeps the first desktop slide aligned with the LCP hero image variant', () => {
    const src = buildUriWeb(
      {
        id: 'hero-1',
        url: 'https://metravel.by/gallery/123/hero.jpg',
      } as any,
      1180,
      undefined,
      'contain',
    )

    // q quantized to the nearest 10 (82 → 80) by imageProxy DIMENSION/quality ladder;
    // hero stays dpr-/format-free per the image-architecture rule.
    expect(src).toContain('w=1280')
    expect(src).toContain('q=80')
    expect(src).toContain('fit=contain')
    expect(src).not.toContain('dpr=')
    expect(src).not.toContain('f=')
  })

  it('keeps the first mobile slide aligned with the LCP hero image variant', () => {
    const src = buildUriWeb(
      {
        id: 'hero-1',
        url: 'https://metravel.by/gallery/123/hero.jpg',
      } as any,
      390,
      undefined,
      'contain',
    )

    // #1170: в лестницу вернули ступени 720/960/1024/1200, которых у прокси всё это
    // время не было только на фронте. Теперь 720 остаётся 720 и не округляется до 800.
    // Инвариант #1146 при этом сохранён: SSG-зеркало лестницы обновлено тем же
    // коммитом и снэпит 720 → 720, то есть preload и слайдер по-прежнему просят
    // побайтово один URL. Парность закреплена тестом `imageProxy.ladder.test.ts`.
    // q 72 → 70. Hero stays dpr-/format-free.
    expect(src).toContain('w=720')
    expect(src).toContain('q=70')
    expect(src).toContain('fit=contain')
    expect(src).not.toContain('dpr=')
    expect(src).not.toContain('f=')
  })

  // #1210: соседний слайд просит РОВНО тот же вариант, что и первый. Раньше здесь
  // ожидалось `w=1200` — ступень, посчитанная от измеренного контейнера 1180; она
  // отличалась от `w=1280` первого слайда, и фото, сменившее индекс, качалось второй раз.
  it('gives non-first desktop slides the same variant as the first slide', () => {
    const src = buildUriWeb(
      {
        id: 'hero-2',
        url: 'https://metravel.by/gallery/123/hero-2.jpg',
      } as any,
      1180,
      undefined,
      'contain',
    )

    expect(src).toContain('w=1280')
    expect(src).toContain('q=80')
  })

  // #1210: ступень мобильного слайда не зависит ни от DPR, ни от того, успел ли
  // слайдер измерить контейнер. Раньше DPR 3 давал `w=800` (390 × 2, кап 768), а
  // DPR 1 — `w=480`; вместе с первым слайдом на 720 это давало до трёх адресов
  // одного файла. `dpr=` в URL по-прежнему не отправляем: прокси его игнорирует (#1113).
  it.each([1, 1.75, 3])('pins the mobile slide rung at DPR %s', (dpr) => {
    ;(window as any).devicePixelRatio = dpr

    const src = buildUriWeb(
      {
        id: 'hero-3',
        url: 'https://metravel.by/gallery/123/hero-3.jpg',
      } as any,
      390,
      undefined,
      'contain',
    )

    expect(src).toContain('w=720')
    expect(src).toContain('q=70')
    expect(src).toContain('fit=contain')
    expect(src).not.toMatch(/[?&]dpr=/)
    expect(src).not.toMatch(/[?&]f=/)
  })

  it('never emits dpr on non-mobile-width neighbour slides either', () => {
    ;(window as any).devicePixelRatio = 3

    const src = buildUriWeb(
      {
        id: 'hero-4',
        url: 'https://metravel.by/gallery/123/hero-4.jpg',
      } as any,
      1180,
      undefined,
      'contain',
    )

    expect(src).not.toMatch(/[?&]dpr=/)
    expect(src).toContain('w=1280')
  })

  /**
   * #1210, корень дефекта. `useSliderCore` стартует с `containerW = winW` и после
   * измерения подменяет её реальной шириной слайда. Пока ступень считалась от этой
   * величины, две фазы рендера давали два адреса одного файла:
   *   412 × 1.75 = 721 → `w=800`,  390 × 1.75 = 683 → `w=720`
   * — замер прода 2026-08-02, около 180 КБ мимо пользы на travel-детали.
   */
  it('keeps one URL per photo across the container-measurement pass', () => {
    ;(window as any).devicePixelRatio = 1.75

    const img = {
      id: 'gallery-shift',
      url: 'https://metravel.by/gallery/544/gallery/952c9b15.JPG',
    } as any

    const beforeMeasure = buildUriWeb(img, 412, undefined, 'contain')
    const afterMeasure = buildUriWeb(img, 390, undefined, 'contain')

    expect(afterMeasure).toBe(beforeMeasure)
    expect(beforeMeasure).toContain('w=720')
  })

  // Тот же инвариант на РЕАЛЬНОМ манифесте: `GET /api/travels/544/`, галерея 3569,
  // прод 2026-08-02. Именно из-за него дефект и был виден в трейсе — в манифесте
  // есть и `card_720`, и `card_800`, поэтому ступень выбиралась той шириной, которую
  // передал слайдер, и две фазы рендера уносили с прода два файла:
  // `?w=800` 152 640 B и `?w=720` 126 194 B (content-length, прод 2026-08-02).
  it('picks one manifest variant for the real production gallery entry', () => {
    ;(window as any).devicePixelRatio = 1.75

    const key = '/gallery/544/gallery/952c9b15a955444ba3d7b1374d3a9f6e.JPG'
    const img = {
      id: 3569,
      url: `https://metravel.by${key}`,
      media: {
        id: 3569,
        sizes_hint_contain: '(max-width: 768px) 100vw, 1280px',
        variants: {
          thumb_320: `${key}?w=320`,
          card_640: `${key}?w=640`,
          card_720: `${key}?w=720`,
          card_800: `${key}?w=800`,
          card_960: `${key}?w=960`,
          hero_1280: `${key}?w=1280`,
        },
      },
    } as any

    const beforeMeasure = buildUriWeb(img, 412, undefined, 'contain')
    const afterMeasure = buildUriWeb(img, 390, undefined, 'contain')

    expect(beforeMeasure).toBe(`https://metravel.by${key}?w=720`)
    expect(afterMeasure).toBe(beforeMeasure)
  })

  it('prefers backend media manifest variants for gallery slider images', () => {
    const src = buildUriWeb(
      {
        id: 'gallery-1',
        url: 'https://metravel.by/gallery/123/original.jpg',
        media: {
          id: 3706,
          lqip_url: '/gallery/123/photo.webp?w=32&q=35&fit=cover',
          variants: {
            thumb_320: '/gallery/123/photo.webp?w=320&q=72&fit=cover',
            card_640: '/gallery/123/photo.webp?w=640&q=75&fit=cover',
            hero_1280: '/gallery/123/photo.webp?w=1280&q=80&fit=contain',
          },
        },
      } as any,
      1180,
      undefined,
      'contain',
    )

    expect(src).toBe('https://metravel.by/gallery/123/photo.webp?w=1280&q=80&fit=contain')
  })
})

describe('#1146: первый слайд не расходится с hero по варианту', () => {
  const originalPlatform = Platform.OS
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL

  const GALLERY = 'https://metravel.by/gallery/3994/conversions/one-detail_hd.jpg'
  // Реальный манифест обложки travel #129 (прод, 2026-07-30): contain-вариантов
  // уже 1280 в нём нет, поэтому мобильный слот 720 схлопывался в hero_1280.
  const MEDIA = {
    id: 100,
    width: 1080,
    height: 1080,
    variants: {
      thumb_320: `${GALLERY}?w=320&q=72&fit=cover`,
      card_640: `${GALLERY}?w=640&q=75&fit=cover`,
      hero_1280: `${GALLERY}?w=1280&q=80&fit=contain`,
      hero_1920: `${GALLERY}?w=1920&q=80&fit=contain`,
    },
  }

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    ;(window as any).devicePixelRatio = 1
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl
  })

  it('мобильный первый слайд берёт тот же вариант, что SSG-preload hero', () => {
    const src = buildUriWeb(
      { id: 100, url: GALLERY, media: MEDIA } as any,
      390,
      undefined,
      'contain',
    )

    // hero после #1146 просит тот же вариант, что и слайдер. После #1170 это
    // `?v=100&w=720&q=70&fit=contain`: ступень 720 вернули в лестницу, и SSG-зеркало
    // (`scripts/generate-seo-pages.js`) обновлено тем же коммитом — обе стороны
    // снэпят 720 → 720. Суть теста не в конкретном числе, а в том, что число ОДНО;
    // расхождение зеркал ловит `imageProxy.ladder.test.ts`.
    expect(src).toContain('w=720')
    expect(src).toContain('q=70')
    expect(src).toContain('fit=contain')
    // было: `?w=1280&q=80&fit=contain` — второй файл той же обложки (211 158 B)
    expect(src).not.toContain('w=1280')
  })

  it('cover-слот по-прежнему может использовать cover-варианты манифеста', () => {
    const src = buildUriWeb(
      { id: 100, url: GALLERY, media: MEDIA } as any,
      390,
      undefined,
      'cover',
    )

    expect(src).toContain('fit=contain') // buildUriWeb нормализует cover → contain для слайда
    expect(src).not.toContain('w=1280')
  })
})
