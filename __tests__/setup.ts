// Suppress React Native deprecation warnings
;(global as any).__DEV__ = false

const originalWarn = console.warn;
console.warn = (message, ...args) => {
  const text = String(message)
  // Suppress specific deprecation warnings
  if (/(ProgressBarAndroid|Clipboard|PushNotificationIOS) has been extracted/.test(text)) {
    return;
  }
  originalWarn(message, ...args);
};

require('@testing-library/jest-native/extend-expect')

// Mock console.error to avoid error logs in test output
const originalError = console.error;
console.error = (message, ...args) => {
  const text = String(message)
  const joined = [message, ...args].map((v) => String(v)).join(' ')
  // Suppress specific error messages from tests
  if (/(Ошибка при создании формы|Ошибка при отправке обратной связи|Error: AI request failed)/.test(text)) {
    return;
  }
  // Suppress expected map snapshot errors in tests
  if (/\bMAP_SNAPSHOT_DOM\b/.test(joined)) {
    return;
  }
  originalError(message, ...args);
};

// Ensure critical Expo env vars exist for API clients referenced in tests
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://example.test/api'

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
  return ({ name, size: _size, color: _color, ...props }: any) =>
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
  const { View } = require('react-native')
  return {
    Feather: ({ name, size: _size, color: _color, ...props }: any) =>
      React.createElement(View, { testID: `feather-${name}`, ...props }),
    FontAwesome5: ({ name, size: _size, color: _color, ...props }: any) =>
      React.createElement(View, { testID: `fa5-${name}`, ...props }),
    MaterialIcons: ({ name, size: _size, color: _color, ...props }: any) =>
      React.createElement(View, { testID: `material-${name}`, ...props }),
    MaterialCommunityIcons: ({ name, size: _size, color: _color, ...props }: any) =>
      React.createElement(View, { testID: `mci-${name}`, ...props }),
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
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    SafeAreaInsetsContext: React.createContext(insetValue),
    useSafeAreaInsets: () => insetValue,
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

  const MockImage = React.forwardRef((props: any, ref: any) => {
    try {
      ;(global as any).__lastImageSourceUri = props?.source?.uri ?? null
    } catch {
      // ignore
    }
    return React.createElement('Image', { ...props, ref })
  })

  return {
    ...RN,
    // Desktop-like default; individual tests can override via jest.fn mock
    useWindowDimensions: jest.fn(() => ({ width: 1024, height: 768 })),
    Image: MockImage,
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
