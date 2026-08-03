/**
 * #1221: og:image / twitter:image / JSON-LD уходили «голым» ownership-URL без `?w=`,
 * а такой адрес отдаёт МАСТЕР с `no-store`: ownership-роуты объявлены
 * `X-Cache-Status: BYPASS`, кэшируемым ответ делает только ширина в URL. Замер прода
 * 2026-08-03: 6% медиа-запросов уходили без `w=` — 44 МБ за 4 ч 43 мин и самые
 * медленные ответы сайта (avg 18 с, max 58 с).
 */
import {
  DERIVATIVE_WIDTHS_BY_ROUTE,
  IMAGE_STORAGE_POLICY_V1,
  SOCIAL_PREVIEW_TARGET_WIDTH,
  socialPreviewWidthForRoute,
} from '@/constants/imageContract'
import { normalizeOgImageUrl } from '@/utils/seo'

describe('социальное превью просит производную, а не мастер (#1221)', () => {
  const previousSiteUrl = process.env.EXPO_PUBLIC_SITE_URL

  beforeAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://metravel.by'
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = previousSiteUrl
  })

  it('ступень семейства существует в его derivatives и не превышает целевую ширину', () => {
    for (const [route, widths] of DERIVATIVE_WIDTHS_BY_ROUTE) {
      const picked = socialPreviewWidthForRoute(route)
      expect({ route, picked, isDerivative: widths.includes(picked as number) }).toEqual({
        route,
        picked,
        isDerivative: true,
      })
      // Либо укладывается в целевую ширину, либо это самая мелкая ступень семейства,
      // у которого ступени такого размера нет вовсе.
      const withinTarget = (picked as number) <= SOCIAL_PREVIEW_TARGET_WIDTH
      expect({ route, picked, ok: withinTarget || picked === widths[0] }).toEqual({
        route,
        picked,
        ok: true,
      })
    }
  })

  it('ни одна ступень превью не совпадает с мастером профиля', () => {
    for (const profile of Object.values(IMAGE_STORAGE_POLICY_V1)) {
      for (const route of profile.routes) {
        expect({ route, picked: socialPreviewWidthForRoute(route) }).not.toEqual({
          route,
          picked: profile.master.width,
        })
      }
    }
  })

  it.each([
    ['gallery', 'https://metravel.by/gallery/8e643f0e.webp', 'https://metravel.by/gallery/8e643f0e.webp?w=1280'],
    [
      'address-image',
      'https://metravel.by/address-image/15850/conversions/8ed5a60e.webp',
      'https://metravel.by/address-image/15850/conversions/8ed5a60e.webp?w=960',
    ],
    [
      'quest-cover',
      'https://metravel.by/quest-cover/quests/71/main/c992a209.webp',
      'https://metravel.by/quest-cover/quests/71/main/c992a209.webp?w=800',
    ],
    [
      'travel-description-image',
      'https://metravel.by/travel-description-image/135/description/be0b1723.JPG',
      'https://metravel.by/travel-description-image/135/description/be0b1723.JPG?w=960',
    ],
  ])('%s получает ширину производной', (_route, input, expected) => {
    expect(normalizeOgImageUrl(input)).toBe(expected)
  })

  it('относительный путь тоже становится абсолютным и получает ширину', () => {
    expect(normalizeOgImageUrl('/travel-image/958/conversions/abc-thumb_200.jpg')).toBe(
      'https://metravel.by/travel-image/958/conversions/abc-thumb_200.jpg?w=1280',
    )
  })

  it('уже заданную ширину не переписывает — иначе появился бы второй адрес того же файла', () => {
    const withWidth = 'https://metravel.by/gallery/8e643f0e.webp?w=640'
    expect(normalizeOgImageUrl(withWidth)).toBe(withWidth)
  })

  it('статику и чужие хосты не трогает', () => {
    expect(normalizeOgImageUrl('/og-home.jpg')).toBe('https://metravel.by/og-home.jpg')
    expect(normalizeOgImageUrl('/assets/icons/logo_yellow_512x512.png')).toBe(
      'https://metravel.by/assets/icons/logo_yellow_512x512.png',
    )
    expect(normalizeOgImageUrl('https://example.com/pic.jpg')).toBe('https://example.com/pic.jpg')
  })

  it('http поднимается до https и получает ширину', () => {
    expect(normalizeOgImageUrl('http://metravel.by/gallery/abc.webp')).toBe(
      'https://metravel.by/gallery/abc.webp?w=1280',
    )
  })

  it('пустой вход остаётся null', () => {
    expect(normalizeOgImageUrl('')).toBeNull()
    expect(normalizeOgImageUrl(null)).toBeNull()
    expect(normalizeOgImageUrl(undefined)).toBeNull()
  })
})
