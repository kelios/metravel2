/**
 * #2236 (MAP-OVERLAY-HITSLOP-LEAK-001): над native-картой ни у одного узла нет
 * `hitSlop`.
 *
 * Почему: на Android `ReactRootView` отдаёт касание в JS, но не перехватывает
 * нативное событие. JS-цель ищется с учётом `hitSlop`, а нативное касание
 * достаётся тому вью, в чьи границы попала точка. В кольце `hitSlop` вокруг
 * кнопки над картой JS срабатывает на кнопку, а нативное касание получает
 * WebView карты (`MAP_CLICK`): в режиме маршрута ставится лишняя точка, на
 * мобильной раскладке закрывается открытая карточка места. Одно касание — две
 * реакции. Тач-таргет над картой — только собственная рамка вью (44, тулбар 48).
 *
 * Это второй постоянный контроль семейства. Первый — статический
 * `scripts/guard-touch-targets.js` (`MAP_OVERLAY_HITSLOP_*`); этот тест ловит то,
 * что статический разбор не видит: проп, пришедший через spread, хелпер из
 * другого модуля или `Platform.select` под конкретную платформу. Поэтому слои
 * рендерятся по-настоящему, отдельно под `ios` и `android` (свежий реестр
 * модулей на платформу: константы вида `Platform.OS === 'android'` в модулях
 * вычисляются при загрузке).
 *
 * Тело шторки (список, фильтры) заменено заглушкой: это сплошная панель, а её
 * файлы (`TravelListPanel`, `CollapsibleSection`, `MapSearchInput`) — явные
 * исключения guard с причиной. Содержимое карточки места (`PlacePopupCard`)
 * лежит в сплошной `nativePanel` карточки; его кнопки покрывает guard.
 */

type Os = 'ios' | 'android'

jest.mock('expo-router', () => ({
  usePathname: () => '/map',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('react-native-gesture-handler', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    GestureHandlerRootView: ({ children, ...props }: any) => React.createElement(View, props, children),
  }
})

// Шторка рендерится сквозной: дети и backdrop — настоящие узлы MapBottomSheet.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  const BottomSheet = React.forwardRef(({ children, backdropComponent }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      snapToIndex: jest.fn(),
      snapToPosition: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
      forceClose: jest.fn(),
    }))
    return React.createElement(
      View,
      { testID: 'gorhom-bottom-sheet' },
      backdropComponent ? backdropComponent({}) : null,
      children,
    )
  })
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetView: ({ children, ...props }: any) => React.createElement(View, props, children),
    BottomSheetScrollView: ({ children, ...props }: any) => React.createElement(View, props, children),
  }
})

jest.mock('@/components/MapPage/MapMobile/MapMobileSheetBody', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { MapMobileSheetBody: () => React.createElement(View, { testID: 'mock-sheet-body' }) }
})

