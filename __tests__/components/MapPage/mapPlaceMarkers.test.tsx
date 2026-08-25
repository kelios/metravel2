/**
 * #1573 — один marker на физическое место в web/native renderers и стабильный
 * `placeKey` в SELECT_PLACE (problem MAP-POI-SOURCE-GROUPING-001).
 *
 * Дефект: несколько статей об одном объекте (Национальная библиотека) приходят
 * отдельными записями, а renderers считали записью каждый маркер — получалась
 * стопка перекрывающихся hit target'ов, и выбор по индексу/координате был
 * неоднозначен при обновлении dataset между рендером и тапом.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import MarkerClusterGroup from '@/components/MapPage/Map/MarkerClusterGroup'
import { parseNativeMapBridgeMessage } from '@/components/MapPage/Map/nativeBridge'
import {
  resolveSelectedNativePlace,
  toNativeClusterPayload,
  toNativeMarkerPayload,
} from '@/components/MapPage/Map/nativeMarkerPayload'
import { groupMapPlaces } from '@/api/mapPlaces'
import { mapClusterPointToPoint } from '@/components/MapPage/Map/serverClusterRenderData'
import type { Point } from '@/components/MapPage/Map/types'

jest.mock('react-dom', () => {
  const mockReact = require('react')
  return {
    createPortal: (children: unknown, _c: unknown, key?: string | null) =>
      mockReact.createElement(mockReact.Fragment, { key: key ?? undefined }, children),
  }
})

/** DTO ровно по `docs/features/map.md` → «Один физический объект с несколькими источниками». */
const LIBRARY_COORD = '53.9316,27.6459'
const OPERA_COORD = '53.9145,27.5615'

const libraryRecordA = {
  id: 101,
  coord: LIBRARY_COORD,
  address: 'Национальная библиотека',
  categoryName: 'Достопримечательность',
  urlTravel: '/travels/minsk-a',
  placeId: 'place-lib',
  sourceCount: 2,
  primarySource: {
    sourceId: 'travel-address:101',
    pointId: 101,
    travelId: 11,
    articleTitle: 'Минск за выходные',
    articleUrl: '/travels/minsk-a',
    thumbnailUrl: null,
    thumbnailWidth: null,
    thumbnailHeight: null,
  },
} as unknown as Point

const libraryRecordB = {
  id: 102,
  coord: LIBRARY_COORD,
  address: 'Национальная библиотека',
  categoryName: 'Достопримечательность',
  urlTravel: '/travels/minsk-b',
  placeId: 'place-lib',
  sourceCount: 2,
} as unknown as Point

const operaRecord = {
  id: 103,
  coord: OPERA_COORD,
  address: 'Большой театр',
  categoryName: 'Театр',
  placeId: 'place-opera',
  sourceCount: 1,
} as unknown as Point

/** Legacy-строка без `place_id`: слияние запрещено, остаётся отдельным маркером. */
const legacyRecord = {
  id: 104,
  coord: '53.9000,27.5000',
  address: 'Старая точка без place_id',
} as unknown as Point

type LeafletHarness = {
  L: Record<string, jest.Mock>
  group: Record<string, jest.Mock>
  createdMarkerCoords: Array<[number, number]>
}

