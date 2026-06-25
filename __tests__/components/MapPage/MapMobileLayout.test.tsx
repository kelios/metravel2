import { act, render, waitFor } from '@testing-library/react-native'
import { View } from 'react-native'

import { MapMobileLayout } from '@/components/MapPage/MapMobileLayout'
import { useMapPanelStore } from '@/stores/mapPanelStore'

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
    default: React.forwardRef(({ children, ...props }: any, _ref) => {
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

  it('does not duplicate the places count as a list sheet header', () => {
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
    expect(screen.queryByText('9 мест')).toBeNull()
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
