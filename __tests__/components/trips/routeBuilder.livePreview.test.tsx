// __tests__/components/trips/routeBuilder.livePreview.test.tsx
// #1490: до нажатия «Сохранить маршрут» конструктор обязан строить дорогу тем же
// движком, что и /map, а не рисовать прямую и печатать оценочные цифры.
import React from 'react'
import { act, fireEvent, render, within } from '@testing-library/react-native'

import type { PlannedTrip, TripRouteElevation } from '@/api/plannedTrips'
import type { UseMapRoutingResult } from '@/components/map-core/useMapRouting'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'
import { PREVIEW_DEBOUNCE_MS } from '@/components/trips/planning/useTripRoutePreview'

const mockEngine: {
  mounts: Array<{ points: Array<[number, number]>; transportMode: string }>
  callbacks: Array<(result: UseMapRoutingResult) => void>
  onResult: ((result: UseMapRoutingResult) => void) | null
} = { mounts: [], callbacks: [], onResult: null }
const mockSaveRouteExportFile = jest.fn()
const mockRefreshRouteElevation = jest.fn()
const mockMissingElevationGeometry: TripRouteElevation = {
  status: 'ready',
  provider: 'ors',
  ascentM: 145,
  descentM: 132,
  preview: null,
  geometry: null,
  calculatedAt: '2026-08-08T08:05:00Z',
}
let mockRouteElevationQuery: {
  data: TripRouteElevation | undefined
  isFetching: boolean
} = { data: mockMissingElevationGeometry, isFetching: false }

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))
jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
  trackRoutePointAdded: jest.fn(),
}))
jest.mock('@/utils/routeExport', () => {
  const actual = jest.requireActual('@/utils/routeExport')
  return {
    ...actual,
    saveRouteExportFile: (...args: unknown[]) => mockSaveRouteExportFile(...args),
  }
})

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => mockRouteElevationQuery,
  useRefreshTripRouteElevation: () => ({ mutate: mockRefreshRouteElevation, isPending: false }),
  useUpdateTripRoute: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

// Реальный движок ходит в сеть за маршрутом; здесь проверяется обвязка вокруг
// него — что он монтируется на нужные точки и что его ответ доезжает до карты.
jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  const ReactLocal = require('react')
  return function TripRoutePreviewEngine(props: {
    points: Array<[number, number]>
    transportMode: string
    onResult: (result: unknown) => void
  }) {
    const { Text, View } = require('react-native')
    mockEngine.onResult = props.onResult as never
    ReactLocal.useEffect(() => {
      mockEngine.mounts.push({ points: props.points, transportMode: props.transportMode })
      mockEngine.callbacks.push(props.onResult as never)
    }, [props.onResult, props.points, props.transportMode])
    return (
      <View testID="trip-route-preview-engine">
        <Text testID="preview-engine-mode">{props.transportMode}</Text>
        <Text testID="preview-engine-points">{String(props.points.length)}</Text>
      </View>
    )
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({
    routeGeometry,
    routingState,
  }: {
    routeGeometry?: Array<[number, number]> | null
    routingState?: { provider: string } | null
  }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Text testID="route-map-geometry">{String(routeGeometry?.length ?? 0)}</Text>
        <Text testID="route-map-provider">{routingState?.provider ?? 'none'}</Text>
      </View>
    )
  }
})

// График высот грузится через React.lazy; под фейковыми таймерами Suspense
// пришлось бы раскручивать вручную, а проверяется здесь не ленивая загрузка.
jest.mock('@/components/layout/safeLazy', () => ({
  __esModule: true,
  safeLazy: () => require('@/components/travel/details/sections/RouteElevationProfile').default,
  default: () => require('@/components/travel/details/sections/RouteElevationProfile').default,
}))

jest.mock('@/components/travel/details/sections/RouteElevationProfile', () => ({
  __esModule: true,
  default: function RouteElevationProfile({
    preview,
  }: {
    preview?: { elevationProfile?: unknown[] }
  }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="route-elevation-profile">
        <Text testID="route-elevation-samples">
          {String(preview?.elevationProfile?.length ?? 0)}
        </Text>
      </View>
    )
  },
}))