const makeLeafletHarness = (): LeafletHarness => {
  const createdMarkerCoords: Array<[number, number]> = []
  const makeMarker = () => {
    const marker: any = {
      bindPopup: jest.fn(),
      bindTooltip: jest.fn(),
      off: jest.fn(),
      unbindPopup: jest.fn(),
      openPopup: jest.fn(),
    }
    marker.on = jest.fn(() => marker)
    return marker
  }
  const group = {
    addLayers: jest.fn(),
    addLayer: jest.fn(),
    removeLayers: jest.fn(),
    removeLayer: jest.fn(),
    clearLayers: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as Record<string, jest.Mock>
  const L = {
    markerClusterGroup: jest.fn(() => group),
    marker: jest.fn((latlng: [number, number]) => {
      createdMarkerCoords.push(latlng)
      return makeMarker()
    }),
    divIcon: jest.fn(),
  } as unknown as Record<string, jest.Mock>

  return { L, group, createdMarkerCoords }
}

/**
 * Идентичности map/markerIcon/PopupContent/queryClient стабильны между рендерами
 * намеренно: свежий markerIcon или новый map-инстанс сам по себе роняет индекс
 * маркеров и пересоздаёт их (см. MarkerClusterGroup «marker options changed»),
 * что замаскировало бы ровно то, что здесь измеряется — стабильность ключей мест.
 */
const renderMarkers = (harness: LeafletHarness, points: Point[]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const map = { addLayer: jest.fn(), removeLayer: jest.fn(), closePopup: jest.fn() }
  const markerIcon = {}
  const PopupContent = () => null
  const Popup = () => null

  const tree = (nextPoints: Point[]) => (
    <QueryClientProvider client={queryClient}>
      <MarkerClusterGroup
        L={harness.L}
        useMap={() => map}
        points={nextPoints}
        markerIcon={markerIcon}
        PopupContent={PopupContent}
        Popup={Popup}
      />
    </QueryClientProvider>
  )

  const view = render(tree(points))
  return {
    ...view,
    rerenderPoints: (nextPoints: Point[]) => view.rerender(tree(nextPoints)),
  }
}

describe('#1573 web renderer: один marker на физическое место', () => {
  const originalDocument = global.document

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).document = {
      createElement: jest.fn(() => ({ className: '', setAttribute: jest.fn(), innerHTML: '' })),
    }
  })

  afterEach(() => {
    ;(global as any).document = originalDocument
  })

  it('сливает две записи одного place_id в один marker и один hit target', () => {
    const harness = makeLeafletHarness()
    renderMarkers(harness, [libraryRecordA, libraryRecordB, operaRecord])

    expect(harness.L.marker).toHaveBeenCalledTimes(2)
    expect(harness.createdMarkerCoords).toEqual([
      [53.9316, 27.6459],
      [53.9145, 27.5615],
    ])
  })

  it('не сливает разные place_id и оставляет legacy-запись без place_id отдельной', () => {
    const harness = makeLeafletHarness()
    renderMarkers(harness, [libraryRecordA, operaRecord, legacyRecord])

    expect(harness.L.marker).toHaveBeenCalledTimes(3)
  })

  it('переупорядочивание dataset не пересоздаёт маркеры (keyed diff #1347)', () => {
    const harness = makeLeafletHarness()
    const view = renderMarkers(harness, [libraryRecordA, libraryRecordB, operaRecord])
    expect(harness.L.marker).toHaveBeenCalledTimes(2)

    // Refetch: свежие объекты записей с тем же содержимым, порядок мест другой.
    // Внутри места порядок записей сохраняется — репрезентативная запись места
    // (её ссылку/превью рисует popup) остаётся прежней.
    view.rerenderPoints([{ ...operaRecord }, { ...libraryRecordA }, { ...libraryRecordB }] as Point[])

    // Ни одного нового L.marker и ни одного снятия слоя: ключи мест стабильны
    // между обновлениями dataset, поэтому маркеры переживают refresh.
    expect(harness.L.marker).toHaveBeenCalledTimes(2)
    expect(harness.group.removeLayers).not.toHaveBeenCalled()
    expect(harness.group.clearLayers).not.toHaveBeenCalled()
  })
})

describe('#1573 place identity переживает адаптер серверных кластеров', () => {
  it('mapClusterPointToPoint не теряет place_id/source_count/primary_source', () => {
    const point = mapClusterPointToPoint({
      id: 101,
      coord: LIBRARY_COORD,
      lat: '53.9316',
      lng: '27.6459',
      address: 'Национальная библиотека',
      categoryName: 'Достопримечательность',
      travelImageThumbUrl: '',
      imageUrl: '',
      urlTravel: '/travels/minsk-a',
      placeId: 'place-lib',
      sourceCount: 2,
      primarySource: null,
    })

    expect(point.placeId).toBe('place-lib')
    expect(point.sourceCount).toBe(2)
    expect(groupMapPlaces([point])[0].placeKey).toBe('place-lib')
  })
})

describe('#1573 native bridge: стабильный placeKey в SELECT_PLACE', () => {
  it('round-trip: placeKey доезжает из WebView в RN', () => {
    expect(
      parseNativeMapBridgeMessage(
        JSON.stringify({
          type: 'SELECT_PLACE',
          placeKey: ' place-lib ',
          index: 0,
          id: 101,
          coord: LIBRARY_COORD,
        }),
      ),
    ).toEqual({
      type: 'SELECT_PLACE',
      placeKey: 'place-lib',
      index: 0,
      id: '101',
      coord: LIBRARY_COORD,
    })
  })

  it('старый WebView без placeKey продолжает парситься (legacy-fallback)', () => {
    expect(
      parseNativeMapBridgeMessage(
        JSON.stringify({ type: 'SELECT_PLACE', id: 42, coord: ' 53.9,27.5 ' }),
      ),
    ).toEqual({ type: 'SELECT_PLACE', placeKey: '', index: null, id: '42', coord: '53.9,27.5' })
  })

  it('сообщение без единого идентификатора отбрасывается', () => {
    expect(parseNativeMapBridgeMessage(JSON.stringify({ type: 'SELECT_PLACE' }))).toBeNull()
  })
})

