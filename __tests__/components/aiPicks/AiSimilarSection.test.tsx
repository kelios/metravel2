import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AiSimilarSection } from '@/components/aiPicks/AiSimilarSection'
import type { AiPickItem } from '@/api/aiPicks'

const mockFetchAiSimilar = jest.fn()
jest.mock('@/api/aiPicks', () => ({
  ...jest.requireActual('@/api/aiPicks'),
  fetchAiSimilar: (...args: unknown[]) => mockFetchAiSimilar(...args),
}))

jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive')
  return { ...actual, useResponsive: () => ({ ...actual.useResponsive(), isHydrated: true, isMobile: false }) }
})

const mockUnifiedTravelCard = (props: any) => {
  const { View, Text } = require('react-native')
  return React.createElement(View, { testID: 'unified-card' }, React.createElement(Text, null, props.title), React.createElement(Text, null, props.metaText))
}

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}))

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const item = (id: number, title: string): AiPickItem => ({
  type: 'travel',
  source_id: id,
  title,
  url: `https://metravel.by/travels/slug-${id}`,
  path: `/travels/slug-${id}`,
  snippet: 'фрагмент',
  score: 0.8,
  city: 'Kraków',
  country: 'Польша',
  cover: `https://metravel.by/travel-image/${id}.jpg`,
})

function renderSection(props: Partial<React.ComponentProps<typeof AiSimilarSection>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={client}>
      <AiSimilarSection type="travel" id={816} limit={6} {...props} />
    </QueryClientProvider>,
  )
  return { ...utils, client }
}

describe('AiSimilarSection (#2459)', () => {
  const env = process.env.EXPO_PUBLIC_AI_PICKS
  beforeEach(() => {
    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    mockFetchAiSimilar.mockReset()
  })
  afterAll(() => {
    process.env.EXPO_PUBLIC_AI_PICKS = env
  })

  it('shows a skeleton while loading and then the cards in the same grid', async () => {
    let resolve: (value: AiPickItem[]) => void = () => {}
    mockFetchAiSimilar.mockReturnValue(new Promise<AiPickItem[]>((r) => { resolve = r }))
    const { getByTestId, queryByTestId, getAllByTestId, getByText, getAllByText } = renderSection()

    expect(getByTestId('ai-similar-skeleton')).toBeTruthy()
    expect(getAllByTestId('ai-pick-card-skeleton')).toHaveLength(6)

    resolve([item(1, 'Пескова Скала'), item(2, 'Ойцув')])
    await waitFor(() => expect(getByTestId('ai-similar-grid')).toBeTruthy())
    expect(queryByTestId('ai-similar-skeleton')).toBeNull()
    expect(getByText('Пескова Скала')).toBeTruthy()
    expect(getByText('Ойцув')).toBeTruthy()
    expect(getAllByText('Kraków, Польша')).toHaveLength(2)
    expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1)
    expect(mockFetchAiSimilar.mock.calls[0][0]).toMatchObject({ type: 'travel', id: 816, limit: 6, resultType: 'travel' })
  })

  it('renders nothing (no gap) when the service returns no items', async () => {
    mockFetchAiSimilar.mockResolvedValue([])
    const { queryByTestId } = renderSection()
    await waitFor(() => expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(queryByTestId('ai-similar-skeleton')).toBeNull())
    expect(queryByTestId('ai-similar-section')).toBeNull()
  })

  it('renders nothing and does not retry when the service is unavailable', async () => {
    mockFetchAiSimilar.mockRejectedValue(new Error('network'))
    const { queryByTestId } = renderSection()
    await waitFor(() => expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(queryByTestId('ai-similar-section')).toBeNull())
    await new Promise((r) => setTimeout(r, 30))
    expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1)
  })

  it('sends no request while the flag is off or the section is not enabled', () => {
    process.env.EXPO_PUBLIC_AI_PICKS = ''
    const first = renderSection()
    expect(first.queryByTestId('ai-similar-section')).toBeNull()
    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    const second = renderSection({ enabled: false })
    expect(second.queryByTestId('ai-similar-section')).toBeNull()
    expect(mockFetchAiSimilar).not.toHaveBeenCalled()
  })
})
