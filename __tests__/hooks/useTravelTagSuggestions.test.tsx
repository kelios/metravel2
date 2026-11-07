import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AI_TAG_SUGGEST_MIN_TEXT_CHARS } from '@/api/aiAssist/policy'
import { normalizeTagSuggestions } from '@/api/aiTagSuggestions'
import { tagSuggestionTextKey, useTravelTagSuggestions } from '@/hooks/useTravelTagSuggestions'

const mockFetch = jest.fn()
jest.mock('@/api/aiTagSuggestions', () => ({
  ...jest.requireActual('@/api/aiTagSuggestions'),
  fetchAiTagSuggestions: (...args: unknown[]) => mockFetch(...args),
}))

const mockEnabled = jest.fn(() => true)
jest.mock('@/utils/aiPicksConfig', () => ({
  ...jest.requireActual('@/utils/aiPicksConfig'),
  isAiPicksEnabled: () => mockEnabled(),
}))

jest.mock('@/i18n', () => ({ ...jest.requireActual('@/i18n'), getActiveLocale: () => 'pl' }))

const LONG = 'Поездка в Гродно на выходные с детьми: замок, набережная, парк и кафе. '.repeat(8)

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockFetch.mockReset()
  mockEnabled.mockReturnValue(true)
  mockFetch.mockResolvedValue(normalizeTagSuggestions({ categories: [10], confidence: 0.8 }))
})

describe('useTravelTagSuggestions', () => {
  it('запрашивает подсказку по нормализованному тексту и локали, один раз', async () => {
    const { result } = await renderHook(() => useTravelTagSuggestions(`  ${LONG}\n\n`), { wrapper })
    await waitFor(() => expect(result.current.data?.categories).toEqual(['10']))
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toMatchObject({ text: LONG.trim(), locale: 'pl' })
    expect(mockFetch.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)
  })

  it('без флага EXPO_PUBLIC_AI_PICKS запросов нет', async () => {
    mockEnabled.mockReturnValue(false)
    const { result } = await renderHook(() => useTravelTagSuggestions(LONG), { wrapper })
    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it(`короче ${AI_TAG_SUGGEST_MIN_TEXT_CHARS} знаков или enabled: false — запросов нет`, async () => {
    const short = await renderHook(() => useTravelTagSuggestions('x'.repeat(AI_TAG_SUGGEST_MIN_TEXT_CHARS - 1)), { wrapper })
    const disabled = await renderHook(() => useTravelTagSuggestions(LONG, { enabled: false }), { wrapper })
    await Promise.resolve()
    expect(short.result.current.fetchStatus).toBe('idle')
    expect(disabled.result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('ключ — отпечаток текста, а не сам текст', () => {
    const a = tagSuggestionTextKey(LONG)
    expect(a).toMatch(/^\d+:[0-9a-f]+$/)
    expect(a.length).toBeLessThan(24)
    expect(tagSuggestionTextKey(LONG)).toBe(a)
    expect(tagSuggestionTextKey(`${LONG}!`)).not.toBe(a)
  })
})
