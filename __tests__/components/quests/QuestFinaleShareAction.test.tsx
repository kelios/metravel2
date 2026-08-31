import React from 'react'
import { act, render, fireEvent, waitFor } from '@testing-library/react-native'
import { Share, StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Верификация вирусной петли финала ([INV2-02], #1472) без браузера: живой финал
// требует полного прохождения квеста (согласие + ответы), что headless нестабильно,
// поэтому взаимодействие «кнопка → лист → канал» проверяем на уровне компонента.

// --- Финальный экран тянет соседние блоки — они здесь не важны. ---
jest.mock('@/components/achievements', () => {
  const ReactModule = jest.requireActual('react') as typeof React
  const { View } = jest.requireActual('react-native') as typeof import('react-native')
  return { BadgeUnlockToast: () => ReactModule.createElement(View, { testID: 'quest-badge-toast' }) }
})
jest.mock('@/components/quests/QuestPioneerBlock', () => {
  const ReactModule = jest.requireActual('react') as typeof React
  const { View } = jest.requireActual('react-native') as typeof import('react-native')
  return { __esModule: true, default: () => ReactModule.createElement(View, { testID: 'quest-pioneer-block' }) }
})
jest.mock('@/components/quests/QuestReviewSection', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestNextStepSection', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useQuestCompletionMeta', () => ({
  useQuestCompletionMeta: () => ({ isCompletedByMe: false, completionsCount: 7 }),
}))
jest.mock('@/components/quests/questWizardMedia', () => ({
  BelkrajWidgetLazy: () => null,
  NativeQuestVideoLazy: () => null,
  QuestFullMapLazy: () => null,
  QuestWebVideo: () => null,
}))
jest.mock('@/components/ui/ImageCardMedia', () => ({ __esModule: true, default: () => null }))

// --- Механизм шаринга: изолируем побочные эффекты. ---
jest.mock('@/api/questsShare', () => ({ createQuestResultCard: jest.fn() }))
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/utils/downloadUrlOnWeb', () => ({ downloadUrlOnWeb: jest.fn().mockReturnValue(true) }))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/gamificationAnalytics', () => ({ trackQuestShareClick: jest.fn() }))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/quest-result.png' }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}))
// Глобальный мок safe-area отдаёт нули, поэтому нижнюю кромку листа он бы не
// проверил: подставляем вставку iPhone с home indicator (#1667).
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 34, left: 0 }
  const ReactModule = jest.requireActual('react') as typeof React
  const mod = {
    __esModule: true,
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    useSafeAreaInsets: () => insets,
  }
  return { ...mod, default: mod }
})
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => unknown) =>
    selector({ username: 'Аня', userId: '1', isAuthenticated: true }),
}))

import { QuestFinalePanel } from '@/components/quests/questWizardSections'
import { createQuestResultCard } from '@/api/questsShare'
import { trackQuestShareClick } from '@/utils/gamificationAnalytics'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

const mockCreateCard = createQuestResultCard as jest.MockedFunction<typeof createQuestResultCard>
const mockTrack = trackQuestShareClick as jest.MockedFunction<typeof trackQuestShareClick>
const mockСlipboardSet = Clipboard.setStringAsync as jest.MockedFunction<typeof Clipboard.setStringAsync>
const mockDownloadImage = FileSystem.downloadAsync as jest.MockedFunction<typeof FileSystem.downloadAsync>
const mockShareImage = Sharing.shareAsync as jest.MockedFunction<typeof Sharing.shareAsync>
const mockOpenExternal = openExternalUrlInNewTab as jest.MockedFunction<typeof openExternalUrlInNewTab>

const styles = {
  completionScreen: {},
  finaleContent: {},
  completionTitle: {},
  completionText: {},
  videoFrame: {},
  primaryButton: {},
  buttonText: {},
}

