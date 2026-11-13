/**
 * #3395: `useAiSimilarAvailability` — пункт меню «Похожие статьи» держится ответа
 * того же запроса, что и блок: без ответа — оптимистично есть, пустой ответ или
 * отказ — нет, выключенный блок или нет id — нет. Своего запроса хук не делает.
 */
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Text, View } from 'react-native'
import { render as renderUi } from '@testing-library/react-native'

import { queryKeys } from '@/api/queryKeys'
import { AiSimilarSection } from '@/components/aiPicks/AiSimilarSection'
import { aiSimilarQueryKey, useAiSimilarAvailability } from '@/hooks/useAiSimilarAvailability'

const mockFetchAiSimilar = jest.fn()
jest.mock('@/api/aiPicks', () => ({
  ...jest.requireActual('@/api/aiPicks'),
  fetchAiSimilar: (...args: unknown[]) => mockFetchAiSimilar(...args),
}))
jest.mock('@/components/aiPicks/AiPickCard', () => ({
  AiPickCard: () => null,
  AiPickCardSkeleton: () => null,
}))

const mockEnabled = jest.fn(() => true)
jest.mock('@/utils/aiPicksConfig', () => ({
  ...jest.requireActual('@/utils/aiPicksConfig'),
  isAiSimilarEnabled: () => mockEnabled(),
}))

jest.mock('@/i18n', () => ({ ...jest.requireActual('@/i18n'), getActiveLocale: () => 'ru' }))

const KEY = queryKeys.aiSimilar('travel', 42, 'ru', 'travel')

let client: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const render = (id: unknown = 42) =>
  renderHook(() => useAiSimilarAvailability('travel', id, 'travel'), { wrapper })

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockEnabled.mockReturnValue(true)
})

describe('useAiSimilarAvailability (#3395)', () => {
  it('shares the query key with useAiSimilar', () => {
    expect(aiSimilarQueryKey('travel', 42, 'ru', 'travel')).toEqual(KEY)
    expect(aiSimilarQueryKey('quest', 7, 'en', undefined)).toEqual(queryKeys.aiSimilar('quest', 7, 'en', 'all'))
  })

  it('is optimistic before the block answered and never fetches on its own', async () => {
    const { result } = await render()

    expect(result.current).toBe(true)
    expect(client.getQueryState(KEY)?.fetchStatus ?? 'idle').toBe('idle')
    expect(client.getQueryData(KEY)).toBeUndefined()
  })

  it('follows the block answer: neighbours keep the link, an empty answer drops it', async () => {
    const { result } = await render()

    await act(async () => {
      client.setQueryData(KEY, [{ type: 'travel', source_id: 1 }])
    })
    await waitFor(() => expect(result.current).toBe(true))

    await act(async () => {
      client.setQueryData(KEY, [])
    })
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('drops the link when the block request failed', async () => {
    const { result } = await render()

    await act(async () => {
      await client
        .fetchQuery({ queryKey: KEY, queryFn: () => Promise.reject(new Error('offline')) })
        .catch(() => undefined)
    })
    expect(client.getQueryState(KEY)?.status).toBe('error')
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('returns false without a QueryClientProvider instead of throwing', async () => {
    const { result } = await renderHook(() => useAiSimilarAvailability('travel', 42, 'travel'))

    expect(result.current).toBe(false)
  })

  it.each([
    ['the block is disabled', 42, false],
    ['the travel id is missing', null, true],
    ['the travel id is not a positive integer', Number.NaN, true],
  ] as const)('returns false when %s', async (_label, id, enabled) => {
    mockEnabled.mockReturnValue(enabled)
    client.setQueryData(KEY, [{ type: 'travel', source_id: 1 }])

    const { result } = await render(id)

    expect(result.current).toBe(false)
  })
})

// Пункт меню и блок — разные компоненты на одном кэше: этот контракт падает, если
// блок сменит ключ/`resultType` запроса, а меню (аргументы как во view model
// статьи) продолжит ждать ответа, который не придёт, — ссылка в никуда.
describe('useAiSimilarAvailability follows the real AiSimilarSection', () => {
  function MenuProbe() {
    const hasSimilar = useAiSimilarAvailability('travel', 42, 'travel')
    return <Text testID="menu-probe">{String(hasSimilar)}</Text>
  }

  const renderPage = (anchorRef?: React.RefObject<View | null>) =>
    renderUi(
      <QueryClientProvider client={client}>
        <MenuProbe />
        <AiSimilarSection type="travel" id={42} sectionKey="similar" anchorRef={anchorRef} />
      </QueryClientProvider>,
    )

  beforeEach(() => mockFetchAiSimilar.mockReset())

  it('keeps the link while the block renders neighbours and hands it the anchor', async () => {
    mockFetchAiSimilar.mockResolvedValue([{ type: 'travel', source_id: 1, title: 'A' }])
    const anchorRef = React.createRef<View>()
    const { getByTestId } = await renderPage(anchorRef)

    await waitFor(() => expect(getByTestId('ai-similar-grid')).toBeTruthy())
    expect(getByTestId('menu-probe').props.children).toBe('true')
    expect(anchorRef.current).not.toBeNull()
    expect(mockFetchAiSimilar).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['answers empty', () => mockFetchAiSimilar.mockResolvedValue([])],
    ['fails', () => mockFetchAiSimilar.mockRejectedValue(new Error('offline'))],
  ])('drops the link together with the block when the request %s', async (_label, arrange) => {
    arrange()
    const { getByTestId, queryByTestId } = await renderPage()

    await waitFor(() => expect(getByTestId('menu-probe').props.children).toBe('false'))
    expect(queryByTestId('ai-similar-section')).toBeNull()
  })
})
