// #1495: мобильная раскладка вкладки «Маршрут» — карта на весь экран и шторка
// с тремя положениями. Здесь проверяется механика самой шторки (снапы, чипы,
// подъём под форму правки) и то, что RouteBuilder действительно раскладывает в
// неё реальные секции панели, а не теряет их по дороге.
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet, Text, View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import RouteBuilderMapFirst, {
  type RouteSheetSnap,
} from '@/components/trips/planning/RouteBuilderMapFirst'

const windowDimensionsMock = require('react-native').useWindowDimensions as jest.Mock

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

jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFile: () => ({ data: null }),
  usePlannedTripOriginalTrack: () => ({ data: null }),
  useUploadPlannedTripRouteFile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlannedTripRouteFile: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
  trackRoutePointAdded: jest.fn(),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View: RNView } = require('react-native')
    return <RNView />
  }
})

jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    const { View: RNView } = require('react-native')
    return <RNView testID="trip-route-preview-engine" />
  }
})

// Карта заглушена, но отдаёт наружу то, чем управляет раскладка: растянута ли
// она на сцену (`fill`) и какую точку её попросили показать (`focusPoint`).
jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({
    fill,
    focusPoint,
    onAddPointFromMap,
  }: {
    fill?: boolean
    focusPoint?: { lat: number; lng: number; token: number } | null
    onAddPointFromMap?: (coords: { lat: number; lng: number }) => void
  }) {
    const { Pressable, Text: RNText, View: RNView } = require('react-native')
    return (
      <RNView testID="trip-plan-route-map">
        <RNText testID="route-map-fill">{String(!!fill)}</RNText>
        <RNText testID="route-map-focus">
          {focusPoint ? `${focusPoint.lat},${focusPoint.lng}` : 'none'}
        </RNText>
        <Pressable
          testID="route-map-click"
          onPress={() => onAddPointFromMap?.({ lat: 53.95, lng: 27.61 })}
        />
      </RNView>
    )
  }
})

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Поездка',
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
    {
      id: 'p0',
      type: 'custom',
      name: 'Старт',
      description: null,
      coordinates: [27.5, 53.9],
      placeId: null,
    },
    {
      id: 'p1',
      type: 'custom',
      name: 'Финиш',
      description: null,
      coordinates: [27.7, 54.1],
      placeId: null,
    },
  ],
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
  ...overrides,
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const renderBuilder = (layout?: 'stack' | 'mapFirst') =>
  render(<RouteBuilder trip={makeTrip()} layout={layout} />, { wrapper: createWrapper() })

const renderSheet = (props: Partial<React.ComponentProps<typeof RouteBuilderMapFirst>> = {}) => {
  const onSnapChange = jest.fn<void, [RouteSheetSnap]>()
  const utils = render(
    <RouteBuilderMapFirst
      mapSlot={<View testID="slot-map" />}
      transportSlot={<Text>Транспорт</Text>}
      pointsSlot={<Text>Точки</Text>}
      summarySlot={<Text>Итог</Text>}
      toolsSlot={<Text>Инструменты</Text>}
      summary={{ distanceKm: 12.4, durationMin: 42, elevationGainM: 0, stopsCount: 2 }}
      routingState={null}
      transport="car"
      editingIndex={null}
      focusToken={0}
      onSnapChange={onSnapChange}
      {...props}
    />,
  )
  return { ...utils, onSnapChange }
}

beforeEach(() => {
  windowDimensionsMock.mockReturnValue({ width: 1024, height: 768, scale: 1, fontScale: 1 })
})

