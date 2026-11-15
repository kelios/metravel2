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

// The default: a hydrated desktop consumer. `mockFirstFrame` replays the first
// web frame of `useHydrationReady`: only a `clientOnly` consumer is ready there.
let mockFirstFrame: { isMobile: boolean } | null = null
jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive')
  return {
    ...actual,
    useResponsive: (options?: { clientOnly?: boolean }) => ({
      ...actual.useResponsive(),
      ...(mockFirstFrame
        ? { isHydrated: options?.clientOnly === true, isMobile: mockFirstFrame.isMobile }
        : { isHydrated: true, isMobile: false }),
    }),
  }
})

const mockUnifiedTravelCard = jest.fn((props: any) => {
  const { View, Text } = require('react-native')
  return React.createElement(View, { testID: 'unified-card' }, React.createElement(Text, null, props.title), React.createElement(Text, null, props.metaText))
})

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
  lat: null,
  lng: null,
  cover: `https://metravel.by/travel-image/${id}.jpg`,
})

async function renderSection(props: Partial<React.ComponentProps<typeof AiSimilarSection>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = await render(
    <QueryClientProvider client={client}>
      <AiSimilarSection type="travel" id={816} limit={6} {...props} />
    </QueryClientProvider>,
  )
  return { ...utils, client }
}

describe('AiSimilarSection (#2459)', () => {
  const env = process.env.EXPO_PUBLIC_AI_PICKS
  const sourceEnv = process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE
  beforeEach(() => {
    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = ''
    mockFetchAiSimilar.mockReset()
    mockFirstFrame = null
  })
  afterAll(() => {
    process.env.EXPO_PUBLIC_AI_PICKS = env
    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = sourceEnv
  })

  it('shows the block from the static artifact while the picks flag is off (#3292)', async () => {
    process.env.EXPO_PUBLIC_AI_PICKS = ''
    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = 'static'
    mockFetchAiSimilar.mockResolvedValue([item(1, 'Пескова Скала')])
    const { getByTestId, getByText } = await renderSection()
    await waitFor(() => expect(getByTestId('ai-similar-grid')).toBeTruthy())
    expect(getByText('Пескова Скала')).toBeTruthy()
    expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1)
  })

  it('shows a skeleton while loading and then the cards in the same grid', async () => {
    let resolve: (value: AiPickItem[]) => void = () => {}
    mockFetchAiSimilar.mockReturnValue(new Promise<AiPickItem[]>((r) => { resolve = r }))
    const { getByTestId, queryByTestId, getAllByTestId, getByText, getAllByText } = await renderSection()

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

  // #3430: the travel block mounts in the deferred sidebar after hydration. Its
  // first frame must already use the phone layout: 6 wide skeletons collapsing to
  // 3 one frame later moved the comments by ~1000 px at the end of the article.
  it('draws the phone skeleton count in the first frame of the post-hydration travel block', async () => {
    mockFirstFrame = { isMobile: true }
    mockFetchAiSimilar.mockReturnValue(new Promise<AiPickItem[]>(() => {}))
    const { getAllByTestId } = await renderSection()
    expect(getAllByTestId('ai-pick-card-skeleton')).toHaveLength(3)
  })

  // #3430: a freshly mounted card had its own width-0 frame (title in 2 lines, then
  // 1: +12 px per card, grid 1290 → 1332 → 1296 px) — the cards share the opt-in.
  it.each([['travel', true], ['quest', false]] as const)('lets the %s cards skip the hydration frame: %s', async (type, clientOnly) => {
    mockFetchAiSimilar.mockResolvedValue([item(1, 'Пескова Скала')])
    const { getByTestId } = await renderSection({ type })
    await waitFor(() => expect(getByTestId('ai-similar-grid')).toBeTruthy())
    expect(mockUnifiedTravelCard).toHaveBeenLastCalledWith(expect.objectContaining({ layoutClientOnly: clientOnly }))
  })

  it('keeps the hydration gate for the quest block rendered by the quest page', async () => {
    mockFirstFrame = { isMobile: true }
    mockFetchAiSimilar.mockReturnValue(new Promise<AiPickItem[]>(() => {}))
    const { getAllByTestId } = await renderSection({ type: 'quest' })
    expect(getAllByTestId('ai-pick-card-skeleton')).toHaveLength(6)
  })

  it('renders nothing (no gap) when the service returns no items', async () => {
    mockFetchAiSimilar.mockResolvedValue([])
    const { queryByTestId } = await renderSection()
    await waitFor(() => expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(queryByTestId('ai-similar-skeleton')).toBeNull())
    expect(queryByTestId('ai-similar-section')).toBeNull()
  })

  it('renders nothing and does not retry when the service is unavailable', async () => {
    mockFetchAiSimilar.mockRejectedValue(new Error('network'))
    const { queryByTestId } = await renderSection()
    await waitFor(() => expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(queryByTestId('ai-similar-section')).toBeNull())
    await new Promise((r) => setTimeout(r, 30))
    expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1)
  })

  it('sends no request while the flag is off or the section is not enabled', async () => {
    process.env.EXPO_PUBLIC_AI_PICKS = ''
    const first = await renderSection()
    expect(first.queryByTestId('ai-similar-section')).toBeNull()
    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    const second = await renderSection({ enabled: false })
    expect(second.queryByTestId('ai-similar-section')).toBeNull()
    expect(mockFetchAiSimilar).not.toHaveBeenCalled()
  })
})
