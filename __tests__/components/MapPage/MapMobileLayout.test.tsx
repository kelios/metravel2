import { act, render } from '@testing-library/react-native'
import { View } from 'react-native'

import { MapMobileLayout } from '@/components/MapPage/MapMobileLayout'
import { useMapPanelStore } from '@/stores/mapPanelStore'

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
    default: React.forwardRef(({ children }: any, _ref) =>
      React.createElement(View, { testID: 'mock-map-bottom-sheet' }, children),
    ),
  }
})

jest.mock('@/components/MapPage/TravelListPanel', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return function MockTravelListPanel() {
    return (
      <View testID="mock-travel-list-panel">
        <Text>Travel list</Text>
      </View>
    )
  }
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

jest.mock('@/components/MapPage/MapQuickFilters', () => {
  const { View } = require('react-native')
  return {
    MapQuickFilters: () => <View testID="mock-map-quick-filters" />,
  }
})

describe('MapMobileLayout', () => {
  beforeEach(() => {
    useMapPanelStore.setState({
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
      useMapPanelStore.getState().requestOpen('filters')
    })

    expect(screen.getByTestId('map-mobile-filters-loading')).toBeTruthy()
    expect(screen.getByText('Загружаем фильтры')).toBeTruthy()
  })
})
