import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

const mockNotifyQuest = jest.fn()
const mockConfirm = jest.fn()
const mockFetchQuest = jest.fn()
const mockSaveQuest = jest.fn()
jest.mock('@/api/quests', () => ({ ...jest.requireActual('@/api/quests'), fetchQuestByQuestId: (...args: unknown[]) => mockFetchQuest(...args) }))
jest.mock('@/services/offline/questOfflineAdapter', () => ({ saveQuestOffline: (...args: unknown[]) => mockSaveQuest(...args) }))

jest.mock('@/components/quests/questWizardHelpers', () => ({
  ...jest.requireActual('@/components/quests/questWizardHelpers'),
  confirmQuestAsync: (...args: unknown[]) => mockConfirm(...args),
  notifyQuest: (message: string) => mockNotifyQuest(message),
}))
jest.mock('@/utils/consent', () => ({
  CONSENT_KEY: 'metravel_consent_v1',
  readConsent: () => ({ necessary: true, analytics: true, date: '2026-09-23' }),
  writeConsent: jest.fn(),
}))
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn() }))
jest.mock('@/components/quests/hooks/useQuestWizardResponsiveModel', () => ({
  ...jest.requireActual('@/components/quests/hooks/useQuestWizardResponsiveModel'),
  useQuestWizardResponsiveModel: () => ({
    screenW: 1280,
    screenH: 900,
    isMobile: false,
    headerInScreenRow: false,
    compactNav: false,
    compactDesktopLayout: false,
    useWideInlineLayout: false,
    useWideExcursionsSidebar: false,
  }),
}))
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsColumns: ({ children }: { children: React.ReactNode }) => children,
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


const renderQuest = async () => {
  const view = await render(
    <QuestWizard title="Test" steps={[makeStep('s1')]} finale={{ story: 'End' } as any}
      intro={{ ...makeStep('intro'), title: 'Intro' }} storageKey="offline-copy"
      questId="test-quest" cityId="minsk" />,
  )
  await act(async () => { await Promise.resolve() })
  return view
}

describe('quest offline save on web (#3063)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web')
    jest.clearAllMocks()
    window.localStorage.clear()
    mockFetchQuest.mockResolvedValue({})
    mockSaveQuest.mockResolvedValue({ assetCount: 1 })
  })
  afterEach(() => jest.restoreAllMocks())

  it('explains the limits before saving and confirms the open-tab condition afterward', async () => {
    mockConfirm.mockResolvedValue(true)
    const view = await renderQuest()
    await act(async () => {
      await fireEvent.press(view.getAllByLabelText(i18nT('quests:components.quests.questWizardShell.skachat_kvest_dlya_oflayna_1b7e958c'))[0])
      await Promise.resolve()
    })
    expect(mockConfirm).toHaveBeenCalledWith(
      i18nT('quests:components.quests.QuestWizard.webOfflineTitle'),
      i18nT('quests:components.quests.QuestWizard.webOfflineBeforeSave'),
    )
    expect(mockSaveQuest).toHaveBeenCalledTimes(1)
    expect(mockNotifyQuest).toHaveBeenCalledWith(i18nT('quests:components.quests.QuestWizard.webOfflineSaved'))
    expect(view.getByTestId('quest-offline-web-saved-details').props.children)
      .toBe(i18nT('quests:components.quests.QuestWizard.webOfflineBeforeSave'))
  })

  it('does not start a download when the warning is cancelled', async () => {
    mockConfirm.mockResolvedValue(false)
    const view = await renderQuest()
    await act(async () => {
      await fireEvent.press(view.getAllByLabelText(i18nT('quests:components.quests.questWizardShell.skachat_kvest_dlya_oflayna_1b7e958c'))[0])
      await Promise.resolve()
    })
    expect(mockFetchQuest).not.toHaveBeenCalled()
    expect(mockSaveQuest).not.toHaveBeenCalled()
  })
})
