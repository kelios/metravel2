import React from 'react'
import { Platform } from 'react-native'
import { act, configure, render, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Финальная надпись поверх видео (#2207): поздравление и город — текст
// интерфейса на языке игрока, а не строка, вшитая в пиксели ролика.
jest.mock('@/components/achievements', () => ({ BadgeUnlockToast: () => null }))
jest.mock('@/components/quests/QuestPioneerBlock', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestReviewSection', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestNextStepSection', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useQuestCompletionMeta', () => ({
  useQuestCompletionMeta: () => ({ isCompletedByMe: false, completionsCount: 7 }),
}))
jest.mock('@/utils/questReturnVisit', () => ({
  rememberQuestFinish: jest.fn(),
  markQuestReturnReminderScheduled: jest.fn(),
  questRetentionOwnerId: () => 'guest',
}))

const mockPlayer: { onPlayingChange?: (playing: boolean) => void } = {}

jest.mock('@/components/quests/questWizardMedia', () => {
  const capture = (props: { onPlayingChange?: (playing: boolean) => void }) => {
    mockPlayer.onPlayingChange = props.onPlayingChange
    return null
  }
  return {
    BelkrajWidgetLazy: () => null,
    NativeQuestVideoLazy: capture,
    QuestFullMapLazy: () => null,
    QuestWebVideo: capture,
  }
})

import { i18n, translate as i18nT } from '@/i18n'
import { QuestFinalePanel } from '@/components/quests/questWizardSections'

// Надпись дублирует заголовок финала и скрыта от скринридера — ищем её среди
// скрытых узлов, а саму скрытость проверяем отдельным тестом.
configure({ defaultIncludeHiddenElements: true })

const styles = {
  completionScreen: {},
  finaleContent: {},
  completionTitle: {},
  completionText: {},
  videoFrame: {},
  videoCaption: {},
  videoCaptionTitle: {},
  videoCaptionCity: {},
  primaryButton: {},
  buttonText: {},
}

const finaleElement = (overrides: Record<string, unknown> = {}) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <QuestFinalePanel
        colors={{}}
        styles={styles}
        finale={{ text: 'Финальный текст', video: 'https://metravel.by/media/finale.mp4', poster: 'https://metravel.by/media/poster.jpg' }}
        questFinished
        questCompleted
        stepsMissingForCompletion={0}
        finishedEarly={false}
        completionFinishedAt={null}
        completedCount={9}
        stepsCount={9}
        frameW={320}
        videoOk
        videoUri="https://metravel.by/media/finale.mp4"
        posterUri="https://metravel.by/media/poster.jpg"
        handleVideoError={jest.fn()}
        handleVideoRetry={jest.fn()}
        setVideoOk={jest.fn()}
        questId="minsk-dvoriki"
        questNumericId={12}
        questTitle="Лошицкая усадьба"
        cityId="4"
        cityName="Минск"
        {...(overrides as object)}
      />
    </QueryClientProvider>
  )

const renderFinale = (overrides: Record<string, unknown> = {}) => render(finaleElement(overrides))

const originalPlatform = Platform.OS

afterAll(() => configure({ defaultIncludeHiddenElements: false }))

afterEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  mockPlayer.onPlayingChange = undefined
  await act(async () => {
    await i18n.changeLanguage('ru')
  })
})