const routedCoords = (count: number): Array<[number, number]> =>
  Array.from(
    { length: count },
    (_, index) => [27.5 + index * 0.002, 53.9 + index * 0.002] as [number, number],
  )

const engineResult = (overrides: Partial<UseMapRoutingResult> = {}): UseMapRoutingResult => ({
  loading: false,
  error: null,
  distance: 24_300,
  duration: 2_040,
  coords: routedCoords(30),
  elevationGain: 145,
  elevationLoss: 132,
  elevationSamples: null,
  ...overrides,
})

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Минск — Несвиж',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'Минск', description: null, coordinates: [27.5615, 53.9023], placeId: null },
    { id: 'b', type: 'custom', name: 'Несвиж', description: null, coordinates: [26.6906, 53.2225], placeId: null },
    { id: 'c', type: 'custom', name: 'Мир', description: null, coordinates: [26.4731, 53.4512], placeId: null },
  ],
  routeGeometry: [
    [27.5615, 53.9023],
    [27.1, 53.6],
    [26.6906, 53.2225],
  ],
  routeSummary: {
    distanceKm: 118.2,
    durationMin: 96,
    elevationGainM: 240,
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

/** Правка маршрута без сохранения: точки перестают совпадать с серверными. */
const editRoute = (getByTestId: (id: string) => unknown) => {
  fireEvent.press(getByTestId('route-builder-move-up-1') as never)
}

const settleDebounce = () => {
  act(() => {
    jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS)
  })
}

const deliver = (result: UseMapRoutingResult) => {
  act(() => {
    mockEngine.onResult?.(result)
  })
}


