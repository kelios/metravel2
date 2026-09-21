/**
 * #2010: блок петли возврата лежит в конце финала, ниже первого экрана, а
 * компактный каталог для него — три запроса и ~27 КБ. На web открытие уже
 * пройденного квеста не должно тянуть каталог, пока блок не дошёл до экрана.
 *
 * Проверка идёт от точки монтирования — `QuestFinalePanel` с засчитанным
 * прохождением — с настоящими секцией и хуком каталога; мокнута только сеть.
 * Видимость отдаёт управляемая подмена `useProgressiveLoad`, как в тестах
 * деталей путешествия: host-ref мокнутого `View` под react-test-renderer — не
 * DOM-узел, и настоящий хук до IntersectionObserver здесь не дошёл бы. Что хук
 * с этой конфигурацией не грузит по таймеру и грузит по пересечению —
 * `__tests__/hooks/useProgressiveLoading.test.tsx`.
 */
import React from 'react'
import { Platform } from 'react-native'
import { act, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { ApiQuestMeta } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import type { ProgressiveLoadConfig } from '@/hooks/useProgressiveLoading'

let mockShouldLoad = false
const mockSetElementRef = jest.fn()
const mockLoadConfigs: ProgressiveLoadConfig[] = []
jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: (config: ProgressiveLoadConfig) => {
    mockLoadConfigs.push(config)
    return { shouldLoad: mockShouldLoad, setElementRef: mockSetElementRef }
  },
}))

