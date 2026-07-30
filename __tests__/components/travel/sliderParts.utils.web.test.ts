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
      true,
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
      true,
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

  it('still allows non-first desktop slides to use the larger slider variant', () => {
    const src = buildUriWeb(
      {
        id: 'hero-2',
        url: 'https://metravel.by/gallery/123/hero-2.jpg',
      } as any,
      1180,
      undefined,
      'contain',
      false,
    )

    // #1170: 1180 теперь округляется до 1200, а не до 1280 — ступень 1200 вернули
    // в лестницу, она есть в контракте прокси и даёт файл легче при том же слоте.
    // q 78 → 80.
    expect(src).toContain('w=1200')
    expect(src).toContain('q=80')
  })

  // Слот НЕпервых слайдов считается в физических точках, а не в CSS-пикселях.
  // Раньше здесь ожидалось `w=480` для слота 390 CSS: на iPhone (DPR 3) это 1170
  // физических точек, то есть апскейл ×2.4 — «размытая картинка» на всех слайдах,
  // кроме первого. `dpr=` в URL по-прежнему не отправляем: прокси его игнорирует
  // (#1113), плотность применяется к самой ширине, как там и предписано.
  it('sizes retina mobile neighbour slides in physical pixels, not CSS pixels', () => {
    ;(window as any).devicePixelRatio = 3

    const src = buildUriWeb(
      {
        id: 'hero-3',
        url: 'https://metravel.by/gallery/123/hero-3.jpg',
      } as any,
      390,
      undefined,
      'contain',
      false,
    )

    // 390 × density 2 = 780, кап `SLIDER_MAX_WIDTH.mobile` 768 → ступень 800;
    // q65 снапится к 70 — тот же профиль, что у мобильного hero (#1146).
    expect(src).toContain('w=800')
    expect(src).toContain('q=70')
    expect(src).toContain('fit=contain')
    expect(src).not.toMatch(/[?&]dpr=/)
  })

  it('keeps non-retina neighbour slides on the CSS-pixel slot', () => {
    ;(window as any).devicePixelRatio = 1

    const src = buildUriWeb(
      {
        id: 'hero-3-dpr1',
        url: 'https://metravel.by/gallery/123/hero-3-dpr1.jpg',
      } as any,
      390,
      undefined,
      'contain',
      false,
    )

    // 390 снапится к 480, q 78 → 80: на DPR 1 апскейла нет, байты не растут.
    expect(src).toContain('w=480')
    expect(src).toContain('q=80')
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
      false,
    )

    expect(src).not.toMatch(/[?&]dpr=/)
    expect(src).toContain('w=1280')
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
            hero_1280: '/gallery/123/photo.webp?w=1280&q=78&fit=contain',
          },
        },
      } as any,
      1180,
      undefined,
      'contain',
      false,
    )

    expect(src).toBe('https://metravel.by/gallery/123/photo.webp?w=1280&q=78&fit=contain')
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
      hero_1280: `${GALLERY}?w=1280&q=78&fit=contain`,
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
      true,
    )

    // hero после #1146 просит тот же вариант, что и слайдер. После #1170 это
    // `?v=100&w=720&q=70&fit=contain`: ступень 720 вернули в лестницу, и SSG-зеркало
    // (`scripts/generate-seo-pages.js`) обновлено тем же коммитом — обе стороны
    // снэпят 720 → 720. Суть теста не в конкретном числе, а в том, что число ОДНО;
    // расхождение зеркал ловит `imageProxy.ladder.test.ts`.
    expect(src).toContain('w=720')
    expect(src).toContain('q=70')
    expect(src).toContain('fit=contain')
    // было: `?w=1280&q=78&fit=contain` — второй файл той же обложки (211 158 B)
    expect(src).not.toContain('w=1280')
  })

  it('cover-слот по-прежнему может использовать cover-варианты манифеста', () => {
    const src = buildUriWeb(
      { id: 100, url: GALLERY, media: MEDIA } as any,
      390,
      undefined,
      'cover',
      false,
    )

    expect(src).toContain('fit=contain') // buildUriWeb нормализует cover → contain для слайда
    expect(src).not.toContain('w=1280')
  })
})