// #1491: шаг «Точки маршрута» рендерит общий AddressSearch с /map, а он ходит за
// адресами через React Query — конструктору нужен клиент, как и в приложении.
const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe('RouteBuilder live route preview', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockEngine.mounts = []
    mockEngine.callbacks = []
    mockEngine.onResult = null
    mockRouteElevationQuery = { data: mockMissingElevationGeometry, isFetching: false }
    mockRefreshRouteElevation.mockReset()
    mockSaveRouteExportFile.mockReset()
    mockSaveRouteExportFile.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('leaves the saved route to the backend and does not build anything', () => {
    const { queryByTestId, getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    expect(queryByTestId('trip-route-preview-engine')).toBeNull()
    expect(getByTestId('route-map-geometry').props.children).toBe('3')
    expect(getByTestId('route-map-provider').props.children).toBe('ors')
  })

  it('repairs a saved healthy state without geometry as one display tuple', async () => {
    const { getByTestId, queryByTestId, queryByText } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ routeGeometry: null })} />,
    )

    // The persisted ORS label and summary cannot survive independently from
    // their missing polyline. The repair engine receives the unchanged saved
    // coordinates immediately; until it answers the complete tuple is empty.
    expect(getByTestId('trip-route-preview-engine')).toBeTruthy()
    expect(mockEngine.mounts[0]).toEqual({
      points: [
        [27.5615, 53.9023],
        [26.6906, 53.2225],
        [26.4731, 53.4512],
      ],
      transportMode: 'car',
    })
    expect(getByTestId('route-map-geometry').props.children).toBe('0')
    expect(getByTestId('route-map-provider').props.children).toBe('none')
    expect(queryByTestId('route-summary-routed')).toBeNull()
    expect(queryByText('Маршрут построен ORS')).toBeNull()
    expect(queryByText('118 км')).toBeNull()

    deliver(engineResult())

    // One result replaces geometry, state and summary together. Export uses
    // that same dense preview geometry instead of the stale saved metadata.
    expect(getByTestId('route-map-geometry').props.children).toBe('30')
    expect(getByTestId('route-map-provider').props.children).toBe('preview')
    expect(queryByTestId('route-summary-routed')).toBeTruthy()
    expect(queryByText('Маршрут построен по дорогам')).toBeTruthy()
    expect(queryByText('24 км')).toBeTruthy()
    expect(queryByText('118 км')).toBeNull()

    fireEvent.press(getByTestId('trip-route-export-gpx'))
    await act(async () => undefined)

    expect(mockSaveRouteExportFile).toHaveBeenCalledTimes(1)
    const exported = mockSaveRouteExportFile.mock.calls[0][0] as { content: string }
    expect((exported.content.match(/<trkpt/g) ?? [])).toHaveLength(30)
  })

  it('fails closed when repair routing fails and keeps retry available', () => {
    const { getByTestId, queryByTestId, queryByText } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ routeGeometry: null })} />,
    )

    deliver(engineResult({ error: 'Сервис маршрутов недоступен' }))

    expect(getByTestId('route-map-geometry').props.children).toBe('0')
    expect(getByTestId('route-map-provider').props.children).toBe('direct')
    expect(queryByTestId('route-summary-routed')).toBeNull()
    expect(queryByTestId('route-summary-approximate')).toBeTruthy()
    expect(queryByText('Маршрут построен ORS')).toBeNull()
    expect(queryByText('118 км')).toBeNull()
    expect(queryByText('Прямая линия')).toBeTruthy()

    const mountsBeforeRetry = mockEngine.mounts.length
    fireEvent.press(queryByText('Повторить') as never)

    expect(mockEngine.mounts.length).toBeGreaterThan(mountsBeforeRetry)
    expect(queryByText('Прямая линия')).toBeNull()
    expect(getByTestId('route-map-provider').props.children).toBe('none')
  })

  it('waits for the persisted elevation geometry source before starting repair', () => {
    mockRouteElevationQuery = {
      data: {
        ...mockMissingElevationGeometry,
        geometry: [
          [10, 50],
          [11, 51],
        ],
      },
      isFetching: true,
    }
    const trip = makeTrip({ routeGeometry: null })
    const { getByTestId, queryByTestId, queryByText, rerender } = renderRouteBuilder(
      <RouteBuilder trip={trip} />,
    )

    expect(queryByTestId('trip-route-preview-engine')).toBeNull()
    expect(getByTestId('route-map-geometry').props.children).toBe('0')
    expect(getByTestId('route-map-provider').props.children).toBe('none')
    expect(queryByText('Маршрут построен ORS')).toBeNull()
    expect(queryByText('118 км')).toBeNull()

    mockRouteElevationQuery = { data: mockMissingElevationGeometry, isFetching: false }
    rerender(<RouteBuilder trip={{ ...trip }} />)

    expect(queryByTestId('trip-route-preview-engine')).toBeTruthy()
    expect(mockEngine.mounts).toHaveLength(1)
  })

  it('does not POST an elevation refresh while its GET is still in flight', () => {
    mockRouteElevationQuery = {
      data: mockMissingElevationGeometry,
      isFetching: true,
    }
    const trip = makeTrip()
    const { rerender } = renderRouteBuilder(<RouteBuilder trip={trip} />)

    expect(mockRefreshRouteElevation).not.toHaveBeenCalled()

    mockRouteElevationQuery = { data: mockMissingElevationGeometry, isFetching: false }
    rerender(<RouteBuilder trip={{ ...trip }} />)

    expect(mockRefreshRouteElevation).toHaveBeenCalledTimes(1)
    expect(mockRefreshRouteElevation).toHaveBeenCalledWith({ tripId: trip.id })
  })

  it('does not call a backend summary a local estimate when routing state is absent', () => {
    const { getByTestId, queryByText } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ routingState: null })} />,
    )

    expect(queryByText('Локальная оценка')).toBeNull()
    expect(within(getByTestId('route-summary')).queryByText('118 км')).toBeTruthy()
  })

  it('waits out the debounce before asking the routing engine', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    editRoute(getByTestId)

    // Микро-правки не должны бить по провайдерам маршрутизации на каждый шаг.
    expect(queryByTestId('trip-route-preview-engine')).toBeNull()
    expect(getByTestId('route-map-geometry').props.children).toBe('0')

    settleDebounce()

    expect(queryByTestId('trip-route-preview-engine')).not.toBeNull()
    expect(getByTestId('preview-engine-mode').props.children).toBe('car')
    expect(getByTestId('preview-engine-points').props.children).toBe('3')
    expect(mockEngine.mounts).toHaveLength(1)
    // move-up сдвинул Несвиж на первое место — движок получает уже новый порядок.
    expect(mockEngine.mounts[0].points).toEqual([
      [26.6906, 53.2225],
      [27.5615, 53.9023],
      [26.4731, 53.4512],
    ])
  })

  it('draws the routed geometry and shows engine numbers without saving', () => {
    const { getByTestId, queryByText } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    editRoute(getByTestId)
    settleDebounce()
    deliver(engineResult())

    expect(getByTestId('route-map-geometry').props.children).toBe('30')
    expect(getByTestId('route-map-provider').props.children).toBe('preview')
    expect(getByTestId('route-summary-routed')).toBeTruthy()
    expect(queryByText('Маршрут построен по дорогам')).toBeTruthy()
    // 24 300 м / 2 040 с из ответа движка, а не оценка по прямой.
    expect(queryByText('24 км')).toBeTruthy()
    expect(queryByText('34 мин')).toBeTruthy()
    expect(queryByText('145 м')).toBeTruthy()
    // Счётчик остановок совпадает с серверным: те же три точки — то же число.
    expect(within(getByTestId('route-summary')).queryByText('3')).toBeTruthy()
  })

  it('routes a fourth coordinate point and updates the stops chip without saving', () => {
    const { getByTestId, queryByText } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'QA Android point')
    fireEvent.changeText(getByTestId('route-builder-lat'), '53.8400')
    fireEvent.changeText(getByTestId('route-builder-lng'), '27.7200')
    fireEvent.press(getByTestId('route-builder-add'))
    settleDebounce()

    expect(getByTestId('preview-engine-points').props.children).toBe('4')
    expect(mockEngine.mounts.at(-1)?.points).toEqual([
      [27.5615, 53.9023],
      [26.6906, 53.2225],
      [26.4731, 53.4512],
      [27.72, 53.84],
    ])

    deliver(engineResult())

    expect(getByTestId('route-map-provider').props.children).toBe('preview')
    expect(getByTestId('route-map-geometry').props.children).toBe('30')
    expect(within(getByTestId('route-summary')).queryByText('4')).toBeTruthy()
    expect(queryByText('Маршрут построен по дорогам')).toBeTruthy()
    expect(queryByText('Локальная оценка')).toBeNull()
  })

  it('announces a direct line with a retry instead of passing it off as a route', () => {
    const { getByTestId, queryByTestId, queryByText } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    editRoute(getByTestId)
    settleDebounce()
    deliver(engineResult({ error: 'Сервис маршрутов недоступен' }))

    expect(queryByText('Прямая линия')).toBeTruthy()
    expect(getByTestId('route-map-geometry').props.children).toBe('0')
    expect(getByTestId('route-map-provider').props.children).toBe('direct')
    expect(queryByTestId('route-summary-approximate')).not.toBeNull()

    // Повтор — это заново смонтированный движок: деградированный ответ намеренно
    // не кэшируется, поэтому свежий монтаж снова идёт к провайдерам.
    const mountsBefore = mockEngine.mounts.length
    fireEvent.press(queryByText('Повторить') as never)

    expect(mockEngine.mounts.length).toBeGreaterThan(mountsBefore)
    expect(queryByText('Прямая линия')).toBeNull()
  })

  it('drops a stale answer as soon as the route changes again', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    editRoute(getByTestId)
    settleDebounce()
    deliver(engineResult())
    expect(getByTestId('route-map-geometry').props.children).toBe('30')

    fireEvent.press(getByTestId('route-builder-delete-2'))

    // Ответ описывает уже другой набор точек — держать его на карте нельзя.
    expect(getByTestId('route-map-geometry').props.children).toBe('0')
  })

  it('rejects a late answer from the engine mounted for the previous points', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    editRoute(getByTestId)
    settleDebounce()
    const staleCallback = mockEngine.callbacks.at(-1)

    fireEvent.press(getByTestId('route-builder-delete-2'))
    settleDebounce()
    const currentCallback = mockEngine.callbacks.at(-1)
    expect(currentCallback).not.toBe(staleCallback)

    act(() => {
      staleCallback?.(engineResult())
    })
    expect(getByTestId('route-map-geometry').props.children).toBe('0')

    act(() => {
      currentCallback?.(engineResult())
    })
    expect(getByTestId('route-map-geometry').props.children).toBe('30')
  })

  it('rejects a late answer from the previous retry attempt', () => {
    const { getByTestId, queryByText } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    editRoute(getByTestId)
    settleDebounce()
    const staleCallback = mockEngine.callbacks.at(-1)
    act(() => {
      staleCallback?.(engineResult({ error: 'routing failed' }))
    })

    fireEvent.press(queryByText('Повторить') as never)
    const currentCallback = mockEngine.callbacks.at(-1)
    expect(currentCallback).not.toBe(staleCallback)

    act(() => {
      currentCallback?.(engineResult())
      staleCallback?.(engineResult({ error: 'late failure' }))
    })
    expect(getByTestId('route-map-geometry').props.children).toBe('30')
  })

  it('updates the elevation profile together with the preview', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ transport: 'bike' })} />,
    )

    editRoute(getByTestId)
    settleDebounce()
    expect(queryByTestId('route-elevation-profile')).toBeNull()

    deliver(
      engineResult({
        elevationSamples: [
          { index: 0, elevationM: 200 },
          { index: 14, elevationM: 268 },
          { index: 29, elevationM: 214 },
        ],
      }),
    )

    expect(queryByTestId('route-elevation-profile')).not.toBeNull()
    expect(getByTestId('route-elevation-samples').props.children).toBe('3')
  })

  it('keeps the saved route when only a point label changed', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Минск (старт)')
    fireEvent.press(getByTestId('route-builder-edit-save'))
    settleDebounce()

    // Геометрия зависит от координат, а не от подписи: опечатка в названии не
    // повод снимать сохранённую дорогу и жечь запрос к лимитированному ORS.
    expect(queryByTestId('trip-route-preview-engine')).toBeNull()
    expect(mockEngine.mounts).toHaveLength(0)
    expect(getByTestId('route-map-geometry').props.children).toBe('3')
    expect(getByTestId('route-map-provider').props.children).toBe('ors')
  })

  it('keeps showing progress until the engine actually answers', () => {
    const { getByTestId, queryByText } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    editRoute(getByTestId)
    settleDebounce()

    // Свежесмонтированный useRouting сначала отдаёт пустое состояние — свой
    // дебаунс он ещё не отработал. Считать это готовым маршрутом нельзя.
    deliver(engineResult({ loading: false, distance: 0, duration: 0, coords: [] }))

    expect(queryByText('Построение маршрута…')).toBeTruthy()
    expect(getByTestId('route-map-provider').props.children).toBe('none')
  })

  it('counts a coordinate-less point in the stops chip right away', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    expect(within(getByTestId('route-summary')).queryByText('3')).toBeTruthy()

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Кофе по дороге')
    fireEvent.press(getByTestId('route-builder-add'))
    settleDebounce()

    // Дорога не поменялась — серверные геометрия и цифры на месте, движок молчит.
    expect(queryByTestId('trip-route-preview-engine')).toBeNull()
    expect(getByTestId('route-map-geometry').props.children).toBe('3')
    // Но точка в списке уже есть, и счётчик остановок обязан её видеть.
    expect(within(getByTestId('route-summary')).queryByText('4')).toBeTruthy()
  })

  it('never auto-routes public transport and says the line is schematic', () => {
    const { getByTestId, queryByTestId, queryByText } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ transport: 'public', routingState: null })} />,
    )

    editRoute(getByTestId)
    settleDebounce()

    expect(queryByTestId('trip-route-preview-engine')).toBeNull()
    expect(getByTestId('route-map-provider').props.children).toBe('schematic')
    expect(getByTestId('route-map-geometry').props.children).toBe('0')
    // Остановки посчитать можно, расстояние общественным транспортом — нет.
    expect(queryByText('Схематичная линия')).toBeTruthy()
    expect(queryByTestId('route-summary-approximate')).not.toBeNull()
    expect(within(getByTestId('route-summary')).queryByText('3')).toBeTruthy()
  })
})
