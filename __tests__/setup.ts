// Suppress React Native deprecation warnings
;(global as any).__DEV__ = false
;(process as any).noDeprecation = true

const originalWarn = console.warn;
console.warn = (message, ...args) => {
  const text = String(message)
  // Suppress specific deprecation warnings
  if (/(ProgressBarAndroid|Clipboard|PushNotificationIOS) has been extracted/.test(text)) {
    return;
  }
  if (text.includes('SafeAreaView has been deprecated')) {
    return
  }
  if (text.includes('Tried to use the icon') && text.includes('react-native-paper')) {
    return
  }
  if (text.includes('GA4: Missing MEASUREMENT_ID or API_SECRET')) {
    return
  }
  if (text.includes('GA4: gtag is not available')) {
    return
  }
  if (text.includes('[Map] Location permission not granted')) {
    return
  }
  if (text.includes('[useRouting]')) {
    return
  }
  if (text.includes('[setRoutePoints]')) {
    return
  }
  originalWarn(message, ...args);
};

require('react-native-gesture-handler/jestSetup')

const originalInfo = console.info;
console.info = (message, ...args) => {
  const joined = [message, ...args].map((v) => String(v)).join(' ')
  // Suppress noisy debug logs from WebMapComponent helpers used in unit tests
  if (joined.includes('buildAddressFromGeocode called with:')) return
  if (joined.includes('Address parts:')) return
  if (joined.includes('[PopupContent] Image URLs:')) return
  if (joined.includes('[PopupContent] No travelImageThumbUrl provided')) return
  if (joined.includes('PhotoUploadWithPreview:')) return
  if (joined.includes('File selected:')) return
  if (joined.includes('Created blob URL:')) return
  if (joined.includes('Upload response:')) return
  if (joined.includes('[setRoutePoints]')) return
  if (joined.includes('[Map.web.tsx] Routing check:')) return
  if (joined.includes('[Map.web.tsx] Route points normalization:')) return
  if (joined.includes('[useRouting]')) return
  if (joined.includes('[FiltersPanel]')) return
  if (joined.includes('Nominatim geocode response')) return
  if (joined.includes('BigDataCloud geocode response')) return
  originalInfo(message, ...args)
}

require('@testing-library/jest-native/extend-expect')

// react-leaflet ships ESM and expects a real browser environment.
// For unit tests we only need lightweight stubs.
jest.mock('react-leaflet', () => {
  const React = require('react')
  const { View } = require('react-native')

  const makeComp = (testID: string) => ({ children, ...props }: any) =>
    React.createElement(View, { testID, ...props }, children)

  return {
    __esModule: true,
    MapContainer: makeComp('react-leaflet-MapContainer'),
    TileLayer: makeComp('react-leaflet-TileLayer'),
    Marker: makeComp('react-leaflet-Marker'),
    Popup: makeComp('react-leaflet-Popup'),
    useMap: () => ({
      setView: jest.fn(),
      fitBounds: jest.fn(),
      getZoom: jest.fn(() => 13),
    }),
    useMapEvents: jest.fn(() => null),
  }
})

jest.mock('@/src/utils/imageAnalysis', () => {
  return {
    __esModule: true,
    analyzeImageBrightness: jest.fn(async () => 128),
    analyzeImageComposition: jest.fn(async () => ({ topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 })),
    getOptimalTextPosition: jest.fn(() => 'center'),
    getOptimalOverlayOpacity: jest.fn(() => 0.6),
    getOptimalOverlayColor: jest.fn(() => 'rgba(0,0,0,'),
    getOptimalTextColor: jest.fn(() => '#ffffff'),
  }
})

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  const BottomSheet = ({ children, ...props }: any) => React.createElement(View, props, children)
  const BottomSheetScrollView = ({ children, ...props }: any) => React.createElement(View, props, children)
  const BottomSheetBackdrop = (_props: any) => null
  const BottomSheetView = ({ children, ...props }: any) => React.createElement(View, props, children)
  const BottomSheetModal = ({ children, ...props }: any) => React.createElement(View, props, children)
  const BottomSheetModalProvider = ({ children }: any) => React.createElement(React.Fragment, null, children)

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheet,
    BottomSheetScrollView,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetModal,
    BottomSheetModalProvider,
  }
})

// Mock expo-router/head (SEO helpers). Unit tests don't need actual head rendering.
jest.mock('expo-router/head', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: ({ children }: any) => React.createElement(React.Fragment, null, children ?? null),
  }
})

