import { Profiler } from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('expo-router', () => ({
  usePathname: jest.fn(() => '/'),
  useLocalSearchParams: jest.fn(() => ({ param: 'test-slug' })),
}))

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native')
  return {
    ...actual,
    useIsFocused: jest.fn(() => true),
  }
})

jest.mock('@/components/seo/InstantSEO', () => {
  const _React = require('react')
  return {
    __esModule: true,
    default: () => null,
  }
})

jest.mock('@/components/home/Home', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    __esModule: true,
    default: () =>
      React.createElement(View, { testID: 'home-root' }, React.createElement(Text, null, 'Home')),
  }
})

jest.mock('@/components/listTravel/ListTravel', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    __esModule: true,
    default: () =>
      React.createElement(View, { testID: 'list-travel-root' }, React.createElement(Text, null, 'ListTravel')),
  }
})

jest.mock('@/components/travel/details/TravelDetailsContainer', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    __esModule: true,
    default: () =>
      React.createElement(
        View,
        { testID: 'travel-details-root' },
        React.createElement(Text, null, 'TravelDetails'),
      ),
  }
})

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

const renderWithProfiler = (ui: React.ReactElement) => {
  let commits = 0

  const client = createClient()

  render(
    <QueryClientProvider client={client}>
      <Profiler id="perf" onRender={() => commits++}>
        {ui}
      </Profiler>
    </QueryClientProvider>,
  )

  return { commits }
}

describe('Routes performance budgets', () => {
  beforeEach(() => {
    Platform.OS = 'web'
    jest.clearAllMocks()
  })

  it('HomeScreen (/) renders within commit budget', () => {
    const HomeScreen = require('@/app/(tabs)/index').default
    const { commits } = renderWithProfiler(<HomeScreen />)

    // Two commits expected: initial render + hydration state update.
    expect(commits).toBeLessThanOrEqual(3)
  })

  it('SearchScreen (/search) renders within commit budget', () => {
    const expoRouter = require('expo-router')
    expoRouter.usePathname.mockReturnValue('/search')

    const SearchScreen = require('@/app/(tabs)/search').default
    const { commits } = renderWithProfiler(<SearchScreen />)

    expect(commits).toBeLessThanOrEqual(2)
  })

  it('Travel details route (/travels/[param]) renders within commit budget', () => {
    const expoRouter = require('expo-router')
    expoRouter.usePathname.mockReturnValue('/travels/test-slug')
    expoRouter.useLocalSearchParams.mockReturnValue({ param: 'test-slug' })

    const TravelRoute = require('@/app/(tabs)/travels/[param]').default
    const { commits } = renderWithProfiler(<TravelRoute />)

    expect(commits).toBeLessThanOrEqual(2)
  })
})
