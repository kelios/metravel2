/**
 * #2777 (MAP-TOOLBAR-ICON-SEMANTICS) — иконка кнопки карты соответствует её
 * действию. На проде сброс фильтров рисовался `maximize` («развернуть»), вход в
 * маршрут — `navigation` (стрелка «где я»), а тур по карте показывал рядом с
 * кнопкой другой глиф, чем на самой кнопке.
 */
import React from 'react'
import Feather from '@expo/vector-icons/Feather'
import { StyleSheet } from 'react-native'
import { cleanup, render } from '@testing-library/react-native'

import { MapMobileTopOverlay } from '@/components/MapPage/MapMobile/MapMobileTopOverlay'
import MapPanelHeader from '@/components/MapPage/MapPanelHeader'
import { getOnboardingSteps, getPhoneOnboardingSteps } from '@/components/MapPage/MapOnboarding'
import {
  MAP_ACTION_ICON,
  MAP_EXPAND_LOOKALIKE_ICONS,
  MAP_GEOLOCATION_LOOKALIKE_ICONS,
} from '@/components/MapPage/mapActionIcons'
import { getThemedColors } from '@/constants/designSystem'
import { getStyles } from '@/screens/tabs/map.styles'
import {
  getMapMobileTopOverlayStyles,
  MAP_TOOLBAR_TOUCH_TARGET_SIZE,
} from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles'
import { resources } from '@/i18n/resources'
import { translate as i18nT } from '@/i18n'

const colors = getThemedColors(false) as any

const baseProps = {
  colors,
  topInset: 24,
  radiusBadge: '60',
  activePopover: null,
  onToggleRadius: jest.fn(),
  onToggleLayers: jest.fn(),
  onClosePopover: jest.fn(),
  onOpenFilters: jest.fn(),
  onCenterOnUser: jest.fn(),
  onShowAllPlaces: jest.fn(),
  onOpenList: jest.fn(),
  listBadge: '149',
  radiusOptions: [{ id: '60', name: '60 км' }],
  radiusValue: '60',
  onRadiusSelect: jest.fn(),
  onEnterRoute: jest.fn(),
} as const

const iconOf = (node: any): string => node.findByType(Feather).props.name

afterEach(cleanup)

describe('map action icons match their actions (#2777)', () => {
  it('reset is a reset glyph, not «expand»', () => {
    const { getByTestId } = render(<MapMobileTopOverlay {...(baseProps as any)} />)
    const icon = iconOf(getByTestId('map-mobile-show-all'))

    expect(icon).toBe(MAP_ACTION_ICON.reset)
    expect(MAP_EXPAND_LOOKALIKE_ICONS).not.toContain(icon)
  })

  it('route entry and the route-mode indicator use the route glyph, not a geolocation arrow', () => {
    const radius = render(<MapMobileTopOverlay {...(baseProps as any)} />)
    const entryIcon = iconOf(radius.getByTestId('map-mobile-route-button'))
    radius.unmount()

    const route = render(
      <MapMobileTopOverlay
        {...(baseProps as any)}
        mode="route"
        onToggleTransport={jest.fn()}
        onClearRoute={jest.fn()}
      />,
    )
    const indicatorIcon = iconOf(route.getByTestId('map-mobile-route-button'))

    for (const icon of [entryIcon, indicatorIcon]) {
      expect(icon).toBe(MAP_ACTION_ICON.route)
      expect(MAP_GEOLOCATION_LOOKALIKE_ICONS).not.toContain(icon)
    }
  })

  it('«my location» keeps the only locate glyph in the row', () => {
    const { getByTestId } = render(<MapMobileTopOverlay {...(baseProps as any)} />)
    expect(iconOf(getByTestId('map-center-user-quick'))).toBe(MAP_ACTION_ICON.locate)
  })

  it('every phone tour step shows the glyph of the button it points at', () => {
    const { getByTestId } = render(<MapMobileTopOverlay {...(baseProps as any)} />)
    for (const step of getPhoneOnboardingSteps()) {
      if (!step.targetTestID) continue
      expect({ target: step.targetTestID, icon: step.icon }).toEqual({
        target: step.targetTestID,
        icon: iconOf(getByTestId(step.targetTestID)),
      })
    }
  })

  it('every desktop tour step shows the glyph of the panel tab it points at', () => {
    const { getByTestId } = render(
      <MapPanelHeader
        activeTab="search"
        travelsCount={3}
        themedColors={colors}
        styles={getStyles(false, 0, colors)}
        selectSearchTab={jest.fn()}
        selectRouteTab={jest.fn()}
        selectTravelsTab={jest.fn()}
      />,
    )
    for (const step of getOnboardingSteps()) {
      if (!step.targetTestID) continue
      expect({ target: step.targetTestID, icon: step.icon }).toEqual({
        target: step.targetTestID,
        icon: iconOf(getByTestId(step.targetTestID)),
      })
    }
    expect(iconOf(getByTestId('map-panel-tab-route'))).toBe(MAP_ACTION_ICON.route)
  })
})

// #2777 (ревью): у сброса и входа в маршрут — видимые подписи, ряд помещается на 320.
describe('labelled reset and route entry in the map toolbar (#2777)', () => {
  const KEY = 'components.MapPage.MapMobile.MapMobileTopOverlay'
  const LABEL_MAX_CHARS = 8

  it('shows «Сбросить» and «Маршрут» as visible labels with names that contain them', () => {
    const { getByTestId, getByText } = render(<MapMobileTopOverlay {...(baseProps as any)} />)
    const reset = getByTestId('map-mobile-show-all')
    const route = getByTestId('map-mobile-route-button')
    const resetLabel = i18nT(`map:${KEY}.resetShort` as any)
    const routeLabel = i18nT(`map:${KEY}.routeShort` as any)

    expect(getByText(resetLabel)).toBeTruthy()
    expect(getByText(routeLabel)).toBeTruthy()
    expect(reset.props.accessibilityLabel.toLowerCase()).toContain(resetLabel.toLowerCase())
    expect(route.props.accessibilityLabel.toLowerCase()).toContain(routeLabel.toLowerCase())
    for (const node of [reset, route]) {
      const style = StyleSheet.flatten(node.props.style) as any
      expect(style.height).toBe(MAP_TOOLBAR_TOUCH_TARGET_SIZE)
      expect(style.minWidth).toBeGreaterThanOrEqual(44)
    }
  })

  it('no reset button without a reset action (nothing to reset)', () => {
    const { queryByTestId } = render(
      <MapMobileTopOverlay {...(baseProps as any)} onShowAllPlaces={undefined} />,
    )
    expect(queryByTestId('map-mobile-show-all')).toBeNull()
  })

  it('the radius-mode row fits 320 at its minimum widths', () => {
    const styles = getMapMobileTopOverlayStyles(colors) as any
    const available = 320 - MAP_TOOLBAR_TOUCH_TARGET_SIZE - 10
    const row = 4 * styles.iconButtonTouch.minWidth + 2 * styles.labeledButtonTouch.minWidth
    expect(row).toBeLessThanOrEqual(available)
  })

  it.each(Object.keys(resources) as (keyof typeof resources)[])('%s labels stay short', (locale) => {
    const bundle = resources[locale].map as Record<string, string>
    for (const key of ['resetShort', 'routeShort']) {
      const label = bundle[`${KEY}.${key}`]
      expect(typeof label).toBe('string')
      expect([...label].length).toBeLessThanOrEqual(LABEL_MAX_CHARS)
    }
  })
})