jest.mock('@react-native-community/netinfo', () => {
  const api = {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve({
        isConnected: true,
        isInternetReachable: true,
        type: 'unknown',
      })
    ),
  }

  return {
    __esModule: true,
    default: api,
    ...api,
  }
})

jest.mock('@/hooks/useTheme', () => {
  const React = require('react')
  const {
    MODERN_MATTE_PALETTE,
    MODERN_MATTE_SHADOWS,
    MODERN_MATTE_BOX_SHADOWS,
    MODERN_MATTE_GRADIENTS,
  } = require('@/constants/modernMattePalette')

  const defaultTheme = {
    theme: 'light',
    isDark: false,
    setTheme: jest.fn(),
    toggleTheme: jest.fn(),
  }

  const ThemeContext = React.createContext(defaultTheme)
  const baseColors = {
    ...MODERN_MATTE_PALETTE,
    surfaceLight: MODERN_MATTE_PALETTE.backgroundTertiary,
    mutedBackground: MODERN_MATTE_PALETTE.mutedBackground ?? MODERN_MATTE_PALETTE.backgroundSecondary,
    error: MODERN_MATTE_PALETTE.danger,
    errorDark: MODERN_MATTE_PALETTE.dangerDark,
    errorLight: MODERN_MATTE_PALETTE.dangerLight,
    errorSoft: MODERN_MATTE_PALETTE.dangerSoft,
    shadows: MODERN_MATTE_SHADOWS,
    boxShadows: MODERN_MATTE_BOX_SHADOWS,
    gradients: MODERN_MATTE_GRADIENTS,
  }

  return {
    ThemeContext,
    useTheme: () => defaultTheme,
    useThemedColors: () => baseColors,
    getThemedColors: () => baseColors,
    ThemeProvider: ({ children }: { children: any }) =>
      React.createElement(ThemeContext.Provider, { value: defaultTheme }, children),
  }
})

// Mock console.error to avoid error logs in test output
const originalError = console.error;
console.error = (message, ...args) => {
  const text = String(message)
  const joined = [message, ...args].map((v) => String(v)).join(' ')
  // Suppress specific error messages from tests
  if (/(Ошибка при создании формы|Ошибка при отправке обратной связи|Error: AI request failed)/.test(text)) {
    return;
  }
  if (joined.includes('[Map] Location error:')) {
    return
  }
  // Suppress expected API fallback logs (devError) during unit tests
  // These are intentionally triggered by tests that validate error fallbacks.
  if (/\bError fetching filters\b/i.test(joined)) {
    return;
  }
  if (/\bError fetching filters country\b/i.test(joined)) {
    return;
  }
  if (/\bError fetching all countries\b/i.test(joined)) {
    return;
  }
  // Suppress noisy React testing warnings about missing act(...)
  // We only filter the well-known warning text to avoid hiding real errors.
  if (
    /not wrapped in act\(\.\.\.\)/i.test(joined) ||
    /When testing, code that causes React state updates should be wrapped into act\(\.\.\.\)/i.test(joined)
  ) {
    return;
  }
  // Suppress known React warning in Map.ios.test.tsx about refs on function components
  if (/Function components cannot be given refs\./i.test(joined)) {
    return;
  }
  // Suppress expected map snapshot errors in tests
  if (/\bMAP_SNAPSHOT_DOM\b/.test(joined)) {
    return;
  }
  if (text.includes('API request error:')) {
    return
  }
  if (text.includes('Error fetching Travel by slug:')) {
    return
  }
  if (text.includes('fetch is not defined')) {
    return
  }
  if (text.includes('Image load error:')) {
    return
  }
  if (text.includes('Location search error:')) {
    return
  }
  if (text.includes('Ошибка загрузки путешествия:')) {
    return
  }
  if (text.includes('Error copying link:')) {
    return
  }
  if (text.includes('Upload error:')) {
    return
  }
  if (text.includes('Comments error:')) {
    return
  }
  if (text.includes('Failed to load Leaflet')) {
    return
  }
  if (text.includes('Validation error:')) {
    return
  }
  if (text.includes('is using incorrect casing')) {
    return
  }
  if (text.includes('The tag <View> is unrecognized in this browser')) {
    return
  }
  if (text.includes('does not recognize the `testID` prop on a DOM element')) {
    return
  }
  if (joined.includes('The tag <View> is unrecognized in this browser')) {
    return
  }
  if (joined.includes('does not recognize the `testID` prop on a DOM element')) {
    return
  }
  if (joined.includes('The tag <') && joined.includes('is unrecognized in this browser')) {
    return
  }
  if (joined.includes('does not recognize the') && joined.includes('testID')) {
    return
  }
  originalError(message, ...args);
};