describe('QuestFinalePanel: надпись поверх финального видео (#2207)', () => {
  it('на русском показывает поздравление и город поверх ролика', () => {
    const screen = renderFinale()
    const caption = within(screen.getByTestId('quest-finale-video-caption'))

    expect(caption.getByText('Квест пройден!')).toBeTruthy()
    expect(caption.getByText('Минск')).toBeTruthy()
  })

  it('на английском — поздравление интерфейса и город из локализованного бандла, без кириллицы', async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    const screen = renderFinale({ cityName: 'Minsk' })
    const caption = screen.getByTestId('quest-finale-video-caption')

    expect(within(caption).getByText('Quest complete!')).toBeTruthy()
    expect(within(caption).getByText('Minsk')).toBeTruthy()
    expect(within(caption).queryByText(/[А-Яа-яЁё]/)).toBeNull()
  })

  it.each(['ru', 'be', 'uk', 'pl', 'en'])('поздравление на %s приходит из @/i18n', async (locale) => {
    await act(async () => {
      await i18n.changeLanguage(locale)
    })
    const screen = renderFinale()
    const expected = i18nT('questShareStatic:finaleMedia.completedCaption')

    expect(expected).not.toContain('finaleMedia')
    expect(within(screen.getByTestId('quest-finale-video-caption')).getByText(expected)).toBeTruthy()
  })

  it('надпись не дублирует заголовок финала для скринридера', () => {
    const screen = renderFinale()

    expect(screen.getByTestId('quest-finale-video-caption')).toBeTruthy()
    expect(screen.queryByTestId('quest-finale-video-caption', { includeHiddenElements: false })).toBeNull()
  })

  it('незасчитанное прохождение не поздравляет, но подписывает город', () => {
    const screen = renderFinale({ questCompleted: false, stepsMissingForCompletion: 3, completedCount: 6 })
    const caption = within(screen.getByTestId('quest-finale-video-caption'))

    expect(caption.queryByText('Квест пройден!')).toBeNull()
    expect(caption.getByText('Минск')).toBeTruthy()
  })

  it.each(['ios', 'web'] as const)('%s: пока ролик играет, надпись убрана; пауза и конец возвращают её', (os) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
    const screen = renderFinale()

    expect(screen.getByTestId('quest-finale-video-caption')).toBeTruthy()
    expect(mockPlayer.onPlayingChange).toBeDefined()

    act(() => mockPlayer.onPlayingChange?.(true))
    expect(screen.queryByTestId('quest-finale-video-caption')).toBeNull()

    act(() => mockPlayer.onPlayingChange?.(false))
    expect(screen.getByTestId('quest-finale-video-caption')).toBeTruthy()
  })

  it('YouTube-финал и сломанное видео — без надписи поверх', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    const youtube = renderFinale({ youtubeEmbedUri: 'https://www.youtube.com/embed/abc' })
    expect(youtube.queryByTestId('quest-finale-video-caption')).toBeNull()
    youtube.unmount()

    const broken = renderFinale({ videoOk: false })
    expect(broken.queryByTestId('quest-finale-video-caption')).toBeNull()
  })
  it('renders poster-only finale without creating a player, including on native', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    const screen = renderFinale({ finale: { text: 'Poster story', poster: 'https://metravel.by/poster.jpg' }, videoUri: undefined })
    expect(screen.getByTestId('quest-finale-media-frame')).toBeTruthy()
    expect(screen.getByTestId('quest-finale-poster')).toBeTruthy()
    expect(screen.getByTestId('quest-finale-video-caption')).toBeTruthy()
    expect(mockPlayer.onPlayingChange).toBeUndefined()
  })

  it('does not create a media frame without a video or poster, or before route finish', () => {
    const noMedia = renderFinale({ finale: { text: 'Story' }, posterUri: undefined, videoUri: undefined })
    expect(noMedia.queryByTestId('quest-finale-media-frame')).toBeNull()
    noMedia.unmount()
    const unfinished = renderFinale({ questFinished: false })
    expect(unfinished.queryByTestId('quest-finale-video-caption')).toBeNull()
  })

  it('updates caption on live locale changes without remounting the panel', async () => {
    const screen = renderFinale({ cityName: 'Minsk' })
    expect(screen.getByText('Квест пройден!')).toBeTruthy()
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.getByText('Quest complete!')).toBeTruthy()
    expect(screen.queryByText('Квест пройден!')).toBeNull()
  })

  it('resets playback for a source visit and rejects callbacks from previous visits', () => {
    const screen = renderFinale()
    const oldPlaying = mockPlayer.onPlayingChange!
    act(() => oldPlaying(true))
    expect(screen.queryByTestId('quest-finale-video-caption')).toBeNull()
    screen.rerender(finaleElement({ questId: 'next-quest', videoUri: 'https://metravel.by/next.mp4' }))
    expect(screen.getByTestId('quest-finale-video-caption')).toBeTruthy()
    act(() => oldPlaying(true))
    expect(screen.getByTestId('quest-finale-video-caption')).toBeTruthy()
    act(() => mockPlayer.onPlayingChange!(true))
    expect(screen.queryByTestId('quest-finale-video-caption')).toBeNull()
  })

  it('passes taps through the caption and does not invent congratulations for partial/no-city', () => {
    const screen = renderFinale({ questCompleted: false, cityName: undefined })
    expect(screen.queryByTestId('quest-finale-video-caption')).toBeNull()
    screen.rerender(finaleElement())
    expect(screen.getByTestId('quest-finale-video-caption').props.pointerEvents).toBe('none')
  })

})
