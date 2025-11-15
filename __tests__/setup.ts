import '@testing-library/jest-native/extend-expect'

// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react')
  const RN = require('react-native')
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    },
    Link: ({ children, href, ...props }: any) => {
      return React.createElement(RN.TouchableOpacity, props, children)
    },
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    usePathname: () => '/',
    useSegments: () => [],
    Href: {} as any,
  }
})

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const { View } = require('react-native')
  return ({ name, size, color, ...props }: any) => (
    <View testID={`icon-${name}`} {...props} />
  )
})

// Mock expo-vector-icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, size, color, ...props }: any) => {
    const { View } = require('react-native')
    return <View testID={`feather-${name}`} {...props} />
  },
  FontAwesome5: ({ name, size, color, ...props }: any) => {
    const { View } = require('react-native')
    return <View testID={`fa5-${name}`} {...props} />
  },
}))

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

// Mock window dimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  }
})