// Ensure critical Expo env vars exist for API clients referenced in tests
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.50.36'
process.env.EXPO_PUBLIC_GOOGLE_GA4 = process.env.EXPO_PUBLIC_GOOGLE_GA4 || 'test-ga4'
process.env.EXPO_PUBLIC_GOOGLE_API_SECRET = process.env.EXPO_PUBLIC_GOOGLE_API_SECRET || 'test-secret'

// Guardrail: unit/integration tests must NOT call the local Playwright webserver/proxy.
// If you see this, something is resolving API base from window.location.origin instead of EXPO_PUBLIC_API_URL.
const FORBIDDEN_JEST_API_PREFIX = 'http://127.0.0.1:8085/api'

if (typeof (global as any).fetch !== 'function') {
  ;(global as any).fetch = jest.fn(async () => ({
    ok: false,
    status: 0,
    statusText: 'Network request failed',
    json: async () => ({}),
    text: async () => '',
  }))
}

// Wrap fetch to fail fast on forbidden localhost API usage.
{
  const originalFetch = (global as any).fetch
  ;(global as any).fetch = jest.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url
    if (typeof url === 'string' && url.startsWith(FORBIDDEN_JEST_API_PREFIX)) {
      throw new Error(
        `Forbidden API base in Jest: ${url}. ` +
          `Unit tests must use EXPO_PUBLIC_API_URL=${process.env.EXPO_PUBLIC_API_URL}. ` +
          `The 127.0.0.1:8085 /api proxy is only for Playwright E2E.`
      )
    }
    return originalFetch(input as any, init as any)
  })
}

// JSDOM has window.scrollBy/scrollTo but they may throw "Not implemented".
// Override to stable mocks so scroll-related unit tests can assert calls.
if (typeof window !== 'undefined') {
  try {
    ;(window as any).scrollBy = jest.fn()
  } catch {
    // noop
  }
  try {
    ;(window as any).scrollTo = jest.fn()
  } catch {
    // noop
  }
}

// JSDOM doesn't implement canvas APIs by default; mock them to avoid noisy errors.
if (typeof window !== 'undefined' && (window as any).HTMLCanvasElement?.prototype) {
  const proto = (window as any).HTMLCanvasElement.prototype
  if (typeof proto.getContext !== 'function') {
    proto.getContext = jest.fn(() => ({}))
  } else {
    // Some jsdom versions throw a "Not implemented" error - override.
    proto.getContext = jest.fn(() => ({}))
  }
  // Some jsdom versions implement toDataURL but return null/throw; override to keep tests stable.
  proto.toDataURL = jest.fn(() => 'data:image/webp;base64,AAAA')
}

// Polyfill setImmediate/clearImmediate for react-native StatusBar cleanup in tests
if (typeof (global as any).setImmediate !== 'function') {
  ;(global as any).setImmediate = (fn: any, ...args: any[]) => setTimeout(fn, 0, ...args)
}
if (typeof (global as any).clearImmediate !== 'function') {
  ;(global as any).clearImmediate = (id: any) => clearTimeout(id)
}

// Polyfill TextEncoder/TextDecoder for JSDOM environment
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Basic DOM polyfills for react-native-web components used in tests
if (typeof window === 'undefined') {
  ;(global as any).window = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    requestIdleCallback: jest.fn((cb: any) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 16 }), 0)),
    cancelIdleCallback: jest.fn((id: number) => clearTimeout(id)),
    matchMedia: jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  }
}

if (!('matchMedia' in window)) {
  ;(window as any).matchMedia = jest.fn(() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

if (typeof (window as any).IntersectionObserver === 'undefined') {
  class IntersectionObserverMock {
    callback: IntersectionObserverCallback
    options?: IntersectionObserverInit

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback
      this.options = options
    }

    observe = jest.fn()
    unobserve = jest.fn()
    disconnect = jest.fn()
    takeRecords = jest.fn(() => [])
  }

  ;(window as any).IntersectionObserver = IntersectionObserverMock
  ;(global as any).IntersectionObserver = IntersectionObserverMock
}

if (typeof (window as any).performance === 'undefined') {
  ;(window as any).performance = {
    now: () => Date.now(),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  }
}

if (typeof document === 'undefined') {
  const createElement = (tag: string) => ({
    tagName: tag.toUpperCase(),
    style: {},
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    getContext: jest.fn(),
  })

  ;(global as any).document = {
    createElement,
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
    },
    head: {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelectorAll: jest.fn(() => []),
    },
    querySelector: jest.fn(() => null),
  }
}

