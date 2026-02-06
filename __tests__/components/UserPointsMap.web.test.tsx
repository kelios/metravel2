const { render, waitFor } = require('@testing-library/react-native')

const RN = require('react-native')
const originalPlatformOS = RN.Platform.OS
RN.Platform.OS = 'web'

afterAll(() => {
  RN.Platform.OS = originalPlatformOS
})

jest.mock('@/src/utils/leafletFix', () => ({}))

jest.mock('@/src/utils/ensureLeafletCss', () => ({
  ensureLeafletCss: () => {},
}))

jest.mock('@/components/MapPage/Map/useMapInstance', () => ({
  useMapInstance: () => ({
    leafletBaseLayerRef: { current: null },
    leafletOverlayLayersRef: { current: new Map() },
    leafletControlRef: { current: null },
  }),
}))

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {},
}))

jest.mock('react-leaflet', () => {
  const React = require('react')
  const { View } = require('react-native')

  const fakeMap = {
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    setView: jest.fn(),
    flyTo: jest.fn(),
    closePopup: jest.fn(),
    fitBounds: jest.fn(),
    getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
    getZoom: jest.fn(() => 11),
    getSize: jest.fn(() => ({ x: 800, y: 600 })),
    on: jest.fn(),
    off: jest.fn(),
    hasLayer: jest.fn(() => false),
    removeLayer: jest.fn(),
    addLayer: jest.fn(),
    invalidateSize: jest.fn(),
  }

  const MapContainer = React.forwardRef((props: any, ref: any) => {
    ;(globalThis as any).__lastUserPointsMapContainerProps = props

    const { whenReady } = props
    React.useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') ref(fakeMap)
        else ref.current = fakeMap
      }
      whenReady?.()
    }, [whenReady, ref])

    return <View testID="userpoints-map-container">{props.children}</View>
  })

  return {
    __esModule: true,
    MapContainer,
    Marker: ({ children }: any) => <View testID="userpoints-marker">{children}</View>,
    Popup: ({ children }: any) => <View testID="userpoints-popup">{children}</View>,
    Polyline: () => <View testID="userpoints-polyline" />,
    useMap: () => fakeMap,
    useMapEvents: () => null,
  }
})

const { UserPointsMap } = require('@/components/UserPoints/UserPointsMap')

test('UserPointsMap.web wires MapContainer via whenReady/ref and emits map UI api', async () => {
  const onMapUiApiReady = jest.fn()
  render(<UserPointsMap points={[]} onMapUiApiReady={onMapUiApiReady} />)

  await waitFor(() => {
    const calls = onMapUiApiReady.mock.calls
    const sawApi = calls.some(([arg]: any[]) => arg && typeof arg.zoomIn === 'function' && typeof arg.setOverlayEnabled === 'function')
    expect(sawApi).toBe(true)
  })

  const props = (globalThis as any).__lastUserPointsMapContainerProps
  expect(typeof props?.whenReady).toBe('function')
  expect(props?.whenCreated).toBeUndefined()
})