const renderCompletedFinale = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <QuestFinalePanel
        colors={{}}
        styles={styles}
        finale={{ text: 'Финал' }}
        questFinished
        questCompleted
        stepsMissingForCompletion={0}
        finishedEarly={false}
        completionFinishedAt={1_700_000_000_000}
        completedCount={8}
        stepsCount={8}
        frameW={320}
        videoOk
        handleVideoError={jest.fn()}
        handleVideoRetry={jest.fn()}
        setVideoOk={jest.fn()}
        onContinue={jest.fn()}
        questId="minsk-cipher"
        questNumericId={42}
        questTitle="Минский шифр"
        cityId="4"
        cityName="Минск"
      />
    </QueryClientProvider>,
  )

beforeEach(() => {
  mockCreateCard.mockReset()
  mockTrack.mockReset()
  mockСlipboardSet.mockClear()
  mockDownloadImage.mockClear()
  mockShareImage.mockClear()
  mockOpenExternal.mockClear()
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction })
})

describe('QuestFinaleShareAction ([INV2-02] #1472)', () => {
  it('shows the share button on a credited completion and copies a quest_result-tagged link', async () => {
    mockCreateCard.mockRejectedValue(new Error('no backend yet'))
    const { getByTestId } = renderCompletedFinale()

    const shareBtn = getByTestId('quest-finale-share')
    fireEvent.press(shareBtn)

    // Ссылка-каналы доступны даже без серверной карточки (деградация до ссылки).
    const copy = await waitFor(() => getByTestId('quest-share-channel-copy'))
    expect(getByTestId('quest-share-channel-telegram')).toBeTruthy()

    fireEvent.press(copy)

    await waitFor(() => expect(mockСlipboardSet).toHaveBeenCalledTimes(1))
    const copiedLink = mockСlipboardSet.mock.calls[0][0]
    expect(copiedLink).toContain('utm_medium=quest_result')
    expect(copiedLink).toContain('/quests/4/minsk-cipher')
    expect(mockTrack).toHaveBeenCalledWith({ questId: 'minsk-cipher', channel: 'copy' })
  })

  it('hides image channels while the result-card endpoint is unavailable', async () => {
    mockCreateCard.mockRejectedValue(new Error('no backend yet'))
    const { getByTestId, queryByTestId } = renderCompletedFinale()

    fireEvent.press(getByTestId('quest-finale-share'))
    await waitFor(() => getByTestId('quest-share-channel-copy'))

    expect(queryByTestId('quest-share-channel-instagram')).toBeNull()
    expect(queryByTestId('quest-result-card-preview')).toBeNull()
  })

  it('exposes image + Instagram channels once the server card is ready', async () => {
    mockCreateCard.mockResolvedValue({
      shareToken: 'tok',
      imageUrl: 'https://metravel.by/media/quest-result-42-og.png',
      storyImageUrl: 'https://metravel.by/media/quest-result-42-story.png',
      publicUrl: 'https://metravel.by/quests/result/42',
      expiresAt: null,
    })
    const { getByTestId } = renderCompletedFinale()

    fireEvent.press(getByTestId('quest-finale-share'))

    const instagram = await waitFor(() => getByTestId('quest-share-channel-instagram'))
    expect(getByTestId('quest-result-hero-name')).toBeTruthy()

    fireEvent.press(instagram)
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith({ questId: 'minsk-cipher', channel: 'instagram' }),
    )
    expect(mockDownloadImage).toHaveBeenCalledWith(
      'https://metravel.by/media/quest-result-42-story.png',
      'file:///cache/metravel-quest-story.png',
    )
    expect(mockShareImage).toHaveBeenCalledWith(
      'file:///cache/quest-result.png',
      expect.objectContaining({ mimeType: 'image/png' }),
    )
  })

  it('shares the server public result URL once available', async () => {
    mockCreateCard.mockResolvedValue({
      shareToken: 'tok',
      imageUrl: 'https://metravel.by/media/quest-result-42-og.png',
      storyImageUrl: '',
      publicUrl: 'https://metravel.by/quests/result/42',
      expiresAt: null,
    })
    const { getByTestId } = renderCompletedFinale()

    fireEvent.press(getByTestId('quest-finale-share'))
    const copy = await waitFor(() => getByTestId('quest-share-channel-copy'))
    fireEvent.press(copy)

    await waitFor(() => expect(mockСlipboardSet).toHaveBeenCalled())
    const copiedLink = mockСlipboardSet.mock.calls[0][0]
    expect(copiedLink).toContain('/quests/result/42')
    expect(copiedLink).toContain('utm_medium=quest_result')
  })

  it('keeps the newest hero-name card when requests resolve out of order', async () => {
    let resolveInitial: (value: Awaited<ReturnType<typeof createQuestResultCard>>) => void = () => {}
    let resolveEdited: (value: Awaited<ReturnType<typeof createQuestResultCard>>) => void = () => {}
    mockCreateCard
      .mockImplementationOnce(() => new Promise((resolve) => { resolveInitial = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveEdited = resolve }))

    const { getByTestId } = renderCompletedFinale()
    fireEvent.press(getByTestId('quest-finale-share'))

    const nameInput = await waitFor(() => getByTestId('quest-result-hero-name'))
    fireEvent.changeText(nameInput, 'Новая героиня')
    fireEvent(nameInput, 'blur')

    resolveEdited({
      shareToken: 'new',
      imageUrl: 'https://metravel.by/media/new.png',
      storyImageUrl: '',
      publicUrl: 'https://metravel.by/quests/result/new',
      expiresAt: null,
    })
    await waitFor(() => expect(getByTestId('quest-result-card-preview')).toBeTruthy())

    await act(async () => {
      resolveInitial({
        shareToken: 'old',
        imageUrl: 'https://metravel.by/media/old.png',
        storyImageUrl: '',
        publicUrl: 'https://metravel.by/quests/result/old',
        expiresAt: null,
      })
      await Promise.resolve()
    })

    const copy = getByTestId('quest-share-channel-copy')
    fireEvent.press(copy)
    await waitFor(() => expect(mockСlipboardSet).toHaveBeenCalled())
    expect(mockСlipboardSet.mock.calls.at(-1)?.[0]).toContain('/quests/result/new')
  })

  // #1667: каналы листа — первичное действие, подпись обязана быть видимой на
  // любой ширине, а текст сообщения — называть результат и домен.
  it('labels every share channel and sends a human-readable caption with the domain', async () => {
    mockCreateCard.mockRejectedValue(new Error('no backend yet'))
    const { getByTestId, getByText } = renderCompletedFinale()

    fireEvent.press(getByTestId('quest-finale-share'))
    await waitFor(() => getByTestId('quest-share-channel-copy'))

    // Подписи каналов видимы как текст, а не только в accessibilityLabel.
    expect(getByText('Ссылка')).toBeTruthy()
    expect(getByText('Telegram')).toBeTruthy()

    fireEvent.press(getByTestId('quest-share-channel-telegram'))
    await waitFor(() => expect(mockOpenExternal).toHaveBeenCalled())

    const telegramUrl = String(mockOpenExternal.mock.calls.at(-1)?.[0])
    const caption = decodeURIComponent(telegramUrl.split('&text=')[1] ?? '')
    expect(caption).toContain('Минский шифр')
    expect(caption).toContain('8 из 8')
    expect(caption).toContain('metravel.by')
    expect(caption).not.toContain('попробуй и ты')
  })

  // #1667: подписи каналов сделали ряд выше и он стал нижним элементом листа.
  // `Modal` не приносит системных вставок, поэтому зазор под home indicator
  // iPhone и жестовой панелью Android считается в рендере.
  it('keeps the channel row clear of the system inset at the bottom edge', async () => {
    mockCreateCard.mockRejectedValue(new Error('no backend yet'))
    const { getByTestId } = renderCompletedFinale()

    fireEvent.press(getByTestId('quest-finale-share'))
    await waitFor(() => getByTestId('quest-share-channel-copy'))

    const sheet = StyleSheet.flatten(getByTestId('quest-share-sheet').props.style)
    expect(sheet.paddingBottom).toBe(34)
  })
})