describe('RouteBuilderMapFirst — шторка маршрута', () => {
  it('держит все четыре секции панели и чипы поверх карты', () => {
    const { getByTestId } = renderSheet()

    expect(getByTestId('slot-map')).toBeTruthy()
    expect(getByTestId('route-sheet')).toBeTruthy()
    expect(getByTestId('route-map-chip-transport')).toBeTruthy()
    expect(getByTestId('route-map-chip-summary')).toBeTruthy()
    expect(getByTestId('route-sheet-section-transport')).toBeTruthy()
    expect(getByTestId('route-sheet-section-points')).toBeTruthy()
    expect(getByTestId('route-sheet-section-summary')).toBeTruthy()
    expect(getByTestId('route-sheet-section-tools')).toBeTruthy()
  })

  it('в свёрнутом положении показывает строку итога', () => {
    const { getByTestId } = renderSheet()

    expect(getByTestId('route-sheet-peek')).toHaveTextContent('12 км', { exact: false })
    expect(getByTestId('route-sheet-peek')).toHaveTextContent('42 мин', { exact: false })
  })

  it('ручка проводит шторку по трём положениям и возвращает в свёрнутое', () => {
    const { getByTestId, onSnapChange } = renderSheet()

    fireEvent.press(getByTestId('route-sheet-handle'))
    expect(onSnapChange).toHaveBeenLastCalledWith('points')

    fireEvent.press(getByTestId('route-sheet-handle'))
    expect(onSnapChange).toHaveBeenLastCalledWith('full')

    fireEvent.press(getByTestId('route-sheet-handle'))
    expect(onSnapChange).toHaveBeenLastCalledWith('summary')
  })

  it('строка итога раскрывает шторку до списка точек и складывает обратно', () => {
    const { getByTestId, onSnapChange } = renderSheet()

    fireEvent.press(getByTestId('route-sheet-peek'))
    expect(onSnapChange).toHaveBeenLastCalledWith('points')

    fireEvent.press(getByTestId('route-sheet-peek'))
    expect(onSnapChange).toHaveBeenLastCalledWith('summary')
  })

  it('чипы транспорта и итога раскрывают шторку до полной панели', () => {
    const { getByTestId, onSnapChange } = renderSheet()

    fireEvent.press(getByTestId('route-map-chip-transport'))
    expect(onSnapChange).toHaveBeenLastCalledWith('full')

    fireEvent.press(getByTestId('route-sheet-handle'))
    onSnapChange.mockClear()

    fireEvent.press(getByTestId('route-map-chip-summary'))
    expect(onSnapChange).toHaveBeenLastCalledWith('full')
  })

  it('открытая форма правки точки поднимает шторку до инструментов', () => {
    const { rerender, onSnapChange } = renderSheet()

    rerender(
      <RouteBuilderMapFirst
        mapSlot={<View testID="slot-map" />}
        transportSlot={<Text>Транспорт</Text>}
        pointsSlot={<Text>Точки</Text>}
        summarySlot={<Text>Итог</Text>}
        toolsSlot={<Text>Инструменты</Text>}
        summary={null}
        routingState={null}
        transport="car"
        editingIndex={1}
        focusToken={0}
        onSnapChange={onSnapChange}
      />,
    )

    expect(onSnapChange).toHaveBeenLastCalledWith('full')
  })

  it('без маршрута строка итога честно говорит, что его ещё нет', () => {
    const { getByTestId } = renderSheet({ summary: null })

    expect(getByTestId('route-sheet-peek')).toHaveTextContent('Маршрут ещё не построен', {
      exact: false,
    })
  })

  it('на узком экране чипы стоят между зумом и кнопками карты, подсказка — ниже', () => {
    windowDimensionsMock.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 })

    const { getByTestId } = renderSheet({ mapHint: 'Нажмите на карту' })

    expect(getByTestId('route-map-chip-summary')).toBeTruthy()
    expect(getByTestId('route-map-chip-transport')).toBeTruthy()
    // Зум Leaflet занимает x 10..56, «Слои»/«Развернуть» — 106 от правого края:
    // ряд обязан помещаться между ними, иначе чип ложится на кнопку «−» (#1690).
    expect(StyleSheet.flatten(getByTestId('route-map-chips').props.style)).toMatchObject({
      top: 10,
      left: 62,
      right: 108,
    })
    expect(StyleSheet.flatten(getByTestId('route-map-chip-controls').props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'nowrap',
    })
    expect(StyleSheet.flatten(getByTestId('route-map-hint').props.style)).toMatchObject({
      width: '100%',
    })
    expect(getByTestId('route-sheet-peek')).toHaveTextContent('12 км', { exact: false })
  })

  it('чип транспорта — квадратная иконка без подписи', () => {
    windowDimensionsMock.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 })

    const { getByTestId } = renderSheet({ transport: 'foot' })

    const chip = getByTestId('route-map-chip-transport')
    expect(StyleSheet.flatten(chip.props.style)).toMatchObject({
      width: 44,
      minHeight: 44,
      paddingHorizontal: 0,
    })
    // Подпись ушла в accessibilityLabel: глиф пешехода читается и без текста,
    // а полный выбор режима открывается тапом в шторке.
    expect(chip).not.toHaveTextContent('Пешком')
    expect(chip.props.accessibilityLabel).toContain('Пешком')
  })
})

