import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render, waitFor, within } from '@testing-library/react-native'

import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes'
import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'
import {
  buildTripRouteExportInput,
  isTripRouteExportApproximate,
} from '@/components/trips/planning/tripRouteExport'
import { buildGpx } from '@/utils/routeExport'

const mockSaveRouteExportFile = jest.fn()
const mockDownloadOriginal = jest.fn()
// Сохранённые оригиналы есть не в каждом сценарии, поэтому мок запроса списка
// переключаемый: по умолчанию файлов нет.
let mockStoredRouteFiles: PlannedTripRouteFile[] | undefined = undefined

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/utils/routeExport', () => {
  const actual = jest.requireActual('@/utils/routeExport')
  return {
    ...actual,
    saveRouteExportFile: (...args: unknown[]) => mockSaveRouteExportFile(...args),
  }
})

jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
  trackRoutePointAdded: jest.fn(),
}))

// Один массив на все рендеры: новая ссылка на каждый рендер гоняла бы карту.
const mockNoTrackSegments: Array<Array<[number, number]>> = []
jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFiles: () => ({ data: mockStoredRouteFiles }),
  usePlannedTripOriginalTracks: () => mockNoTrackSegments,
  useUploadPlannedTripRouteFile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlannedTripRouteFile: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/utils/travelRouteDownload', () => ({
  ...jest.requireActual('@/utils/travelRouteDownload'),
  downloadPlannedTripRouteFile: (...args: unknown[]) => mockDownloadOriginal(...args),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

const routedGeometry: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [
  19.9496 + i * 0.004,
  49.2992 + i * 0.0005,
])

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 22,
  slug: '22',
  title: 'Закопане — Буковина',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'Zakopane', description: null, coordinates: [19.9496, 49.2992], placeId: null },
    { id: 'b', type: 'custom', name: 'Bukowina', description: null, coordinates: [20.108, 49.32], placeId: null },
  ],
  routeGeometry: routedGeometry,
  routeSummary: {
    distanceKm: 16.5,
    durationMin: 30,
    elevationGainM: 452,
    stopsCount: 2,
    provider: 'ors',
  },
  routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-08-08T08:00:00Z',
  ...overrides,
})

// #1304: маршрут строится во вкладке «Маршрут», а скачать его можно было только
// во вкладке «Экспорт» — владелец функциональность не нашёл.

// #1491: шаг «Точки маршрута» рендерит общий AddressSearch с /map, а он ходит за
// адресами через React Query — конструктору нужен клиент, как и в приложении.
const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

const STORED_ORIGINAL: PlannedTripRouteFile = {
  id: 7,
  original_name: 'Mullerthal_Trail_Routes_1-3.kml',
  ext: 'kml',
  size: 185548,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
}

