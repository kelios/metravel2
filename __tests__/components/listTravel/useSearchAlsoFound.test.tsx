// #2775: поиск по сайту искал только статьи — «Браслав» давал 7 статей без
// квеста и мест. Строка «Ещё по запросу» стоит над карточками фиксированной
// высоты с первого кадра активного запроса, сводит квесты города и места
// каталога и раскрывает их по тапу; пустой запрос за квестами и местами не ходит.
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { useSearchAlsoFound } from '@/components/listTravel/hooks/useSearchAlsoFound'
import { SEARCH_ALSO_FOUND_ROW_HEIGHT } from '@/components/listTravel/SearchAlsoFoundSummary'

const mockPush = jest.fn()
const mockFetchQuestCitiesDirectory = jest.fn()
const mockFetchSiteSearchCityQuests = jest.fn()
const mockFetchSiteSearchPlaces = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/api/siteSearchExtras', () => ({
  fetchQuestCitiesDirectory: (...args: unknown[]) => mockFetchQuestCitiesDirectory(...args),
  fetchSiteSearchCityQuests: (...args: unknown[]) => mockFetchSiteSearchCityQuests(...args),
  fetchSiteSearchPlaces: (...args: unknown[]) => mockFetchSiteSearchPlaces(...args),
}))

jest.mock('@/components/quests/QuestForCityCard', () => {
  const ReactRuntime = require('react')
  const { Text: RNText } = require('react-native')
  return {
    __esModule: true,
    default: ({ quest }: { quest: { id: string; title: string } }) =>
      ReactRuntime.createElement(RNText, { testID: `quest-card-${quest.id}` }, quest.title),
  }
})

const cities = [
  { id: 65, name: 'Браслав', name_canonical: 'Браслав', lat: 55.6, lng: 27.0, legacy_ids: [] },
  { id: 9, name: 'Минск', name_canonical: 'Минск', lat: 53.9, lng: 27.5, legacy_ids: [] },
]

const braslavQuest = {
  id: 'braslav-ozera',
  numericId: 501,
  title: 'Квест по Браславу: город между двух озёр',
  points: 8,
  cityId: '65',
  cityName: 'Браслав',
  contentLocale: 'ru',
  availableLocales: ['ru'],
  lat: 55.6,
  lng: 27.0,
  ratingAvg: null,
  ratingCount: 0,
  completionsCount: 0,
  viewsCount: 0,
  isCompletedByMe: false,
  firstCompleter: null,
}

const braslavPlace = {
  id: 'place-1',
  title: 'Гора Маяк',
  category: 'Смотровая площадка',
  country: 'Беларусь',
}

type HarnessProps = {
  query: string
  enabled?: boolean
}

function Harness({ query, enabled = true }: HarnessProps) {
  const header = useSearchAlsoFound({ query, enabled, userId: null })
  return (
    <View>
      {header}
      <Text>cards</Text>
    </View>
  )
}

async function renderHarness(props: HarnessProps) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return await render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const rowHeight = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).height

describe('useSearchAlsoFound (#2775)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchQuestCitiesDirectory.mockResolvedValue(cities)
    mockFetchSiteSearchCityQuests.mockResolvedValue({
      quests: [braslavQuest],
      total: 1,
      citySegment: 'braslav',
      cityName: 'Браслав',
    })
    mockFetchSiteSearchPlaces.mockResolvedValue({ places: [braslavPlace], total: 12 })
  })

  it('reserves the fixed-height row before the sources answer', async () => {
    mockFetchSiteSearchPlaces.mockReturnValue(new Promise(() => undefined))
    await renderHarness({ query: 'Браслав' })

    expect(screen.getByTestId('search-also-found-loading')).toBeTruthy()
    expect(rowHeight('search-also-found-loading')).toBe(SEARCH_ALSO_FOUND_ROW_HEIGHT)
    expect(screen.queryByTestId('search-also-found-list')).toBeNull()
  })

  it('summarizes the city quest and places for «Браслав» in a row of the same height', async () => {
    await renderHarness({ query: 'Браслав' })

    expect(await screen.findByText('Ещё по запросу: 1 квест · 12 мест')).toBeTruthy()
    expect(rowHeight('search-also-found-toggle')).toBe(SEARCH_ALSO_FOUND_ROW_HEIGHT)
    expect(screen.queryByTestId('search-also-found-list')).toBeNull()
    expect(mockFetchSiteSearchCityQuests).toHaveBeenCalledWith(65, expect.any(String))
    expect(mockFetchSiteSearchPlaces).toHaveBeenCalledWith('Браслав', expect.anything())
  })

  it('expands the ready list on tap and links to the city quests and places', async () => {
    await renderHarness({ query: 'Браслав' })

    await fireEvent.press(await screen.findByTestId('search-also-found-toggle'))

    expect(await screen.findByText('Квест по Браславу: город между двух озёр')).toBeTruthy()
    expect(screen.getByText('Гора Маяк')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('search-also-found-quests-all'))
    expect(mockPush).toHaveBeenLastCalledWith('/quests/braslav')
    await fireEvent.press(screen.getByTestId('search-also-found-places-all'))
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/places', params: { q: 'Браслав' } })

    await fireEvent.press(screen.getByTestId('search-also-found-toggle'))
    await waitFor(() => expect(screen.queryByTestId('search-also-found-list')).toBeNull())
  })

  it('keeps the row with a muted "nothing found" text when no quest city or place matches', async () => {
    mockFetchSiteSearchPlaces.mockResolvedValue({ places: [], total: 0 })
    await renderHarness({ query: 'Зюзюкино' })

    expect(await screen.findByTestId('search-also-found-empty')).toBeTruthy()
    expect(screen.getByText('Квестов и мест по запросу не нашлось')).toBeTruthy()
    expect(rowHeight('search-also-found-empty')).toBe(SEARCH_ALSO_FOUND_ROW_HEIGHT)
    expect(screen.queryByTestId('search-also-found-toggle')).toBeNull()
    expect(mockFetchSiteSearchCityQuests).not.toHaveBeenCalled()
  })

  it.each(['', '   ', 'Бр'])('does not request quests or places and shows no row for query %p', async (query) => {
    await renderHarness({ query })
    await flush()

    expect(mockFetchSiteSearchCityQuests).not.toHaveBeenCalled()
    expect(mockFetchSiteSearchPlaces).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-also-found')).toBeNull()
  })

  it('prefetches the quest city directory on /search before a query is typed', async () => {
    await renderHarness({ query: '' })
    await waitFor(() => expect(mockFetchQuestCitiesDirectory).toHaveBeenCalledTimes(1))
  })

  it('does nothing outside /search', async () => {
    await renderHarness({ query: 'Браслав', enabled: false })
    await flush()

    expect(mockFetchQuestCitiesDirectory).not.toHaveBeenCalled()
    expect(mockFetchSiteSearchPlaces).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-also-found')).toBeNull()
  })
})
