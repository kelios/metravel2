import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native'
import { BackHandler, Platform, StyleSheet, View } from 'react-native'

import { MapMobileLayout } from '@/components/MapPage/MapMobileLayout'
import { getSearchAreaButtonBottom } from '@/components/MapPage/MapMobileLayout.styles'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'

const mockTravelListPanel = jest.fn((props: any) => {
  const React = require('react')
  const { Pressable, View, Text } = require('react-native')
  return (
    <View testID="mock-travel-list-panel">
      <Text>{props.isLoading ? 'Travel list loading' : 'Travel list'}</Text>
      {props.onOpenFilters ? (
        <Pressable testID="mock-list-open-filters" onPress={props.onOpenFilters}>
          <Text>Open filters</Text>
        </Pressable>
      ) : null}
    </View>
  )
})
const mockMapPlaceBottomCard = jest.fn()

const mockMapBottomSheet = jest.fn()
const mockSnapToCollapsed = jest.fn()
const mockSnapToQuarter = jest.fn()
const mockSnapToHalf = jest.fn()
const mockSnapToSeventy = jest.fn()
const mockSnapToFull = jest.fn()
const mockClose = jest.fn()

jest.mock('expo-router', () => ({
  usePathname: () => '/map',
}))

jest.mock('react-native-gesture-handler', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    GestureHandlerRootView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  }
})

jest.mock('@/components/MapPage/MapBottomSheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    __esModule: true,
    default: React.forwardRef(({ children, ...props }: any, ref) => {
      React.useImperativeHandle(ref, () => ({
        snapToCollapsed: mockSnapToCollapsed,
        snapToQuarter: mockSnapToQuarter,
        snapToHalf: mockSnapToHalf,
        snapToSeventy: mockSnapToSeventy,
        snapToFull: mockSnapToFull,
        close: mockClose,
      }))
      mockMapBottomSheet(props)
      return React.createElement(View, { testID: 'mock-map-bottom-sheet' }, children)
    }),
  }
})

jest.mock('@/components/MapPage/MapPlaceBottomCard', () => {
  const React = require('react')
  const { View } = require('react-native')

  return function MockMapPlaceBottomCard(props: any) {
    mockMapPlaceBottomCard(props)
    const { point } = props
    return point
      ? React.createElement(View, { testID: 'map-place-bottom-card' })
      : null
  }
})

jest.mock('@/components/MapPage/TravelListPanel', () => {
  return (props: any) => mockTravelListPanel(props)
})

jest.mock('@/components/MapPage/SegmentedControl', () => {
  const { View, Text } = require('react-native')
  return function MockSegmentedControl({ options, value }: any) {
    return (
      <View testID="mock-segmented-control">
        <Text>{value}</Text>
        {options.map((option: any) => (
          <Text key={option.key}>{option.label}</Text>
        ))}
      </View>
    )
  }
})

