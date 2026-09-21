/**
 * @jest-environment jsdom
 */

/**
 * #1569: заметки о местах на экране города.
 *
 * Статический HTML их несёт, значит и рантайм обязан — иначе после гидратации
 * страница теряет своё содержание. Здесь проверяется цена и условие загрузки:
 * бандлы едут только после простоя, только выбранные общей моделью и не роняют
 * секцию, когда один из них недоступен.
 */
import React from 'react'
import { Platform } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { fetchQuestByQuestId } from '@/api/quests'
import { useQuestCityWalk } from '@/hooks/useQuestCityWalk'

jest.mock('@/api/quests', () => ({
  fetchQuestByQuestId: jest.fn(),
}))

const mockedFetch = fetchQuestByQuestId as jest.MockedFunction<typeof fetchQuestByQuestId>

const quest = (id: string) => ({
  id,
  numericId: 1,
  title: `Квест ${id}`,
  points: 1,
  cityId: '4',
  lat: 53.9,
  lng: 27.56,
  ratingAvg: null,
  ratingCount: 0,
  completionsCount: 0,
  viewsCount: 0,
  isCompletedByMe: false,
  firstCompleter: null,
})

const bundleFor = (id: string) => ({
  quest_id: id,
  title: `Квест ${id}`,
  steps: [
    {
      step_id: `${id}-1`,
      title: 'Ратуша',
      location: 'Площадь Свободы',
      story: [
        'Первое предложение о ратуше уходит на страницу квеста целиком.',
        'Второе предложение о ратуше тоже достаётся странице квеста.',
        `Внутри работает городской музей ${id} с коллекцией старых печатей.`,
      ].join(' '),
      answer_pattern: { type: 'any_text' },
    },
  ],
})

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

describe('useQuestCityWalk', () => {
  const originalPlatform = Platform.OS
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeAll(() => {
    // Секции города — web-only, и гейт простоя работает только там: под
    // платформой по умолчанию (`ios`) тест мерил бы отключённую ветку.
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    delete (window as IdleWindow).requestIdleCallback
    delete (window as IdleWindow).cancelIdleCallback
    jest.useFakeTimers()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  })

  afterEach(() => {
    queryClient.clear()
    jest.useRealTimers()
  })

  it('не трогает сеть до простоя и тянет только выбранные общей моделью бандлы', async () => {
    mockedFetch.mockImplementation(async (questId: string) => bundleFor(questId) as never)
    const quests = ['minsk-d', 'minsk-a', 'minsk-c', 'minsk-b'].map(quest)

    const { result } = renderHook(() => useQuestCityWalk(quests as never), { wrapper })

    expect(mockedFetch).not.toHaveBeenCalled()
    expect(result.current).toBeNull()

    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    expect(mockedFetch.mock.calls.map(([questId]) => questId)).toEqual([
      'minsk-a',
      'minsk-b',
      'minsk-c',
    ])
  })

  it('ждёт простоя не дольше 1000 мс «Timeout policy» (#2020)', () => {
    const requestIdleCallback = jest.fn((_callback: () => void, _options?: { timeout: number }) => 1)
    ;(window as IdleWindow).requestIdleCallback = requestIdleCallback
    ;(window as IdleWindow).cancelIdleCallback = jest.fn()

    renderHook(() => useQuestCityWalk([quest('minsk-a')] as never), { wrapper })

    expect(requestIdleCallback).toHaveBeenCalledTimes(1)
    expect(requestIdleCallback.mock.calls[0][1]?.timeout).toBeLessThanOrEqual(1000)
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('без requestIdleCallback запрашивает бандлы не позже чем через 1000 мс', async () => {
    mockedFetch.mockImplementation(async (questId: string) => bundleFor(questId) as never)

    renderHook(() => useQuestCityWalk([quest('minsk-a')] as never), { wrapper })

    expect(mockedFetch).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    expect(mockedFetch).toHaveBeenCalledWith('minsk-a', expect.anything())
  })

  it('не пишет чужие квесты в офлайн-каталог: заметки читают бандл без коммита', async () => {
    mockedFetch.mockImplementation(async (questId: string) => bundleFor(questId) as never)

    renderHook(() => useQuestCityWalk(['minsk-a'].map(quest) as never), { wrapper })

    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    // Слотов «недавних» всего 20: квест, который посетитель не открывал, не
    // должен вытеснять оттуда просмотренный (#1569).
    // С #1992 запрос собирается из общих `questBundleQueryOptions`, поэтому в
    // опции доезжает ещё и `signal` React Query; для инварианта слотов важно
    // ровно `persistOffline: false`.
    expect(mockedFetch).toHaveBeenCalledWith('minsk-a', expect.objectContaining({ persistOffline: false }))
  })

  it('оставляет секцию с теми бандлами, что доехали', async () => {
    mockedFetch.mockImplementation(async (questId: string) => {
      if (questId === 'minsk-a') throw new Error('502')
      return bundleFor(questId) as never
    })

    const { result } = renderHook(() => useQuestCityWalk([quest('minsk-a'), quest('minsk-b')] as never), {
      wrapper,
    })

    // Гейт простоя, затем ответы бандлов, затем батч уведомлений React Query:
    // под поддельными таймерами каждый шаг двигается отдельно.
    await act(async () => {
      jest.runOnlyPendingTimers()
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    expect(result.current?.routes.map((route) => route.questId)).toEqual(['minsk-b'])
    expect(result.current?.places.map((place) => place.questId)).toEqual(['minsk-b'])
  })

  it('не ходит в сеть, пока город не разрешён', () => {
    renderHook(() => useQuestCityWalk([quest('minsk-a')] as never, { enabled: false }), { wrapper })

    jest.runOnlyPendingTimers()

    expect(mockedFetch).not.toHaveBeenCalled()
  })
})
