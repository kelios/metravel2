// #716/#715: выбор backend media variants vs клиентская сборка srcset/LQIP.

import { Platform } from 'react-native'

import {
  buildResponsiveImagePropsFromMedia,
  buildResponsiveImagePropsPreferringMedia,
  findGalleryMediaImage,
  getMediaLqipUrl,
  getMediaPlaceholderData,
  resolveMediaVariantUrl,
} from '@/utils/travelMediaVariants'
import { buildResponsiveImageProps } from '@/utils/imageSrcSet'
import type { TravelMedia, TravelMediaImage } from '@/types/types'

const withPlatform = (os: 'web' | 'ios', fn: () => void) => {
  const original = Platform.OS
  ;(Platform as { OS: string }).OS = os
  try {
    fn()
  } finally {
    ;(Platform as { OS: string }).OS = original
  }
}

const mediaEntry: TravelMediaImage = {
  id: 3706,
  alt: 'пример',
  dominant_color: null,
  blurhash: null,
  lqip_url: '/gallery/563/gallery/abc.webp?w=32&q=35&fit=cover',
  variants: {
    thumb_160: '/gallery/563/gallery/abc.webp?w=160&q=70&fit=cover',
    thumb_320: '/gallery/563/gallery/abc.webp?w=320&q=72&fit=cover',
    card_640: '/gallery/563/gallery/abc.webp?w=640&q=75&fit=cover',
    hero_1280: '/gallery/563/gallery/abc.webp?w=1280&q=80&fit=contain',
    hero_1920: '/gallery/563/gallery/abc.webp?w=1920&q=80&fit=contain',
    print_2500: '/gallery/563/gallery/abc.webp?w=2500&q=88&fit=contain',
    original: '/gallery/563/gallery/abc.webp',
  },
  srcset: null,
  sizes_hint: '(max-width: 768px) 100vw, 640px',
  updated_at: '2026-06-14T04:06:35Z',
}

