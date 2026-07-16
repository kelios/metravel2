/**
 * Регрессия: «Искать в этой области» залипала на карте с первого кадра.
 *
 * Радиус-режим намеренно подгоняет вид с асимметричным padding (снизу
 * резервируется место под шторку), поэтому центр карты, на котором она
 * успокаивается, лежит заметно ниже центра круга поиска — на мобильном это
 * ~36px ≈ 26км при r=50км. Пока дрейф считался от ЯКОРЯ запроса, эта разница
 * читалась как «пользователь уехал», кнопка висела всегда, а нажатие тащило
 * зону поиска южнее того, что видит пользователь.
 *
 * Контракт: точка отсчёта — центр, на котором карта успокоилась после НАШЕГО
 * же движения (payload без userInitiated). Кнопка появляется только после
 * жеста пользователя.
 */
import { renderHook, act } from '@testing-library/react-native'

// ─── моки зависимостей хука ───────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  usePathname: () => '/map',
  useLocalSearchParams: () => ({}),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/hooks/map/useMapCoordinates', () => ({
  useMapCoordinates: () => ({
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    updateCoordinates: jest.fn(),
    error: null,
  }),
}))

jest.mock('@/hooks/map/useMapFilters', () => ({
  useMapFilters: () => ({
    filters: { categories: [], categoryTravelAddress: [], radius: [], address: [] },
    filterValues: { categories: [], categoryTravelAddress: [], radius: '60', address: '' },
    handleFilterChangeForPanel: jest.fn(),
    resetFilters: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useMapPanelState', () => ({
  useMapResponsive: () => ({ isMobile: false, width: 1280 }),
  useMapPanelState: () => ({
    isFocused: true,
    mapReady: true,
    rightPanelTab: 'list',
    rightPanelVisible: true,
    isDesktopCollapsed: false,
    desktopPanelWidth: 384,
    selectFiltersTab: jest.fn(),
    selectTravelsTab: jest.fn(),
    openRightPanel: jest.fn(),
    closeRightPanel: jest.fn(),
    toggleDesktopCollapse: jest.fn(),
    onResizePanelWidth: jest.fn(),
    panelStyle: {},
    overlayStyle: {},
    filtersTabRef: { current: null },
    panelRef: { current: null },
  }),
}))

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/utils/seo', () => ({
  buildCanonicalUrl: () => 'http://localhost/map',
}))

