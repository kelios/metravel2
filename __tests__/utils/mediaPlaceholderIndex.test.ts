/**
 * @jest-environment jsdom
 *
 * #1208/#1264: общий индекс заливки полей letterbox.
 *
 * Контракт: заливка — свойство картинки, а не экрана. Один раз проиндексировали
 * запись манифеста в data-слое — и любой слот, который рисует ЛЮБУЮ производную
 * того же файла, находит цвет сам, без пропа. Где манифеста нет, вторая ступень
 * усредняет уже загруженный кадр и кладёт результат в тот же индекс.
 */
import type { TravelMedia, TravelMediaImage } from '@/types/types'
import {
  indexMediaImage,
  indexTravelMedia,
  lookupMediaPlaceholder,
  resetMediaPlaceholderIndex,
  resolveMediaPlaceholderKey,
  sampleDominantColor,
  toLetterboxFill,
} from '@/utils/mediaPlaceholderIndex'

const COLOR = '#5c6252'
const BLURHASH = 'LKCZne~WRO%gyGXTIUxvyFo$jYxu'

/** Форма записи манифеста прода (`/api/travels/search_travels_for_map/`, точка 355). */
const entry = (overrides: Partial<TravelMediaImage> = {}): TravelMediaImage => ({
  id: 355,
  dominant_color: COLOR,
  blurhash: BLURHASH,
  variants: {
    thumb_320: '/address-image/355/conversions/e4dc7a17.webp?w=320',
    original: '/address-image/355/conversions/e4dc7a17.webp',
  },
  src: '/address-image/355/conversions/e4dc7a17.webp?w=640',
  srcset:
    '/address-image/355/conversions/e4dc7a17.webp?w=320 320w, /address-image/355/conversions/e4dc7a17.webp?w=960 960w',
  ...overrides,
})

beforeEach(() => {
  resetMediaPlaceholderIndex()
})

describe('resolveMediaPlaceholderKey', () => {
  it('сводит роут-префикс, origin и query одного файла к одному ключу', () => {
    const expected = '355/conversions/e4dc7a17.webp'
    expect(resolveMediaPlaceholderKey('/address-image/355/conversions/e4dc7a17.webp?w=640')).toBe(expected)
    expect(
      resolveMediaPlaceholderKey(
        'https://metravel.by/media-resize/legacy/355/conversions/e4dc7a17.webp?v=1785826436881&w=720&q=60&fit=contain',
      ),
    ).toBe(expected)
    expect(resolveMediaPlaceholderKey('https://metravel.by/address-image/355/conversions/e4dc7a17.webp')).toBe(
      expected,
    )
  })

  it('разные файлы одной точки остаются разными ключами', () => {
    expect(resolveMediaPlaceholderKey('/address-image/355/conversions/e4dc7a17.webp')).not.toBe(
      resolveMediaPlaceholderKey('/address-image/355/conversions/462e31db.webp'),
    )
  })

  it('не ключует то, чего нет в хранилище', () => {
    expect(resolveMediaPlaceholderKey('')).toBeNull()
    expect(resolveMediaPlaceholderKey(null)).toBeNull()
    expect(resolveMediaPlaceholderKey('data:image/png;base64,AAAA')).toBeNull()
    expect(resolveMediaPlaceholderKey('blob:https://metravel.by/abc')).toBeNull()
  })
})

describe('indexMediaImage', () => {
  it('отдаёт заливку по любой ступени `?w=` того же файла', () => {
    indexMediaImage(entry())

    expect(lookupMediaPlaceholder('/address-image/355/conversions/e4dc7a17.webp?w=320')).toEqual({
      dominantColor: COLOR,
      blurhash: BLURHASH,
    })
    expect(
      lookupMediaPlaceholder('https://metravel.by/address-image/355/conversions/e4dc7a17.webp?w=960&q=60'),
    ).toEqual({ dominantColor: COLOR, blurhash: BLURHASH })
  })

  it('индексирует запись и под alias-адресами, которых в манифесте нет', () => {
    // Карта рисует legacy-конверсию `462e31db…`, а манифест описывает `e4dc7a17…`.
    indexMediaImage(entry(), ['https://metravel.by/address-image/355/conversions/462e31db.webp'])

    expect(
      lookupMediaPlaceholder(
        'https://metravel.by/media-resize/legacy/355/conversions/462e31db.webp?v=1785826436881&w=720&q=60&fit=contain',
      )?.dominantColor,
    ).toBe(COLOR)
  })

  it('запись без цвета и без blurhash в индекс не попадает', () => {
    indexMediaImage(entry({ dominant_color: null, blurhash: null }))
    expect(lookupMediaPlaceholder('/address-image/355/conversions/e4dc7a17.webp')).toBeNull()
  })

  it('невалидный цвет отбрасывается каноническим извлекателем', () => {
    indexMediaImage(entry({ dominant_color: 'rgb(1,2,3)', blurhash: null }))
    expect(lookupMediaPlaceholder('/address-image/355/conversions/e4dc7a17.webp')).toBeNull()
  })
})

