// #2058: дни в шаге «Точки маршрута» сворачиваются при > 15 точках, заголовок
// дня — кнопка, день показывается на карте (`trips-plan-route-tab-mock.md` §3).
import React from 'react'
import { act, fireEvent, render, within } from '@testing-library/react-native'

import type { PlannedTrip, RoutePoint } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import type { MapFocusIndices } from '@/components/trips/planning/tripPlanRouteMap.types'
import { translate as i18nT } from '@/i18n'
import { formatTripDateLong, formatTripDayMonth } from '@/utils/tripDateTime'
import { createQueryWrapper } from '../../helpers/testQueryClient'

type MapProps = {
  focusIndices?: MapFocusIndices | null
  onEditPoint?: (index: number) => void
  onAddPointFromMap?: (coords: { lat: number; lng: number }) => void
}
const mockMapProps: MapProps[] = []

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

// Один массив на все рендеры: новая ссылка на каждый рендер гоняла бы карту.
const mockNoTrackSegments: Array<Array<[number, number]>> = []
jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFiles: () => ({ data: undefined }),
  usePlannedTripOriginalTracks: () => mockNoTrackSegments,
  useUploadPlannedTripRouteFile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlannedTripRouteFile: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
  trackRoutePointAdded: jest.fn(),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    return null
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap(props: MapProps) {
    mockMapProps.push(props)
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

jest.mock('@/components/trips/planning/TripRouteImportPanel', () => {
  return function TripRouteImportPanel() {
    return null
  }
})

jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch() {
    return null
  }
})

// Фикстура крупной поездки в миниатюре: 61 точка в 17 днях, как trip 47.
const DAY_SIZES = [1, 3, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3]

const largeRoute = (): RoutePoint[] => {
  const route: RoutePoint[] = []
  DAY_SIZES.forEach((size, dayIndex) => {
    for (let slot = 0; slot < size; slot += 1) {
      const index = route.length
      route.push({
        id: `p${index}`,
        type: 'custom',
        name: `Точка ${index + 1}`,
        description: null,
        coordinates: [11 + dayIndex * 0.1 + slot * 0.01, 47.5 + slot * 0.01],
        placeId: null,
        dayNumber: dayIndex + 1,
      })
    }
  })
  return route
}

/** Индексы точек дня `day` в `largeRoute()`. */
const dayIndices = (day: number): number[] => {
  const start = DAY_SIZES.slice(0, day - 1).reduce((sum, size) => sum + size, 0)
  return Array.from({ length: DAY_SIZES[day - 1] }, (_, offset) => start + offset)
}

const makeTrip = (route: RoutePoint[]): PlannedTrip => ({
  id: 47,
  slug: '47',
  title: 'Альпы',
  description: '',
  startDate: '2026-09-25',
  endDate: null,
  startTime: '09:00',
  transport: 'foot',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route,
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-08-08T08:00:00Z',
})

const renderBuilder = (route: RoutePoint[], layout: 'stack' | 'mapFirst') =>
  render(<RouteBuilder trip={makeTrip(route)} layout={layout} />, {
    wrapper: createQueryWrapper().Wrapper,
  })

const lastMapProps = () => mockMapProps[mockMapProps.length - 1] ?? {}

describe.each(['stack', 'mapFirst'] as const)('RouteBuilder: свёртка дней (%s)', (layout) => {
  beforeEach(() => {
    mockMapProps.length = 0
  })

  it('> 15 точек: все 17 дней свёрнуты, строки точек не смонтированы', () => {
    const { getByTestId, queryByTestId } = renderBuilder(largeRoute(), layout)

    for (let day = 1; day <= DAY_SIZES.length; day += 1) {
      expect(getByTestId(`route-builder-day-toggle-${day}`).props.accessibilityState).toEqual({
        expanded: false,
      })
    }
    expect(queryByTestId('route-builder-point-0')).toBeNull()
    expect(queryByTestId('route-builder-point-60')).toBeNull()
  })

  it('заголовок дня: номер, дата, число точек с plural и дистанция дня', () => {
    const { getByTestId } = renderBuilder(largeRoute(), layout)

    const dayOne = getByTestId('route-builder-day-toggle-1')
    expect(dayOne.props.accessibilityRole).toBe('button')
    expect(dayOne.props.accessibilityLabel).toContain(formatTripDateLong('2026-09-25'))
    expect(dayOne.props.accessibilityLabel).toContain('1 точка')
    expect(getByTestId('route-builder-day-toggle-2').props.accessibilityLabel).toContain('3 точки')
    const dayThree = getByTestId('route-builder-day-toggle-3')
    expect(dayThree.props.accessibilityLabel).toContain('6 точек')

    // Видимая строка: «День 3 · 27 сентября · 6 точек · N км».
    const heading = i18nT('tripsStatic:plan.routeDay.heading', { day: 3 })
    expect(
      within(dayThree).getByText(
        new RegExp(`^${heading} · ${formatTripDayMonth('2026-09-27')} · 6 точек · [\\d,\\s]+км$`),
      ),
    ).toBeTruthy()
    // У дня из одной точки дистанции нет — «0 км» не печатается.
    expect(
      within(dayOne).getByText(
        `${i18nT('tripsStatic:plan.routeDay.heading', { day: 1 })} · ${formatTripDayMonth('2026-09-25')} · 1 точка`,
      ),
    ).toBeTruthy()
  })

  it('касание заголовка раскрывает и сворачивает только свой день', () => {
    const { getByTestId, queryByTestId } = renderBuilder(largeRoute(), layout)

    fireEvent.press(getByTestId('route-builder-day-toggle-3'))

    expect(getByTestId('route-builder-day-toggle-3').props.accessibilityState).toEqual({ expanded: true })
    for (const index of dayIndices(3)) expect(getByTestId(`route-builder-point-${index}`)).toBeTruthy()
    expect(queryByTestId(`route-builder-point-${dayIndices(4)[0]}`)).toBeNull()

    fireEvent.press(getByTestId('route-builder-day-toggle-3'))
    expect(queryByTestId(`route-builder-point-${dayIndices(3)[0]}`)).toBeNull()
  })

  it('точка, выбранная на карте для правки, раскрывает свой день', () => {
    const { getByTestId } = renderBuilder(largeRoute(), layout)
    const target = dayIndices(9)[2]

    act(() => {
      lastMapProps().onEditPoint?.(target)
    })

    expect(getByTestId('route-builder-day-toggle-9').props.accessibilityState).toEqual({ expanded: true })
    expect(getByTestId(`route-builder-point-${target}`)).toBeTruthy()
    expect(getByTestId('route-builder-edit-form')).toBeTruthy()
  })

  it('день, куда только что добавили точку, раскрыт', () => {
    const { getByTestId } = renderBuilder(largeRoute(), layout)

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Новая точка')
    fireEvent.changeText(getByTestId('route-builder-lat'), '47.6')
    fireEvent.changeText(getByTestId('route-builder-lng'), '11.2')
    fireEvent.press(getByTestId('route-builder-add'))

    expect(getByTestId('route-builder-day-toggle-unassigned').props.accessibilityState).toEqual({
      expanded: true,
    })
    expect(getByTestId('route-builder-point-61')).toBeTruthy()
    expect(getByTestId('route-builder-day-toggle-1').props.accessibilityState).toEqual({ expanded: false })
  })

  it('≤ 15 точек: список как раньше — без кнопок свёртки и без «на карте»', () => {
    const route = largeRoute().slice(0, 10)
    const { getByTestId, queryByTestId } = renderBuilder(route, layout)

    expect(getByTestId('route-builder-day-group-3')).toBeTruthy()
    expect(queryByTestId('route-builder-day-toggle-3')).toBeNull()
    expect(queryByTestId('route-builder-day-map-3')).toBeNull()
    for (let index = 0; index < route.length; index += 1) {
      expect(getByTestId(`route-builder-point-${index}`)).toBeTruthy()
    }
  })
})