describe('MapMobileLayout', () => {
  beforeEach(() => {
    mockTravelListPanel.mockClear()
    mockMapBottomSheet.mockClear()
    mockMapPlaceBottomCard.mockClear()
    mockSnapToCollapsed.mockClear()
    mockSnapToQuarter.mockClear()
    mockSnapToHalf.mockClear()
    mockSnapToSeventy.mockClear()
    mockSnapToFull.mockClear()
    mockClose.mockClear()
    useMapPanelStore.setState({
      commandNonce: 0,
      command: { kind: 'open', tab: 'filters' },
      openNonce: 0,
      requestedTab: 'filters',
      toggleNonce: 0,
    } as any)
  })

  it('shows a loading state instead of an empty panel when filters content is not ready', async () => {
    const screen = render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[]}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
      />,
    )

    await act(async () => {
      useMapPanelStore.setState((s) => ({
        commandNonce: s.commandNonce + 1,
        command: { kind: 'open', tab: 'filters' },
      }))
    })

    expect(screen.getByTestId('map-mobile-filters-loading')).toBeTruthy()
    expect(screen.getByText('Загружаем фильтры')).toBeTruthy()
  })

  it('opens ready filters from the expanded list and keeps them above late map selections', async () => {
    const clearSelectedPlace = jest.fn()
    const Provider = ({ children }: { children: React.ReactNode }) => <View>{children}</View>
    const Panel = () => <View testID="filters-block-main" />
    const filtersPanelProps = {
      Component: Provider,
      Panel,
      contextValue: { mode: 'radius', setMode: jest.fn(), filterValue: {} },
    }
    const baseProps = {
      mapComponent: <View testID="mock-map" />,
      travelsData: [{ id: 1 }],
      coordinates: { latitude: 53.9, longitude: 27.56 },
      transportMode: 'car' as const,
      buildRouteTo: jest.fn(),
      onCenterOnUser: jest.fn(),
      onOpenFilters: jest.fn(),
      filtersPanelProps,
      clearSelectedPlace,
    }
    const screen = render(<MapMobileLayout {...baseProps} />)

    await act(async () => {
      useMapPanelStore.setState((state) => ({
        commandNonce: state.commandNonce + 1,
        command: { kind: 'open', tab: 'list' },
      }))
    })
    fireEvent.press(screen.getByTestId('mock-list-open-filters'))

    await waitFor(() => expect(screen.getByTestId('filters-block-main')).toBeTruthy())
    expect(mockSnapToSeventy).toHaveBeenCalled()

    mockSnapToCollapsed.mockClear()
    clearSelectedPlace.mockClear()
    screen.rerender(
      <MapMobileLayout
        {...baseProps}
        selectedPlace={{ id: 10, coord: '53.9,27.56', address: 'Late marker' }}
      />,
    )

    await waitFor(() => expect(clearSelectedPlace).toHaveBeenCalled())
    expect(screen.getByTestId('filters-block-main')).toBeTruthy()
    expect(mockSnapToCollapsed).not.toHaveBeenCalled()
  })

  it('passes loading state to the mobile places tab while map results refresh', () => {
    const screen = render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[]}
        isLoading
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
      />,
    )

    expect(screen.getByTestId('mock-travel-list-panel')).toBeTruthy()
    expect(screen.getByText('Travel list loading')).toBeTruthy()
    expect(mockTravelListPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        travelsData: [],
        isLoading: true,
      }),
    )
  })

  it('reserves native bottom dock space for the map bottom sheet', () => {
    render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[]}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
      />,
    )

    expect(mockMapBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        bottomInset: expect.any(Number),
      }),
    )
    expect(mockMapBottomSheet.mock.calls[0]?.[0]?.bottomInset).toBeGreaterThan(56)
  })

  it('renders the places summary in the sheet header and hides the body summary', () => {
    const screen = render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[{ id: 1 }]}
        totalCount={9}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
      />,
    )

    expect(screen.getByText('Travel list')).toBeTruthy()
    expect(screen.getByText('Места рядом')).toBeTruthy()
    expect(screen.getByText('9 мест')).toBeTruthy()
    expect(mockTravelListPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        showMobileSummary: false,
      }),
    )
  })

  it('opens the places list at the seventy percent snap point', async () => {
    render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[{ id: 1 }]}
        totalCount={9}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
      />,
    )

    await act(async () => {
      useMapPanelStore.setState((s) => ({
        commandNonce: s.commandNonce + 1,
        command: { kind: 'open', tab: 'list' },
      }))
    })

    expect(mockSnapToSeventy).toHaveBeenCalledTimes(1)
    expect(mockSnapToHalf).not.toHaveBeenCalled()
  })

  it('hides search-this-area when the map sheet is open', async () => {
    const screen = render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[{ id: 1 }]}
        totalCount={9}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        canSearchThisArea
        onSearchThisArea={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
      />,
    )

    expect(screen.getByTestId('map-search-this-area')).toBeTruthy()

    await act(async () => {
      mockMapBottomSheet.mock.calls.at(-1)?.[0]?.onStateChange('half')
    })

    expect(screen.queryByTestId('map-search-this-area')).toBeNull()
  })

  it('consumes Android Back by closing the selected place card in place', () => {
    const originalPlatform = Platform.OS
    ;(Platform as any).OS = 'android'
    const clearSelectedPlace = jest.fn()
    let hardwareBackHandler: (() => boolean) | undefined
    const remove = jest.fn()
    const addEventListenerSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_eventName: any, handler: any) => {
        hardwareBackHandler = handler
        return { remove } as any
      })

    try {
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={null}
          selectedPlace={{ id: 'place-1', coord: '53.9,27.56', address: 'Test place' }}
          clearSelectedPlace={clearSelectedPlace}
        />,
      )

      expect(screen.getByTestId('map-place-bottom-card')).toBeTruthy()
      expect(mockMapPlaceBottomCard.mock.calls.at(-1)?.[0]?.userLocation).toBeNull()
      expect(hardwareBackHandler?.()).toBe(true)
      expect(clearSelectedPlace).toHaveBeenCalledTimes(1)
    } finally {
      addEventListenerSpy.mockRestore()
      ;(Platform as any).OS = originalPlatform
    }
  })

  it('passes only trusted user location to the selected place bottom card', () => {
    render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[]}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
        selectedPlace={{ id: 'place-1', coord: '53.9,27.56', address: 'Test place' }}
        selectedPlaceUserLocation={{ latitude: 52.2, longitude: 20.98 }}
      />,
    )

    expect(mockMapPlaceBottomCard.mock.calls.at(-1)?.[0]?.userLocation).toEqual({
      latitude: 52.2,
      longitude: 20.98,
    })
  })

  it('keeps the web search-this-area button close to the mobile footer dock', () => {
    expect(getSearchAreaButtonBottom(true, true)).toBe(
      'calc(16px + env(safe-area-inset-bottom))',
    )
    expect(getSearchAreaButtonBottom(true, true, true)).toBe(
      'max(176px, var(--mt-consent-h, 176px))',
    )
    expect(getSearchAreaButtonBottom(false, true)).toBe(96)
    expect(getSearchAreaButtonBottom(false, false)).toBe(104)
  })

  describe('route building toolbar (#597)', () => {
    const buildFiltersProps = (overrides: any = {}) => {
      const setMode = jest.fn()
      const props = {
        mode: 'radius',
        transportMode: 'car',
        setMode,
        filterValue: { radius: '50' },
        onFilterChange: jest.fn(),
        ...overrides,
      }
      return { filtersPanelProps: { props }, setMode }
    }

    beforeEach(() => {
      // The toolbar reads/writes route state straight from the store, so reset
      // it to radius before each scenario. Unmount any leaked tree first so a
      // pending store-driven re-render from a prior test can't crash render().
      cleanup()
      useRouteStore.getState().clearRouteAndSetMode('radius')
      useRouteStore.getState().setTransportMode('car')
    })

    afterEach(() => {
      cleanup()
      useRouteStore.getState().clearRouteAndSetMode('radius')
    })

    it('enters route mode without faking a start when current location is unavailable', () => {
      const centerOnUser = jest.fn()
      const { filtersPanelProps } = buildFiltersProps()
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={centerOnUser}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      // Radius mode: no contextual route icons yet.
      expect(screen.queryByTestId('map-mobile-route-toolbar')).toBeNull()
      expect(screen.getByText('Построить маршрут')).toBeTruthy()
      expect(screen.queryByTestId('map-mobile-transport-button')).toBeNull()
      expect(screen.queryByTestId('map-mobile-route-clear-button')).toBeNull()

      fireEvent.press(screen.getByTestId('map-mobile-route-button'))
      // Store flipped to 'route' → contextual icons + hint now render.
      expect(useRouteStore.getState().mode).toBe('route')
      expect(screen.getByTestId('map-mobile-route-toolbar')).toBeTruthy()
      expect(screen.getByTestId('map-mobile-transport-button')).toBeTruthy()
      expect(screen.getByTestId('map-mobile-route-clear-button')).toBeTruthy()
      expect(screen.getByTestId('map-mobile-route-hint')).toBeTruthy()
      expect(screen.getByText('0/2')).toBeTruthy()
      expect(screen.getByText('Текущее положение не определено. Разрешите геолокацию или укажите старт вручную.')).toBeTruthy()
      expect(useRouteStore.getState().points).toHaveLength(0)
      fireEvent.press(screen.getByTestId('map-mobile-route-request-location'))
      expect(centerOnUser).toHaveBeenCalledTimes(1)
      fireEvent.press(screen.getByTestId('map-mobile-route-manual-start'))
      expect(screen.getByText('Коснитесь карты, чтобы выбрать новый старт маршрута.')).toBeTruthy()
      expect(mockSnapToHalf).not.toHaveBeenCalled()
    })

    it('enters manual tap-start directly when route mode is requested by the location banner', async () => {
      const { filtersPanelProps } = buildFiltersProps()
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      await act(async () => {
        useRouteStore.getState().clearRouteAndSetMode('route')
      })

      expect(screen.getByText('Коснитесь карты, чтобы выбрать новый старт маршрута.')).toBeTruthy()
      expect(screen.queryByTestId('map-mobile-route-request-location')).toBeNull()
      expect(useRouteStore.getState().points).toHaveLength(0)
    })

    it('seeds route mode with trusted current location as 1/2 start', () => {
      const { filtersPanelProps } = buildFiltersProps()
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          userLocation={{ latitude: 52.2, longitude: 20.98 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      expect(screen.getByText('Маршрут от меня')).toBeTruthy()

      fireEvent.press(screen.getByTestId('map-mobile-route-button'))

      const points = useRouteStore.getState().points
      expect(useRouteStore.getState().mode).toBe('route')
      expect(points).toHaveLength(1)
      expect(points[0]).toEqual(
        expect.objectContaining({
          coordinates: { lat: 52.2, lng: 20.98 },
          address: 'Моё местоположение',
          type: 'start',
        }),
      )
      expect(screen.getByText('1/2')).toBeTruthy()
      expect(screen.getByText('Старт задан. Выберите место назначения на карте.')).toBeTruthy()
      expect(screen.queryByTestId('map-mobile-route-request-location')).toBeNull()
      expect(mockSnapToHalf).not.toHaveBeenCalled()
    })

    it('lets the user replace the current-location start with a manually selected start', () => {
      const { filtersPanelProps } = buildFiltersProps()
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          userLocation={{ latitude: 52.2, longitude: 20.98 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      fireEvent.press(screen.getByTestId('map-mobile-route-button'))
      expect(useRouteStore.getState().points).toEqual([
        expect.objectContaining({
          coordinates: { lat: 52.2, lng: 20.98 },
          address: 'Моё местоположение',
          type: 'start',
        }),
      ])

      fireEvent.press(screen.getByTestId('map-mobile-route-button'))

      expect(useRouteStore.getState().mode).toBe('route')
      expect(useRouteStore.getState().points).toHaveLength(0)
      expect(screen.getByText('0/2')).toBeTruthy()
      expect(screen.getByText('Коснитесь карты, чтобы выбрать новый старт маршрута.')).toBeTruthy()
      expect(screen.queryByTestId('map-mobile-route-request-location')).toBeNull()
    })

    it('auto-seeds the pending route start when current location arrives later', async () => {
      const { filtersPanelProps } = buildFiltersProps()
      const baseProps = {
        mapComponent: <View testID="mock-map" />,
        travelsData: [],
        coordinates: { latitude: 53.9, longitude: 27.56 },
        transportMode: 'car' as const,
        buildRouteTo: jest.fn(),
        onCenterOnUser: jest.fn(),
        onOpenFilters: jest.fn(),
        filtersPanelProps,
      }
      const screen = render(<MapMobileLayout {...baseProps} />)

      fireEvent.press(screen.getByTestId('map-mobile-route-button'))
      expect(useRouteStore.getState().points).toHaveLength(0)

      screen.rerender(
        <MapMobileLayout
          {...baseProps}
          userLocation={{ latitude: 52.2, longitude: 20.98 }}
        />,
      )

      await waitFor(() => {
        expect(useRouteStore.getState().points).toEqual([
          expect.objectContaining({
            coordinates: { lat: 52.2, lng: 20.98 },
            address: 'Моё местоположение',
            type: 'start',
          }),
        ])
      })
      expect(screen.getByText('1/2')).toBeTruthy()
    })

    it('shows transport selector + clear + hint when already in route mode', () => {
      useRouteStore.getState().setMode('route')
      useRouteStore.getState().addPoint({ lat: 53.9, lng: 27.56 }, 'Старт')
      const { filtersPanelProps } = buildFiltersProps({ mode: 'route' })
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      expect(screen.getByTestId('map-mobile-transport-button')).toBeTruthy()
      expect(screen.getByTestId('map-mobile-route-clear-button')).toBeTruthy()
      expect(screen.getByTestId('map-mobile-route-hint')).toBeTruthy()
      expect(screen.getByText('1/2')).toBeTruthy()
      // Radius button hidden in route mode to keep the row short.
      expect(screen.queryByTestId('map-mobile-radius-button')).toBeNull()
    })

    it('keeps built route metrics visible on the map until the summary close is pressed', () => {
      jest.useFakeTimers()
      try {
        useRouteStore.getState().setMode('route')
        useRouteStore.getState().addPoint({ lat: 53.9, lng: 27.56 }, 'Старт')
        useRouteStore.getState().addPoint({ lat: 53.95, lng: 27.62 }, 'Финиш')
        useRouteStore.getState().setRoute({
          coordinates: [
            { lat: 53.9, lng: 27.56 },
            { lat: 53.95, lng: 27.62 },
          ],
          distance: 12500,
          duration: 1800,
          isOptimal: true,
        })

        const { filtersPanelProps } = buildFiltersProps({ mode: 'route' })
        const screen = render(
          <MapMobileLayout
            mapComponent={<View testID="mock-map" />}
            travelsData={[]}
            coordinates={{ latitude: 53.9, longitude: 27.56 }}
            transportMode="car"
            buildRouteTo={jest.fn()}
            onCenterOnUser={jest.fn()}
            onOpenFilters={jest.fn()}
            filtersPanelProps={filtersPanelProps}
          />,
        )

        expect(screen.getByTestId('map-mobile-route-summary')).toBeTruthy()
        expect(screen.getByText('Маршрут готов')).toBeTruthy()
        expect(screen.getByText('12.5 км')).toBeTruthy()
        expect(screen.getByText('30 мин')).toBeTruthy()

        act(() => {
          jest.advanceTimersByTime(10000)
        })

        expect(screen.getByTestId('map-mobile-route-summary')).toBeTruthy()

        fireEvent.press(screen.getByTestId('map-mobile-route-summary-close'))
        expect(screen.queryByTestId('map-mobile-route-summary')).toBeNull()

        act(() => {
          useRouteStore.getState().setRoute({
            coordinates: [
              { lat: 53.9, lng: 27.56 },
              { lat: 54.01, lng: 27.7 },
            ],
            distance: 16000,
            duration: 2400,
            isOptimal: true,
          })
        })

        expect(screen.getByTestId('map-mobile-route-summary')).toBeTruthy()
        expect(screen.getByText('16.0 км')).toBeTruthy()
        expect(screen.getByText('40 мин')).toBeTruthy()
      } finally {
        jest.useRealTimers()
      }
    })

    it('opens the transport popover and applies a profile via the store', () => {
      useRouteStore.getState().setMode('route')
      const { filtersPanelProps } = buildFiltersProps({ mode: 'route' })
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      fireEvent.press(screen.getByTestId('map-mobile-transport-button'))
      fireEvent.press(screen.getByTestId('map-mobile-transport-option-bike'))
      expect(useRouteStore.getState().transportMode).toBe('bike')
    })

    it('anchors compact popovers under their toolbar icons', () => {
      const { filtersPanelProps } = buildFiltersProps()
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      fireEvent.press(screen.getByTestId('map-mobile-radius-button'))
      expect(
        StyleSheet.flatten(screen.getByTestId('map-mobile-radius-popover-card').props.style).right,
      ).toBe(98)

      fireEvent.press(screen.getByTestId('map-mobile-layers-button'))
      const layersCardStyle = StyleSheet.flatten(
        screen.getByTestId('map-mobile-layers-popover-card').props.style,
      )
      expect(layersCardStyle.right).toBe(54)
      expect(layersCardStyle.width).toBe(360)

      fireEvent.press(screen.getByTestId('map-mobile-layers-popover-backdrop'))
      fireEvent.press(screen.getByTestId('map-mobile-route-button'))
      fireEvent.press(screen.getByTestId('map-mobile-transport-button'))
      const transportCardStyle = StyleSheet.flatten(
        screen.getByTestId('map-mobile-transport-popover-card').props.style,
      )
      expect(transportCardStyle.right).toBe(54)
      expect(transportCardStyle.width).toBe(204)
    })

    it('clears the route and returns to radius mode (contextual icons hidden)', () => {
      useRouteStore.getState().setMode('route')
      const { filtersPanelProps } = buildFiltersProps({ mode: 'route' })
      const screen = render(
        <MapMobileLayout
          mapComponent={<View testID="mock-map" />}
          travelsData={[]}
          coordinates={{ latitude: 53.9, longitude: 27.56 }}
          transportMode="car"
          buildRouteTo={jest.fn()}
          onCenterOnUser={jest.fn()}
          onOpenFilters={jest.fn()}
          filtersPanelProps={filtersPanelProps}
        />,
      )

      fireEvent.press(screen.getByTestId('map-mobile-route-clear-button'))
      expect(useRouteStore.getState().mode).toBe('radius')
      // Back in radius: contextual icons gone, radius button restored.
      expect(screen.queryByTestId('map-mobile-transport-button')).toBeNull()
      expect(screen.queryByTestId('map-mobile-route-clear-button')).toBeNull()
      expect(screen.getByTestId('map-mobile-radius-button')).toBeTruthy()
    })
  })

  it('keeps the places list static but makes filters sheet content scrollable', async () => {
    render(
      <MapMobileLayout
        mapComponent={<View testID="mock-map" />}
        travelsData={[]}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        transportMode="car"
        buildRouteTo={jest.fn()}
        onCenterOnUser={jest.fn()}
        onOpenFilters={jest.fn()}
        filtersPanelProps={null}
      />,
    )

    expect(mockMapBottomSheet.mock.calls.at(-1)?.[0]?.scrollableContent).toBe(false)

    await act(async () => {
      useMapPanelStore.setState((s) => ({
        commandNonce: s.commandNonce + 1,
        command: { kind: 'open', tab: 'filters' },
      }))
    })

    await waitFor(() => {
      expect(mockMapBottomSheet.mock.calls.at(-1)?.[0]?.scrollableContent).toBe(true)
    })
  })
})