// #1691: раскладку `mapFirst` собирает уже не шторка, а RouteBuilderMobile —
// карта блоком в потоке страницы. Контракт самой раскладки держит
// `routeBuilderMobile.test.tsx`; здесь остаётся связка «карта ↔ панель».
describe('RouteBuilder layout=mapFirst', () => {
  it('растягивает карту и держит панель обычным контентом под ней', () => {
    const { getByTestId, queryByTestId } = renderBuilder('mapFirst')

    expect(getByTestId('route-map-fill').props.children).toBe('true')
    expect(getByTestId('route-mobile-map')).toBeTruthy()
    // Транспорт, точки и добавление доехали до панели целиком.
    expect(getByTestId('route-builder-transport-control')).toBeTruthy()
    expect(getByTestId('route-builder-point-0')).toBeTruthy()
    // Добавление раскрывается по запросу: длинная форма не вытесняет точки и
    // итог, пока пользователь не выбрал это действие.
    expect(getByTestId('route-builder-add-action')).toBeTruthy()
    expect(queryByTestId('route-builder-add-form')).toBeNull()
    expect(queryByTestId('route-builder-site-search')).toBeNull()

    fireEvent.press(getByTestId('route-builder-add-action'))

    // Первый тип — «место», поэтому раскрытая add-форма показывает поиск, а не
    // ручной submit `route-builder-add`.
    expect(getByTestId('route-builder-add-form')).toBeTruthy()
    expect(getByTestId('route-builder-site-search')).toBeTruthy()
    expect(getByTestId('route-summary')).toBeTruthy()
    // #1491: кнопка действия появляется только при несохранённых правках,
    // поэтому на нетронутом маршруте её нет ни в стеке, ни в шторке.
    expect(queryByTestId('route-builder-save')).toBeNull()
  })

  it('тап по точке в списке центрует карту на её координатах', () => {
    const { getByTestId } = renderBuilder('mapFirst')

    expect(getByTestId('route-map-focus').props.children).toBe('none')

    fireEvent.press(getByTestId('route-builder-focus-1'))

    expect(getByTestId('route-map-focus').props.children).toBe('54.1,27.7')
  })

  it('точка, добавленная тапом по карте, открывает форму переименования', () => {
    const { getByTestId } = renderBuilder('mapFirst')

    fireEvent.press(getByTestId('route-map-click'))

    expect(getByTestId('route-builder-edit-form')).toBeTruthy()
    expect(getByTestId('route-builder-edit-lat').props.value).toBe('53.95')
    expect(getByTestId('route-builder-edit-lng').props.value).toBe('27.61')
  })

  it('вертикальная раскладка остаётся без мобильного блока и без центрирования по тапу', () => {
    const { getByTestId, queryByTestId } = renderBuilder()

    expect(queryByTestId('route-mobile-map')).toBeNull()
    expect(queryByTestId('route-builder-focus-1')).toBeNull()
    expect(getByTestId('route-map-fill').props.children).toBe('false')
  })
})
