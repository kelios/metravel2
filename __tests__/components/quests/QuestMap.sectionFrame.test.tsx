import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import QuestsMapScreen from '@/app/(tabs)/quests/map'
import { translate as i18nT } from '@/i18n'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockNativeMap = jest.fn()
const mockWebMap = jest.fn()
let mockLoading = false
let mockFailed = false
let mockRefetching = false
const mockRetry = jest.fn()
const QUESTS = [
  { id: 'valid', cityId: '4', title: 'Quest', lat: 53.9, lng: 27.56, cover: 'https://example.test/cover.jpg' },
  { id: 'invalid', cityId: '4', title: 'No coordinates', lat: NaN, lng: 27.56 },
]
let mockQuests = QUESTS

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useIsFocused: () => true,
}))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('@/hooks/useQuestsApi', () => ({ useQuestsList: () => ({
  quests: mockQuests, loading: mockLoading, failed: mockFailed, refetch: mockRetry, refetching: mockRefetching,
}) }))
jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ width: 1440 }),
  useResponsive: () => ({ width: 1440, isMobile: false, isHydrated: true }),
}))
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
    default: (props: { travel: { data: unknown[] } }) => {
      mockWebMap(props)
      return React.createElement(View, { testID: 'web-map', accessibilityLabel: String(props.travel.data.length) })
    },
  }
})

const originalOS = Platform.OS
const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os })

beforeEach(() => {
  mockLoading = false
  mockFailed = false
  mockRefetching = false
  mockQuests = QUESTS
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

// #3397 — the quest map is a catalog surface: its own points, no radius circle.
// As a radius search it drew the travel-place clusters of the main catalog and, on
// a phone, opened at z11 on the centroid of all quests with none of them in frame.
it('shows the quest catalog as a points-only map without a radius circle', async () => {
  setPlatform('web')
  const { getByTestId } = await render(<QuestsMapScreen />)
  await waitFor(() => expect(getByTestId('web-map')).toBeTruthy())
  const props = mockWebMap.mock.calls[0][0]
  expect(props).toMatchObject({ mode: 'radius', pointsOnly: true, showRadiusCircle: false })
  expect(props.radius).toBeUndefined()
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

it.each(['android', 'ios'])('uses quest-owned points on %s and preserves marker navigation', async (os) => {
  setPlatform(os)
  const { getByTestId, queryByTestId, queryAllByRole } = await render(<QuestsMapScreen />)
  expect(getByTestId('quest-map-native')).toBeTruthy()
  expect(getByTestId('native-map')).toBeTruthy()
  expect(queryByTestId('public-frame')).toBeNull()
  const props = mockNativeMap.mock.calls[0][0]
  expect(props).toMatchObject({ mode: 'radius', pointsOnly: true, showRadiusCircle: false })
  expect(props.radius).toBeUndefined()
  expect(props.travel.data.map((point: { coord: string }) => point.coord)).toEqual(['53.9,27.56'])
  expect(queryAllByRole('button')).toHaveLength(0)
  const select = props.onMarkerSelect as (point: { urlTravel: string }) => void
  select({ urlTravel: '/quests/4/valid' })
  expect(mockPush).toHaveBeenCalledWith('/quests/4/valid')
})

it('keeps distant coordinates in their original latitude/longitude order', async () => {
  setPlatform('android')
  mockQuests = [
    { ...QUESTS[0], id: 'tbilisi', lat: 41.7, lng: 44.8 },
    { ...QUESTS[0], id: 'new-york', lat: 40.7, lng: -74 },
  ]
  await render(<QuestsMapScreen />)
  expect(mockNativeMap.mock.calls[0][0].travel.data.map((point: { coord: string }) => point.coord))
    .toEqual(['41.7,44.8', '40.7,-74'])
})

it('shows truthful native loading without a web-only message or duplicate Back action', async () => {
  setPlatform('android')
  mockLoading = true
  const { getByText, queryByText, queryByTestId, queryAllByRole } = await render(<QuestsMapScreen />)
  expect(getByText(i18nT('quests:app.tabs.quests.map.zagruzhaem_kartu_kvestov_6b50ed3f'))).toBeTruthy()
  expect(queryByText(i18nT('quests:app.tabs.quests.map.karta_dostupna_v_veb_versii_85f3b9c2'))).toBeNull()
  expect(queryByTestId('native-map')).toBeNull()
  expect(queryAllByRole('button')).toHaveLength(0)
})

it('distinguishes a successful empty native catalogue from loading and a read error', async () => {
  setPlatform('android')
  mockQuests = []
  const { getByText, queryByTestId, queryAllByRole } = await render(<QuestsMapScreen />)
  expect(getByText(i18nT('quests:app.tabs.quests.map.net_kvestov_s_koordinatami_dlya_otobrazheniy_6ec1ec92'))).toBeTruthy()
  expect(queryByTestId('native-map')).toBeNull()
  expect(queryByTestId('quest-landing-load-error')).toBeNull()
  expect(queryAllByRole('button')).toHaveLength(0)
})

it('retries a failed native catalogue read and shows retry activity', async () => {
  setPlatform('android')
  mockQuests = []
  mockFailed = true
  const { getByTestId, queryByTestId, rerender } = await render(<QuestsMapScreen />)
  expect(getByTestId('quest-landing-load-error')).toBeTruthy()
  expect(queryByTestId('native-map')).toBeNull()
  await fireEvent.press(getByTestId('quest-landing-load-error-retry'))
  expect(mockRetry).toHaveBeenCalledTimes(1)
  mockRefetching = true
  await rerender(<QuestsMapScreen />)
  expect(getByTestId('quest-landing-load-error-retry').props.accessibilityState)
    .toMatchObject({ disabled: true })
})

it('retains usable quest points after a background read fails', async () => {
  setPlatform('android')
  mockFailed = true
  const { getByTestId, queryByTestId } = await render(<QuestsMapScreen />)
  expect(getByTestId('native-map')).toBeTruthy()
  expect(queryByTestId('quest-landing-load-error')).toBeNull()
})

it('retains the shared web frame around a retryable error', async () => {
  setPlatform('web')
  mockQuests = []
  mockFailed = true
  const { getByTestId } = await render(<QuestsMapScreen />)
  expect(getByTestId('public-frame')).toBeTruthy()
  expect(getByTestId('quest-map-viewport')).toBeTruthy()
  expect(getByTestId('quest-landing-load-error')).toBeTruthy()
})
