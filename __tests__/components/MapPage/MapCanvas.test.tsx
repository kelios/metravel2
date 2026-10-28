import { fireEvent, render } from '@testing-library/react-native'
import { Platform, StyleSheet, View } from 'react-native'

import { MapCanvas } from '@/components/MapPage/MapCanvas'
import {
  markLiveUserPositionFix,
  resetLiveUserPosition,
} from '@/hooks/map/liveUserPosition'

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
  onCenterUser: jest.fn(),
}

describe('MapCanvas', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  beforeEach(() => {
    mockMapLoadingBar.mockClear()
  })

  // #2219 × #2304 — the quality pill and «Искать в этой области» share ONE
  // flex row; while the action shows, the pill folds to its icon and keeps its
  // message as the accessibility label.
  it.each(['ios', 'android', 'web'] as const)('%s desktop: quality pill and the action are items of one top-row band', async (os) => {
    ;(Platform as any).OS = os
    const lowAccuracy = {
      status: 'current' as const,
      coordinates: { latitude: 52.2, longitude: 20.98 },
      accuracy: 180,
      timestamp: Date.now(),
      canAskAgain: true,
    }
    const screen = await render(
      <MapCanvas
        {...baseProps}
        isWeb={os === 'web'}
        showProgress={false}
        locationState={lowAccuracy}
        coordinatesSource="geolocation"
        canSearchThisArea
        onSearchThisArea={jest.fn()}
      />,
    )
    const band = screen.getByTestId('map-top-band')
    const quality = screen.getByTestId('map-location-quality')
    expect(band.queryAll((node: any) => node.props?.testID === 'map-location-quality').length).toBeGreaterThan(0)
    expect(band.queryAll((node: any) => node.props?.testID === 'map-search-this-area-desktop').length).toBeGreaterThan(0)
    expect(screen.queryByText('Низкая точность геолокации')).toBeNull()
    expect(quality.props.accessibilityLabel).toBe('Низкая точность геолокации')
    // Web names the folded icon only as an `img` (a generic div exposes no name).
    expect(quality.props.accessibilityRole).toBe(os === 'web' ? 'image' : undefined)
    await screen.unmount()

    // Without the action the pill shows its message in the same band.
    const alone = await render(
      <MapCanvas {...baseProps} isWeb={os === 'web'} showProgress={false} locationState={lowAccuracy} coordinatesSource="geolocation" />,
    )
    expect(alone.getByTestId('map-top-band')).toBeTruthy()
    expect(alone.getByText('Низкая точность геолокации')).toBeTruthy()
  })

  describe('#2219 — map actions of the desktop branch on the native tablet', () => {
    it.each(['ios', 'android'] as const)('%s: «Искать в этой области» is offered and has no hitSlop', async (os) => {
      ;(Platform as any).OS = os
      const onSearchThisArea = jest.fn()
      const screen = await render(
        <MapCanvas {...baseProps} showProgress={false} canSearchThisArea onSearchThisArea={onSearchThisArea} />,
      )
      const button = screen.getByTestId('map-search-this-area-desktop')
      expect(button.props.hitSlop).toBeUndefined()
      await fireEvent.press(button)
      expect(onSearchThisArea).toHaveBeenCalledTimes(1)
    })

    it.each(['ios', 'android'] as const)('%s: «Моё местоположение» centres the map once, no hitSlop', async (os) => {
      ;(Platform as any).OS = os
      const onCenterUser = jest.fn()
      const screen = await render(<MapCanvas {...baseProps} showProgress={false} onCenterUser={onCenterUser} />)
      const button = screen.getByTestId('map-desktop-locate-button')
      expect(button.props.accessibilityLabel).toBeTruthy()
      expect(button.props.hitSlop).toBeUndefined()
      expect(StyleSheet.flatten(button.props.style)).toEqual(
        expect.objectContaining({ position: 'absolute', top: 72, left: 16, width: 44, height: 44 }),
      )
      await fireEvent.press(button)
      expect(onCenterUser).toHaveBeenCalledTimes(1)
    })

    it('neither button exists in the phone layout', async () => {
      ;(Platform as any).OS = 'ios'
      const screen = await render(
        <MapCanvas {...baseProps} isMobile showProgress={false} canSearchThisArea onSearchThisArea={jest.fn()} />,
      )
      expect(screen.queryByTestId('map-search-this-area-desktop')).toBeNull()
      expect(screen.queryByTestId('map-desktop-locate-button')).toBeNull()
    })

    it('no search pill until the map was moved far enough', async () => {
      const screen = await render(
        <MapCanvas {...baseProps} showProgress={false} canSearchThisArea={false} onSearchThisArea={jest.fn()} />,
      )
      expect(screen.queryByTestId('map-search-this-area-desktop')).toBeNull()
    })

    it('web keeps the pill and leaves «Моё местоположение» to the Leaflet MapControls column', async () => {
      ;(Platform as any).OS = 'web'
      const screen = await render(
        <MapCanvas {...baseProps} isWeb showProgress={false} canSearchThisArea onSearchThisArea={jest.fn()} />,
      )
      expect(screen.getByTestId('map-search-this-area-desktop')).toBeTruthy()
      expect(screen.queryByTestId('map-desktop-locate-button')).toBeNull()
    })
  })

  it('passes the explicit map progress state to the top loading bar', async () => {
    await render(<MapCanvas {...baseProps} showProgress={false} />)
    expect(mockMapLoadingBar).toHaveBeenLastCalledWith({ visible: false })
  })

  it('shows the top loading bar when the screen asks for map progress', async () => {
    await render(<MapCanvas {...baseProps} showProgress />)
    expect(mockMapLoadingBar).toHaveBeenLastCalledWith({ visible: true })
  })

  it('offers a retry when location permission can be requested again', async () => {
    const retryLocation = jest.fn()
    const screen = await render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        showGeoBanner
        retryLocation={retryLocation}
      />,
    )

    await fireEvent.press(screen.getByTestId('map-geo-retry'))

    expect(retryLocation).toHaveBeenCalledTimes(1)
    // Ручной старт — действие режима маршрута, а не общего гео-статуса: в
    // radius-режиме баннер не предлагает уходить в построение маршрута.
    expect(screen.queryByTestId('map-geo-manual-start')).toBeNull()
  })

  // Ряд чипов активных фильтров (overlay-слой) и баннер (слой карты) — разные
  // поддеревья, поэтому баннер опускается под ряд явным сдвигом, иначе они
  // рисуются друг поверх друга.
  it('drops the geo banner below the active filter chips row when it is shown', async () => {
    const screen = await render(
      <MapCanvas
        {...baseProps}
        isMobile
        showProgress={false}
        showGeoBanner
        geoBannerStackOffset={34}
      />,
    )

    const banner = screen.getByTestId('map-geo-banner')
    expect(StyleSheet.flatten(banner.props.style)).toMatchObject({ marginTop: 34 })
  })

  it('keeps the geo banner tight under the toolbar when there are no chips', async () => {
    const screen = await render(
      <MapCanvas {...baseProps} isMobile showProgress={false} showGeoBanner />,
    )

    const banner = screen.getByTestId('map-geo-banner')
    expect(StyleSheet.flatten(banner.props.style)?.marginTop).toBeUndefined()
  })

  it('offers a manual route start from the geo banner only in route mode', async () => {
    const startManualRoute = jest.fn()
    const screen = await render(
      <MapCanvas
        {...baseProps}
        mapPanelProps={{ mode: 'route' }}
        showProgress={false}
        showGeoBanner
        startManualRoute={startManualRoute}
      />,
    )

    await fireEvent.press(screen.getByTestId('map-geo-manual-start'))

    expect(startManualRoute).toHaveBeenCalledTimes(1)
  })

  it('labels cached coordinates as last-known rather than current', async () => {
    const screen = await render(
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

  it('opens native settings when permission cannot be requested again', async () => {
    ;(Platform as any).OS = 'android'
    const openLocationSettings = jest.fn()
    const screen = await render(
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

    await fireEvent.press(screen.getByTestId('map-geo-open-settings'))

    expect(openLocationSettings).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('map-geo-retry')).toBeNull()
  })

  // #1780 — на мобиле статус и действия стоят разными строками. Если действий
  // нет (геолокация недоступна в принципе: ни «Повторить», ни «Открыть
  // настройки»), пустая вторая строка добавила бы баннеру только gap.
  it('drops the geo banner action row when there is nothing to offer', async () => {
    const screen = await render(
      <MapCanvas
        {...baseProps}
        isMobile
        showProgress={false}
        showGeoBanner
        locationState={{
          status: 'unavailable',
          coordinates: null,
          accuracy: null,
          timestamp: null,
          canAskAgain: false,
        }}
      />,
    )

    expect(screen.getByTestId('map-geo-banner')).toBeTruthy()
    expect(screen.queryByTestId('map-geo-banner-actions')).toBeNull()
  })

  it('keeps the geo banner action row while at least one action is offered', async () => {
    const screen = await render(
      <MapCanvas {...baseProps} isMobile showProgress={false} showGeoBanner />,
    )

    expect(screen.getByTestId('map-geo-banner-actions')).toBeTruthy()
    expect(screen.getByTestId('map-geo-retry')).toBeTruthy()
  })

  it('shows when a trusted live fix is temporarily refreshing', async () => {
    const screen = await render(
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

  it('shows low accuracy and stale live-fix states without replacing the user point', async () => {
    const lowAccuracy = await render(
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
    await lowAccuracy.unmount()

    const stale = await render(
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

/**
 * Регрессия #1272: у неподвижного пользователя «Местоположение давно не
 * обновлялось» загоралось через 30 с на ровном месте. Свежесть меряли по
 * последней ОПУБЛИКОВАННОЙ точке, а публикация пропускает сдвиги меньше 12 м —
 * значит, у стоящего на месте она не обновлялась никогда. По той же причине не
 * годится timestamp из ОС: первый фикс Android отдаёт из кэша просроченным.
 */
describe('MapCanvas — свежесть позиции считается по пульсу приёма фиксов', () => {
  const currentLocation = (timestamp: number) => ({
    status: 'current' as const,
    coordinates: { latitude: 52.2, longitude: 20.98 },
    accuracy: 8,
    timestamp,
    canAskAgain: true,
  })

  afterEach(() => {
    resetLiveUserPosition()
  })

  it('молчит, пока тики приходят, даже если фикс из ОС давно просрочен', async () => {
    markLiveUserPositionFix(Date.now())

    const { queryByText } = await render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        locationState={currentLocation(Date.now() - 10 * 60_000)}
        coordinatesSource="geolocation"
      />,
    )

    expect(queryByText('Местоположение давно не обновлялось')).toBeNull()
  })

  it('показывает баннер, когда тиков действительно нет', async () => {
    markLiveUserPositionFix(Date.now() - 31_000)

    const { getByText } = await render(
      <MapCanvas
        {...baseProps}
        showProgress={false}
        locationState={currentLocation(Date.now() - 31_000)}
        coordinatesSource="geolocation"
      />,
    )

    expect(getByText('Местоположение давно не обновлялось')).toBeTruthy()
  })
})
