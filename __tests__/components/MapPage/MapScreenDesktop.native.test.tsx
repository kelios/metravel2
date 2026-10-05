import React from 'react'
import { BackHandler, Platform, StyleSheet, View } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import {
  MapScreenDesktopChrome,
  MapScreenDesktopOverlays,
} from '@/components/MapPage/MapScreenParts/MapScreenDesktop'
import { restartMapOnboarding } from '@/components/MapPage/MapOnboarding'
import { getDesktopBranchTopInset, getStyles } from '@/screens/tabs/map.styles'
import { translate as i18nT } from '@/i18n'

jest.mock('@/screens/tabs/mapDeferred', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    ActiveFiltersBar: () => null,
    MapOnboarding: () => null,
    TravelListPanel: () => React.createElement(View, { testID: 'travel-list-panel' }),
  }
})

jest.mock('@/components/MapPage/MapOnboarding', () => ({
  __esModule: true,
  restartMapOnboarding: jest.fn(),
}))

jest.mock('@/components/MapPage/MapOfflineIndicator', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    MAP_OFFLINE_INDICATOR_TOP: 10,
    MapOfflineIndicator: (props: any) => React.createElement(View, { testID: 'offline-indicator', ...props }),
  }
})

jest.mock('@/components/MapPage/MapMobile/MapMobileLayersPopover', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { MapMobileLayersPopover: (props: any) => React.createElement(View, { testID: 'layers-popover', top: props.top }) }
})

jest.mock('@/components/MapPage/MapMobile/MapMobileRadiusPopover', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { MapMobileRadiusPopover: (props: any) => React.createElement(View, { testID: 'radius-popover', top: props.top }) }
})

const themedColors: any = {
  background: '#ffffff',
  backgroundSecondary: '#f7f7f7',
  surface: '#ffffff',
  surfaceMuted: '#f5f5f5',
  surfaceAlpha40: 'rgba(255,255,255,0.4)',
  border: '#e5e5e5',
  borderLight: '#eeeeee',
  overlay: 'rgba(0,0,0,0.35)',
  overlayLight: 'rgba(0,0,0,0.1)',
  primary: '#3b82f6',
  primaryAlpha30: 'rgba(59,130,246,0.3)',
  primaryLight: '#dbeafe',
  text: '#111111',
  textMuted: '#666666',
  textInverse: '#ffffff',
  textOnPrimary: '#ffffff',
  warning: '#f59e0b',
  shadows: {
    light: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    heavy: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  },
  boxShadows: { card: '0 1px 2px rgba(0,0,0,0.1)', medium: '0 6px 16px rgba(0,0,0,0.12)' },
}

const PANEL_WIDTH_NATIVE = 360
const COLLAPSED_STRIP_WIDTH = 56

// The desktop chrome beside a stand-in map host, inside the shell row.
function Chrome({ isWeb = false }: { isWeb?: boolean }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [tab, setTab] = React.useState<'filters' | 'travels'>('filters')
  const styles = getStyles(false, 0, themedColors)
  return (
    <View testID="map-row" style={styles.mapContainer}>
      <MapScreenDesktopChrome
        styles={styles}
        themedColors={themedColors}
        isWeb={isWeb}
        isMobile={false}
        isDesktopCollapsed={collapsed}
        desktopPanelWidth={384}
        rightPanelTab={tab}
        activePanelTab={tab === 'travels' ? 'travels' : 'search'}
        panelRef={null}
        panelStyle={null}
        toggleDesktopCollapse={() => setCollapsed((value) => !value)}
        handleSelectSearchTab={() => setTab('filters')}
        handleSelectRouteTab={() => setTab('filters')}
        selectTravelsTab={() => setTab('travels')}
        handleResizeMouseDown={jest.fn()}
        filtersPanelProps={null}
        activeFilterItems={[]}
        handleRemoveActiveFilter={jest.fn()}
        handleClearAllFilters={jest.fn()}
        handleExpandRadius={jest.fn()}
        travelsData={[]}
        loading={false}
        isFetching={false}
        isPlaceholderData={false}
        hasMore={false}
        refetchMapData={jest.fn()}
        buildRouteTo={jest.fn()}
        travelsCount={123}
        currentRadius="60"
        coordinates={null}
        transportMode="car"
        isConnected
        mapReady
        shouldLoadOnboarding={false}
      />
      <View testID="map-host" style={styles.mapHost} />
    </View>
  )
}