describe('RouteBuilder route download', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveRouteExportFile.mockResolvedValue(true)
    mockDownloadOriginal.mockResolvedValue(true)
    mockStoredRouteFiles = undefined
  })

  it('offers GPX and KML download next to the map', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    expect(getByTestId('route-builder-export')).toBeTruthy()
    expect(getByTestId('trip-route-export-gpx')).toBeTruthy()
    expect(getByTestId('trip-route-export-kml')).toBeTruthy()
  })

  // #1902 собрал импорт и GPX/KML в одну рамку «Файл маршрута», но в сжатом ряду
  // подписи обрезались до «И…», «G.», «K..» (#2053). Теперь блок — стопка по
  // макету: импорт во всю ширину, GPX и KML поровну, подписи полные.
  it('stacks the «Route file» block with full labels (#1902, #2053)', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    const block = within(getByTestId('route-builder-route-file'))
    expect(block.getByText('Файл маршрута')).toBeTruthy()
    expect(block.getByTestId('trip-route-import-panel')).toBeTruthy()
    expect(block.getByTestId('route-builder-export')).toBeTruthy()

    const importButton = block.getByTestId('trip-route-import-picker')
    expect(within(importButton).getByText('Загрузить трек (GPX/KML)')).toBeTruthy()
    expect(StyleSheet.flatten(importButton.props.style)).toMatchObject({
      flexGrow: 1,
      flexShrink: 0,
    })

    const gpx = block.getByTestId('trip-route-export-gpx')
    const kml = block.getByTestId('trip-route-export-kml')
    // jest рендерит как iPhone: на native действие называется «Поделиться».
    expect(within(gpx).getByText('Поделиться GPX')).toBeTruthy()
    expect(within(kml).getByText('Поделиться KML')).toBeTruthy()
    expect(block.queryByText('GPX')).toBeNull()
    // Один вариант и одинаковое растяжение — одинаковые кнопки.
    const gpxStyle = StyleSheet.flatten(gpx.props.style)
    expect(gpxStyle).toMatchObject({ flexGrow: 1, flexShrink: 0 })
    expect(StyleSheet.flatten(kml.props.style)).toEqual(gpxStyle)
  })

  it('downloads the saved original from its card, not from the export row (#2053)', async () => {
    mockStoredRouteFiles = [STORED_ORIGINAL]
    const { getByTestId, queryByTestId, queryByText } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip()} />,
    )

    const card = within(getByTestId('trip-route-import-stored-original'))
    const name = card.getByText('Mullerthal_Trail_Routes_1-3.kml')
    expect(name.props.numberOfLines).toBe(2)
    expect(card.getByTestId('trip-route-import-remove-original')).toBeTruthy()
    const download = card.getByTestId('trip-route-import-download-original')
    expect(within(download).getByText('Поделиться оригиналом')).toBeTruthy()

    // Имя файла уже в карточке: строки-дубля и второй кнопки оригинала нет.
    expect(queryByTestId('trip-route-export-download-original')).toBeNull()
    expect(queryByTestId('trip-route-original-download-block')).toBeNull()
    expect(queryByText(/Исходный файл маршрута/)).toBeNull()

    fireEvent.press(download)
    await waitFor(() => expect(mockDownloadOriginal).toHaveBeenCalledTimes(1))
    expect(mockDownloadOriginal).toHaveBeenCalledWith(22, STORED_ORIGINAL)
  })

  it('reports a failed original download inside the card', async () => {
    mockStoredRouteFiles = [STORED_ORIGINAL]
    mockDownloadOriginal.mockResolvedValueOnce(false)
    const { findByTestId, getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('trip-route-import-download-original'))

    const error = await findByTestId('trip-route-import-original-download-error')
    expect(
      within(getByTestId('trip-route-import-stored-original')).getByTestId(
        'trip-route-import-original-download-error',
      ),
    ).toBe(error)
  })

  // Стопка с полными подписями — исключение только для блока «Файл маршрута»
  // владельца (#2053). У участника того блока нет: GPX/KML остаются обычным
  // рядом инструментов — на телефоне (jest рендерит окно 750 px) короткие
  // подписи, кнопки не растянуты на всю ширину.
  it('keeps the compact download row for a participant who cannot edit the route', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ isOwner: false })} />,
    )

    expect(getByTestId('route-builder-export')).toBeTruthy()
    expect(queryByTestId('route-builder-route-file')).toBeNull()

    const gpx = getByTestId('trip-route-export-gpx')
    const kml = getByTestId('trip-route-export-kml')
    expect(within(gpx).getByText('GPX')).toBeTruthy()
    expect(within(kml).getByText('KML')).toBeTruthy()
    expect(gpx.props.accessibilityLabel).toBe('Поделиться GPX')
    for (const button of [gpx, kml]) {
      expect(StyleSheet.flatten(button.props.style).flexGrow).not.toBe(1)
    }
  })

  it('builds a real file through the shared export path', async () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('trip-route-export-gpx'))

    await waitFor(() => expect(mockSaveRouteExportFile).toHaveBeenCalledTimes(1))
    expect(mockSaveRouteExportFile.mock.calls[0][0]).toEqual(
      expect.objectContaining({ filename: expect.stringMatching(/\.gpx$/) }),
    )
  })

  it('disables the buttons until the route has two points with coordinates', () => {
    const { getByTestId } = renderRouteBuilder(
      <RouteBuilder
        trip={makeTrip({
          route: [
            { id: 'a', type: 'custom', name: 'Zakopane', description: null, coordinates: [19.9496, 49.2992], placeId: null },
          ],
          routeGeometry: null,
        })}
      />,
    )

    expect(getByTestId('trip-route-export-gpx').props.accessibilityState.disabled).toBe(true)
    expect(getByTestId('trip-route-export-kml').props.accessibilityState.disabled).toBe(true)
  })

  // #2057: на desktop (прод trip 47, 1440) фраза «Сервис построения маршрутов
  // временно недоступен…» стояла и в «Итоге маршрута», и в «Файле маршрута».
  // Причину показывает шапка карты (в этом тесте карта заглушена), «Файл
  // маршрута» говорит про экспорт одной короткой строкой (макет §1 и §2).
  it('keeps the degradation reason out of the steps: summary chip and a short export line', () => {
    const { getByTestId, queryByText } = renderRouteBuilder(
      <RouteBuilder
        trip={makeTrip({
          transport: 'foot',
          routeGeometry: [
            [19.9496, 49.2992],
            [20.108, 49.32],
          ],
          routeSummary: {
            distanceKm: 2429,
            durationMin: 28917,
            elevationGainM: 0,
            stopsCount: 2,
            provider: 'direct',
          },
          routingState: {
            provider: 'direct',
            isOptimal: false,
            fallbackReason: 'ors_http_404',
            warnings: ['ors_http_404'],
          },
        })}
      />,
    )

    expect(queryByText(/Не получилось проложить|временно недоступен/)).toBeNull()
    expect(within(getByTestId('route-builder-route-file')).getByTestId('trip-route-download-approximate'))
      .toHaveTextContent('Линия приблизительная — в файле будут прямые отрезки.')
    const summary = within(getByTestId('route-summary'))
    expect(summary.getByTestId('route-summary-approximate')).toBeTruthy()
    expect(summary.queryByTestId('route-summary-metric-duration')).toBeNull()
    expect(summary.queryByTestId('route-summary-metric-elevation')).toBeNull()
  })
})

