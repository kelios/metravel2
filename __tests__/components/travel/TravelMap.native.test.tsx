import { fireEvent, render, screen } from '@testing-library/react-native'

jest.mock('react-native-webview', () => ({
  WebView: (props: any) => {
    const { View } = require('react-native')
    return <View testID="native-travel-map-webview" {...props} />
  },
}))

jest.mock('@/components/MapPage/MapPlaceBottomCard', () => ({
  __esModule: true,
  default: ({ point, onClose }: any) => {
    const React = require('react')
    const { Text, View } = require('react-native')
    return point ? (
      <View testID="shared-map-place-bottom-card">
        <Text>{point.address}</Text>
        <Text>{point.coord}</Text>
        <Text onPress={onClose}>Закрыть</Text>
      </View>
    ) : null
  },
}))

const { TravelMap } = require('@/components/MapPage/TravelMap.native')

const point = {
  id: 'p1',
  address: 'Ратуша, центр города',
  coord: '50.000000,20.000000',
  travelImageThumbUrl: 'https://example.com/point.jpg',
  categoryName: 'Достопримечательность',
}

describe('TravelMap native shared place card', () => {
  it('opens the shared MapPlaceBottomCard when the WebView marker is selected', () => {
    render(<TravelMap travelData={[point]} height={420} />)

    fireEvent(screen.getByTestId('native-travel-map-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'POINT_SELECT', coord: point.coord }),
      },
    })

    expect(screen.getByTestId('shared-map-place-bottom-card')).toBeTruthy()
    expect(screen.getByText('Ратуша, центр города')).toBeTruthy()

    fireEvent(screen.getByTestId('native-travel-map-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'CLEAR_SELECTED_POINT' }),
      },
    })

    expect(screen.queryByTestId('shared-map-place-bottom-card')).toBeNull()
  })

  it('opens the shared card for a highlighted point from the travel point list', () => {
    render(
      <TravelMap
        travelData={[point]}
        highlightedPoint={{ coord: point.coord, key: 'from-list' }}
        height={420}
      />,
    )

    expect(screen.getByTestId('shared-map-place-bottom-card')).toBeTruthy()
    expect(screen.getByText(point.coord)).toBeTruthy()
  })
})