const findByTestID = (node: any, testID: string): any => {
  if (!node || typeof node !== 'object') return null
  if (node.props?.testID === testID) return node
  for (const kid of node.children ?? []) {
    const found = findByTestID(kid, testID)
    if (found) return found
  }
  return null
}
const rowChildren = (utils: ReturnType<typeof render>) =>
  (findByTestID(utils.toJSON(), 'map-row')?.children ?? []) as any[]
const widthOf = (node: any) => StyleSheet.flatten(node?.props?.style)?.width

// #2172 — iPad and Android tablets (width ≥ 768) render the desktop branch. It
// used to be assembled from web gates: the header showed the phone «Скрыть
// панель», which left an invisible 360pt column in the row, and the strip,
// the collapse chevron and the on-map controls existed only on web.
describe.each(['ios', 'android'])('map desktop branch on a %s tablet (#2172)', (os) => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS })
  })

  // #2217 — the header row belongs to the tabs only: «Фильтры» became the third
  // tab, «Подсказки» moved onto the map, «Сбросить» into the filters footer.
  it('the panel header is the three tabs, without header actions or the phone «Скрыть панель»', () => {
    const utils = render(<Chrome />)

    for (const testID of ['map-panel-tab-travels', 'map-panel-tab-route', 'map-panel-tab-filters']) {
      expect(utils.getByTestId(testID)).toBeTruthy()
    }
    for (const testID of [
      'map-filters-button',
      'map-help-button',
      'map-reset-filters-button',
      'map-close-panel-button',
      'map-panel-tab-search',
    ]) {
      expect(utils.queryByTestId(testID)).toBeNull()
    }
    // The mouse-driven resize handle stays web-only.
    expect(utils.queryByTestId('map-panel-resize-handle')).toBeNull()
  })

  // Native honours hitSlop (web ignores it): a slop wider than the gap to the
  // neighbour reached into the neighbour's own 44pt box (the right 6pt of
  // «Места» opened «Маршрут»). The own box is the target
  // (scripts/guard-touch-targets.js).
  it('header tabs never reach into their neighbour', () => {
    const utils = render(<Chrome />)
    const styles = getStyles(false, 0, themedColors)
    const gap = Number(styles.tabsSegment.columnGap)
    expect(Number.isFinite(gap)).toBe(true)

    for (const testID of ['map-panel-tab-travels', 'map-panel-tab-route', 'map-panel-tab-filters']) {
      const slop = utils.getByTestId(testID).props.hitSlop
      const reach = slop == null ? 0 : typeof slop === 'number' ? slop : Math.max(slop.left ?? 0, slop.right ?? 0)
      expect(reach).toBeLessThanOrEqual(gap)
    }
  })

  it('collapses into the 56pt strip with no 360pt column left in the row, then expands back', () => {
    const utils = render(<Chrome />)

    let row = rowChildren(utils)
    // Panel, then the chevron as its row sibling (inside the row's bounds —
    // Android routes the native touch by parent bounds), then the map host.
    expect(row).toHaveLength(3)
    expect(widthOf(row[0])).toBe(PANEL_WIDTH_NATIVE)
    expect(row[1].props.testID).toBe('map-panel-collapse-button')
    expect(StyleSheet.flatten(row[1].props.style).position).toBe('absolute')
    expect(row[2].props.testID).toBe('map-host')

    fireEvent.press(utils.getByTestId('map-panel-collapse-button'))

    row = rowChildren(utils)
    expect(row).toHaveLength(2)
    expect(row[0].props.testID).toBe('map-panel-collapsed')
    expect(widthOf(row[0])).toBe(COLLAPSED_STRIP_WIDTH)
    expect(row.some((node) => widthOf(node) === PANEL_WIDTH_NATIVE)).toBe(false)
    expect(utils.queryByTestId('map-panel-tab-travels')).toBeNull()

    fireEvent.press(utils.getByTestId('map-panel-expand-button'))

    row = rowChildren(utils)
    expect(row).toHaveLength(3)
    expect(widthOf(row[0])).toBe(PANEL_WIDTH_NATIVE)
    expect(row[1].props.testID).toBe('map-panel-collapse-button')
  })

  it('a strip icon expands the panel on its tab', () => {
    const utils = render(<Chrome />)

    fireEvent.press(utils.getByTestId('map-panel-collapse-button'))
    fireEvent.press(
      utils.getByLabelText(
        i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.spisok_tochek_value1_3daae6f8', { value1: 123 }),
      ),
    )

    expect(utils.queryByTestId('map-panel-collapsed')).toBeNull()
    expect(utils.getByTestId('travel-list-panel')).toBeTruthy()
  })

  const renderOverlays = (topInset = 0, isConnected = true) =>
    render(
      <MapScreenDesktopOverlays
        styles={getStyles(false, topInset, themedColors)}
        themedColors={themedColors}
        isMobile={false}
        topInset={getDesktopBranchTopInset(topInset)}
        isConnected={isConnected}
        mapReady
        shouldLoadOnboarding={false}
        mapUiApi={null}
        overlayOptions={[]}
        enabledOverlays={{}}
        onOverlayToggle={jest.fn()}
        onResetOverlays={jest.fn()}
        radiusOptions={[{ id: '60', name: '60' }]}
        radiusValue="60"
        onRadiusSelect={jest.fn()}
      />,
    )

  // Over the native map WebView a hitSlop ring leaks taps on Android: the JS
  // target grows by it while the native touch outside the view lands on the
  // map (a route point in «Маршрут»). Targets are their own 44pt boxes.
  it('controls over or beside the map carry no hitSlop', () => {
    const chrome = render(<Chrome />)
    expect(chrome.getByTestId('map-panel-collapse-button').props.hitSlop).toBeUndefined()
    fireEvent.press(chrome.getByTestId('map-panel-collapse-button'))
    expect(chrome.getByTestId('map-panel-expand-button').props.hitSlop).toBeUndefined()

    const overlays = renderOverlays()
    expect(overlays.getByTestId('map-desktop-help-button').props.hitSlop).toBeUndefined()
    expect(overlays.getByTestId('map-desktop-layers-button').props.hitSlop).toBeUndefined()
    expect(overlays.getByTestId('map-desktop-radius-button').props.hitSlop).toBeUndefined()
  })

  // BUG-CLASS-5: an open overlay closes on Android Back before Back navigates
  // away, as the phone layout already does for the same popovers.
  it('Android Back closes an open on-map popover first; with none open Back stays default', () => {
    let hardwareBack: (() => boolean) | undefined
    const remove = jest.fn()
    const addListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_eventName: any, handler: any) => {
        hardwareBack = handler
        return { remove } as any
      })

    try {
      const utils = renderOverlays()
      expect(addListener).not.toHaveBeenCalled()

      fireEvent.press(utils.getByTestId('map-desktop-radius-button'))
      expect(utils.getByTestId('radius-popover')).toBeTruthy()

      if (os === 'android') {
        expect(addListener).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function))
        let consumed: boolean | undefined
        act(() => {
          consumed = hardwareBack?.()
        })
        expect(consumed).toBe(true)
        expect(utils.queryByTestId('radius-popover')).toBeNull()
        expect(remove).toHaveBeenCalled()
      } else {
        // No hardware Back on iOS: nothing is registered.
        expect(addListener).not.toHaveBeenCalled()
      }
    } finally {
      addListener.mockRestore()
    }
  })

  it('the map carries «Радиус», «Слои», «Подсказки» in reading order; the floating filters button is gone', () => {
    const utils = renderOverlays()

    // Exactly the three on-map controls in the order of the picture: the top
    // row left to right, then «Подсказки» under «Слои» (#2217 moved it here
    // from the panel header); no floating filters button.
    expect(utils.getAllByRole('button').map((button) => button.props.testID)).toEqual([
      'map-desktop-radius-button',
      'map-desktop-layers-button',
      'map-desktop-help-button',
    ])
    expect(utils.getByLabelText(i18nT('map:components.MapPage.MapPanelHeader.pokazat_podskazki_po_karte_5d9bc7dd'))).toBeTruthy()
    ;(restartMapOnboarding as jest.Mock).mockClear()
    fireEvent.press(utils.getByTestId('map-desktop-help-button'))
    expect(restartMapOnboarding).toHaveBeenCalledTimes(1)

    // One cluster of 44 boxes 8 apart: «Радиус» and «Слои» in the top row with
    // «Слои» at the edge, «Подсказки» under «Слои» — the row does not grow left
    // into the centred «Искать в этой области» pill.
    const box = (testID: string) => StyleSheet.flatten(utils.getByTestId(testID).props.style)
    const [help, radius, layers] = [
      box('map-desktop-help-button'),
      box('map-desktop-radius-button'),
      box('map-desktop-layers-button'),
    ]
    expect(radius.top).toBe(layers.top)
    for (const fab of [help, radius, layers]) expect([fab.width, fab.height]).toEqual([44, 44])
    expect(layers.right).toBe(16)
    expect(radius.right - layers.right - layers.width).toBe(8)
    expect(help.right).toBe(layers.right)
    expect(help.top - layers.top - layers.height).toBe(8)

    // The «Слои» card opens on the spot of «Подсказки»: the button would sit
    // on the card's «×» (and start the tour), so it is gone while «Слои» is open.
    fireEvent.press(utils.getByTestId('map-desktop-layers-button'))
    expect(utils.getByTestId('layers-popover')).toBeTruthy()
    expect(utils.queryByTestId('map-desktop-help-button')).toBeNull()
    fireEvent.press(utils.getByTestId('map-desktop-radius-button'))
    expect(utils.getByTestId('radius-popover')).toBeTruthy()
    expect(utils.queryByTestId('layers-popover')).toBeNull()
    expect(utils.getByTestId('map-desktop-help-button')).toBeTruthy()
  })

  // The map route has no app header on native: the branch must clear the iPad
  // status bar itself — the row, the on-map controls, their popovers and the
  // offline pill all move down by the same inset.
  it('clears the status bar: the row, the on-map controls, their popovers and the offline pill', () => {
    const STATUS_BAR = 24
    const styles = getStyles(false, STATUS_BAR, themedColors)
    expect(styles.mapContainer.paddingTop).toBe(12 + STATUS_BAR)

    const utils = renderOverlays(STATUS_BAR, false)
    const topOf = (testID: string) => StyleSheet.flatten(utils.getByTestId(testID).props.style)?.top
    expect(topOf('map-desktop-help-button')).toBe(16 + STATUS_BAR + 44 + 8)
    expect(topOf('map-desktop-layers-button')).toBe(16 + STATUS_BAR)
    expect(topOf('map-desktop-radius-button')).toBe(16 + STATUS_BAR)
    expect(utils.getByTestId('offline-indicator').props.top).toBe(10 + STATUS_BAR)

    fireEvent.press(utils.getByTestId('map-desktop-layers-button'))
    expect(utils.getByTestId('layers-popover').props.top).toBe(STATUS_BAR + 16 + 44 + 8)
  })
})

// #2172 containment: the shared chrome forks only the chevron's parent. On web
// it stays a child of the panel past its right edge (DOM hit-testing reaches
// it); a row sibling with the web offsets would sit off the panel.
describe('map desktop branch on web (#2172 containment)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS })
  })

  it('keeps the collapse chevron inside the panel; the row holds the panel and the map', () => {
    const utils = render(<Chrome isWeb />)

    const row = rowChildren(utils)
    expect(row).toHaveLength(2)
    expect(row[1].props.testID).toBe('map-host')
    const chevron = findByTestID(row[0], 'map-panel-collapse-button')
    expect(chevron).toBeTruthy()
    const chevronStyle = StyleSheet.flatten(chevron.props.style)
    expect(chevronStyle).toMatchObject({ position: 'absolute', top: 16, right: -48 })
    expect(chevronStyle.left).toBeUndefined()

    fireEvent.press(utils.getByTestId('map-panel-collapse-button'))

    expect(rowChildren(utils)[0].props.testID).toBe('map-panel-collapsed')
    expect(utils.queryByTestId('map-panel-collapse-button')).toBeNull()
  })
})
