/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act } from 'react-test-renderer'
import { render } from '@testing-library/react-native'

const mockUseIsFocused = jest.fn(() => true)
const mockRouterPush = jest.fn()
const mockUseAuth = jest.fn(() => ({ isAuthenticated: true }))
const mockUseQuestBundle = jest.fn(() => ({
  bundle: {
    id: 77,
    title: 'Тайна Свислочского Цмока: Легенда оживает',
    storageKey: 'minsk-cmok',
    steps: [],
    finale: null,
    intro: null,
    city: { name: 'Минск', countryCode: 'BY', lat: 53.9, lng: 27.56 },
  },
  loading: false,
  error: null,
  refetch: jest.fn(),
}))
const mockUseQuestProgressSync = jest.fn(() => ({
  progress: null,
  progressLoading: false,
  saveProgress: jest.fn(),
  resetProgress: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ city: '4', questId: 'minsk-cmok' }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  useIsFocused: () => mockUseIsFocused(),
  useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: '#fff',
    surface: '#fff',
    border: '#ddd',
    primary: '#f60',
    text: '#222',
    textMuted: '#666',
    textOnPrimary: '#fff',
  }),
}))

jest.mock('@/hooks/useQuestsApi', () => ({
  useQuestBundle: (...args: any[]) => mockUseQuestBundle(...args),
  useQuestProgressSync: (...args: any[]) => mockUseQuestProgressSync(...args),
  useQuestReviews: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}))

jest.mock('@/hooks/useQuestRatingMeta', () => ({
  useQuestRatingMeta: () => ({ ratingAvg: null, ratingCount: 0 }),
}))

jest.mock('@/hooks/useQuestCompletionMeta', () => ({
  useQuestCompletionMeta: () => ({ isCompletedByMe: false, completionsCount: 0 }),
}))

