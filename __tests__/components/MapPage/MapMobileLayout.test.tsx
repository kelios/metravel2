import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'

import { MapMobileLayout } from '@/components/MapPage/MapMobileLayout'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'

const mockTravelListPanel = jest.fn((props: any) => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return (
    <View testID="mock-travel-list-panel">
      <Text>{props.isLoading ? 'Travel list loading' : 'Travel list'}</Text>
    </View>
  )
})

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

    it('enters route mode and reveals contextual transport/clear icons + hint', () => {
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

      // Radius mode: no contextual route icons yet.
      expect(screen.getByTestId('map-mobile-route-toolbar')).toBeTruthy()
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
      expect(mockSnapToHalf).not.toHaveBeenCalled()
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
      ).toBe(116)

      fireEvent.press(screen.getByTestId('map-mobile-layers-button'))
      const layersCardStyle = StyleSheet.flatten(
        screen.getByTestId('map-mobile-layers-popover-card').props.style,
      )
      expect(layersCardStyle.right).toBe(64)
      expect(layersCardStyle.width).toBe(272)

      fireEvent.press(screen.getByTestId('map-mobile-layers-popover-backdrop'))
      fireEvent.press(screen.getByTestId('map-mobile-route-button'))
      fireEvent.press(screen.getByTestId('map-mobile-transport-button'))
      const transportCardStyle = StyleSheet.flatten(
        screen.getByTestId('map-mobile-transport-popover-card').props.style,
      )
      expect(transportCardStyle.right).toBe(64)
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
