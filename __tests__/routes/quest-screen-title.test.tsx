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

const mockRecordGuestQuestPreview = jest.fn(async () => undefined)

jest.mock('@/utils/guestTrialState', () => ({
  recordGuestQuestPreview: (...args: any[]) => mockRecordGuestQuestPreview(...args),
}))

jest.mock('@/components/quests/QuestWizard', () => ({
  QuestWizard: () => null,
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
    mockRecordGuestQuestPreview.mockClear()
    document.title = 'Energylandia - польский Диснейленд.'
    document.head.innerHTML = [
      '<meta name="description" content="old desc">',
      '<meta property="og:title" content="Energylandia - польский Диснейленд.">',
      '<meta property="og:description" content="old desc">',
      '<meta property="og:url" content="https://metravel.by/travels/energylandia-polskiy-disneylend">',
      '<meta property="og:type" content="article">',
      '<meta name="twitter:title" content="Energylandia - польский Диснейленд.">',
      '<meta name="twitter:description" content="old desc">',
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

    expect(document.title).toBe('Тайна Свислочского Цмока: Легенда оживает')
    expect(
      document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    ).toBe('Тайна Свислочского Цмока: Легенда оживает')
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe('https://metravel.by/quests/4/minsk-cmok')
  })

  it('does not load quest data or progress while the quest screen is not focused', () => {
    mockUseIsFocused.mockReturnValue(false)
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    render(<QuestScreen />)

    expect(mockUseQuestBundle).toHaveBeenCalledWith(undefined)
    expect(mockUseQuestProgressSync).toHaveBeenCalledWith(undefined, false)
  })

  it('shows the first quest step preview to logged-out users without loading progress', async () => {
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

    const { getByTestId, getByText } = render(<QuestScreen />)

    expect(getByTestId('guest-quest-first-step-preview')).toBeTruthy()
    expect(getByText('Площадь у реки')).toBeTruthy()
    expect(getByText('Найдите знак на ограде.')).toBeTruthy()
    expect(mockUseQuestProgressSync).toHaveBeenCalledWith('minsk-cmok', false)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockRecordGuestQuestPreview).toHaveBeenCalledWith({
      questId: 'minsk-cmok',
      cityId: '4',
      stepId: 'step-1',
    })
  })
})