if (typeof navigator === 'undefined') {
  ;(global as any).navigator = { userAgent: 'node.js' }
}

if (typeof (window as any).Image === 'undefined') {
  ;(window as any).Image = class {
    onload?: () => void
    onerror?: () => void
    set src(_value: string) {
      setTimeout(() => {
        if (this.onload) {
          this.onload()
        }
      }, 0)
    }
  }
}

// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react')
  const RN = require('react-native')

  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }

  return {
    router,
    Link: ({ children, href: _href, ...props }: any) => {
      const content = React.Children.map(children, (child: any) =>
        typeof child === 'string'
          ? React.createElement(RN.Text, null, child)
          : child
      )
      return React.createElement(RN.TouchableOpacity, props, content)
    },
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    usePathname: () => '/',
    useSegments: () => [],
    Href: {} as any,
  }
})

// Provide a lightweight FavoritesContext mock so components using the hook
// don't fail outside of the real provider during unit tests
jest.mock('@/context/FavoritesContext', () => {
  const React = require('react')
  const stub = {
    favorites: [],
    viewHistory: [],
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(() => false),
    addToHistory: jest.fn(),
    clearHistory: jest.fn(),
    getRecommendations: jest.fn(() => []),
  }

  const useFavoritesMock = jest.fn(() => stub)

  return {
    __esModule: true,
    FavoritesProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useFavorites: useFavoritesMock,
    default: {
      FavoritesProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
      useFavorites: useFavoritesMock,
    },
  }
})

// Mock react-native-webview to avoid TurboModuleRegistry errors in Jest
jest.mock('react-native-webview', () => {
  const React = require('react')
  const RN = require('react-native')

  const WebView = (props: any) => React.createElement(RN.View, props)

  return {
    __esModule: true,
    WebView,
    default: WebView,
  }
})

// Mock expo-image-picker to avoid native permission hook dependencies in Jest
jest.mock('expo-image-picker', () => {
  return {
    __esModule: true,
    MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
    PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
    getMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
    requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
    getCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
    launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
    launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
    default: {},
  }
})

// Properly typed AsyncStorage mock
const createAsyncStorageMock = () => {
  const store = new Map<string, string>()

  const getItem = jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null))
  const setItem = jest.fn(async (key: string, value: string) => store.set(key, value))
  const removeItem = jest.fn(async (key: string) => store.delete(key))
  const clear = jest.fn(async () => store.clear())
  const multiGet = jest.fn(async (keys: ReadonlyArray<string>) => 
    keys.map(key => [key, store.has(key) ? store.get(key)! : null] as [string, string | null])
  )
  const multiSet = jest.fn(async (entries: ReadonlyArray<[string, string]>) => 
    entries.forEach(([key, value]) => store.set(key, value))
  )
  const multiRemove = jest.fn(async (keys: ReadonlyArray<string>) => keys.forEach(key => store.delete(key)))
  const getAllKeys = jest.fn(async () => Array.from(store.keys()))

  const reset = () => {
    store.clear()
    getItem.mockClear()
    setItem.mockClear()
    removeItem.mockClear()
    clear.mockClear()
    multiGet.mockClear()
    multiSet.mockClear()
    multiRemove.mockClear()
    getAllKeys.mockClear()
  }

  return { getItem, setItem, removeItem, clear, multiGet, multiSet, multiRemove, getAllKeys, __reset: reset }
}

jest.mock('@react-native-async-storage/async-storage', () => createAsyncStorageMock())

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const React = require('react')
  const { View } = require('react-native')
  return ({ name, ...props }: any) =>
    React.createElement(View, { testID: `icon-${name}`, ...props })
})

jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react')
  const { View } = require('react-native')
  return ({ name, ...props }: any) =>
    React.createElement(View, { testID: `material-${name}`, ...props })
})

// Mock expo-vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')

  const makeIcon = (prefix: string) => {
    const Comp = ({ name, ...props }: any) =>
      React.createElement(Text, { testID: `${prefix}-${name}`, ...props }, String(name ?? ''))
    return Comp
  }

  const globalAny = global as any
  if (!globalAny.__expoVectorIconsMock) {
    globalAny.__expoVectorIconsMock = {
      Feather: makeIcon('feather'),
      FontAwesome5: makeIcon('fa5'),
      MaterialIcons: makeIcon('material'),
      MaterialCommunityIcons: makeIcon('mci'),
    }
  }

  return {
    ...globalAny.__expoVectorIconsMock,
  }
})