jest.mock('@/hooks/map/useMapDataController', () => ({
  useMapDataController: () => ({
    allTravelsData: [],
    travelsData: [],
    loading: false,
    isFetching: false,
    isPlaceholderData: false,
    mapError: null,
    mapErrorDetails: null,
    refetchMapData: jest.fn(),
    invalidateTravelsQuery: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useRouteController', () => ({
  useRouteController: () => ({
    mode: 'radius',
    setMode: jest.fn(),
    transportMode: 'car',
    setTransportMode: jest.fn(),
    routeStorePoints: [],
    startAddress: null,
    endAddress: null,
    routeDistance: null,
    fullRouteCoords: [],
    routingLoading: false,
    routingError: null,
    handleMapClick: jest.fn(),
    buildRouteTo: jest.fn(),
    handleClearRoute: jest.fn(),
    handleAddressSelect: jest.fn(),
    handleAddressClear: jest.fn(),
    onRemoveRoutePoint: jest.fn(),
    swapStartEnd: jest.fn(),
  }),
}))

jest.mock('@/hooks/useRouteStoreAdapter', () => ({
  useRouteStoreAdapter: () => ({
    mode: 'radius',
    setMode: jest.fn(),
    transportMode: 'car',
    setTransportMode: jest.fn(),
    routePoints: [],
    startAddress: null,
    endAddress: null,
    routeDistance: null,
    fullRouteCoords: [],
    setRoutePoints: jest.fn(),
    setRouteDistance: jest.fn(),
    setFullRouteCoords: jest.fn(),
    handleClearRoute: jest.fn(),
    handleAddressSelect: jest.fn(),
    points: [],
    isBuilding: false,
    error: null,
    clearRoute: jest.fn(),
    removePoint: jest.fn(),
    swapStartEnd: jest.fn(),
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#000',
    text: '#000',
    textMuted: '#666',
    surface: '#fff',
    surfaceMuted: 'rgba(255,255,255,0.75)',
    border: '#ddd',
    borderLight: '#eee',
  }),
}))

jest.mock('@/screens/tabs/map.styles', () => ({
  getStyles: () => ({}),
}))

jest.mock('@/utils/logger', () => ({
  logMessage: jest.fn(),
}))

jest.mock('@/utils/mapFiltersStorage', () => ({
  loadMapFilterValues: () => ({
    lastMode: 'radius',
    transportMode: 'car',
  }),
  saveMapFilterValues: jest.fn(),
}))

jest.mock('@/hooks/map/mapFiltersPanelLoader', () => ({
  FiltersPanelComponent: null,
  FiltersProviderComponent: null,
  preloadMapFiltersPanel: jest.fn(),
}))

jest.mock('@/stores/routeStore', () => ({
  useRouteStore: Object.assign(jest.fn(() => ({})), {
    getState: () => ({
      clearRouteAndSetMode: jest.fn(),
      forceRebuild: jest.fn(),
    }),
  }),
}))


// ─── подключаем хук после всех моков ─────────────────────────────────────────
import { useMapScreenController } from '@/hooks/useMapScreenController'

// Якорь запроса — Минск (см. мок useMapCoordinates). Радиус 60км → порог дрейфа
// clamp(60*0.3, 1.5, 25) = 18км.
const ANCHOR = { latitude: 53.9, longitude: 27.5667 }
// ~26км южнее якоря: ровно та «просадка», которую даёт fitBounds под шторку.
const FIT_SETTLE = { latitude: 53.666, longitude: 27.5667 }
// ~56км южнее — реальный пан пользователя за порог.
const USER_PANNED = { latitude: 53.4, longitude: 27.5667 }

describe('useMapScreenController — «Искать в этой области»', () => {
  it('молчит, когда карту сдвинула наша же подгонка вида, а не пользователь', () => {
    const { result } = renderHook(() => useMapScreenController())

    // Программный settle после fitBounds: центр НЕ совпадает с якорем.
    act(() => {
      result.current.mapPanelProps.onMapMove({ ...FIT_SETTLE })
    })

    expect(result.current.canSearchThisArea).toBe(false)
  })

  it('предлагает поиск только после жеста пользователя за порог', () => {
    const { result } = renderHook(() => useMapScreenController())

    act(() => {
      result.current.mapPanelProps.onMapMove({ ...FIT_SETTLE })
    })
    expect(result.current.canSearchThisArea).toBe(false)

    act(() => {
      result.current.mapPanelProps.onMapMove({ ...USER_PANNED, userInitiated: true })
    })
    expect(result.current.canSearchThisArea).toBe(true)
  })

  it('не реагирует на жест в пределах порога', () => {
    const { result } = renderHook(() => useMapScreenController())

    act(() => {
      result.current.mapPanelProps.onMapMove({ ...ANCHOR })
    })
    act(() => {
      // ~5км — сильно меньше 18км порога.
      result.current.mapPanelProps.onMapMove({
        latitude: ANCHOR.latitude - 0.045,
        longitude: ANCHOR.longitude,
        userInitiated: true,
      })
    })

    expect(result.current.canSearchThisArea).toBe(false)
  })

  it('прячет кнопку после нажатия и снова показывает после нового жеста', () => {
    const { result } = renderHook(() => useMapScreenController())

    act(() => {
      result.current.mapPanelProps.onMapMove({ ...FIT_SETTLE })
    })
    act(() => {
      result.current.mapPanelProps.onMapMove({ ...USER_PANNED, userInitiated: true })
    })
    expect(result.current.canSearchThisArea).toBe(true)

    // Нажатие переносит якорь поиска в текущий вид и делает его новой точкой
    // отсчёта — иначе кнопка осталась бы висеть поверх уже найденной области.
    act(() => {
      result.current.handleSearchThisArea()
    })
    expect(result.current.canSearchThisArea).toBe(false)

    act(() => {
      result.current.mapPanelProps.onMapMove({
        latitude: USER_PANNED.latitude - 0.6,
        longitude: USER_PANNED.longitude,
        userInitiated: true,
      })
    })
    expect(result.current.canSearchThisArea).toBe(true)
  })
})