jest.mock('@/components/MapPage/Map/createMapPopupComponent', () => ({
  __esModule: true,
  createMapPopupComponent: () =>
    function MockPopup() {
      const React = require('react')
      const { Text } = require('react-native')
      return React.createElement(Text, { testID: 'mock-popup-content' }, 'content')
    },
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

const loadForPlatform = (os: Os) => {
  jest.resetModules()
  const RN = require('react-native')
  RN.Platform.OS = os
  // Мок Platform из jest-expo резолвится как `Platform.ios.js`, и его `select`
  // жёстко выбирает ветку `ios`; под android подменяем выбор ветки.
  RN.Platform.select = (spec: Record<string, unknown>) =>
    os in spec ? spec[os] : 'native' in spec ? spec.native : spec.default
  return {
    React: require('react'),
    RNTL: require('@testing-library/react-native/pure'),
    getThemedColors: require('@/constants/designSystem').getThemedColors,
    MapMobileTopOverlay: require('@/components/MapPage/MapMobile/MapMobileTopOverlay').MapMobileTopOverlay,
    MapMobileLayersPopover: require('@/components/MapPage/MapMobile/MapMobileLayersPopover').MapMobileLayersPopover,
    MapEmptyStateToast: require('@/components/MapPage/MapMobile/MapEmptyStateToast').MapEmptyStateToast,
    MapMobileLayout: require('@/components/MapPage/MapMobileLayout').MapMobileLayout,
    MapPlaceBottomCard: require('@/components/MapPage/MapPlaceBottomCard').default,
  }
}

type Env = ReturnType<typeof loadForPlatform>

/** Ближайший testID вверх по дереву — адрес находки в сообщении. */
const addressOf = (node: any): string => {
  let current = node
  while (current) {
    if (current.props?.testID) return String(current.props.testID)
    current = current.parent
  }
  return '(без testID)'
}

const typeName = (node: any) => {
  // forwardRef/memo-обёртки (Pressable = memo(forwardRef(fn))) хранят имя во
  // внутреннем render/type — спускаемся до первого имени.
  let type = node.type
  for (let depth = 0; type && depth < 4; depth += 1) {
    if (typeof type === 'string') return type
    if (type.displayName || type.name) return type.displayName || type.name
    type = type.render ?? type.type
  }
  return '(composite)'
}

/** Все узлы (host и composite) с `hitSlop` — в виде, пригодном для сообщения. */
const findHitSlopNodes = (root: any) =>
  root
    .findAll((node: any) => node.props != null && node.props.hitSlop != null)
    .map((node: any) => `${typeName(node)} @ ${addressOf(node)} hitSlop=${JSON.stringify(node.props.hitSlop)}`)

const OS_LIST: Os[] = ['ios', 'android']

describe.each(OS_LIST)('слои над native-картой без hitSlop (#2236) — %s', (os) => {
  let env: Env
  let colors: any

  beforeAll(() => {
    env = loadForPlatform(os)
    colors = env.getThemedColors(false)
  })

  afterEach(() => {
    env.RNTL.cleanup()
  })

  const h = (component: any, props: Record<string, unknown>) => env.React.createElement(component, props)

  const renderLayer = (element: any, expectedTestIds: string[]) => {
    const screen = env.RNTL.render(element)
    // Контроль невакуумности: нужные кнопки слоя действительно отрендерились.
    for (const testID of expectedTestIds) {
      expect({ testID, rendered: screen.queryAllByTestId(testID).length > 0 }).toEqual({ testID, rendered: true })
    }
    return screen
  }

  const expectNoHitSlop = (screen: any) => {
    expect(findHitSlopNodes(screen.UNSAFE_root)).toEqual([])
  }

  const overlayProps = () => ({
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
    onEnterRoute: jest.fn(),
    listBadge: '246',
    radiusOptions: [
      { id: '50', name: '50 км' },
      { id: '100', name: '100 км' },
    ],
    radiusValue: '50',
    onRadiusSelect: jest.fn(),
    overlayOptions: [{ id: 'weather', title: 'Погода' }],
    enabledOverlays: { weather: false },
    onOverlayToggle: jest.fn(),
    onResetOverlays: jest.fn(),
    activeFilters: [{ key: 'category:1', label: 'Замки' }],
    onRemoveActiveFilter: jest.fn(),
    onClearActiveFilters: jest.fn(),
    hasActiveFilters: true,
  })

  const routeProps = () => ({
    ...overlayProps(),
    mode: 'route',
    transportMode: 'car',
    onToggleTransport: jest.fn(),
    onTransportSelect: jest.fn(),
    onClearRoute: jest.fn(),
    onUseUserLocationStart: jest.fn(),
    onStartManualRoute: jest.fn(),
  })

  it('модули слоёв загружены под эту платформу', () => {
    expect(require('react-native').Platform.OS).toBe(os)
    expect(require('react-native').Platform.select({ ios: 'ios', android: 'android' })).toBe(os)
  })

  it('тулбар в radius-режиме с рядом чипов', () => {
    const screen = renderLayer(h(env.MapMobileTopOverlay, overlayProps()), [
      'map-center-user-quick',
      'map-mobile-filters-button',
      'map-mobile-radius-button',
      'map-mobile-layers-button',
      'map-mobile-open-list',
      'map-mobile-route-button',
    ])
    expectNoHitSlop(screen)
  })

  it('тулбар с открытым поповером радиуса', () => {
    const screen = renderLayer(h(env.MapMobileTopOverlay, { ...overlayProps(), activePopover: 'radius' }), [
      'map-center-user-quick',
    ])
    expectNoHitSlop(screen)
  })

  it('тулбар с открытым поповером «Слои»', () => {
    const screen = renderLayer(h(env.MapMobileTopOverlay, { ...overlayProps(), activePopover: 'layers' }), [
      'map-mobile-layers-popover',
      'map-mobile-layers-popover-close',
    ])
    expectNoHitSlop(screen)
  })

  it('тулбар в route-режиме: выбор старта и подсказка с «Разрешить»', () => {
    const screen = renderLayer(
      h(env.MapMobileTopOverlay, {
        ...routeProps(),
        routePointCount: 0,
        hasUserLocation: false,
        onRequestLocation: jest.fn(),
      }),
      [
        'map-center-user-quick',
        'map-mobile-transport-button',
        'map-mobile-route-start-user',
        'map-mobile-route-start-map',
        'map-mobile-route-hint',
        'map-mobile-route-request-location',
      ],
    )
    expectNoHitSlop(screen)
  })

  it('тулбар в route-режиме с поповером транспорта', () => {
    const screen = renderLayer(
      h(env.MapMobileTopOverlay, { ...routeProps(), routePointCount: 1, activePopover: 'transport' }),
      ['map-mobile-transport-button'],
    )
    expectNoHitSlop(screen)
  })

  it('тулбар в route-режиме со сводкой готового маршрута', () => {
    const screen = renderLayer(
      h(env.MapMobileTopOverlay, {
        ...routeProps(),
        routePointCount: 2,
        routeDistance: 4200,
        routeDuration: 900,
      }),
      ['map-mobile-route-clear-button', 'map-mobile-route-summary-close'],
    )
    expectNoHitSlop(screen)
  })

  it('поповер «Слои» отдельно (его же монтирует планшетная раскладка)', () => {
    const screen = renderLayer(
      h(env.MapMobileLayersPopover, {
        colors,
        top: 80,
        overlayOptions: [{ id: 'weather', title: 'Погода' }],
        enabledOverlays: { weather: false },
        onOverlayToggle: jest.fn(),
        onRequestClose: jest.fn(),
      }),
      ['map-mobile-layers-popover-close'],
    )
    expectNoHitSlop(screen)
  })

  it('плашка пустого состояния с обоими действиями', () => {
    const screen = renderLayer(
      h(env.MapEmptyStateToast, {
        colors,
        nextRadiusOption: { id: '100', name: '100' },
        onExpandRadius: jest.fn(),
        hasActiveFilters: true,
        onResetFilters: jest.fn(),
        bottom: 96,
      }),
      ['map-empty-state-expand-radius', 'map-empty-state-reset'],
    )
    expectNoHitSlop(screen)
  })

  const layoutProps = () => ({
    mapComponent: h(require('react-native').View, { testID: 'mock-map' }),
    travelsData: [{ id: 1, coord: '53.9,27.56', address: 'Место' }],
    totalCount: 1,
    coordinates: { latitude: 53.9, longitude: 27.56 },
    transportMode: 'car',
    buildRouteTo: jest.fn(),
    onCenterOnUser: jest.fn(),
    onOpenFilters: jest.fn(),
    filtersPanelProps: null,
    canSearchThisArea: true,
    onSearchThisArea: jest.fn(),
    onShowAllPlaces: jest.fn(),
  })

  it('мобильная раскладка: тулбар, «Искать в этой области» и шапка нижней шторки', () => {
    const screen = renderLayer(h(env.MapMobileLayout, layoutProps()), [
      'map-mobile-top-overlay',
      'map-search-this-area',
      'travel-list-mobile-summary',
      'travel-list-open-filters',
      'map-mobile-sheet-close',
    ])
    expectNoHitSlop(screen)
  })

  it('мобильная раскладка с открытой карточкой места', () => {
    const screen = renderLayer(
      h(env.MapMobileLayout, {
        ...layoutProps(),
        selectedPlace: { id: 'place-1', coord: '53.9,27.56', address: 'Место' },
        clearSelectedPlace: jest.fn(),
      }),
      ['map-place-bottom-card', 'map-place-bottom-card-close', 'map-mobile-sheet-close'],
    )
    expectNoHitSlop(screen)
  })

  it('нижняя карточка места отдельно (native-ветка)', () => {
    const screen = renderLayer(
      h(env.MapPlaceBottomCard, {
        point: { id: '1', lat: 53.9, lng: 27.56, title: 'Место' },
        userLocation: null,
        onClose: jest.fn(),
        bottomInset: 72,
        topInset: 116,
      }),
      ['map-place-bottom-card', 'map-place-bottom-card-close'],
    )
    expectNoHitSlop(screen)
  })
})
