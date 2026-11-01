/**
 * @jest-environment jsdom
 */

import { Platform } from 'react-native'

import { buildUriWeb } from '@/components/travel/sliderParts/utils'
import { buildGalleryFrameBaseUrl } from '@/utils/imageOptimization'
import { createSafeImageUrl } from '@/utils/travelMedia'
import { buildResponsiveImagePropsPreferringMedia } from '@/utils/travelMediaVariants'

// Прод 2026-11-01, `/api/travels/by-slug/rodniki-yuckovskie/`: первый кадр галереи.
// Элемент галереи без `updated_at`, варианты манифеста — `<путь>?w=N` без версии.
const GALLERY_PATH = '/gallery/6559/conversions/1jQKLDwYZxdDZhMmwb6MsvUESmBPvBvCShJEc1rB-detail_hd.jpg'
const GALLERY_URL = `https://metravel.by${GALLERY_PATH}`
const GALLERY_ITEM = { id: 2862, url: GALLERY_URL }
const VARIANT_WIDTHS: Record<string, number> = {
  thumb_96: 96, thumb_160: 160, thumb_320: 320, card_480: 480, card_640: 640, card_720: 720,
  card_800: 800, card_960: 960, hero_1280: 1280, print_1600: 1600, print_2500: 2500,
}
const MEDIA_ENTRY = {
  id: 2862,
  width: 1080,
  height: 1080,
  aspect_ratio: 1,
  dominant_color: '#7f755c',
  lqip_url: null,
  variants: {
    ...Object.fromEntries(Object.entries(VARIANT_WIDTHS).map(([key, width]) => [key, `${GALLERY_PATH}?w=${width}`])),
    original: GALLERY_PATH,
  },
}

// Ровно так `TravelDetailsOptimizedLCPHero` собирает базовый адрес первого кадра.
const heroBaseSrc = () => buildGalleryFrameBaseUrl(createSafeImageUrl(GALLERY_ITEM.url, null), null)

const HERO_MOBILE = { maxWidth: 720, widths: [320, 480, 640, 720], quality: 70, fit: 'contain' as const, sizes: '100vw' }
const HERO_DESKTOP = { maxWidth: 1280, widths: [720, 960, 1280], quality: 80, fit: 'contain' as const, sizes: '720px' }

const absolute = (value?: string) => (value ? new URL(value, 'https://metravel.by').toString() : value)
const srcSetUrls = (srcSet?: string) =>
  String(srcSet || '').split(',').map((part) => absolute(part.trim().split(/\s+/)[0])).filter(Boolean)

// #2923: SSR-loader отдаёт только cover манифеста (#1479), поэтому первый кадр
// статьи строится без манифеста галереи, а после фоновой догрузки — по нему.
// Адрес одного и того же кадра обязан совпадать в обоих состояниях: иначе hero
// качается дважды, а снятый `<img>` обрывает первую загрузку (ERR_ABORTED).
describe('gallery frame keeps one address before and after the media backfill (web)', () => {
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

  it.each([['mobile', HERO_MOBILE], ['desktop', HERO_DESKTOP]] as const)(
    'hero %s src and srcset are the manifest addresses even without the manifest',
    (_label, options) => {
      const partial = buildResponsiveImagePropsPreferringMedia(null, heroBaseSrc(), options)
      const full = buildResponsiveImagePropsPreferringMedia(MEDIA_ENTRY as any, heroBaseSrc(), options)

      expect(partial.src).not.toMatch(/[?&]v=/)
      expect(absolute(partial.src)).toBe(absolute(full.src))
      expect(srcSetUrls(partial.srcSet)).toEqual(srcSetUrls(full.srcSet))
    },
  )

  it.each([['mobile', 390], ['desktop', 1180]] as const)(
    'slider %s first slide keeps its address when the manifest arrives',
    (_label, containerWidth) => {
      const beforeBackfill = buildUriWeb(GALLERY_ITEM as any, containerWidth, undefined, 'contain')
      const afterBackfill = buildUriWeb({ ...GALLERY_ITEM, media: MEDIA_ENTRY } as any, containerWidth, undefined, 'contain')

      expect(beforeBackfill).not.toMatch(/[?&]v=/)
      expect(absolute(beforeBackfill)).toBe(absolute(afterBackfill))
    },
  )

  it('mobile hero and the first mobile slide request one file', () => {
    const hero = buildResponsiveImagePropsPreferringMedia(null, heroBaseSrc(), HERO_MOBILE)
    const slide = buildUriWeb(GALLERY_ITEM as any, 390, undefined, 'contain')

    expect(absolute(slide)).toBe(absolute(hero.src))
  })

  it('still versions a frame by updated_at, which changes with its content', () => {
    const url = buildGalleryFrameBaseUrl(GALLERY_URL, '2026-10-01T00:00:00Z')

    expect(new URL(url).searchParams.get('v')).toBe(String(Date.parse('2026-10-01T00:00:00Z')))
  })
})
