/**
 * #1208: карточка/попап карты рисуют `contain`-снимок, а поля вокруг него должна
 * заливать `dominant_color`. Замер прода 2026-08-05 на `/map`: 7 карточек списка,
 * `object-fit: contain` в боксе 360×173, слоёв заливки — 0, фон медиа-бокса
 * `rgba(0, 0, 0, 0)`. Причина — цвет лежал в `media.address_images`, а карта его
 * оттуда никогда не читала.
 *
 * Тест идёт РЕАЛЬНЫМ путём построения (`fetchTravelsForMap` → нормализатор →
 * индекс), а не мокает нормализацию: дефект был именно в том, как собирается
 * адрес, поэтому подменять сборку нельзя. Пейлоад и итоговый URL карточки взяты
 * с прода.
 */
import { fetchTravelsForMap, fetchMapClusters } from '@/api/map'
import { lookupMediaPlaceholder, resetMediaPlaceholderIndex } from '@/utils/mediaPlaceholderIndex'

const mockFetchWithTimeout = jest.fn()

jest.mock('@/utils/fetchWithTimeout', () => ({
  __esModule: true,
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}))

const responseMock = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => JSON.stringify(payload),
})

const DOMINANT_COLOR = '#5c6252'
const BLURHASH = 'LKCZne~WRO%gyGXTIUxvyFo$jYxu'

/** Точка 355 в форме прод-ответа: у карточки свой thumb, у манифеста — свой кадр. */
const POINT = {
  id: 355,
  point_id: 355,
  title: 'Река Ислочь',
  lat: '53.9832626',
  lng: '26.9879837',
  address: 'Н8331, Раковский сельский Совет',
  categoryName: 'Парковка',
  travelImageThumbUrl:
    'https://metravel.by/address-image/355/conversions/462e31db74f043c5884fa3f3803132f7.webp',
  travelImageUrl:
    'https://metravel.by/address-image/355/conversions/e4dc7a175f604fea82eea4c37b993ad8.webp',
  urlTravel: 'https://metravel.by/travels/reka-isloch?id=133',
  media: {
    address_images: {
      '355': {
        id: 355,
        width: 1448,
        height: 1086,
        dominant_color: DOMINANT_COLOR,
        blurhash: BLURHASH,
        src: '/address-image/355/conversions/e4dc7a175f604fea82eea4c37b993ad8.webp?w=640',
        srcset:
          '/address-image/355/conversions/e4dc7a175f604fea82eea4c37b993ad8.webp?w=320 320w, /address-image/355/conversions/e4dc7a175f604fea82eea4c37b993ad8.webp?w=640 640w',
      },
    },
  },
}

/** Ровно тот адрес, который `<img>` карточки показывал на проде. */
const RENDERED_CARD_SRC =
  'https://metravel.by/media-resize/legacy/355/conversions/462e31db74f043c5884fa3f3803132f7.webp?v=1785826436881&w=720&q=60&fit=contain'

describe('карта: заливка полей letterbox приходит из манифеста точки', () => {
  beforeEach(() => {
    resetMediaPlaceholderIndex()
    mockFetchWithTimeout.mockReset()
  })

  it('fetchTravelsForMap индексирует цвет под адресом, который рисует карточка', async () => {
    mockFetchWithTimeout.mockResolvedValue(responseMock({ count: 1, results: [POINT] }))

    expect(lookupMediaPlaceholder(RENDERED_CARD_SRC)).toBeNull()

    await fetchTravelsForMap(0, 100, { lat: '53.9', lng: '27.5', radius: 60 }, { throwOnError: true })

    expect(lookupMediaPlaceholder(RENDERED_CARD_SRC)?.dominantColor).toBe(DOMINANT_COLOR)
    // Попап маркера открывает полноразмерный кадр — тот же цвет и по нему.
    expect(lookupMediaPlaceholder(POINT.travelImageUrl)?.dominantColor).toBe(DOMINANT_COLOR)
  })

  it('серверная кластеризация индексирует те же точки', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      responseMock({ clusters: [], markers: [POINT], total_count: 1 }),
    )

    await fetchMapClusters({ south: 53, west: 26, north: 54, east: 28 }, 12)

    expect(lookupMediaPlaceholder(RENDERED_CARD_SRC)?.dominantColor).toBe(DOMINANT_COLOR)
  })

  it('точка без манифеста ничего не индексирует — заливка остаётся отсутствующей', async () => {
    const { media: _media, ...pointWithoutManifest } = POINT
    mockFetchWithTimeout.mockResolvedValue(responseMock({ count: 1, results: [pointWithoutManifest] }))

    await fetchTravelsForMap(0, 100, { lat: '53.9', lng: '27.5', radius: 60 }, { throwOnError: true })

    expect(lookupMediaPlaceholder(RENDERED_CARD_SRC)).toBeNull()
  })
})
