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

// #844 — the save-feedback toast must live INSIDE the native Modal (a root-level
// toast renders behind it → save looks like a no-op). Mock the host so the test can
// assert it is wired into the modal without pulling react-native-toast-message.
jest.mock('@/components/ui/ToastHost', () => ({
  __esModule: true,
  default: () => {
    const { View } = require('react-native')
    return <View testID="travel-map-modal-toast-host" />
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

  it('mounts the toast host inside the modal so «Мои точки» save feedback is visible', () => {
    render(
      <TravelMap
        travelData={[point]}
        highlightedPoint={{ coord: point.coord, key: 'from-list' }}
        height={420}
      />,
    )

    // #844 — nested toast host lives next to the bottom card inside the Modal.
    expect(screen.getByTestId('travel-map-modal-toast-host')).toBeTruthy()
  })

  it('renders travel-point markers with the shared brand bird divIcon', () => {
    render(<TravelMap travelData={[point]} height={420} />)

    const html = screen.getByTestId('native-travel-map-webview').props.source.html as string
    // #843 — same brand bird as web/native /map (size/anchor mirror useLeafletIcons),
    // not the old raster SVG data-URI pin.
    expect(html).toContain('L.divIcon')
    expect(html).toContain("className: 'metravel-marker'")
    expect(html).toContain('iconSize: [48, 58]')
    expect(html).toContain('iconAnchor: [24, 54]')
    expect(html).toContain('0 0 100 100')
    expect(html).not.toContain('data:image/svg+xml')
  })
})
