/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act } from 'react-test-renderer'
import { render } from '@testing-library/react-native'

const mockUseIsFocused = jest.fn(() => true)

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockUseIsFocused(),
}))

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ city: '4', questId: 'minsk-cmok' }),
  Link: ({ children }: { children: React.ReactNode }) => children,
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
  useQuestBundle: () => ({
    bundle: {
      title: 'Тайна Свислочского Цмока: Легенда оживает',
      storageKey: 'minsk-cmok',
      steps: [],
      finale: null,
      intro: null,
      city: '4',
    },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useQuestProgressSync: () => ({
    progress: null,
    progressLoading: false,
    saveProgress: jest.fn(),
    resetProgress: jest.fn(),
  }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

jest.mock('@/components/quests/QuestWizard', () => ({
  QuestWizard: () => null,
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
})
