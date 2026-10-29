import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import QuestsMapScreen from '@/app/(tabs)/quests/map'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockNativeMap = jest.fn()
let mockLoading = false
const mockQuests = [
  { id: 'valid', cityId: '4', title: 'Quest', lat: 53.9, lng: 27.56, cover: 'https://example.test/cover.jpg' },
  { id: 'invalid', cityId: '4', title: 'No coordinates', lat: NaN, lng: 27.56 },
]

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useIsFocused: () => true,
}))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('@/hooks/useQuestsApi', () => ({ useQuestsList: () => ({ quests: mockQuests, loading: mockLoading }) }))
jest.mock('@/hooks/useResponsive', () => ({ useBreakpoints: () => ({ width: 1440 }) }))
jest.mock('@/components/layout/bottomChromeInset', () => ({
  asBottomDimension: (value: unknown) => value,
  useScrollBottomPadding: () => 24,
}))
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)
jest.mock('@/components/quests/QuestPublicPageFrame', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'public-frame' }, children),
  }
})
jest.mock('@/components/quests/QuestPageColumns', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    QuestPageColumns: ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'shared-columns' }, children),
  }
})
jest.mock('@/components/MapPage/Map', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockNativeMap(props)
      return React.createElement(View, { testID: 'native-map' })
    },
  }
})
jest.mock('@/components/MapPage/Map.web', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: ({ travel }: { travel: { data: unknown[] } }) => React.createElement(View, { testID: 'web-map', accessibilityLabel: String(travel.data.length) }),
  }
})

const originalOS = Platform.OS
const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os })

beforeEach(() => {
  mockLoading = false
  jest.clearAllMocks()
})
afterEach(() => { setPlatform(originalOS) })

it('keeps one filtered web map inside the shared section and advertising hosts', async () => {
  setPlatform('web')
  const { getAllByTestId, getByTestId, queryByTestId } = await render(<QuestsMapScreen />)
  await waitFor(() => expect(getByTestId('web-map')).toBeTruthy())
  expect(getAllByTestId('public-frame')).toHaveLength(1)
  expect(getAllByTestId('shared-columns')).toHaveLength(1)
  expect(getAllByTestId('quest-map-viewport')).toHaveLength(1)
  expect(getByTestId('web-map').props.accessibilityLabel).toBe('1')
  expect(queryByTestId('native-map')).toBeNull()
})

it('retains the section host while the web map finishes loading', async () => {
  setPlatform('web')
  mockLoading = true
  const { getByTestId, queryByTestId, rerender } = await render(<QuestsMapScreen />)
  const frame = getByTestId('public-frame')
  expect(queryByTestId('web-map')).toBeNull()
  mockLoading = false
  await rerender(<QuestsMapScreen />)
  await waitFor(() => expect(getByTestId('web-map')).toBeTruthy())
  expect(getByTestId('public-frame')).toBe(frame)
})

it('preserves the native map boundary and marker navigation', async () => {
  setPlatform('android')
  const { getByTestId, queryByTestId } = await render(<QuestsMapScreen />)
  expect(getByTestId('native-map')).toBeTruthy()
  expect(queryByTestId('public-frame')).toBeNull()
  const select = mockNativeMap.mock.calls[0][0].onMarkerSelect as (point: { urlTravel: string }) => void
  select({ urlTravel: '/quests/4/valid' })
  expect(mockPush).toHaveBeenCalledWith('/quests/4/valid')
})