jest.mock('@/api/quests', () => ({
  ...jest.requireActual('@/api/quests'),
  fetchQuestsCompactCatalog: jest.fn(),
}))
jest.mock('@/components/achievements', () => ({ BadgeUnlockToast: () => null }))
jest.mock('@/components/quests/QuestPioneerBlock', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestReviewSection', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useQuestCompletionMeta', () => ({
  useQuestCompletionMeta: () => ({ isCompletedByMe: true, completionsCount: 3 }),
}))
jest.mock('@/components/quests/questWizardMedia', () => ({
  BelkrajWidgetLazy: () => null,
  NativeQuestVideoLazy: () => null,
  QuestFullMapLazy: () => null,
  QuestWebVideo: () => null,
}))
jest.mock('@/components/ui/ImageCardMedia', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn(), queueAnalyticsEvent: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

// Пресет jest резолвит `.native`-вариант напоминания; проверяем web-сценарий.
jest.mock('@/components/quests/useQuestReturnReminder', () =>
  jest.requireActual('@/components/quests/useQuestReturnReminder.web'),
)

const mockRememberQuestFinish = jest.fn()
jest.mock('@/utils/questReturnVisit', () => ({
  rememberQuestFinish: (...args: unknown[]) => mockRememberQuestFinish(...args),
  markQuestReturnReminderScheduled: jest.fn(),
  questRetentionOwnerId: () => 'guest',
}))

import { fetchQuestsCompactCatalog } from '@/api/quests'
import { QuestFinalePanel } from '@/components/quests/questWizardSections'

const mockFetchCompactCatalog = fetchQuestsCompactCatalog as jest.MockedFunction<typeof fetchQuestsCompactCatalog>

const meta = (over: Partial<ApiQuestMeta> & Pick<ApiQuestMeta, 'id' | 'quest_id'>): ApiQuestMeta => ({
  title: over.quest_id,
  points: 8,
  city_id: '4',
  city_name: 'Минск',
  lat: 53.9,
  lng: 27.56,
  duration_min: 90,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
  ...over,
})

const CATALOG: ApiQuestMeta[] = [
  meta({ id: 12, quest_id: 'minsk-cipher', title: 'Шифр Минска', is_completed_by_me: true }),
  meta({ id: 13, quest_id: 'minsk-dvoriki', title: 'Дворики', lat: 53.905, lng: 27.555 }),
]

const styles = {
  completionScreen: {},
  finaleContent: {},
  completionTitle: {},
  completionText: {},
  videoFrame: {},
  primaryButton: {},
  buttonText: {},
}

let client: QueryClient

const finale = (overrides: Record<string, unknown> = {}) => (
  <QueryClientProvider client={client}>
    <QuestFinalePanel
      colors={{}}
      styles={styles}
      finale={{ text: 'Финальный текст' }}
      questFinished
      questCompleted
      stepsMissingForCompletion={0}
      finishedEarly={false}
      completionFinishedAt={null}
      completedCount={8}
      stepsCount={8}
      frameW={320}
      videoOk
      handleVideoError={jest.fn()}
      handleVideoRetry={jest.fn()}
      setVideoOk={jest.fn()}
      onContinue={jest.fn()}
      questId="minsk-cipher"
      questNumericId={12}
      questTitle="Шифр Минска"
      cityId="4"
      cityName="Минск"
      cityLat={53.9023}
      cityLng={27.5619}
      {...(overrides as any)}
    />
  </QueryClientProvider>
)

/** Элемент, отданный наблюдателю видимости последним. */
const observedTestID = () => {
  const calls = mockSetElementRef.mock.calls.filter(([node]) => node)
  return calls.at(-1)?.[0]?.props?.testID
}

describe('Блок «следующий квест рядом»: каталог только по прокрутке (#2010)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    mockShouldLoad = false
    mockSetElementRef.mockReset()
    mockLoadConfigs.length = 0
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    mockFetchCompactCatalog.mockReset()
    mockFetchCompactCatalog.mockResolvedValue(CATALOG)
    mockRememberQuestFinish.mockReset()
    mockRememberQuestFinish.mockResolvedValue(null)
  })

  afterEach(() => {
    client.clear()
    ;(Platform as any).OS = originalOS
  })

  it('открытие пройденного квеста не запрашивает каталог, пока блок не на экране', async () => {
    const { queryByTestId } = render(finale())
    await act(async () => {})

    expect(queryByTestId('quest-next-step-anchor')).toBeTruthy()
    expect(observedTestID()).toBe('quest-next-step-anchor')
    expect(queryByTestId('quest-next-step-section')).toBeNull()
    expect(mockFetchCompactCatalog).not.toHaveBeenCalled()
    // Только видимость, без таймера-страховки: иначе запрос вернулся бы
    // каждому, кто открыл финал и не долистал его.
    expect(mockLoadConfigs.at(-1)).toMatchObject({ disableFallbackOnWeb: true })
    expect(mockLoadConfigs.at(-1)?.fallbackDelay).toBeUndefined()
  })

  it('когда блок доходит до экрана, каталог уходит один раз и блок работает как раньше', async () => {
    const { getByTestId, getByText, queryByTestId, rerender } = render(finale())
    expect(mockFetchCompactCatalog).not.toHaveBeenCalled()

    mockShouldLoad = true
    rerender(finale())

    await waitFor(() => expect(getByTestId('quest-next-step-section')).toBeTruthy())
    expect(queryByTestId('quest-next-step-anchor')).toBeNull()
    expect(mockFetchCompactCatalog).toHaveBeenCalledTimes(1)
    expect(getByText('Коллекция: Минск')).toBeTruthy()
    expect(getByText('Пройдено 1 из 2 квестов')).toBeTruthy()
    expect(getByText('Дворики')).toBeTruthy()
  })

  it('финиш в этой сессии запоминается сразу, не дожидаясь прокрутки к блоку', () => {
    render(finale({ completionFinishedAt: 123 }))

    expect(mockRememberQuestFinish).toHaveBeenCalledTimes(1)
    expect(mockRememberQuestFinish.mock.calls[0][0]).toMatchObject({ questId: 'minsk-cipher', finishedAt: 123 })
    expect(mockFetchCompactCatalog).not.toHaveBeenCalled()
  })

  it('каталог из кэша показывается сразу, а перепроверяется только на экране', async () => {
    client.setQueryData(queryKeys.questsCompactCatalog(null), CATALOG, { updatedAt: 1 })
    const { getByText, rerender } = render(finale())

    expect(getByText('Дворики')).toBeTruthy()
    expect(observedTestID()).toBe('quest-next-step-section')
    expect(mockFetchCompactCatalog).not.toHaveBeenCalled()

    mockShouldLoad = true
    rerender(finale())

    await waitFor(() => expect(mockFetchCompactCatalog).toHaveBeenCalledTimes(1))
  })

  it('непройденный квест по-прежнему не монтирует блок и не ходит за каталогом', async () => {
    mockShouldLoad = true
    const { queryByTestId } = render(finale({ questCompleted: false, stepsMissingForCompletion: 3 }))
    await act(async () => {})

    expect(queryByTestId('quest-next-step-anchor')).toBeNull()
    expect(queryByTestId('quest-next-step-section')).toBeNull()
    expect(mockFetchCompactCatalog).not.toHaveBeenCalled()
  })
})
