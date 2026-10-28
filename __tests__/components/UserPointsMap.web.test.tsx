import React from 'react'
import { createWebMapTestRuntime, type WebMapTestRuntime } from '@/__tests__/helpers/webMapTestRuntime'
let render: typeof import('@testing-library/react/pure').render
let waitFor: typeof import('@testing-library/react/pure').waitFor
let UserPointsMap: typeof import('@/components/UserPoints/UserPointsMap').UserPointsMap

let mockIsDark = false
jest.mock('@/hooks/useTheme', () => ({
  ...jest.requireActual('@/hooks/useTheme'),
  useThemedColors: () => require('@/constants/designSystem').getThemedColors(mockIsDark),
}))


jest.mock('@/utils/leafletFix', () => ({}))

jest.mock('@/utils/ensureLeafletCss', () => ({
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

    return <div data-testid="userpoints-map-container" style={props.style}>{props.children}</div>
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

let web: WebMapTestRuntime<typeof UserPointsMap>
beforeAll(() => {
  web = createWebMapTestRuntime(React, () => require('@/components/UserPoints/UserPointsMap').UserPointsMap)
  UserPointsMap = web.subject
  ;({ render, waitFor } = web)
  expect.extend(web.matchers)
})
afterEach(() => web.cleanup())
afterAll(() => expect.extend(require('@testing-library/react-native/matchers')))
beforeEach(() => { (globalThis as any).__lastUserPointsMapContainerProps = undefined })

test('UserPointsMap.web wires MapContainer via whenReady/ref and emits map UI api', async () => {
  const onMapUiApiReady = jest.fn()
  const screen = render(<UserPointsMap points={[]} onMapUiApiReady={onMapUiApiReady} />)

  await waitFor(() => {
    const calls = onMapUiApiReady.mock.calls
    const sawApi = calls.some(([arg]: any[]) => arg && typeof arg.zoomIn === 'function' && typeof arg.setOverlayEnabled === 'function')
    expect(sawApi).toBe(true)
    expect(screen.getByTestId('userpoints-map-container')).toBeTruthy()
  })

  const props = (globalThis as any).__lastUserPointsMapContainerProps
  expect(typeof props?.whenReady).toBe('function')
  expect(props?.whenCreated).toBeUndefined()
})

test.each([false, true])('uses the theme background on the actual Leaflet owner before tiles arrive (dark=%s)', async (isDark) => {
  mockIsDark = isDark
  const screen = await render(<UserPointsMap points={[]} />)
  await waitFor(() => {
    const props = (globalThis as any).__lastUserPointsMapContainerProps
    expect(props.style.background).toBe(require('@/constants/designSystem').getThemedColors(isDark).background)
    expect(props.style['--metravel-map-background']).toBe(require('@/constants/designSystem').getThemedColors(isDark).background)
    const owner = screen.getByTestId('userpoints-map-container')
    expect(owner).toHaveStyle({ background: require('@/constants/designSystem').getThemedColors(isDark).background })
    expect(owner.style.getPropertyValue('--metravel-map-background')).toBe(props.style['--metravel-map-background'])
  })
  await screen.unmount()
})