// Инвариант экспорта: файл несёт проложенный трек, а не только точки — иначе
// «скачать маршрут» отдаёт прямые между waypoints.
describe('trip route export payload', () => {
  it('writes the routed geometry into the GPX track', () => {
    const gpx = buildGpx(buildTripRouteExportInput(makeTrip()))

    expect((gpx.content.match(/<trkpt/g) ?? []).length).toBe(routedGeometry.length)
    expect((gpx.content.match(/<wpt/g) ?? []).length).toBe(2)
  })

  it('falls back to the waypoint line when no routed geometry exists', () => {
    const gpx = buildGpx(buildTripRouteExportInput(makeTrip({ routeGeometry: null })))

    expect((gpx.content.match(/<trkpt/g) ?? []).length).toBe(2)
  })

  it('warns and exports only waypoints when a healthy state has no geometry', () => {
    const inconsistentTrip = makeTrip({
      routeGeometry: null,
      routingState: {
        provider: 'ors',
        isOptimal: true,
        fallbackReason: null,
        warnings: [],
      },
    })

    const input = buildTripRouteExportInput(inconsistentTrip)
    const gpx = buildGpx(input)

    expect(isTripRouteExportApproximate(inconsistentTrip)).toBe(true)
    expect(input.track).toEqual(inconsistentTrip.route.map((point) => point.coordinates))
    expect(input.description).toContain('приблизительный')
    expect((gpx.content.match(/<trkpt/g) ?? [])).toHaveLength(2)
  })
})
