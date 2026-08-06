/**
 * Регрессия на семейство «интерактивный элемент меньше минимального тач-таргета»
 * (#192 → #1044 → #1271): у кнопок тулбара карты меряем РЕАЛЬНЫЙ размер вью.
 *
 * Почему нельзя зачесть hitSlop: на Android RN ищет цель, спускаясь по дереву, и
 * попадает в потомка только если точка уже внутри родителя. Ряд `toolbar`
 * обтягивает кнопки вплотную, поэтому hitSlop за его границы не выходит —
 * проверено tap-пробой на устройстве. Значит норма 48dp должна держаться
 * шириной/высотой самой кнопки.
 */
import { cleanup, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { MapMobileTopOverlay } from '@/components/MapPage/MapMobile/MapMobileTopOverlay'
import { MAP_TOOLBAR_TOUCH_TARGET_SIZE } from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles'
import { getThemedColors } from '@/constants/designSystem'

const colors = getThemedColors(false) as any

const RADIUS_MODE_BUTTONS = [
  'map-center-user-quick',
  'map-mobile-filters-button',
  'map-mobile-radius-button',
  'map-mobile-layers-button',
  'map-mobile-open-list',
  'map-mobile-show-all',
] as const

const ROUTE_MODE_BUTTONS = [
  'map-center-user-quick',
  'map-mobile-filters-button',
  'map-mobile-layers-button',
  'map-mobile-open-list',
  'map-mobile-route-button',
  'map-mobile-transport-button',
  'map-mobile-route-clear-button',
] as const

const baseProps = {
  colors,
  topInset: 24,
  radiusBadge: '50',
  activePopover: null,
  onToggleRadius: jest.fn(),
  onToggleLayers: jest.fn(),
  onClosePopover: jest.fn(),
  onOpenFilters: jest.fn(),
  onCenterOnUser: jest.fn(),
  onShowAllPlaces: jest.fn(),
  onOpenList: jest.fn(),
  listBadge: '246',
  radiusOptions: [{ id: '50', name: '50 км' }],
  radiusValue: '50',
  onRadiusSelect: jest.fn(),
} as const

afterEach(cleanup)

describe('MapMobileTopOverlay — тач-таргеты тулбара', () => {
  it('в radius-режиме каждая кнопка не меньше 48dp по обеим осям', () => {
    const { getByTestId } = render(<MapMobileTopOverlay {...(baseProps as any)} />)

    RADIUS_MODE_BUTTONS.forEach((testID) => {
      const style = StyleSheet.flatten(getByTestId(testID).props.style)
      expect({ testID, width: style.width, height: style.height }).toEqual({
        testID,
        width: MAP_TOOLBAR_TOUCH_TARGET_SIZE,
        height: MAP_TOOLBAR_TOUCH_TARGET_SIZE,
      })
    })
  })

  it('в route-режиме кнопки маршрута тоже держат 48dp', () => {
    const { getByTestId } = render(
      <MapMobileTopOverlay
        {...(baseProps as any)}
        mode="route"
        transportMode="car"
        onToggleTransport={jest.fn()}
        onTransportSelect={jest.fn()}
        onClearRoute={jest.fn()}
      />,
    )

    ROUTE_MODE_BUTTONS.forEach((testID) => {
      const style = StyleSheet.flatten(getByTestId(testID).props.style)
      expect({ testID, width: style.width, height: style.height }).toEqual({
        testID,
        width: MAP_TOOLBAR_TOUCH_TARGET_SIZE,
        height: MAP_TOOLBAR_TOUCH_TARGET_SIZE,
      })
    })
  })

  it('видимый круг остаётся 38dp, чтобы тулбар не раздувался', () => {
    const { getByTestId } = render(<MapMobileTopOverlay {...(baseProps as any)} />)

    const touch = getByTestId('map-mobile-filters-button')
    const surface = StyleSheet.flatten(touch.children[0].props.style)
    expect(surface.width).toBe(38)
    expect(surface.height).toBe(38)
  })
})

/**
 * #1274: тот же дефект жил в остальных контролах оверлея — их правил не тулбар,
 * поэтому #1271 их не закрыл. hitSlop тут так же бесполезен: и шапка сводки, и
 * селектор старта обтягивают своих потомков вплотную.
 */
describe('MapMobileTopOverlay — тач-таргеты контролов маршрута', () => {
  const routeProps = {
    ...baseProps,
    mode: 'route',
    transportMode: 'car',
    onToggleTransport: jest.fn(),
    onTransportSelect: jest.fn(),
    onClearRoute: jest.fn(),
  } as const

  it('пилюли выбора старта держат 44dp по высоте (было 36)', () => {
    const { getByTestId } = render(
      <MapMobileTopOverlay {...(routeProps as any)} onUseUserLocationStart={jest.fn()} onStartManualRoute={jest.fn()} />,
    )

    for (const testID of ['map-mobile-route-start-user', 'map-mobile-route-start-map']) {
      const style = StyleSheet.flatten(getByTestId(testID).props.style)
      expect({ testID, minHeight: style.minHeight }).toEqual({ testID, minHeight: 44 })
    }
  })

  it('действие в подсказке маршрута держит 44dp и не раздувает плашку', () => {
    const { getByTestId } = render(
      <MapMobileTopOverlay {...(routeProps as any)} routePointCount={0} hasUserLocation={false} onRequestLocation={jest.fn()} />,
    )

    const style = StyleSheet.flatten(getByTestId('map-mobile-route-request-location').props.style)
    expect(style.minHeight).toBe(44)
    // Отрицательные поля съедают padding плашки, поэтому она остаётся одноярусной.
    expect(style.marginVertical).toBe(-6)
  })

  it('крестик сводки маршрута: рамка 48dp, видимый круг прежние 26dp', () => {
    const { getByTestId } = render(
      <MapMobileTopOverlay {...(routeProps as any)} routePointCount={2} routeDistance={4200} routeDuration={900} />,
    )

    const touch = getByTestId('map-mobile-route-summary-close')
    const touchStyle = StyleSheet.flatten(touch.props.style)
    expect({ width: touchStyle.width, height: touchStyle.height }).toEqual({ width: 48, height: 48 })
    // Рамка вынесена в отрицательные поля — шапка карточки прежней высоты.
    expect(touchStyle.margin).toBe(-11)

    const circle = StyleSheet.flatten(touch.children[0].props.style)
    expect({ width: circle.width, height: circle.height }).toEqual({ width: 26, height: 26 })
  })
})
