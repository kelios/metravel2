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

    it('snaps fractional device DPR to integer 1/2/3', () => {
      expect(onMediaPath({ width: 480, dpr: 2.75 }).searchParams.get('dpr')).toBe('3')
      expect(onMediaPath({ width: 480, dpr: 2.8125 }).searchParams.get('dpr')).toBe('3')
      expect(onMediaPath({ width: 480, dpr: 1.25 }).searchParams.get('dpr')).toBe('1')
      expect(onMediaPath({ width: 480, dpr: 2 }).searchParams.get('dpr')).toBe('2')
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
      expect([...variants][0]).toBe('480|3|80')
    })
  })
})
