import React from 'react'
import { BackHandler, Platform, StyleSheet, View } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import {
  MapScreenDesktopChrome,
  MapScreenDesktopOverlays,
} from '@/components/MapPage/MapScreenParts/MapScreenDesktop'
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

jest.mock('@/utils/mapToasts', () => ({
  showFiltersResetToast: jest.fn(),
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

  function Chrome() {
    const [collapsed, setCollapsed] = React.useState(false)
    const [tab, setTab] = React.useState<'filters' | 'travels'>('filters')
    const styles = getStyles(false, 0, themedColors)
    return (
      <View testID="map-row" style={styles.mapContainer}>
        <MapScreenDesktopChrome
          styles={styles}
          themedColors={themedColors}
          isWeb={false}
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

  const rowChildren = (utils: ReturnType<typeof render>) => {
    const findRow = (node: any): any => {
      if (!node || typeof node !== 'object') return null
      if (node.props?.testID === 'map-row') return node
      for (const kid of node.children ?? []) {
        const found = findRow(kid)
        if (found) return found
      }
      return null
    }
    return (findRow(utils.toJSON())?.children ?? []) as any[]
  }
  const widthOf = (node: any) => StyleSheet.flatten(node?.props?.style)?.width

  it('the panel header carries the desktop actions, not the phone «Скрыть панель»', () => {
    const utils = render(<Chrome />)

    expect(utils.getByTestId('map-filters-button')).toBeTruthy()
    expect(utils.getByTestId('map-help-button')).toBeTruthy()
    expect(utils.getByTestId('map-reset-filters-button')).toBeTruthy()
    expect(utils.getByTestId('map-panel-tab-travels')).toBeTruthy()
    expect(utils.getByTestId('map-panel-tab-route')).toBeTruthy()
    expect(utils.queryByTestId('map-close-panel-button')).toBeNull()
    expect(utils.queryByTestId('map-panel-tab-search')).toBeNull()
    // The mouse-driven resize handle stays web-only.
    expect(utils.queryByTestId('map-panel-resize-handle')).toBeNull()
  })

  // Native honours hitSlop (web ignores it): a slop wider than the gap to the
  // neighbour reached into the neighbour's own 44pt box, so the right 4pt of
  // «Подсказки» fired «Сбросить фильтры» and the right 6pt of «Места» opened
  // «Маршрут». The own box is the target (scripts/guard-touch-targets.js).
  it('header targets never reach into their neighbour', () => {
    const utils = render(<Chrome />)
    const styles = getStyles(false, 0, themedColors)
    const reach = (testID: string) => {
      const slop = utils.getByTestId(testID).props.hitSlop
      if (slop == null) return 0
      return typeof slop === 'number' ? slop : Math.max(slop.left ?? 0, slop.right ?? 0)
    }
    const rows: [string[], number][] = [
      [['map-panel-tab-travels', 'map-panel-tab-route'], Number(styles.tabsSegment.columnGap)],
      [
        ['map-filters-button', 'map-help-button', 'map-reset-filters-button'],
        Number(styles.panelHeaderActions.gap),
      ],
    ]

    for (const [testIDs, gap] of rows) {
      expect(Number.isFinite(gap)).toBe(true)
      for (const testID of testIDs) {
        expect(reach(testID)).toBeLessThanOrEqual(gap)
      }
    }
  })

  it('collapses into the 56pt strip with no 360pt column left in the row, then expands back', () => {
    const utils = render(<Chrome />)

    let row = rowChildren(utils)
    expect(row).toHaveLength(2)
    expect(widthOf(row[0])).toBe(PANEL_WIDTH_NATIVE)
    expect(row[1].props.testID).toBe('map-host')

    fireEvent.press(utils.getByTestId('map-panel-collapse-button'))

    row = rowChildren(utils)
    expect(row).toHaveLength(2)
    expect(row[0].props.testID).toBe('map-panel-collapsed')
    expect(widthOf(row[0])).toBe(COLLAPSED_STRIP_WIDTH)
    expect(row.some((node) => widthOf(node) === PANEL_WIDTH_NATIVE)).toBe(false)
    expect(utils.queryByTestId('map-panel-tab-travels')).toBeNull()

    fireEvent.press(utils.getByTestId('map-panel-expand-button'))

    row = rowChildren(utils)
    expect(row).toHaveLength(2)
    expect(widthOf(row[0])).toBe(PANEL_WIDTH_NATIVE)
    expect(utils.getByTestId('map-panel-collapse-button')).toBeTruthy()
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

  it('the map carries the layers and radius controls; the floating filters button is gone', () => {
    const utils = renderOverlays()

    // Exactly the two on-map controls: the former FAB was a third button.
    expect(utils.getAllByRole('button')).toHaveLength(2)
    fireEvent.press(utils.getByTestId('map-desktop-layers-button'))
    expect(utils.getByTestId('layers-popover')).toBeTruthy()
    fireEvent.press(utils.getByTestId('map-desktop-radius-button'))
    expect(utils.getByTestId('radius-popover')).toBeTruthy()
    expect(utils.queryByTestId('layers-popover')).toBeNull()
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
    expect(topOf('map-desktop-layers-button')).toBe(16 + STATUS_BAR)
    expect(topOf('map-desktop-radius-button')).toBe(16 + STATUS_BAR)
    expect(utils.getByTestId('offline-indicator').props.top).toBe(10 + STATUS_BAR)

    fireEvent.press(utils.getByTestId('map-desktop-layers-button'))
    expect(utils.getByTestId('layers-popover').props.top).toBe(STATUS_BAR + 16 + 44 + 8)
  })
})