describe('RouteBuilder: день на карте', () => {
  beforeEach(() => {
    mockMapProps.length = 0
  })

  it('desktop: разворот дня отдаёт карте индексы точек дня, сворачивание — нет', () => {
    const { getByTestId, queryByTestId } = renderBuilder(largeRoute(), 'stack')

    expect(lastMapProps().focusIndices ?? null).toBeNull()
    expect(queryByTestId('route-builder-day-map-3')).toBeNull()

    fireEvent.press(getByTestId('route-builder-day-toggle-3'))
    const focus = lastMapProps().focusIndices
    expect(focus?.indices).toEqual(dayIndices(3))

    fireEvent.press(getByTestId('route-builder-day-toggle-3'))
    expect(lastMapProps().focusIndices).toBe(focus)

    fireEvent.press(getByTestId('route-builder-day-toggle-3'))
    expect(lastMapProps().focusIndices?.token).toBeGreaterThan(focus?.token ?? 0)
  })

  it('mobile: разворот карту не трогает, «на карте» подгоняет её под день', () => {
    const { getByTestId } = renderBuilder(largeRoute(), 'mapFirst')

    fireEvent.press(getByTestId('route-builder-day-toggle-5'))
    expect(lastMapProps().focusIndices ?? null).toBeNull()

    const showOnMap = getByTestId('route-builder-day-map-5')
    expect(showOnMap.props.accessibilityLabel).toBe(
      i18nT('tripsStatic:plan.routeDay.showOnMap', { day: 5 }),
    )
    fireEvent.press(showOnMap)
    expect(lastMapProps().focusIndices?.indices).toEqual(dayIndices(5))
    // Сам день «на карте» не раскрывает и не сворачивает.
    expect(getByTestId('route-builder-day-toggle-5').props.accessibilityState).toEqual({ expanded: true })
    expect(getByTestId('route-builder-day-toggle-6').props.accessibilityState).toEqual({ expanded: false })
  })
})

describe('RouteBuilder: свёртка дней у участника поездки', () => {
  beforeEach(() => {
    mockMapProps.length = 0
  })

  const renderGuest = (layout: 'stack' | 'mapFirst') =>
    render(<RouteBuilder trip={{ ...makeTrip(largeRoute()), isOwner: false }} layout={layout} />, {
      wrapper: createQueryWrapper().Wrapper,
    })

  it.each(['stack', 'mapFirst'] as const)('%s: дни свёрнуты и раскрываются, «на карте» нет', (layout) => {
    const { getByTestId, queryByTestId } = renderGuest(layout)

    expect(getByTestId('route-builder-day-toggle-3').props.accessibilityState).toEqual({ expanded: false })
    expect(queryByTestId(`route-builder-point-${dayIndices(3)[0]}`)).toBeNull()
    expect(queryByTestId('route-builder-day-map-3')).toBeNull()

    fireEvent.press(getByTestId('route-builder-day-toggle-3'))
    for (const index of dayIndices(3)) expect(getByTestId(`route-builder-point-${index}`)).toBeTruthy()
  })

  it('desktop: разворот дня подгоняет карту участника под точки дня', () => {
    const { getByTestId } = renderGuest('stack')

    fireEvent.press(getByTestId('route-builder-day-toggle-4'))
    expect(lastMapProps().focusIndices?.indices).toEqual(dayIndices(4))
  })
})
