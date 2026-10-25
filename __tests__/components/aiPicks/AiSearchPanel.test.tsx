import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AiSearchPanel, AI_SEARCH_DEBOUNCE_MS } from '@/components/aiPicks/AiSearchPanel'
import type { AiSearchResult } from '@/api/aiPicks'

const mockFetchAiSearch = jest.fn()
jest.mock('@/api/aiPicks', () => ({
  ...jest.requireActual('@/api/aiPicks'),
  fetchAiSearch: (...args: unknown[]) => mockFetchAiSearch(...args),
}))

jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive')
  return { ...actual, useResponsive: () => ({ ...actual.useResponsive(), isHydrated: true, isMobile: false }) }
})

const mockUnifiedTravelCard = (props: any) => {
  const { View, Text } = require('react-native')
  return React.createElement(View, { testID: 'unified-card' }, React.createElement(Text, null, props.title))
}

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}))

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const result = (titles: string[], degraded = false): AiSearchResult => ({
  items: titles.map((title, index) => ({
    type: index % 2 ? 'quest' : 'travel',
    source_id: index + 1,
    title,
    url: `https://metravel.by/travels/${index + 1}`,
    path: `/travels/${index + 1}`,
    snippet: `почему подошло ${index + 1}`,
    score: 0.5,
    city: 'Kraków',
    country: null,
    cover: null,
  })),
  took_ms: 120,
  degraded,
})

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiSearchPanel />
    </QueryClientProvider>,
  )
}

describe('AiSearchPanel (#2459)', () => {
  const env = process.env.EXPO_PUBLIC_AI_PICKS
  beforeEach(() => {
    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    mockFetchAiSearch.mockReset()
  })
  afterAll(() => {
    process.env.EXPO_PUBLIC_AI_PICKS = env
  })

  it('stays idle for short input and searches after the debounce', async () => {
    mockFetchAiSearch.mockResolvedValue(result(['Ойцув с детьми', 'Квест по Кракову']))
    const { getByTestId, queryByTestId, getByText, getAllByTestId } = renderPanel()

    fireEvent.changeText(getByTestId('ai-search-input'), 'с ')
    await new Promise((resolve) => setTimeout(resolve, AI_SEARCH_DEBOUNCE_MS + 200))
    expect(mockFetchAiSearch).not.toHaveBeenCalled()
    expect(queryByTestId('ai-search-results')).toBeNull()

    fireEvent.changeText(getByTestId('ai-search-input'), 'с детьми под Краковом')
    await waitFor(() => expect(mockFetchAiSearch).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(mockFetchAiSearch.mock.calls[0][0]).toMatchObject({ q: 'с детьми под Краковом', limit: 12 })
    await waitFor(() => expect(getByTestId('ai-search-results')).toBeTruthy())
    expect(getByText('Ойцув с детьми')).toBeTruthy()
    expect(getAllByTestId('ai-pick-card-snippet')).toHaveLength(2)
    expect(getByText('почему подошло 1')).toBeTruthy()
  })

  it('shows the empty message when nothing matches', async () => {
    mockFetchAiSearch.mockResolvedValue(result([]))
    const { getByTestId, queryByTestId } = renderPanel()
    fireEvent.changeText(getByTestId('ai-search-input'), 'ничего такого нет')
    await waitFor(() => expect(getByTestId('ai-search-empty')).toBeTruthy(), { timeout: 3000 })
    expect(queryByTestId('ai-search-results')).toBeNull()
  })

  it('keeps the input and shows an unavailable note when the service fails', async () => {
    mockFetchAiSearch.mockRejectedValue(new Error('503'))
    const { getByTestId, queryByTestId } = renderPanel()
    fireEvent.changeText(getByTestId('ai-search-input'), 'замки беларуси')
    await waitFor(() => expect(getByTestId('ai-search-unavailable')).toBeTruthy(), { timeout: 3000 })
    expect(getByTestId('ai-search-input')).toBeTruthy()
    expect(queryByTestId('ai-search-results')).toBeNull()
    expect(mockFetchAiSearch).toHaveBeenCalledTimes(1)
  })
})