// Some components import icon sets via path imports (e.g. '@expo/vector-icons/Feather'),
// which bypass the top-level '@expo/vector-icons' mock. Mock these explicitly.
jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react')
  const { Text } = require('react-native')
  const globalAny = global as any
  if (!globalAny.__expoVectorIconsMock?.Feather) {
    globalAny.__expoVectorIconsMock = {
      ...(globalAny.__expoVectorIconsMock ?? {}),
      Feather: ({ name, ...props }: any) =>
        React.createElement(Text, { testID: `feather-${name}`, ...props }, String(name ?? '')),
    }
  }
  return {
    __esModule: true,
    default: globalAny.__expoVectorIconsMock.Feather,
  }
})

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  const globalAny = global as any
  if (!globalAny.__expoVectorIconsMock?.MaterialIcons) {
    globalAny.__expoVectorIconsMock = {
      ...(globalAny.__expoVectorIconsMock ?? {}),
      MaterialIcons: ({ name, ...props }: any) =>
        React.createElement(Text, { testID: `material-${name}`, ...props }, String(name ?? '')),
    }
  }
  return {
    __esModule: true,
    default: globalAny.__expoVectorIconsMock.MaterialIcons,
  }
})

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  const globalAny = global as any
  if (!globalAny.__expoVectorIconsMock?.MaterialCommunityIcons) {
    globalAny.__expoVectorIconsMock = {
      ...(globalAny.__expoVectorIconsMock ?? {}),
      MaterialCommunityIcons: ({ name, ...props }: any) =>
        React.createElement(Text, { testID: `mci-${name}`, ...props }, String(name ?? '')),
    }
  }
  return {
    __esModule: true,
    default: globalAny.__expoVectorIconsMock.MaterialCommunityIcons,
  }
})

jest.mock('@expo/vector-icons/FontAwesome5', () => {
  const React = require('react')
  const { Text } = require('react-native')
  const globalAny = global as any
  if (!globalAny.__expoVectorIconsMock?.FontAwesome5) {
    globalAny.__expoVectorIconsMock = {
      ...(globalAny.__expoVectorIconsMock ?? {}),
      FontAwesome5: ({ name, ...props }: any) =>
        React.createElement(Text, { testID: `fa5-${name}`, ...props }, String(name ?? '')),
    }
  }
  return {
    __esModule: true,
    default: globalAny.__expoVectorIconsMock.FontAwesome5,
  }
})

// Mock react-native-paper Portal
jest.mock('react-native-paper', () => {
  const Paper = jest.requireActual('react-native-paper')
  return {
    ...Paper,
    Portal: ({ children }: any) => children,
  }
})

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}))

// Mock safe area context to avoid native dependency
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const insetValue = { top: 0, right: 0, bottom: 0, left: 0 }
  const mod = {
    __esModule: true,
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    SafeAreaInsetsContext: React.createContext(insetValue),
    useSafeAreaInsets: () => insetValue,
  }
  return {
    ...mod,
    default: mod,
  }
})

// Mock FlashList to avoid Jest parsing ESM in @shopify/flash-list.
jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const RN = require('react-native')

  const FlashList = ({ data = [], renderItem, keyExtractor }: any) => {
    return React.createElement(
      RN.View,
      null,
      (data || []).map((item: any, index: number) => {
        const key = keyExtractor ? keyExtractor(item, index) : String(item?.id ?? index)
        const element = renderItem ? renderItem({ item, index }) : null
        return React.createElement(RN.View, { key }, element)
      })
    )
  }

  return {
    __esModule: true,
    FlashList,
    default: FlashList,
  }
})

// Mock expo web browser dependency
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'dismiss' })),
  dismissBrowser: jest.fn(),
}))

// Mock expo font loader used by vector icons
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
}))

// Mock expo-image to avoid native dependencies
jest.mock('expo-image', () => {
  const React = require('react')
  const { View } = require('react-native')
  const MockImage = ({ children, ...props }: any) =>
    React.createElement(View, props, children)
  return {
    __esModule: true,
    Image: MockImage,
    default: MockImage,
  }
})

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
    hide: jest.fn(),
  },
}))

