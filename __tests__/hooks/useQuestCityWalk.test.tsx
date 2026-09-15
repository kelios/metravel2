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
  requestIdleCallback?: (callback: () => void) => number
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
