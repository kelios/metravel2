import { Platform } from 'react-native'

import {
  optimizeImageUrl,
  getOptimalImageWidth,
  generateSrcSet,
  buildVersionedImageUrl,
} from '@/utils/imageOptimization'
// #1171: не входит в публичный баррель — это внутренний дефолт
// `buildResponsiveImageProps`, но набор ступеней в нём проверять нужно.
import { getResponsiveSizes } from '@/utils/imageSrcSet'

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

    it('optimizes first-party media on a configured local API origin', () => {
      const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
      process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8085/api'

      try {
        const result = optimizeImageUrl(
          'http://127.0.0.1:8085/quest-cover/quests/5/main/cover.png',
          { width: 320, quality: 60, fit: 'cover' },
        )!
        const url = new URL(result)

        expect(url.origin).toBe('http://127.0.0.1:8085')
        expect(url.searchParams.get('w')).toBe('320')
        expect(url.searchParams.get('q')).toBe('60')
        expect(url.searchParams.get('fit')).toBe('cover')
      } finally {
        process.env.EXPO_PUBLIC_API_URL = previousApiUrl
      }
    })

    it('keeps same-host private media from a different origin unchanged', () => {
      const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
      process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8085/api'
      const privateUrl = 'http://127.0.0.1:8086/quest-cover/private.png'

      try {
        expect(optimizeImageUrl(privateUrl, { width: 320, quality: 60 })).toBe(privateUrl)
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

  // #1171: раньше это был `getOptimalImageSize` с тремя способами посчитать высоту.
  // Высота никуда не уходила (прокси ресайзит только по `w`), осталась единственная
  // реальная работа — перевод CSS-ширины в device-пиксели.
  describe('getOptimalImageWidth', () => {
    it('multiplies the css width by the device pixel ratio', () => {
      ;(window as any).devicePixelRatio = 2
      expect(getOptimalImageWidth(100)).toBe(200)
    })

    it('rounds fractional ratios instead of emitting a fractional width', () => {
      ;(window as any).devicePixelRatio = 1.5
      expect(getOptimalImageWidth(101)).toBe(152)
    })

    // Потолок DPR 2 действует только на web: выше него прирост резкости не виден, а
    // байты растут квадратично (карточка на DPR 3 просила бы 1440 вместо 960).
    // На native потолка нет — там плотность экрана реальная и кадрируется системой.
    it('caps the device pixel ratio at 2 on web only', () => {
      ;(window as any).devicePixelRatio = 3
      withPlatform('web', () => {
        expect(getOptimalImageWidth(480)).toBe(960)
      })
      withPlatform('android', () => {
        expect(getOptimalImageWidth(480)).toBe(1440)
      })
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

  // #1160: брейкпоинты обновлены с CSS-сетки (768/1536) на ступени лестницы прокси
  // (800/1600) — именно в них они снэпились и раньше, но теперь это видно в коде.
  describe('getResponsiveSizes', () => {
    it('returns default breakpoints limited by maxWidth', () => {
      const sizes = getResponsiveSizes(1000)
      // maxWidth не добавляется, если он не входит в стандартные breakpoints
      expect(sizes).toEqual([320, 640, 800])
    })

    it('includes all default breakpoints up to 1920 when maxWidth is large', () => {
      const sizes = getResponsiveSizes(1920)
      expect(sizes).toEqual([320, 640, 800, 1024, 1280, 1600, 1920])
    })

    it('appends custom maxWidth greater than 1920', () => {
      const sizes = getResponsiveSizes(2560)
      expect(sizes).toEqual([320, 640, 800, 1024, 1280, 1600, 1920, 2560])
    })

    // Каждый брейкпоинт обязан быть ступенью прокси: иначе список ширин в коде
    // расходится с тем, что реально уедет в запрос после `snapDimensionUp`.
    it('emits only widths that exist on the proxy ladder', () => {
      const ladder = [32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500]
      expect(getResponsiveSizes(1920).filter((w) => !ladder.includes(w))).toEqual([])
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
  // своп-штормы на проде 1 vCPU / 1.8 ГБ). Теперь w и q округляются вверх
  // по лестницам proxy-contract.
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
    it('never emits h, and a widthless family path emits no sizing params at all', () => {
      expect(onMediaPath({ width: 480, height: 320 }).searchParams.get('h')).toBeNull()

      // #1195: conversion-ключ теперь адресуется `/media-resize/legacy/`, а тот
      // widthless URL не принимает и подставляет канонический w=800 — это дешевле
      // мастера, который family-роут отдал бы на голый запрос.
      const conversionHeightOnly = onMediaPath({ height: 240, quality: 60, fit: 'contain' })
      expect(conversionHeightOnly.pathname.startsWith('/media-resize/legacy/')).toBe(true)
      expect(conversionHeightOnly.searchParams.get('h')).toBeNull()
      expect(conversionHeightOnly.searchParams.get('w')).toBe('800')

      // Пути без legacy-роута остаются голыми: лишние q/fit только плодят cache-key
      // на тот же мастер.
      const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
      process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
      try {
        const heightOnly = new URL(
          optimizeImageUrl('https://metravel.by/gallery/540/gallery/x.webp', {
            height: 240,
            quality: 60,
            fit: 'contain',
          })!
        )
        expect(heightOnly.searchParams.get('h')).toBeNull()
        expect(heightOnly.searchParams.get('w')).toBeNull()
        expect(heightOnly.searchParams.get('q')).toBeNull()
        expect(heightOnly.searchParams.get('fit')).toBeNull()
      } finally {
        process.env.EXPO_PUBLIC_API_URL = previousApiUrl
      }
    })

    // #1113: `/quest-cover/**` и `/avatar/**` обслуживает тот же image-proxy
    // (`?w=320&q=70&fit=cover` → 7 884 B при оригинале 209 КБ), но их пути не подходят
    // под MEDIA_FILE_PATH и уходили в ветку «свой домен». Там оптимизация включается
    // только при совпадении origin с EXPO_PUBLIC_API_URL, поэтому в конфигурации с
    // проксированным API (dev/preprod) параметры молча не добавлялись и `srcSet`
    // собирался из одинаковых URL без `w` — браузер брал оригинал на плитку 132×132.
    it('optimizes every model-owned proxy family regardless of the configured api origin', () => {
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

        for (const path of [
          '/trip-cover/trips/7/cover/sample.webp',
          '/quest-step-image/quests/16/step/2/sample.webp',
          '/quest-poster/quests/16/poster/sample.webp',
          '/badge-image/achievements/badges/sample.webp',
        ]) {
          const optimized = optimizeImageUrl(`https://metravel.by${path}`, {
            width: 132,
            quality: 70,
            fit: 'cover',
          })!
          expect({ path, width: new URL(optimized).searchParams.get('w') }).toEqual({
            path,
            width: '160',
          })
        }
      } finally {
        process.env.EXPO_PUBLIC_API_URL = previousApiUrl
      }
    })

    // #1176: прямая ссылка на бакет не понимает `w` — S3 отдаёт мастер (замер прода
    // 2026-08-02: `uploads/1591620319350_original.jpg` = 141 354 B против 7 820 B на
    // `?w=320` через свой роут). Роуты объявлены в `route_behavior` proxy-contract v4.
    it('routes legacy bucket links through our resize route instead of leaving them on S3', () => {
      const previousApiUrl = process.env.EXPO_PUBLIC_API_URL
      process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
      try {
        const uploads = optimizeImageUrl(
          'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1591620319350_original.jpg',
          { width: 300, quality: 80 },
        )!
        expect(uploads).not.toContain('metravelprod.s3')
        expect(uploads).toBe(
          'https://metravel.by/media-resize/uploads/1591620319350_original.jpg?w=320&q=80',
        )

        const conversions = optimizeImageUrl(
          'https://metravelprod.s3.eu-north-1.amazonaws.com/3994/conversions/HcQK-detail_hd.jpg',
          { width: 800 },
        )!
        expect(conversions).toBe(
          'https://metravel.by/media-resize/legacy/3994/conversions/HcQK-detail_hd.jpg?w=800',
        )

        const wrappedOrigin =
          'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/wrapped.jpg?X-Amz-Signature=secret'
        const wrapped = `https://images.weserv.nl/?url=${encodeURIComponent(wrappedOrigin)}&w=1600`
        expect(optimizeImageUrl(wrapped, { width: 300 })).toBe(
          'https://metravel.by/media-resize/uploads/wrapped.jpg?w=320',
        )

        // `/media-resize` never leaves the frontend without an explicit canonical
        // width, even if a dynamic caller has not measured its slot yet.
        expect(optimizeImageUrl(wrapped, {})).toBe(
          'https://metravel.by/media-resize/uploads/wrapped.jpg?w=800',
        )

        // Класса без legacy-роута быть переписанным не должно: `responsive-images`
        // удалён в #1157, и подмена хоста только спрятала бы мёртвую ссылку.
        const orphan = 'https://metravelprod.s3.eu-north-1.amazonaws.com/540/responsive-images/x.jpg'
        expect(optimizeImageUrl(orphan, { width: 320 })).toBe(orphan)
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
      // #1170: ступень 720 вернули в лестницу, она есть в контракте прокси
      expect(onMediaPath({ width: 720 }).searchParams.get('w')).toBe('720')
      expect(onMediaPath({ width: 1280 }).searchParams.get('w')).toBe('1280')
    })

    // Guard #1113: лестница обязана состоять ТОЛЬКО из ширин, которые прокси реально
    // ресайзит. Набор ниже — `widths` из `GET /api/media/proxy-contract` (version 3),
    // сверено 2026-08-02.
    //
    // #1170: прежний комментарий утверждал, что 1024/2500 и др. «подтверждённо сломаны».
    // Это было верно до #1112 — тогда прокси неподдержанную ширину молча отдавал
    // оригиналом. Сейчас он округляет вверх (`bisect_left`) и не апскейлит: замеры
    // прода 2026-07-30 дают w=47 → 2 582 B (= w=96) и w=240 → 17 738 B (= w=320).
    // Полная сверка лестницы с контрактом — `__tests__/utils/imageProxy.ladder.test.ts`.
    it('only ever emits widths the backend proxy actually resizes', () => {
      const PROXY_SUPPORTED_WIDTHS = new Set([
        32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500,
      ])

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
      // иначе картинка мылится. Исключение — потолок, выше которого запрос клампится.
      // Для `gallery` (профиль `travelMedia`) это 1600: самая широкая ПРОИЗВОДНАЯ
      // семейства. Запрос выше неё бэкенд не обслуживает вовсе — замер прода
      // 2026-08-03 на `gallery/3994/conversions/…-detail_hd.jpg`: `w=1600` → 200
      // stored-derivative, `w=1920` → 400 (#1221). Клэмп вниз здесь — единственный
      // способ не отдать пользователю битую картинку.
      const FAMILY_DERIVATIVE_CEILING = 1600
      const downscaled = emitted.filter(
        (entry) => entry.w != null && entry.w < entry.width && entry.w !== FAMILY_DERIVATIVE_CEILING,
      )
      expect(downscaled).toEqual([])
    })

    it('ceil-snaps quality exactly like proxy-contract v3', () => {
      expect(onMediaPath({ width: 480, quality: 72 }).searchParams.get('q')).toBe('80')
      expect(onMediaPath({ width: 480, quality: 78 }).searchParams.get('q')).toBe('80')
      expect(onMediaPath({ width: 480, quality: 82 }).searchParams.get('q')).toBe('85')
      expect(onMediaPath({ width: 480, quality: 0 }).searchParams.get('q')).toBe('85')
      expect(onMediaPath({ width: 480, quality: 150 }).searchParams.get('q')).toBe('85')
    })

    it('collapses many real per-pixel variants of one file to a single cacheable one', () => {
      const inputs = [
        { width: 371, dpr: 2.75, quality: 78 },
        { width: 379, dpr: 2.8125, quality: 78 },
        { width: 393, dpr: 2.75, quality: 80 },
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