describe('utils/travelMediaVariants', () => {
  const previousApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = previousApiUrl
  })

  describe('resolveMediaVariantUrl', () => {
    it('резолвит относительный путь против API-origin', () => {
      expect(resolveMediaVariantUrl('/gallery/1/x.webp?w=160')).toBe(
        'https://metravel.by/gallery/1/x.webp?w=160',
      )
    })

    it('абсолютные и data/blob URL не трогает', () => {
      expect(resolveMediaVariantUrl('https://cdn.metravel.by/x.webp')).toBe(
        'https://cdn.metravel.by/x.webp',
      )
      expect(resolveMediaVariantUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
    })

    it('пустое значение → null', () => {
      expect(resolveMediaVariantUrl(null)).toBeNull()
      expect(resolveMediaVariantUrl('  ')).toBeNull()
    })

    // #1195: URL манифеста идут прямо в src/srcSet мимо `optimizeImageUrl`, поэтому
    // без переписывания здесь карточка каталога тянет мастер с `no-store`.
    it('уводит conversion-вариант на legacy-роут, сохраняя ширину', () => {
      expect(resolveMediaVariantUrl('/travel-image/682/conversions/10f0a8f2.webp?w=960')).toBe(
        'https://metravel.by/media-resize/legacy/682/conversions/10f0a8f2.webp?w=960',
      )
    })

    it('варианты без conversions-ключа оставляет на family-роуте', () => {
      expect(resolveMediaVariantUrl('/gallery/cd701fc3.webp?w=320')).toBe(
        'https://metravel.by/gallery/cd701fc3.webp?w=320',
      )
    })
  })

  describe('buildResponsiveImagePropsFromMedia (web)', () => {
    it('строит src/srcSet из backend-вариантов под запрошенные ширины', () => {
      withPlatform('web', () => {
        const result = buildResponsiveImagePropsFromMedia(mediaEntry, {
          maxWidth: 1280,
          widths: [720, 960, 1280],
          sizes: '(max-width: 1024px) 92vw, 720px',
        })

        expect(result).not.toBeNull()
        expect(result?.src).toBe('https://metravel.by/gallery/563/gallery/abc.webp?w=1280&q=80&fit=contain')
        // 720→hero_1280, 960→hero_1280, 1280→hero_1280 → один кандидат 1280w
        expect(result?.srcSet).toBe(
          'https://metravel.by/gallery/563/gallery/abc.webp?w=1280&q=80&fit=contain 1280w',
        )
        expect(result?.sizes).toBe('(max-width: 1024px) 92vw, 720px')
      })
    })

    it('мобильные ширины маппятся на ближайшие варианты вверх без дублей', () => {
      withPlatform('web', () => {
        const result = buildResponsiveImagePropsFromMedia(mediaEntry, {
          maxWidth: 720,
          widths: [320, 480, 640, 720],
        })

        expect(result?.srcSet).toBe(
          [
            'https://metravel.by/gallery/563/gallery/abc.webp?w=320&q=72&fit=cover 320w',
            'https://metravel.by/gallery/563/gallery/abc.webp?w=640&q=75&fit=cover 640w',
            'https://metravel.by/gallery/563/gallery/abc.webp?w=1280&q=80&fit=contain 1280w',
          ].join(', '),
        )
        // sizes по умолчанию берётся из sizes_hint манифеста
        expect(result?.sizes).toBe('(max-width: 768px) 100vw, 640px')
      })
    })

    it('манифест без variants → null (сигнал клиентского fallback)', () => {
      expect(buildResponsiveImagePropsFromMedia({ ...mediaEntry, variants: null })).toBeNull()
      expect(buildResponsiveImagePropsFromMedia(null)).toBeNull()
      expect(buildResponsiveImagePropsFromMedia(undefined)).toBeNull()
    })

    it('на native отдаёт только src', () => {
      withPlatform('ios', () => {
        const result = buildResponsiveImagePropsFromMedia(mediaEntry, { maxWidth: 640 })
        expect(result).toEqual({
          src: 'https://metravel.by/gallery/563/gallery/abc.webp?w=640&q=75&fit=cover',
        })
      })
    })
  })

  describe('buildResponsiveImagePropsPreferringMedia', () => {
    const baseUrl = 'https://metravel.by/gallery/563/gallery/abc.webp'
    const options = {
      maxWidth: 1280,
      widths: [720, 960, 1280],
      quality: 82,
      format: 'auto' as const,
      fit: 'contain' as const,
      sizes: '(max-width: 1024px) 92vw, 720px',
    }

    it('media присутствует → backend-варианты', () => {
      withPlatform('web', () => {
        const result = buildResponsiveImagePropsPreferringMedia(mediaEntry, baseUrl, options)
        expect(result.src).toContain('w=1280&q=80&fit=contain')
        expect(result.srcSet).toContain('1280w')
      })
    })

    it('media отсутствует → бит-в-бит текущая клиентская сборка', () => {
      withPlatform('web', () => {
        const preferred = buildResponsiveImagePropsPreferringMedia(null, baseUrl, options)
        const client = buildResponsiveImageProps(baseUrl, options)
        expect(preferred).toEqual(client)
        expect(preferred.src).toBeTruthy()
      })
    })

    it('media без пригодных вариантов → клиентская сборка', () => {
      withPlatform('web', () => {
        const preferred = buildResponsiveImagePropsPreferringMedia(
          { ...mediaEntry, variants: { original: '/gallery/563/gallery/abc.webp' } },
          baseUrl,
          options,
        )
        expect(preferred).toEqual(buildResponsiveImageProps(baseUrl, options))
      })
    })
  })

  describe('getMediaLqipUrl', () => {
    it('резолвит backend lqip_url', () => {
      expect(getMediaLqipUrl(mediaEntry)).toBe(
        'https://metravel.by/gallery/563/gallery/abc.webp?w=32&q=35&fit=cover',
      )
    })

    it('без lqip_url → null', () => {
      expect(getMediaLqipUrl({ ...mediaEntry, lqip_url: null })).toBeNull()
      expect(getMediaLqipUrl(null)).toBeNull()
    })
  })

  describe('getMediaPlaceholderData', () => {
    it('prefers trimmed blurhash and suppresses color/LQIP network fallback', () => {
      expect(
        getMediaPlaceholderData({
          ...mediaEntry,
          blurhash: '  LEHL6nWB2yk8pyo0adR*.7kCMdnj  ',
          dominant_color: '#123456',
        }),
      ).toEqual({
        blurhash: 'LEHL6nWB2yk8pyo0adR*.7kCMdnj',
        dominantColor: null,
      })
    })

    it('uses a valid dominant color when blurhash is empty', () => {
      expect(
        getMediaPlaceholderData({
          ...mediaEntry,
          blurhash: ' ',
          dominant_color: '#aBc123',
        }),
      ).toEqual({ blurhash: null, dominantColor: '#aBc123' })
    })

    // #1167: ветка `lqip_url` убрана — она была единственной, которая порождала
    // ВТОРОЙ сетевой запрос на тот же слот. Без blurhash и dominant_color подложки
    // просто нет; это дешевле, чем тянуть ради неё отдельный файл.
    it('без blurhash и dominant_color не подставляет LQIP и не создаёт второй запрос', () => {
      expect(getMediaPlaceholderData(mediaEntry)).toEqual({
        blurhash: null,
        dominantColor: null,
      })
    })

    it('rejects malformed dominant colors before they reach RN/CSS styles', () => {
      expect(
        getMediaPlaceholderData({
          ...mediaEntry,
          dominant_color: 'url(https://example.com/tracker)',
        }).dominantColor,
      ).toBeNull()
    })
  })

  describe('findGalleryMediaImage', () => {
    const media: TravelMedia = {
      cover: { ...mediaEntry, id: 563 },
      gallery: [mediaEntry, { ...mediaEntry, id: 3707 }],
      address_images: null,
    }

    it('находит запись галереи по id (number/string)', () => {
      expect(findGalleryMediaImage(media, 3706)?.id).toBe(3706)
      expect(findGalleryMediaImage(media, '3707')?.id).toBe(3707)
    })

    it('нет совпадения/манифеста → null', () => {
      expect(findGalleryMediaImage(media, 9999)).toBeNull()
      expect(findGalleryMediaImage(media, null)).toBeNull()
      expect(findGalleryMediaImage(undefined, 3706)).toBeNull()
      expect(findGalleryMediaImage({ gallery: [] }, 3706)).toBeNull()
    })
  })
})
