/**
 * Регресс на #1452: на карточке шага квеста блок «Экскурсии рядом» должен
 * рендериться РОВНО один раз.
 *
 * Дефект: на native одновременно рисовались две секции с одинаковым заголовком и
 * одинаковой обвязкой — QuestExcursionsInline (Belkraj) и QuestNativeAffiliateSection
 * (партнёрские офферы). Игрок видел «Экскурсии рядом» дважды подряд, причём первая
 * карточка была пустой, когда Belkraj-виджет не отдавал контент.
 *
 * Тест намеренно НЕ мокает `questWizardSections` — иначе он перестанет ловить
 * повторную секцию, добавленную в реальное дерево визарда.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

const EXCURSIONS_TITLE = 'Экскурсии рядом'

const mockOffers = [
  {
    key: 'tours',
    title: 'Экскурсии и гиды',
    subtitle: 'Авторские экскурсии и местные гиды — Познань',
    cta: 'Посмотреть экскурсии',
    url: 'https://tp.media/r?marker=1&p=1&trs=1&u=https%3A%2F%2Fexample.com',
  },
]

jest.mock('@/components/affiliate/affiliateConfig', () => ({
  ...(jest.requireActual('@/components/affiliate/affiliateConfig') as object),
  isAffiliateEnabled: () => true,
  getAffiliateOffers: () => mockOffers,
}))

// Belkraj рендерится только в production-сборке — в jest гейт открываем явно,
// иначе сценарий «виджет + офферы в одной карточке» не воспроизводится.
jest.mock('@/components/belkraj/belkrajAvailability', () => ({
  ...(jest.requireActual('@/components/belkraj/belkrajAvailability') as object),
  isBelkrajEnabled: () => true,
  canRenderBelkrajWidget: () => true,
}))

jest.mock('@/components/quests/questWizardMedia', () => {
  const ReactModule = jest.requireActual('react') as typeof React
  const { View } = jest.requireActual('react-native') as typeof import('react-native')
  return {
    BelkrajWidgetLazy: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, { ...props, testID: 'quest-belkraj-widget' }),
    NativeQuestVideoLazy: () => null,
    QuestFullMapLazy: () => null,
    QuestWebVideo: () => null,
  }
})

jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn() }))
jest.mock('@/components/quests/hooks/useQuestWizardResponsiveModel', () => ({
  useQuestWizardResponsiveModel: () => ({
    screenW: 390,
    screenH: 844,
    isMobile: true,
    compactNav: true,
    compactDesktopLayout: false,
    useWideInlineLayout: false,
    useWideExcursionsSidebar: false,
  }),
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

const anyAnswer = () => true

const makeStep = (id: string, title: string) => ({
  id,
  title,
  location: '',
  story: `Story ${id}`,
  task: `Task ${id}`,
  lat: 52.4,
  lng: 16.93,
  answer: anyAnswer,
})

const intro = {
  id: 'intro',
  title: 'Intro',
  location: '',
  story: 'Начало',
  task: '',
  lat: 52.4,
  lng: 16.93,
  answer: anyAnswer,
}
const steps = [makeStep('goats', 'Козлики'), makeStep('fara', 'Фара')]
const finale = { story: 'Финал', video: undefined, poster: undefined } as any
const city = { id: 'poznan', name: 'Познань', lat: 52.4, lng: 16.93, countryCode: 'PL' }

const originalPlatformOS = Platform.OS

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

const renderWizard = () => render(
  <QuestWizard
    title="Квест по Познани: козлики и Старый рынок"
    steps={steps}
    finale={finale}
    intro={intro}
    storageKey="excursions_single_quest"
    questId="poznan-goats"
    city={city}
  />,
)

afterEach(() => {
  setPlatform(originalPlatformOS)
})

describe('QuestWizard: секция «Экскурсии рядом» на карточке шага', () => {
  it('на native рендерит блок ровно один раз, а не двумя секциями подряд', () => {
    setPlatform('android')

    const { getAllByText, getByTestId } = renderWizard()

    // Ключевая проверка регресса #1452: один заголовок, а не два подряд.
    expect(getAllByText(EXCURSIONS_TITLE)).toHaveLength(1)
    expect(getByTestId('quest-excursions-section')).toBeTruthy()
  })

  it('на native держит Belkraj-виджет и партнёрские офферы в одной карточке', () => {
    setPlatform('android')

    const { getAllByText, getByTestId } = renderWizard()

    expect(getAllByText(EXCURSIONS_TITLE)).toHaveLength(1)
    expect(getByTestId('quest-belkraj-widget')).toBeTruthy()
    // Партнёрская поверхность не потерялась при слиянии секций.
    expect(getAllByText('Экскурсии и гиды')).toHaveLength(1)
  })

  it('на mobile web оставляет ровно один блок и не добавляет партнёрские офферы', () => {
    setPlatform('web')

    const { getAllByText, queryByText } = renderWizard()

    expect(getAllByText(EXCURSIONS_TITLE)).toHaveLength(1)
    expect(queryByText('Экскурсии и гиды')).toBeNull()
  })
})
