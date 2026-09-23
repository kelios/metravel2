/**
 * #2069 — у поездки несколько исходных файлов трека, и карта планировщика рисует
 * все, а не только первый.
 *
 * Regression control карточки: «список из двух файлов даёт два трека на карте».
 * Цепочка настоящая — файловая ветка конструктора (`useTripRouteFileBranch`) с
 * живым React Query читает список, качает и разбирает каждый файл, а её линии
 * получает сама карта: на web — react-leaflet (`TripPlanRouteMap.web`), на
 * native — payload WebView-карты (`TripPlanRouteMap`). Подменён только HTTP-клиент
 * (`apiClient`), так что `api/plannedTripRoutes` работает настоящий. До фикса он
 * сводил список к `files[0]`, и на карту уезжал один KML, а GPX по дням пропадал.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import type { RouteGeometry, RoutePoint } from '@/api/plannedTrips'
import { useTripRouteFileBranch } from '@/components/trips/planning/useTripRouteFileBranch'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockPolylineProps: Array<Record<string, unknown>> = []
const mockNativeMapProps: Array<Record<string, unknown>> = []
const mockMap = { setView: jest.fn(), fitBounds: jest.fn(), stop: jest.fn() }

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    uploadFormData: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
}))

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))
jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: {
      divIcon: (options: unknown) => options,
      latLngBounds: (positions: unknown) => positions,
    },
    RL: {
      Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Polyline: (props: Record<string, unknown>) => {
        mockPolylineProps.push(props)
        return null
      },
      useMap: () => mockMap,
      useMapEvents: () => null,
    },
  }),
}))
jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: ({ children }: { children?: (engine: unknown) => React.ReactNode }) => (
    <>{children?.({})}</>
  ),
}))
jest.mock('@/components/MapPage/Map', () => {
  const { View } = require('react-native')
  const MockNativeMap = (props: Record<string, unknown>) => {
    mockNativeMapProps.push(props)
    return <View testID="native-map" />
  }
  return { __esModule: true, default: MockNativeMap }
})
// Цвет по имени токена: так линия оригинала отличается от линии маршрута.
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMapNative from '@/components/trips/planning/TripPlanRouteMap'
import TripPlanRouteMapWeb from '@/components/trips/planning/TripPlanRouteMap.web'

const { apiClient } = jest.requireMock('@/api/client') as {
  apiClient: { get: jest.Mock; download: jest.Mock }
}

const TRIP_ID = 47

const routeIdOf = (url: string): number => Number(/\/routes\/(\d+)\/download\/$/.exec(url)?.[1])
// Скачивание отвечает телом своего файла; `null` — отказ хранилища.
const mockDownloads = (bodyOf: (routeId: number) => string | null) =>
  apiClient.download.mockImplementation(async (url: string) => {
    const body = bodyOf(routeIdOf(url))
    if (body == null) throw new Error('storage down')
    return { blob: { text: async () => body } }
  })

// Как у trip 47 на проде 23.09: трёхпетлевой KML (sort_order 0) и добавленный
// к нему GPX по дням (sort_order 1).
const FILES = [
  {
    id: 4,
    original_name: 'Mullerthal_Trail_Routes_1-3.kml',
    ext: 'kml',
    size: 185548,
    created_at: '2026-09-20T08:00:00Z',
    updated_at: '2026-09-20T08:00:00Z',
  },
  {
    id: 11,
    original_name: 'Mullerthal_Trail_po_dnyam.gpx',
    ext: 'gpx',
    size: 412000,
    created_at: '2026-09-23T08:00:00Z',
    updated_at: '2026-09-23T08:00:00Z',
  },
]

const BODIES: Record<number, string> = {
  4: '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><LineString><coordinates>6.42,49.81 6.43,49.82 6.44,49.81</coordinates></LineString></Placemark></Document></kml>',
  11: '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="49.79" lon="6.3"/><trkpt lat="49.8" lon="6.31"/><trkpt lat="49.795" lon="6.32"/></trkseg></trk></gpx>',
}

// Линии файлов в формате [lng, lat], как их отдаёт файловая ветка.
const LOOP_LINE: RouteGeometry = [
  [6.42, 49.81],
  [6.43, 49.82],
  [6.44, 49.81],
]
const DAY_LINE: RouteGeometry = [
  [6.3, 49.79],
  [6.31, 49.8],
  [6.32, 49.795],
]

const route: RoutePoint[] = [
  { id: 'a', type: 'custom', name: 'Эхтернах', description: null, coordinates: [6.4214, 49.8117], placeId: null },
  { id: 'b', type: 'custom', name: 'Бердорф', description: null, coordinates: [6.3508, 49.8206], placeId: null },
]

type PlanMap = typeof TripPlanRouteMapWeb | typeof TripPlanRouteMapNative

function Harness({ PlanMap }: { PlanMap: PlanMap }) {
  const { originalTrackSegments } = useTripRouteFileBranch({ tripId: TRIP_ID, isOwner: true })
  return <PlanMap route={route} originalTrackSegments={originalTrackSegments} />
}

const renderHarness = (PlanMap: PlanMap) =>
  render(<Harness PlanMap={PlanMap} />, { wrapper: createQueryWrapper().Wrapper })

describe('#2069: два исходных файла — два трека на карте планировщика', () => {
  beforeEach(() => {
    mockPolylineProps.length = 0
    mockNativeMapProps.length = 0
    jest.clearAllMocks()
    apiClient.get.mockResolvedValue(FILES)
    mockDownloads((routeId) => BODIES[routeId])
  })

  it('web: по полилинии оригинала на каждый файл, с координатами своего файла', async () => {
    const screen = renderHarness(TripPlanRouteMapWeb)

    const originalLines = () => {
      const seen = new Map<string, unknown>()
      mockPolylineProps
        .filter((props) => (props.pathOptions as { color?: string })?.color === 'accentDark')
        .forEach((props) => seen.set(JSON.stringify(props.positions), props.positions))
      return [...seen.values()]
    }

    await waitFor(() => expect(originalLines()).toHaveLength(2))
    expect(apiClient.get).toHaveBeenCalledWith(`/trips/planned/${TRIP_ID}/routes/`, expect.any(Number))
    expect(apiClient.download.mock.calls.map(([url]) => routeIdOf(url)).sort((a, b) => a - b)).toEqual([4, 11])
    // Leaflet получает [lat, lng]: KML-петля и GPX-день — каждый своей линией.
    expect(originalLines()).toEqual([
      LOOP_LINE.map(([lng, lat]) => [lat, lng]),
      DAY_LINE.map(([lng, lat]) => [lat, lng]),
    ])
    // Легенда одна на весь слой оригиналов.
    expect(screen.getAllByTestId('trip-plan-map-original-track-legend')).toHaveLength(1)
  })

  it('native: в payload WebView-карты уезжают линии обоих файлов', async () => {
    const screen = renderHarness(TripPlanRouteMapNative)

    const lastSegments = () =>
      mockNativeMapProps[mockNativeMapProps.length - 1]?.originalTrackSegments as RouteGeometry[] | undefined

    await waitFor(() => expect(lastSegments()).toHaveLength(2))
    expect(lastSegments()).toEqual([LOOP_LINE, DAY_LINE])
    expect(screen.getAllByTestId('trip-plan-map-original-track-legend')).toHaveLength(1)
  })

  it('файл, который не скачался, не прячет трек соседнего', async () => {
    mockDownloads((routeId) => (routeId === 4 ? null : BODIES[routeId]))

    renderHarness(TripPlanRouteMapNative)

    await waitFor(() =>
      expect(mockNativeMapProps[mockNativeMapProps.length - 1]?.originalTrackSegments).toEqual([DAY_LINE]),
    )
  })
})
