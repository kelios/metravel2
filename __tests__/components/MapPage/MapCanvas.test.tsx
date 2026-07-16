import { fireEvent, render } from '@testing-library/react-native'
import { Platform, View } from 'react-native'

import { MapCanvas } from '@/components/MapPage/MapCanvas'

const mockMapLoadingBar = jest.fn(({ visible }: { visible: boolean }) => (
  <View testID="map-loading-bar" {...({ 'data-visible': String(visible) } as any)} />
))

jest.mock('@/components/MapPage/MapLoadingBar', () => ({
  __esModule: true,
  MapLoadingBar: (props: { visible: boolean }) => mockMapLoadingBar(props),
}))

jest.mock('@/components/MapPage/MapPageSkeleton', () => ({
  __esModule: true,
  MapPageSkeleton: () => {
    const { View: MockView } = require('react-native')
    return <MockView testID="map-page-skeleton" />
  },
}))

const baseProps = {
  styles: {
    mapArea: {},
    radiusPill: {},
    radiusPillText: {},
    locationQualityPill: {},
    locationQualityText: {},
    geoBanner: {},
    geoBannerText: {},
    geoBannerActionPrimary: {},
    geoBannerActionPrimaryText: {},
    geoBannerActionSecondary: {},
    geoBannerActionSecondaryText: {},
    geoBannerClose: {},
  },
  themedColors: {
    primary: '#000',
    textMuted: '#666',
    warning: '#b45309',
  },
  isWeb: false,
  isMobile: false,
  mapReady: false,
  mapPanelProps: {},
  travelsData: [],
  quickFilters: {
    selected: [],
    radiusOptions: [],
    categoryOptions: [],
    overlayOptions: [],
    enabledOverlays: {},
    categoriesValue: '',
    radiusValue: '',
    overlaysValue: '',
  },
  mapQuickActionButtons: [],
  currentRadius: '',
  shouldShowFloatingRadiusPill: false,
  showGeoBanner: false,
  locationState: {
    status: 'denied' as const,
    coordinates: null,
    accuracy: null,
    timestamp: null,
    canAskAgain: true,
  },
  coordinatesSource: 'default' as const,
  dismissGeoBanner: jest.fn(),
  retryLocation: jest.fn(),
  openLocationSettings: jest.fn(),
  startManualRoute: jest.fn(),
  handleSelectSearchTab: jest.fn(),
  openRightPanel: jest.fn(),
}

describe('MapCanvas', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  beforeEach(() => {
    mockMapLoadingBar.mockClear()
  })

  it('passes the explicit map progress state to the top loading bar', () => {
    render(<MapCanvas {...baseProps} showProgress={false} />)
    expect(mockMapLoadingBar).toHaveBeenLastCalledWith({ visible: false })
  })

  it('shows the top loading bar when the screen asks for map progress', () => {
    render(<MapCanvas {...baseProps} showProgress />)
    expect(mockMapLoadingBar).toHaveBeenLastCalledWith({ visible: true })
  })

  it('offers a retry when location permission can be requested again', () => {
    const retryLocation = jest.fn()
    const screen = render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        showGeoBanner
        retryLocation={retryLocation}
      />,
    )

    fireEvent.press(screen.getByTestId('map-geo-retry'))

    expect(retryLocation).toHaveBeenCalledTimes(1)
    // Ручной старт — действие режима маршрута, а не общего гео-статуса: в
    // radius-режиме баннер не предлагает уходить в построение маршрута.
    expect(screen.queryByTestId('map-geo-manual-start')).toBeNull()
  })

  it('offers a manual route start from the geo banner only in route mode', () => {
    const startManualRoute = jest.fn()
    const screen = render(
      <MapCanvas
        {...baseProps}
        mapPanelProps={{ mode: 'route' }}
        showProgress={false}
        showGeoBanner
        startManualRoute={startManualRoute}
      />,
    )

    fireEvent.press(screen.getByTestId('map-geo-manual-start'))

    expect(startManualRoute).toHaveBeenCalledTimes(1)
  })

  it('labels cached coordinates as last-known rather than current', () => {
    const screen = render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        showGeoBanner
        coordinatesSource="cache"
        locationState={{
          status: 'cached',
          coordinates: { latitude: 52.2, longitude: 20.98 },
          accuracy: null,
          timestamp: 1000,
          canAskAgain: true,
        }}
      />,
    )

    expect(screen.getByText(/последнее известное место/i)).toBeTruthy()
  })

  it('opens native settings when permission cannot be requested again', () => {
    ;(Platform as any).OS = 'android'
    const openLocationSettings = jest.fn()
    const screen = render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        showGeoBanner
        openLocationSettings={openLocationSettings}
        locationState={{
          status: 'denied',
          coordinates: null,
          accuracy: null,
          timestamp: null,
          canAskAgain: false,
        }}
      />,
    )

    fireEvent.press(screen.getByTestId('map-geo-open-settings'))

    expect(openLocationSettings).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('map-geo-retry')).toBeNull()
  })

  it('shows when a trusted live fix is temporarily refreshing', () => {
    const screen = render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        locationState={{
          status: 'current',
          coordinates: { latitude: 52.2, longitude: 20.98 },
          accuracy: 8,
          timestamp: Date.now(),
          canAskAgain: true,
          isRefreshing: true,
        }}
        coordinatesSource="geolocation"
      />,
    )

    expect(screen.getByTestId('map-location-quality')).toBeTruthy()
    expect(screen.getByText('Обновляем местоположение…')).toBeTruthy()
  })

  it('shows low accuracy and stale live-fix states without replacing the user point', () => {
    const lowAccuracy = render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        locationState={{
          status: 'current',
          coordinates: { latitude: 52.2, longitude: 20.98 },
          accuracy: 180,
          timestamp: Date.now(),
          canAskAgain: true,
        }}
        coordinatesSource="geolocation"
      />,
    )
    expect(lowAccuracy.getByText('Низкая точность геолокации')).toBeTruthy()
    lowAccuracy.unmount()

    const stale = render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        locationState={{
          status: 'current',
          coordinates: { latitude: 52.2, longitude: 20.98 },
          accuracy: 8,
          timestamp: Date.now() - 31_000,
          canAskAgain: true,
        }}
        coordinatesSource="geolocation"
      />,
    )
    expect(stale.getByText('Местоположение давно не обновлялось')).toBeTruthy()
  })
})
