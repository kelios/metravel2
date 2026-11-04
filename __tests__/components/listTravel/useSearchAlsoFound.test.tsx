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
const mockGet = jest.fn()
const mockFetchPlacesCatalog = jest.fn()
let mockLocale = 'ru'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}))

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: (...args: unknown[]) => mockFetchPlacesCatalog(...args),
}))

jest.mock('@/hooks/useQuestContentLocale', () => ({
  useQuestContentLocale: () => mockLocale,
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

const braslavQuest = {
  id: 501,
  quest_id: 'braslav-ozera',
  title: 'Квест по Браславу: город между двух озёр',
  points: 8,
  city_id: '65',
  city_name: 'Браслав',
  content_locale: 'ru',
  available_locales: ['ru'],
  lat: 55.6,
  lng: 27.0,
}

const emptyQuestPreview = { city: null, count: 0, results: [] }

const braslavPlace = {
  id: 'place-1',
  title: 'Гора Маяк',
  category: 'Смотровая площадка',
  country: 'Беларусь',
}

type HarnessProps = {
  query: string
  enabled?: boolean
  authReady?: boolean
  userId?: string | null
}

function Harness({ query, enabled = true, authReady = true, userId = null }: HarnessProps) {
  const header = useSearchAlsoFound({ query, enabled, authReady, userId })
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
  return await render(<Harness {...props} />, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const rowHeight = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).height

describe('useSearchAlsoFound (#2775)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocale = 'ru'
    mockGet.mockResolvedValue({
      city: { slug: 'braslav', name: 'Браслав' },
      count: 1,
      results: [braslavQuest],
    })
    mockFetchPlacesCatalog.mockResolvedValue({ places: [braslavPlace], count: 12 })
  })

  it('reserves the fixed-height row before the sources answer', async () => {
    mockFetchPlacesCatalog.mockReturnValue(new Promise(() => undefined))
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
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith(
      `/quests/search-city-preview/?q=${encodeURIComponent('браслав')}&locale=ru`,
      undefined,
      { signal: expect.anything() },
    )
    expect(mockFetchPlacesCatalog).toHaveBeenCalledWith(
      { page: 1, perPage: 3, q: 'Браслав' },
      expect.anything(),
    )
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
    mockGet.mockResolvedValue(emptyQuestPreview)
    mockFetchPlacesCatalog.mockResolvedValue({ places: [], count: 0 })
    await renderHarness({ query: 'Зюзюкино' })

    expect(await screen.findByTestId('search-also-found-empty')).toBeTruthy()
    expect(screen.getByText('Квестов и мест по запросу не нашлось')).toBeTruthy()
    expect(rowHeight('search-also-found-empty')).toBe(SEARCH_ALSO_FOUND_ROW_HEIGHT)
    expect(screen.queryByTestId('search-also-found-toggle')).toBeNull()
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it.each(['', '   ', 'Бр', ' — (  ) '])('does not request quests or places and shows no row for query %p', async (query) => {
    await renderHarness({ query })
    await flush()

    expect(mockGet).not.toHaveBeenCalled()
    expect(mockFetchPlacesCatalog).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-also-found')).toBeNull()
  })

  it('uses the server total and keeps a normalized cache entry per locale', async () => {
    mockGet.mockResolvedValue({
      city: { slug: 'braslav', name: 'Браслав' },
      count: 11,
      results: [braslavQuest, { ...braslavQuest, id: 502 }, { ...braslavQuest, id: 503 }],
    })
    const view = await renderHarness({ query: 'Браслав' })
    expect(await screen.findByText('Ещё по запросу: 11 квестов · 12 мест')).toBeTruthy()

    await view.rerender(<Harness query="  БРАСЛАВ  " />)
    await flush()
    expect(mockGet).toHaveBeenCalledTimes(1)

    mockLocale = 'en'
    await view.rerender(<Harness query="Браслав" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet.mock.calls[1][0]).toMatch(/&locale=en$/)
  })

  it('waits for the restored account before loading a personal quest preview', async () => {
    const view = await renderHarness({ query: 'Браслав', authReady: false })

    await waitFor(() => expect(mockFetchPlacesCatalog).toHaveBeenCalledTimes(1))
    expect(mockGet).not.toHaveBeenCalled()

    await view.rerender(<Harness query="Браслав" userId="7" />)
    expect(await screen.findByTestId('search-also-found-toggle')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockFetchPlacesCatalog).toHaveBeenCalledTimes(1)
  })

  it('aborts an obsolete quest preview when the query changes or /search is disabled', async () => {
    mockGet.mockImplementation(() => new Promise(() => undefined))
    const view = await renderHarness({ query: 'Браслав' })
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    const firstSignal = mockGet.mock.calls[0][2].signal as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    await view.rerender(<Harness query="Минск" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(firstSignal.aborted).toBe(true)

    const secondSignal = mockGet.mock.calls[1][2].signal as AbortSignal
    await view.rerender(<Harness query="Минск" enabled={false} />)
    expect(secondSignal.aborted).toBe(true)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('keeps places and articles available on a preview error without retrying', async () => {
    mockGet.mockRejectedValue(new Error('Preview unavailable'))
    await renderHarness({ query: 'Браслав' })
    await fireEvent.press(await screen.findByTestId('search-also-found-toggle'))

    expect(await screen.findByText('Гора Маяк')).toBeTruthy()
    expect(screen.getByText('cards')).toBeTruthy()
    expect(screen.queryByTestId('quest-card-braslav-ozera')).toBeNull()
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('does nothing outside /search', async () => {
    await renderHarness({ query: 'Браслав', enabled: false })
    await flush()

    expect(mockGet).not.toHaveBeenCalled()
    expect(mockFetchPlacesCatalog).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-also-found')).toBeNull()
  })
})
