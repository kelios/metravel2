import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Финальный экран тянет достижения, счётчик прохождений и медиа — для проверки
// политики зачёта (#1443) важно только, показаны ли эти блоки вообще.
jest.mock('@/components/achievements', () => ({
  BadgeUnlockToast: () => {
    const ReactModule = jest.requireActual('react') as typeof React
    const { View } = jest.requireActual('react-native') as typeof import('react-native')
    return ReactModule.createElement(View, { testID: 'quest-badge-toast' })
  },
}))

jest.mock('@/components/quests/QuestPioneerBlock', () => {
  const ReactModule = jest.requireActual('react') as typeof React
  const { View } = jest.requireActual('react-native') as typeof import('react-native')
  return {
    __esModule: true,
    default: () => ReactModule.createElement(View, { testID: 'quest-pioneer-block' }),
  }
})

jest.mock('@/components/quests/QuestReviewSection', () => ({
  __esModule: true,
  default: () => {
    const ReactModule = jest.requireActual('react') as typeof React
    const { View } = jest.requireActual('react-native') as typeof import('react-native')
    return ReactModule.createElement(View, { testID: 'quest-review-section' })
  },
}))

jest.mock('@/hooks/useQuestCompletionMeta', () => ({
  useQuestCompletionMeta: () => ({ isCompletedByMe: false, completionsCount: 7 }),
}))

// #1484: блок «следующий квест рядом» ходит за каталогом квестов. Здесь важно
// только, показан он или нет, поэтому каталог отдаём пустым, а данные блока —
// фиксированными.
jest.mock('@/hooks/useQuestCityCollection', () => ({
  useQuestCityCollection: () => ({
    collection: { cityId: '4', cityName: 'Минск', completedCount: 1, totalCount: 6, ratio: 1 / 6 },
    suggestions: [],
    loading: false,
  }),
}))

jest.mock('@/utils/questReturnVisit', () => ({
  rememberQuestFinish: jest.fn(),
  markQuestReturnReminderScheduled: jest.fn(),
  questRetentionOwnerId: () => 'guest',
}))

jest.mock('@/components/quests/questWizardMedia', () => ({
  BelkrajWidgetLazy: () => null,
  NativeQuestVideoLazy: () => null,
  QuestFullMapLazy: () => null,
  QuestWebVideo: () => null,
}))

import { QuestFinalePanel } from '@/components/quests/questWizardSections'

const styles = {
  completionScreen: {},
  finaleContent: {},
  completionTitle: {},
  completionText: {},
  videoFrame: {},
  primaryButton: {},
  buttonText: {},
}

const renderFinale = (overrides: Record<string, unknown>) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <QuestFinalePanel
      colors={{}}
      styles={styles}
      finale={{ text: 'Финальный текст' }}
      questFinished
      questCompleted={false}
      stepsMissingForCompletion={5}
      finishedEarly
      completedCount={1}
      stepsCount={9}
      frameW={320}
      videoOk
      handleVideoError={jest.fn()}
      handleVideoRetry={jest.fn()}
      setVideoOk={jest.fn()}
      onContinue={jest.fn()}
      questId="minsk-dvoriki"
      questNumericId={12}
      questTitle="Лошицкая усадьба"
      cityId="4"
      cityName="Минск"
      {...(overrides as any)}
    />
    </QueryClientProvider>,
  )

describe('QuestFinalePanel: частичное прохождение (#1443)', () => {
  it('не выдаёт значок, «первопроходца» и счётчик, но объясняет недобор', () => {
    const { getByTestId, queryByTestId, getByText } = renderFinale({})

    expect(getByText('Квест пройден частично')).toBeTruthy()
    expect(getByTestId('quest-finale-not-credited')).toBeTruthy()
    // Награды остаются за засчитанным прохождением.
    expect(queryByTestId('quest-pioneer-block')).toBeNull()
    expect(queryByTestId('quest-badge-toast')).toBeNull()
    // Путь назад к пропущенным точкам показан: недобор ещё можно закрыть.
    expect(getByTestId('quest-finale-continue-partial')).toBeTruthy()
    // Финал сохраняется: текст концовки игрок видит.
    expect(getByText('Финальный текст')).toBeTruthy()
    // #1484: следующий шаг — это не новый квест, а возврат к пропущенным точкам.
    expect(queryByTestId('quest-next-step-section')).toBeNull()
    // Публичный рейтинг собираем только от засчитанных прохождений.
    expect(queryByTestId('quest-review-section')).toBeNull()
  })

  it('засчитанное прохождение остаётся полноценным финалом с наградами', () => {
    const { getByTestId, queryByTestId, getByText } = renderFinale({
      questCompleted: true,
      stepsMissingForCompletion: 0,
      completedCount: 8,
    })

    expect(getByText('Квест завершен!')).toBeTruthy()
    expect(getByTestId('quest-pioneer-block')).toBeTruthy()
    expect(getByTestId('quest-badge-toast')).toBeTruthy()
    // Пропущенные далёкие точки объясняются честной строкой, а не молчанием.
    expect(getByTestId('quest-finale-partial')).toBeTruthy()
    expect(queryByTestId('quest-finale-not-credited')).toBeNull()
    expect(queryByTestId('quest-finale-continue-partial')).toBeNull()
    // #1484: у засчитанного прохождения появляется второе действие.
    expect(getByTestId('quest-next-step-section')).toBeTruthy()
    expect(getByTestId('quest-review-section')).toBeTruthy()
  })
})