describe('#1573 native payload и резолв выбора', () => {
  const places = groupMapPlaces<Point>([libraryRecordA, libraryRecordB, operaRecord])

  it('WebView получает один маркер на место и только поля рендера/выбора', () => {
    const payload = toNativeMarkerPayload(places)

    expect(payload).toEqual([
      {
        placeKey: 'place-lib',
        id: '101',
        coord: LIBRARY_COORD,
        categoryName: 'Достопримечательность',
        sourceCount: 2,
      },
      {
        placeKey: 'place-opera',
        id: '103',
        coord: OPERA_COORD,
        categoryName: 'Театр',
        sourceCount: 1,
      },
    ])
    // Массив источников места через мост не сериализуется.
    expect(JSON.stringify(payload)).not.toContain('sources')
    expect(JSON.stringify(payload)).not.toContain('primarySource')
  })

  it('место без координаты сохраняет слот, иначе legacy-index указал бы на чужое место', () => {
    const coordlessRecord = { id: 999, address: 'Запись без координаты' } as unknown as Point
    const withGap = groupMapPlaces<Point>([coordlessRecord, operaRecord])
    const payload = toNativeMarkerPayload(withGap)

    // WebView сам пропускает элемент без coord (`if (!point.coord) return`), но в
    // SELECT_PLACE шлёт индекс СВОЕГО массива: пропуск элемента здесь сдвинул бы
    // нумерацию и legacy-fallback открыл бы соседнюю карточку.
    expect(payload).toHaveLength(withGap.length)
    expect(payload[0].coord).toBe('')
    expect(resolveSelectedNativePlace(withGap, { index: 1 })?.record).toBe(operaRecord)
  })

  it('payload не превышает baseline сырых записей по размеру', () => {
    const baselineBytes = JSON.stringify([libraryRecordA, libraryRecordB, operaRecord]).length
    const payloadBytes = JSON.stringify(toNativeMarkerPayload(places)).length

    expect(payloadBytes).toBeLessThan(baselineBytes)
  })

  it('кластеры уходят в WebView без items: preview-записи через мост не едут', () => {
    const cluster = {
      key: 'geo-key',
      count: 7,
      center: [53.9, 27.5] as [number, number],
      bounds: [[53.8, 27.4], [54.0, 27.6]] as [[number, number], [number, number]],
      items: [libraryRecordA, libraryRecordB],
    }
    const payload = toNativeClusterPayload([cluster] as never)

    expect(payload).toEqual([
      // `key` остаётся: стабильный геометрический ключ #1347 — контракт паритета с web.
      { key: 'geo-key', center: [53.9, 27.5], count: 7, bounds: [[53.8, 27.4], [54.0, 27.6]] },
    ])
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('items')
    expect(serialized).not.toContain('primarySource')
    expect(serialized.length).toBeLessThan(JSON.stringify([cluster]).length)
  })

  it('тап после переупорядочивания dataset открывает то же место', () => {
    const reordered = groupMapPlaces<Point>([operaRecord, libraryRecordB, libraryRecordA])
    const selected = resolveSelectedNativePlace(reordered, {
      placeKey: 'place-lib',
      // Индекс и координата взяты из ПРЕЖНЕГО кадра — placeKey обязан их перебить.
      index: 0,
      coord: OPERA_COORD,
      id: '103',
    })

    expect(selected?.placeKey).toBe('place-lib')
    expect(selected?.record).toBe(libraryRecordB)
  })

  it('без placeKey резолв откатывается на legacy id, затем coord, затем index', () => {
    expect(resolveSelectedNativePlace(places, { id: '103' })?.placeKey).toBe('place-opera')
    expect(resolveSelectedNativePlace(places, { coord: OPERA_COORD })?.placeKey).toBe('place-opera')
    expect(resolveSelectedNativePlace(places, { index: 0 })?.placeKey).toBe('place-lib')
    expect(resolveSelectedNativePlace(places, { index: 99 })).toBeNull()
  })
})
