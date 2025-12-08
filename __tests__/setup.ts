import '@testing-library/jest-native/extend-expect'

// Ensure critical Expo env vars exist for API clients referenced in tests
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://example.test/api'

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
    Link: ({ children, href, ...props }: any) => {
      const content = React.Children.map(children, (child: any) =>
        typeof child === 'string'
          ? React.createElement(RN.Text, null, child)
          : child
      )
      return React.createElement(RN.TouchableOpacity, props, content)
    },
    useRouter: () => router,
    usePathname: () => '/',
    useSegments: () => [],
    Href: {} as any,
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
  return ({ name, size, color, ...props }: any) =>
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
    Feather: ({ name, size, color, ...props }: any) =>
      React.createElement(View, { testID: `feather-${name}`, ...props }),
    FontAwesome5: ({ name, size, color, ...props }: any) =>
      React.createElement(View, { testID: `fa5-${name}`, ...props }),
    MaterialIcons: ({ name, size, color, ...props }: any) =>
      React.createElement(View, { testID: `material-${name}`, ...props }),
  }
})

// Mock react-native-paper Portal
jest.mock('react-native-paper', () => {
  const RN = require('react-native')
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

jest.mock('react-native/Libraries/PushNotificationIOS/PushNotificationIOS', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  requestPermissions: jest.fn(),
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
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    // Desktop-like default; individual tests can override via their own mocks
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
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