// Mock native modules before mocking react-native
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  class MockNativeEventEmitter {
    addListener() {
      return { remove: jest.fn() }
    }
    removeAllListeners() {}
    removeSubscription() {}
  }
  return MockNativeEventEmitter
})

// React Native 0.8x+ pulls in DevMenu TurboModule from react-native entrypoint in some environments.
// In Jest there is no native binary, so we stub the spec to avoid TurboModuleRegistry.getEnforcing('DevMenu').
jest.mock('react-native/src/private/devsupport/devmenu/specs/NativeDevMenu', () => ({
  __esModule: true,
  default: {},
}))

// Mock react-native/Libraries/PushNotificationIOS/PushNotificationIOS
export const mockRequestPermissions = jest.fn(() => Promise.resolve(true))
export const mockGetInitialNotification = jest.fn(() => Promise.resolve())

jest.mock('react-native/Libraries/PushNotificationIOS/PushNotificationIOS', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  requestPermissions: mockRequestPermissions,
  abandonPermissions: jest.fn(),
  checkPermissions: jest.fn((cb: any) => cb({ alert: true, badge: true, sound: true })),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
}))

jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  __esModule: true,
  default: {
    getConstants: jest.fn(() => ({})),
    setValues: jest.fn(),
    deleteValues: jest.fn(),
  },
}))

// Mock window dimensions and native modules
jest.mock('react-native', () => {
  const React = require('react')
  const RN = jest.requireActual('react-native')
  const Linking =
    RN.Linking ??
    ({
      openURL: jest.fn(() => Promise.resolve()),
      canOpenURL: jest.fn(() => Promise.resolve(true)),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    } as any)

  const MockImage = React.forwardRef((props: any, ref: any) => {
    try {
      ;(global as any).__lastImageSourceUri = props?.source?.uri ?? null
    } catch {
      // ignore
    }
    return React.createElement('Image', { ...props, ref })
  })

  const getA11yProps = (props: any) => {
    if (typeof globalThis.document === 'undefined') {
      return {}
    }
    const ariaLabel = props.accessibilityLabel ?? props['aria-label']
    const role = props.accessibilityRole ?? props.role
    const ariaSelected = typeof props.accessibilityState?.selected === 'boolean'
      ? String(props.accessibilityState.selected)
      : props['aria-selected']

    return {
      ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      ...(role ? { role } : {}),
      ...(ariaSelected != null ? { 'aria-selected': ariaSelected } : {}),
    }
  }

  const Pressable = React.forwardRef((props: any, ref: any) => {
    const { onPress, style, children, ...rest } = props
    const pressState = { pressed: false, hovered: false, focused: false }
    const resolvedStyle = typeof style === 'function' ? style(pressState) : style
    const resolvedChildren = typeof children === 'function' ? children(pressState) : children
    const isDisabled = Boolean(props.disabled || props.accessibilityState?.disabled)
    const accessible = props.accessible ?? Boolean(props.accessibilityRole || props.accessibilityLabel)
    const pointerEvents = isDisabled ? 'none' : rest.pointerEvents

    return React.createElement(RN.View, {
      ...rest,
      ref,
      style: resolvedStyle,
      pointerEvents,
      onPress: isDisabled ? undefined : onPress,
      onClick: isDisabled ? undefined : onPress,
      accessible,
      ...getA11yProps(props),
    }, resolvedChildren)
  })

  return {
    ...RN,
    // Desktop-like default; individual tests can override via jest.fn mock
    useWindowDimensions: jest.fn(() => ({ width: 1024, height: 768 })),
    Image: MockImage,
    Pressable,
    Linking,
    Settings: {
      get: jest.fn(),
      set: jest.fn(),
      watchKeys: jest.fn(),
      clearWatch: jest.fn(),
    },
  }
})

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

declare global {
  namespace NodeJS {
    interface Global {
      __reanimatedWorkletInit?: jest.Mock
      window?: typeof window
      document?: typeof document
      navigator?: typeof navigator
    }
  }
}

if (!(global as any).__reanimatedWorkletInit) {
  (global as any).__reanimatedWorkletInit = jest.fn()
}

// Setup and teardown
beforeEach(() => {
  jest.clearAllMocks()
})

afterAll(() => {
  // Clean up global polyfills
  const globalAny = global as any
  if (globalAny.window) delete globalAny.window
  if (globalAny.document) delete globalAny.document
  if (globalAny.navigator) delete globalAny.navigator
  
  // Clear all mocks
  jest.restoreAllMocks()
})
