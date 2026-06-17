/**
 * Unit-тесты для логики handleOverlayToggle в useMapScreenController.
 *
 * Покрывает:
 * 1. Включение weather-temp → temp=true, labels=true, clouds/precip=false.
 * 2. Включение weather-precip при включённых temp+labels → precip=true, temp=false, labels=false.
 * 3. Прямое выключение weather-temp → temp=false, labels=false.
 * 4. Включение НЕ-погодного оверлея не сбрасывает другие (два одновременно).
 * 5. Граничный случай: labels=true, temp=false → включение другого heatmap НЕ трогает labels.
 *
 * Все тесты детерминированы: нет сети, нет таймеров.
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

jest.mock('@/hooks/map/useMapUIController', () => ({
  useMapUIController: () => ({
    isFocused: true,
    isMobile: false,
    mapReady: true,
    rightPanelTab: 'list',
    rightPanelVisible: true,
    selectFiltersTab: jest.fn(),
    selectTravelsTab: jest.fn(),
    openRightPanel: jest.fn(),
    closeRightPanel: jest.fn(),
    panelStyle: {},
    overlayStyle: {},
    filtersTabRef: { current: null },
    panelRef: { current: null },
    styles: {},
    themedColors: {},
    canonical: 'http://localhost',
    openNonce: 0,
  }),
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

// ─── константы из конфига (дублируем для удобочитаемости тестов) ──────────────
const TEMP = 'weather-temp'
const LABELS = 'weather-temp-labels'
const PRECIP = 'weather-precip'
const CLOUDS = 'weather-clouds'
const WATER = 'nature-water' // не-погодный оверлей без exclusiveGroup

// ─── хелперы доступа к вложенному API ────────────────────────────────────────
// handleOverlayToggle и enabledOverlays живут в filtersPanelProps.contextValue,
// а не в прямом return хука (паттерн facade + FiltersProvider).
const getToggle = (r: { current: any }): (id: string, enabled: boolean) => void =>
  r.current.filtersPanelProps.contextValue.onOverlayToggle

const getOverlays = (r: { current: any }): Record<string, boolean> =>
  r.current.filtersPanelProps.contextValue.enabledOverlays

describe('useMapScreenController — handleOverlayToggle', () => {
  // Кейс 1: включение weather-temp → temp=true, labels=true, clouds/precip=false
  it('включение weather-temp включает подписи и сбрасывает других участников группы', () => {
    const { result } = renderHook(() => useMapScreenController())

    act(() => {
      getToggle(result)(TEMP, true)
    })

    const ov = getOverlays(result)
    expect(ov[TEMP]).toBe(true)
    expect(ov[LABELS]).toBe(true)
    // CLOUDS/PRECIP выключены при включении TEMP: либо явно false (если OWM-ключ есть),
    // либо absent (undefined) — оба варианта означают «не активен».
    expect(ov[CLOUDS]).toBeFalsy()
    expect(ov[PRECIP]).toBeFalsy()
  })

  // Кейс 2: включены temp+labels, включаем precip → precip=true, temp=false, labels=false
  it('включение weather-precip при активном temp выключает temp и подписи (граничный фикс)', () => {
    const { result } = renderHook(() => useMapScreenController())

    // Сначала включаем temp (он тянет labels)
    act(() => {
      getToggle(result)(TEMP, true)
    })
    expect(getOverlays(result)[TEMP]).toBe(true)
    expect(getOverlays(result)[LABELS]).toBe(true)

    // Теперь включаем precip — temp должен выключиться косвенно, labels тоже
    act(() => {
      getToggle(result)(PRECIP, true)
    })

    const ov = getOverlays(result)
    expect(ov[PRECIP]).toBe(true)
    expect(ov[TEMP]).toBe(false)
    expect(ov[LABELS]).toBe(false)
    // CLOUDS либо false (с OWM-ключом), либо undefined (без ключа) — в обоих случаях не активен
    expect(ov[CLOUDS]).toBeFalsy()
  })

  // Кейс 3: прямое выключение weather-temp → temp=false, labels=false
  it('прямое выключение weather-temp выключает и подписи', () => {
    const { result } = renderHook(() => useMapScreenController())

    act(() => {
      getToggle(result)(TEMP, true)
    })

    act(() => {
      getToggle(result)(TEMP, false)
    })

    const ov = getOverlays(result)
    expect(ov[TEMP]).toBe(false)
    expect(ov[LABELS]).toBe(false)
  })

  // Кейс 4: два не-погодных оверлея (без exclusiveGroup) могут быть включены одновременно
  it('не-погодные оверлеи включаются независимо (нет взаимоисключения)', () => {
    const { result } = renderHook(() => useMapScreenController())

    act(() => {
      getToggle(result)(WATER, true)
    })
    act(() => {
      getToggle(result)('nature-viewpoint', true)
    })

    const ov = getOverlays(result)
    expect(ov[WATER]).toBe(true)
    expect(ov['nature-viewpoint']).toBe(true)
  })

  // Кейс 5 (граничный): labels=true, temp=false → включаем clouds → labels НЕ трогаем.
  // Симулирует сценарий «подписи включены отдельно без заливки».
  it('косвенное выключение temp НЕ сбрасывает labels если temp уже был выключен', () => {
    const { result } = renderHook(() => useMapScreenController())

    // Включаем только labels (temp остаётся false)
    act(() => {
      getToggle(result)(LABELS, true)
    })
    // Убеждаемся: temp выключен, labels включён
    expect(getOverlays(result)[TEMP]).toBeFalsy()
    expect(getOverlays(result)[LABELS]).toBe(true)

    // Включаем clouds (другой heatmap группы). temp был уже выключен —
    // условие `prev[WEATHER_TEMP_LAYER_ID]` не срабатывает, labels не трогаем.
    act(() => {
      getToggle(result)(CLOUDS, true)
    })

    const ov = getOverlays(result)
    expect(ov[CLOUDS]).toBe(true)
    expect(ov[TEMP]).toBeFalsy()
    // Подписи должны остаться нетронутыми
    expect(ov[LABELS]).toBe(true)
  })
})