describe('indexTravelMedia', () => {
  it('покрывает обложку, галерею, кадры точек и тело статьи одним вызовом', () => {
    const media: TravelMedia = {
      cover: { id: 1, dominant_color: '#111111', src: '/travel-image/682/conversions/cover.webp?w=640' },
      gallery: [{ id: 2, dominant_color: '#222222', src: '/gallery/682/conversions/g1.webp?w=640' }],
      address_images: {
        '355': { id: 355, dominant_color: '#333333', src: '/address-image/355/conversions/p1.webp?w=640' },
      },
      article_body: {
        gallery: [
          {
            id: 4,
            dominant_color: '#444444',
            src: '/travel-description-image/682/conversions/b1.webp?w=640',
          },
        ],
      },
    }

    indexTravelMedia(media)

    expect(lookupMediaPlaceholder('/travel-image/682/conversions/cover.webp?w=1280')?.dominantColor).toBe('#111111')
    expect(lookupMediaPlaceholder('/gallery/682/conversions/g1.webp')?.dominantColor).toBe('#222222')
    expect(lookupMediaPlaceholder('/media-resize/legacy/355/conversions/p1.webp?w=320')?.dominantColor).toBe(
      '#333333',
    )
    expect(
      lookupMediaPlaceholder('/travel-description-image/682/conversions/b1.webp')?.dominantColor,
    ).toBe('#444444')
  })

  it('пустой или отсутствующий манифест не роняет индексацию', () => {
    expect(() => indexTravelMedia(null)).not.toThrow()
    expect(() => indexTravelMedia({} as TravelMedia)).not.toThrow()
  })
})

describe('toLetterboxFill', () => {
  it('переводит hex в rgba с общей альфой и не трогает готовую', () => {
    expect(toLetterboxFill('#5c6252')).toBe('rgba(92, 98, 82, 0.75)')
    expect(toLetterboxFill('#abc')).toBe('rgba(170, 187, 204, 0.75)')
    expect(toLetterboxFill('#5c625280')).toBe('#5c625280')
  })
})

describe('sampleDominantColor — вторая ступень для семейств без манифеста', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  let drawCalls = 0

  const stubCanvas = (pixel: number[] | Error) => {
    drawCalls = 0
    HTMLCanvasElement.prototype.getContext = (() => ({
      drawImage: () => {
        drawCalls += 1
      },
      getImageData: () => {
        if (pixel instanceof Error) throw pixel
        return { data: pixel }
      },
    })) as unknown as typeof originalGetContext

  }

  const imgWithSrc = (src: string): HTMLImageElement => {
    const img = document.createElement('img')
    Object.defineProperty(img, 'currentSrc', { value: src, configurable: true })
    return img
  }

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
  })

  it('усредняет кадр в hex и отдаёт его следующему слоту без повторного семпла', () => {
    stubCanvas([92, 98, 82, 255])
    const src = 'https://metravel.by/quest-cover/quests/1/steps/a.webp?w=640'

    expect(sampleDominantColor(imgWithSrc(src))).toBe('#5c6252')
    expect(drawCalls).toBe(1)

    // Тот же файл другой ступенью — уже из индекса, канву не трогаем.
    expect(lookupMediaPlaceholder('/quest-cover/quests/1/steps/a.webp?w=320')?.dominantColor).toBe(
      '#5c6252',
    )
    expect(sampleDominantColor(imgWithSrc(src))).toBe('#5c6252')
    expect(drawCalls).toBe(1)
  })

  it('манифест главнее: цвет из него канву не запускает', () => {
    stubCanvas([1, 2, 3, 255])
    indexMediaImage(entry())

    expect(sampleDominantColor(imgWithSrc('/address-image/355/conversions/e4dc7a17.webp?w=320'))).toBe(
      COLOR,
    )
    expect(drawCalls).toBe(0)
  })

  it('тейнт чужого origin запоминается, попытка не повторяется', () => {
    stubCanvas(new Error('SecurityError'))
    const src = 'https://example.com/foreign.jpg'

    expect(sampleDominantColor(imgWithSrc(src))).toBeNull()
    expect(sampleDominantColor(imgWithSrc(src))).toBeNull()
    expect(drawCalls).toBe(1)
  })

  it('полностью прозрачный кадр не считается чёрным', () => {
    stubCanvas([0, 0, 0, 0])
    expect(sampleDominantColor(imgWithSrc('/gallery/1/conversions/transparent.png'))).toBeNull()
  })
})
