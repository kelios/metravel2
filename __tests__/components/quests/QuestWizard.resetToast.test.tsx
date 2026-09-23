/**
 * #2043: «Сбросить» без сети. Тост «Прогресс очищен» был правдой только про
 * устройство: строка на сервере оставалась. Теперь, пока удаление там ждёт сети,
 * тост говорит об этом; подтверждённый сброс и гость видят прежний текст.
 */
import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

const mockNotifyQuest = jest.fn()

jest.mock('@/components/quests/questWizardHelpers', () => ({
  ...jest.requireActual('@/components/quests/questWizardHelpers'),
  confirmQuestAsync: jest.fn(async () => true),
  notifyQuest: (message: string) => mockNotifyQuest(message),
}))
jest.mock('@/utils/consent', () => ({
  CONSENT_KEY: 'metravel_consent_v1',
  readConsent: () => ({ necessary: true, analytics: true, date: '2026-09-23' }),
  writeConsent: jest.fn(),
}))
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn() }))
jest.mock('@/components/quests/hooks/useQuestWizardResponsiveModel', () => ({
  useQuestWizardResponsiveModel: () => ({
    screenW: 1280,
    screenH: 900,
    isMobile: false,
    compactNav: false,
    compactDesktopLayout: false,
    useWideInlineLayout: false,
    useWideExcursionsSidebar: false,
  }),
}))
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsSidebar: () => null,
  QuestFinalePanel: () => null,
}))
jest.mock('@/components/quests/useQuestFinaleMedia', () => ({
  useQuestFinaleMedia: () => ({
    frameW: 300,
    videoOk: true,
    setVideoOk: jest.fn(),
    videoUri: undefined,
    posterUri: undefined,
    youtubeEmbedUri: undefined,
    handleVideoError: jest.fn(),
    handleVideoRetry: jest.fn(),
  }),
}))
jest.mock('@/components/quests/useQuestReminder', () => ({ useQuestReminder: jest.fn() }))
jest.mock('@/components/quests/useQuestGeofence', () => ({ useQuestGeofence: jest.fn() }))
jest.mock('@/components/quests/QuestPrintable', () => ({ generatePrintableQuest: jest.fn() }))
jest.mock('@/components/quests/questOfflineMapExport', () => ({
  exportQuestOfflineMap: jest.fn(),
  getQuestOfflineMapPoints: () => [],
  openQuestOfflineMapInApp: jest.fn(),
}))

import { QuestWizard } from '@/components/quests/QuestWizard'
import { translate as i18nT } from '@/i18n'

const makeStep = (id: string) => ({
  id,
  title: `Точка ${id}`,
  location: '',
  story: `Story ${id}`,
  task: `Task ${id}`,
  lat: 53.9,
  lng: 27.56,
  answer: () => true,
})

const renderAndReset = async (onProgressReset: (serverId: number) => Promise<boolean> | void) => {
  const view = render(
    <QuestWizard
      title="Тест-квест"
      steps={[makeStep('s1'), makeStep('s2')]}
      finale={{ story: 'Финал' } as any}
      intro={{ ...makeStep('intro'), title: 'Intro' }}
      storageKey="reset_toast_quest"
      questId="test-quest"
      cityId="minsk"
      onProgressReset={onProgressReset}
    />,
  )
  await act(async () => {
    await Promise.resolve()
  })
  await act(async () => {
    fireEvent.press(view.getAllByLabelText(i18nT('quests:components.quests.questWizardShell.sbrosit_progress_5f45dc36'))[0])
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('QuestWizard: тост после «Сбросить» (#2043)', () => {
  beforeEach(() => {
    mockNotifyQuest.mockClear()
    window.localStorage.clear()
  })

  it('говорит, что с сервера прогресс удалится при появлении сети, пока удаление ждёт', async () => {
    await renderAndReset(async () => true)

    expect(mockNotifyQuest).toHaveBeenCalledWith(
      i18nT('quests:components.quests.QuestWizard.progressClearedServerPending'),
    )
  })

  it('подтверждённый сброс и гость видят прежнее «Прогресс очищен»', async () => {
    await renderAndReset(async () => false)
    await renderAndReset(() => undefined)

    expect(mockNotifyQuest.mock.calls).toEqual([
      [i18nT('quests:components.quests.QuestWizard.progress_ochischen_54659954')],
      [i18nT('quests:components.quests.QuestWizard.progress_ochischen_54659954')],
    ])
  })
})