jest.mock('@/hooks/useQuestPioneerMeta', () => ({
  useQuestPioneerMeta: () => null,
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockQuestWizard = jest.fn(() => null)

jest.mock('@/components/quests/QuestWizard', () => ({
  QuestWizard: (props: any) => mockQuestWizard(props),
}))

const mockUseGuestQuestFlow = jest.fn(() => ({
  guestInitial: null,
  guestReady: true,
  guestFreeSteps: 2,
  persistGuestProgress: jest.fn(),
  goToLogin: jest.fn(),
  goToRegister: jest.fn(),
}))

jest.mock('@/components/quests/useGuestQuestFlow', () => ({
  useGuestQuestFlow: (...args: any[]) => mockUseGuestQuestFlow(...args),
}))

jest.mock('@/components/quests/TravelsForQuestSection', () => ({
  __esModule: true,
  default: () => null,
}))

describe('Quest screen title sync', () => {
  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockUseIsFocused.mockReturnValue(true)
    mockRouterPush.mockClear()
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockUseQuestBundle.mockClear()
    mockUseQuestBundle.mockReturnValue({
      bundle: {
        id: 77,
        title: 'Тайна Свислочского Цмока: Легенда оживает',
        storageKey: 'minsk-cmok',
        steps: [],
        finale: null,
        intro: null,
        city: { name: 'Минск', countryCode: 'BY', lat: 53.9, lng: 27.56 },
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockUseQuestProgressSync.mockClear()
    mockUseQuestProgressSync.mockReturnValue({
      progress: null,
      progressLoading: false,
      saveProgress: jest.fn(),
      resetProgress: jest.fn(),
    })
    mockQuestWizard.mockClear()
    mockUseGuestQuestFlow.mockClear()
    mockUseGuestQuestFlow.mockReturnValue({
      guestInitial: null,
      guestReady: true,
      guestFreeSteps: 2,
      persistGuestProgress: jest.fn(),
      goToLogin: jest.fn(),
      goToRegister: jest.fn(),
    })
    document.title = 'Energylandia - польский Диснейленд.'
    document.body.innerHTML = ''
    document.head.innerHTML = [
      '<meta name="description" content="old desc">',
      '<meta property="og:title" content="Energylandia - польский Диснейленд.">',
      '<meta property="og:description" content="old desc">',
      '<meta property="og:url" content="https://metravel.by/travels/energylandia-polskiy-disneylend">',
      '<meta property="og:type" content="article">',
      '<meta name="twitter:title" content="Energylandia - польский Диснейленд.">',
      '<meta name="twitter:description" content="old desc">',
      '<meta name="robots" content="noindex, nofollow">',
      '<link rel="canonical" href="https://metravel.by/travels/energylandia-polskiy-disneylend">',
    ].join('')
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('updates document title and canonical when quest screen becomes active', async () => {
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    render(<QuestScreen />)

    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(document.title).toBe('Минск: что посмотреть — Тайна Свислочского Цмока: Легенда…')
    expect(
      document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    ).toBe('Минск: что посмотреть — Тайна Свислочского Цмока: Легенда…')
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute('content')
    ).toContain('Город Минск: бесплатный пеший маршрут')
    expect(
      document.querySelector('meta[property="og:description"]')?.getAttribute('content')
    ).toContain('по достопримечательностям')
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe('https://metravel.by/quests/4/minsk-cmok')
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('does not load quest data or progress while the quest screen is not focused', () => {
    mockUseIsFocused.mockReturnValue(false)
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    render(<QuestScreen />)

    expect(mockUseQuestBundle).toHaveBeenCalledWith(undefined)
    expect(mockUseQuestProgressSync).toHaveBeenCalledWith(undefined, false)
  })

  it('renders the quest wizard in guest mode for logged-out users without loading server progress', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    mockUseQuestBundle.mockReturnValue({
      bundle: {
        id: 77,
        title: 'Тайна Свислочского Цмока: Легенда оживает',
        storageKey: 'minsk-cmok',
        steps: [
          {
            id: 'step-1',
            title: 'Площадь у реки',
            location: 'Набережная Свислочи',
            story: 'Цмок оставил первый след у воды.',
            task: 'Найдите знак на ограде.',
            lat: 53.9,
            lng: 27.56,
            answer: jest.fn(),
          },
        ],
        finale: null,
        intro: { story: 'Начало легенды', lat: 53.9, lng: 27.56 },
        city: { name: 'Минск', countryCode: 'BY', lat: 53.9, lng: 27.56 },
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    })
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    render(<QuestScreen />)

    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })

    // Гость не грузит серверный прогресс (второй аргумент false).
    expect(mockUseQuestProgressSync).toHaveBeenCalledWith('minsk-cmok', false)
    // Визард смонтирован в гостевом режиме, а не login-wall preview.
    expect(mockQuestWizard).toHaveBeenCalled()
    const wizardProps = mockQuestWizard.mock.calls[0][0] as any
    expect(wizardProps.guestMode).toBe(true)
    expect(wizardProps.storageKey).toBe('guest_minsk-cmok')
    expect(typeof wizardProps.onGuestLogin).toBe('function')
    expect(typeof wizardProps.onGuestRegister).toBe('function')
    expect(document.title).toBe('Минск: что посмотреть — Тайна Свислочского Цмока: Легенда…')
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('removes the no-JS SSG heading and leaves the H1 to the wizard', () => {
    // H1 страницы — это видимый заголовок самого визарда (`questWizardShell`:
    // RNW рендерит role=heading + aria-level настоящим тегом). Роут своего
    // заголовка не рисует: отдельный видимый блок дублировал заголовок панели и
    // лежал во всю ширину страницы мимо контейнера визарда.
    document.body.innerHTML = [
      '<section data-ssg-quest-intro="true"><h1>Static quest title</h1></section>',
      '<h1 data-ssg-travel-h1="true" style="position:absolute;width:1px;height:1px">Hidden fallback</h1>',
    ].join('')
    document.head.insertAdjacentHTML(
      'beforeend',
      '<style data-ssg-quest-intro-style="true">[data-ssg-quest-intro]{display:none}</style>',
    )
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    const { UNSAFE_root } = render(<QuestScreen />)

    expect(UNSAFE_root.findAll((node) => node.type === 'h1')).toHaveLength(0)
    expect(document.querySelector('section[data-ssg-quest-intro="true"]')).toBeNull()
    expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).toBeNull()
    expect(document.querySelector('style[data-ssg-quest-intro-style="true"]')).toBeNull()
  })
})
