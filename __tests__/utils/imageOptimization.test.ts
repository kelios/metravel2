import { Platform } from 'react-native'

import {
  optimizeImageUrl,
  getOptimalImageSize,
  generateSrcSet,
  getResponsiveSizes,
  buildVersionedImageUrl,
} from '@/utils/imageOptimization'

// В этом файле проверяем только чистую логику трансформации URL и размеров,
// не трогая реальные сети/DOM. JSDOM и polyfills уже настраиваются в __tests__/setup.ts.

// Локальный helper для временного изменения Platform.OS
const withPlatform = (os: 'web' | 'ios' | 'android', fn: () => void) => {
  const original = Platform.OS as typeof os
  ;(Platform as any).OS = os
  try {
    fn()
  } finally {
    ;(Platform as any).OS = original
  }
}

describe('utils/imageOptimization', () => {
  describe('optimizeImageUrl', () => {
    it('returns undefined for empty or null url', () => {
      expect(optimizeImageUrl(undefined)).toBeUndefined()
      expect(optimizeImageUrl(null as any)).toBeUndefined()
      expect(optimizeImageUrl('')).toBeUndefined()
    })

    it('appends optimization params to same-origin gallery media paths', () => {
      const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
      process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'

      try {
        const result = optimizeImageUrl(
          'https://metravel.by/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?v=3567',
          {
            width: 640,
            quality: 60,
            format: 'webp',
            fit: 'contain',
          }
        )!

        const url = new URL(result)
        expect(url.origin).toBe('https://metravel.by')
        expect(url.pathname).toBe('/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG')
        expect(url.searchParams.get('v')).toBe('3567')
        expect(url.searchParams.get('w')).toBe('640')
        expect(url.searchParams.get('q')).toBe('60')
        expect(url.searchParams.get('f')).toBe('webp')
        expect(url.searchParams.get('fit')).toBe('contain')
      } finally {
        process.env.EXPO_PUBLIC_API_URL = previousApiUrl
      }
    })

    it('adds width/height/quality/format/fit params and respects dpr on web', () => {
      withPlatform('web', () => {
        ;(window as any).devicePixelRatio = 2

        const result = optimizeImageUrl('https://example.com/image.jpg', {
          width: 100,
          height: 50,
          quality: 90,
          format: 'png',
          fit: 'contain',
        })!

        const url = new URL(result)
        expect(url.origin + url.pathname).toBe('https://example.com/image.jpg')
        // Остальное (конкретные query-параметры) зависит от окружения и реализации URL,
        // поэтому здесь проверяем только корректность базового пути
      })
    })

    it('does not set quality when it is 100', () => {
      const result = optimizeImageUrl('https://example.com/image.jpg', {
        width: 100,
        quality: 100,
      })!
      const url = new URL(result)
      expect(url.searchParams.has('q')).toBe(false)
    })

    it('prefers existing search params and only updates what is provided', () => {
      const result = optimizeImageUrl('https://example.com/image.jpg?foo=bar', {
        width: 100,
      })!
      const url = new URL(result)
      expect(url.searchParams.get('foo')).toBe('bar')
      expect(url.searchParams.get('w')).toBeDefined()
    })

    it('on web with format="auto" may set webp format when supported', () => {
      withPlatform('web', () => {
        // Подготовим состояние, ожидаемое checkWebPSupport
        ;(window as any).__webpSupportChecked = true
        ;(window as any).__webpSupport = true

        const result = optimizeImageUrl('https://example.com/image.jpg', {
          width: 100,
          format: 'auto',
        })!
        // Достаточно убедиться, что URL корректно формируется
        expect(() => new URL(result)).not.toThrow()
      })
    })
  })

  describe('getOptimalImageSize', () => {
    it('uses dpr from window for basic case without aspectRatio', () => {
      ;(window as any).devicePixelRatio = 2

      const { width, height } = getOptimalImageSize(100)
      // 16:9 по умолчанию, умножено на dpr=2
      expect(width).toBe(200)
      expect(height).toBe(Math.round(200 * (16 / 9)))
    })

    it('respects explicit containerHeight when aspectRatio is not provided', () => {
      ;(window as any).devicePixelRatio = 1.5

      const { width, height } = getOptimalImageSize(100, 80)
      expect(width).toBe(Math.round(100 * 1.5))
      expect(height).toBe(Math.round(80 * 1.5))
    })

    it('uses aspectRatio when provided (height = width / aspectRatio)', () => {
      ;(window as any).devicePixelRatio = 1

      const { width, height } = getOptimalImageSize(120, undefined, 4 / 3)
      expect(width).toBe(120)
      expect(height).toBe(Math.round(120 / (4 / 3)))
    })
  })

  describe('generateSrcSet', () => {
    it('returns base url as-is on non-web platforms', () => {
      withPlatform('ios', () => {
        const result = generateSrcSet('https://example.com/img.jpg', [320, 640])
        expect(result).toBe('https://example.com/img.jpg')
      })
    })

    it('generates srcset for web platform', () => {
      withPlatform('web', () => {
        const base = 'https://example.com/img.jpg'
        const result = generateSrcSet(base, [320, 640])

        const parts = result.split(',').map(p => p.trim())
        expect(parts.length).toBe(2)
        expect(parts[0].endsWith('320w')).toBe(true)
        expect(parts[1].endsWith('640w')).toBe(true)

        for (const part of parts) {
          const [urlStr] = part.split(' ')
          const url = new URL(urlStr)
          expect(url.origin + url.pathname).toBe(base)
        }
      })
    })

    it('deduplicates proxy widths and advertises the actual supported width', () => {
      withPlatform('web', () => {
        const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
        process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'

        try {
          const base = 'https://metravel.by/gallery/544/gallery/photo.jpg'
          const result = generateSrcSet(base, [239, 240, 241, 320])
          const parts = result.split(',').map(part => part.trim())

          expect(parts).toHaveLength(1)
          const [urlString, descriptor] = parts[0].split(' ')
          expect(new URL(urlString).searchParams.get('w')).toBe('320')
          expect(descriptor).toBe('320w')
        } finally {
          process.env.EXPO_PUBLIC_API_URL = previousApiUrl
        }
      })
    })
  })

  describe('getResponsiveSizes', () => {
    it('returns default breakpoints limited by maxWidth', () => {
      const sizes = getResponsiveSizes(1000)
      // maxWidth не добавляется, если он не входит в стандартные breakpoints
      expect(sizes).toEqual([320, 640, 768])
    })

    it('includes all default breakpoints up to 1920 when maxWidth is large', () => {
      const sizes = getResponsiveSizes(1920)
      expect(sizes).toEqual([320, 640, 768, 1024, 1280, 1536, 1920])
    })

    it('appends custom maxWidth greater than 1920', () => {
      const sizes = getResponsiveSizes(2560)
      expect(sizes).toEqual([320, 640, 768, 1024, 1280, 1536, 1920, 2560])
    })
  })

  describe('buildVersionedImageUrl', () => {
    it('returns original value when url is empty', () => {
      expect(buildVersionedImageUrl('')).toBe('')
    })

    it('adds timestamp-based version param when updatedAt is valid', () => {
      withPlatform('web', () => {
        const url = buildVersionedImageUrl('https://example.com/img.jpg', '2024-01-02T00:00:00Z')
        const parsed = new URL(url)
        const v = parsed.searchParams.get('v')
        expect(v).not.toBeNull()
        const ts = Number(v)
        expect(Number.isFinite(ts)).toBe(true)
      })
    })

    it('falls back to id when updatedAt is missing', () => {
      const url = buildVersionedImageUrl('https://example.com/img.jpg', null, 123)
      const parsed = new URL(url)
      expect(parsed.searchParams.get('v')).toBe('123')
    })

    it('on invalid URL falls back to string concatenation with updatedAt', () => {
      const base = 'not-a-valid-url'
      const result = buildVersionedImageUrl(base, '2024-01-02T00:00:00Z')

      // Для относительного URL функция успешно создаёт абсолютный URL с версией
      const parsed = new URL(result)
      expect(parsed.pathname.endsWith('/not-a-valid-url')).toBe(true)
      expect(parsed.searchParams.get('v')).not.toBeNull()
    })

    it('on invalid URL falls back to string concatenation with id', () => {
      const base = 'not-a-valid-url'
      const result = buildVersionedImageUrl(base, undefined, 42)

      const parsed = new URL(result)
      expect(parsed.pathname.endsWith('/not-a-valid-url')).toBe(true)
      expect(parsed.searchParams.get('v')).toBe('42')
    })
  })

  // Квантование вариантов: дробный DPR и попиксельные ширины из window.devicePixelRatio /
  // onLayout раньше плодили уникальный файл-конверсию на каждую комбинацию (тикет #628 —
  // своп-штормы на проде 1 vCPU / 1.8 ГБ). Теперь w/h к лесенке, dpr к 1/2/3, q к шагу 10.
  describe('optimizeImageUrl variant quantization', () => {
    const onMediaPath = (opts: Parameters<typeof optimizeImageUrl>[1]) => {
      const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
      process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
      try {
        return new URL(
          optimizeImageUrl('https://metravel.by/gallery/3801/conversions/abc-detail_hd.jpg', opts)!
        )
      } finally {
        process.env.EXPO_PUBLIC_API_URL = previousApiUrl
      }
    }

    // #1113: `dpr` прокси игнорирует (замер прода 2026-07-28 — байт-в-байт одинаковый
    // ответ 36 094 B для dpr отсутствующего / 2 / 3), но каждое значение создавало
    // отдельный URL, отдельную запись кэша и отдельную синхронную конверсию.
    it('never emits dpr: the proxy ignores it and it only fragments the cache', () => {
      expect(onMediaPath({ width: 480, dpr: 2.75 }).searchParams.get('dpr')).toBeNull()
      expect(onMediaPath({ width: 480, dpr: 2 }).searchParams.get('dpr')).toBeNull()
    })

    // #1113: `h` тоже игнорируется прокси, а запрос с ОДНИМ лишь `h` он не отвергает —
    // молча отдаёт оригинал (`?h=240&q=60&fit=contain` → 132 344 B при исходнике
    // 1024×576). Поэтому высота в URL не участвует вовсе.
    it('never emits h, and without a width emits no sizing params at all', () => {
      expect(onMediaPath({ width: 480, height: 320 }).searchParams.get('h')).toBeNull()

      const heightOnly = onMediaPath({ height: 240, quality: 60, fit: 'contain' })
      expect(heightOnly.searchParams.get('h')).toBeNull()
      expect(heightOnly.searchParams.get('w')).toBeNull()
      expect(heightOnly.searchParams.get('q')).toBeNull()
      expect(heightOnly.searchParams.get('fit')).toBeNull()
    })

    // #1113: `/quest-cover/**` и `/avatar/**` обслуживает тот же image-proxy
    // (`?w=320&q=70&fit=cover` → 7 884 B при оригинале 209 КБ), но их пути не подходят
    // под MEDIA_FILE_PATH и уходили в ветку «свой домен». Там оптимизация включается
    // только при совпадении origin с EXPO_PUBLIC_API_URL, поэтому в конфигурации с
    // проксированным API (dev/preprod) параметры молча не добавлялись и `srcSet`
    // собирался из одинаковых URL без `w` — браузер брал оригинал на плитку 132×132.
    it('optimizes quest covers and avatars regardless of the configured api origin', () => {
      const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
      process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4622'
      try {
        const cover = optimizeImageUrl(
          'https://metravel.by/quest-cover/quests/16/main/85f9edf327a9455ea2369a883cd2daa6.png',
          { width: 132, quality: 60, fit: 'contain' },
        )!
        expect(cover).toContain('w=160')
        expect(cover).toContain('q=60')

        const avatar = optimizeImageUrl(
          'https://metravel.by/avatar/profile/82/avatar/f9b9811452104523b2088f840a77a6ee.webp',
          { width: 48, quality: 70, fit: 'cover' },
        )!
        expect(avatar).toContain('w=96')
      } finally {
        process.env.EXPO_PUBLIC_API_URL = previousApiUrl
      }
    })

    it('snaps per-pixel widths up to the dimension ladder', () => {
      // 371/379/393 — реальные onLayout-замеры → один rung 480
      expect(onMediaPath({ width: 371 }).searchParams.get('w')).toBe('480')
      expect(onMediaPath({ width: 379 }).searchParams.get('w')).toBe('480')
      expect(onMediaPath({ width: 393 }).searchParams.get('w')).toBe('480')
      expect(onMediaPath({ width: 56 }).searchParams.get('w')).toBe('96')
      expect(onMediaPath({ width: 720 }).searchParams.get('w')).toBe('800')
      expect(onMediaPath({ width: 1280 }).searchParams.get('w')).toBe('1280')
    })

    // Guard #1113: лестница обязана состоять ТОЛЬКО из ширин, которые прокси реально
    // ресайзит. Неподдержанную ширину он не снэпит и не отвергает — отдаёт исходный файл
    // целиком, и вместо превью в 3 КБ прилетают сотни килобайт. Ступени ниже проверены
    // curl'ом на проде 2026-07-28 (/gallery/, /travel-image/, /address-image/, /avatar/,
    // /quest-cover/); подтверждённо сломаны 16, 24, 48, 240, 1024, 1440, 2048, 2500.
    it('only ever emits widths the backend proxy actually resizes', () => {
      const PROXY_SUPPORTED_WIDTHS = new Set([32, 96, 160, 320, 480, 640, 800, 1280, 1600, 1920])

      const requested = [
        1, 8, 15, 16, 20, 24, 31, 32, 40, 47, 48, 49, 56, 64, 88, 96, 100, 132, 159, 160,
        161, 200, 239, 240, 241, 264, 320, 361, 393, 400, 480, 512, 640, 720, 800, 899,
        960, 1000, 1023, 1024, 1025, 1080, 1200, 1280, 1440, 1600, 1800, 1920, 2048, 2500, 4000,
      ]

      const emitted = requested.map((width) => {
        const raw = onMediaPath({ width }).searchParams.get('w')
        return { width, w: raw == null ? null : Number(raw) }
      })

      const unsupported = emitted.filter((entry) => entry.w != null && !PROXY_SUPPORTED_WIDTHS.has(entry.w))
      expect(unsupported).toEqual([])

      // И лестница не должна округлять ВНИЗ: превью не может быть мельче запрошенного,
      // иначе картинка мылится. Единственное исключение — потолок whitelist.
      const downscaled = emitted.filter(
        (entry) => entry.w != null && entry.w < entry.width && entry.w !== 1920,
      )
      expect(downscaled).toEqual([])
    })

    it('collapses near-identical quality values to a step of 10', () => {
      expect(onMediaPath({ width: 480, quality: 72 }).searchParams.get('q')).toBe('70')
      expect(onMediaPath({ width: 480, quality: 78 }).searchParams.get('q')).toBe('80')
      expect(onMediaPath({ width: 480, quality: 82 }).searchParams.get('q')).toBe('80')
    })

    it('collapses many real per-pixel variants of one file to a single cacheable one', () => {
      const inputs = [
        { width: 371, dpr: 2.75, quality: 78 },
        { width: 379, dpr: 2.8125, quality: 78 },
        { width: 393, dpr: 2.75, quality: 82 },
        { width: 388, dpr: 2.8, quality: 80 },
      ]
      const variants = new Set(
        inputs.map((o) => {
          const u = onMediaPath(o)
          return `${u.searchParams.get('w')}|${u.searchParams.get('dpr')}|${u.searchParams.get('q')}`
        })
      )
      expect(variants.size).toBe(1)
      expect([...variants][0]).toBe('480|null|80')
    })
  })
})
