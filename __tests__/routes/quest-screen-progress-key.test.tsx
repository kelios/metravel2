/**
 * @jest-environment jsdom
 */

// #1456: ключ локальной копии прогресса квеста обязан содержать id аккаунта —
// иначе на общем устройстве визард сливает прогресс следующего вошедшего с
// записью предыдущего (чужие ответы и монотонный `completed`).

import React from 'react'
import { act } from 'react-test-renderer'
import { render } from '@testing-library/react-native'

const mockUseAuth = jest.fn(() => ({ isAuthenticated: true, userId: '17' } as any))
const mockQuestWizard = jest.fn(() => null)
const mockResetGuestProgress = jest.fn()
/** Что вернул хук синхронизации: строка, подтверждённое отсутствие или упавшее чтение. */
const mockProgressSync = { progress: null as any, progressMissing: false }

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ city: '4', questId: 'minsk-cmok' }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  useIsFocused: () => true,
  useRouter: () => ({ push: jest.fn() }),
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
    primaryDark: '#c50',
    text: '#222',
    textMuted: '#666',
    textOnPrimary: '#fff',
    warning: '#fa0',
  }),
}))

jest.mock('@/hooks/useQuestsApi', () => ({
  useQuestBundle: () => ({
    bundle: {
      id: 77,
      title: 'Тайна Свислочского Цмока',
      storageKey: 'minsk-cmok',
      steps: [],
      finale: null,
      intro: null,
      city: { name: 'Минск', countryCode: 'BY', lat: 53.9, lng: 27.56 },
    },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useQuestProgressSync: () => ({
    progress: mockProgressSync.progress,
    progressLoading: false,
    progressMissing: mockProgressSync.progressMissing,
    saveProgress: jest.fn(),
    resetProgress: jest.fn(),
  }),
  useQuestReviews: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
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

jest.mock('@/hooks/useActionConsent', () => ({
  useActionConsent: () => ({ granted: true, hydrated: true, grant: jest.fn() }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('@/components/quests/QuestWizard', () => ({
  QuestWizard: (props: any) => mockQuestWizard(props),
}))

jest.mock('@/components/quests/useGuestQuestFlow', () => ({
  useGuestQuestFlow: () => ({
    guestInitial: null,
    guestReady: true,
    guestFreeSteps: 2,
    persistGuestProgress: jest.fn(),
    resetGuestProgress: mockResetGuestProgress,
    goToLogin: jest.fn(),
    goToRegister: jest.fn(),
  }),
}))

jest.mock('@/components/quests/TravelsForQuestSection', () => ({
  __esModule: true,
  default: () => null,
}))

const renderQuestScreen = async () => {
  const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default
  render(<QuestScreen />)
  await act(async () => {
    await Promise.resolve()
  })
  return mockQuestWizard.mock.calls[0][0] as any
}

describe('Quest screen: ключ прогресса привязан к аккаунту (#1456)', () => {
  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
  })

  beforeEach(() => {
    mockQuestWizard.mockClear()
    mockUseAuth.mockReturnValue({ isAuthenticated: true, userId: '17' })
    mockProgressSync.progress = null
    mockProgressSync.progressMissing = false
    document.head.innerHTML = ''
  })

  it('передаёт визарду ключ с id вошедшего пользователя', async () => {
    const props = await renderQuestScreen()

    expect(props.storageKey).toBe('minsk-cmok__u17')
  })

  it('второй аккаунт на том же устройстве получает другой ключ', async () => {
    const first = await renderQuestScreen()

    mockQuestWizard.mockClear()
    mockUseAuth.mockReturnValue({ isAuthenticated: true, userId: '42' })
    const second = await renderQuestScreen()

    expect(second.storageKey).not.toBe(first.storageKey)
    expect(second.storageKey).toBe('minsk-cmok__u42')
  })

  it('гость по-прежнему пишет под гостевым ключом', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, userId: null })
    const props = await renderQuestScreen()

    expect(props.guestMode).toBe(true)
    expect(props.storageKey).toBe('guest_minsk-cmok')
  })

  it('гостевой «Сбросить» стирает и гостевую копию прохождения (#2047)', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, userId: null })
    const props = await renderQuestScreen()

    expect(props.onProgressReset).toBe(mockResetGuestProgress)
  })

  it('залогиненный без ещё подтянувшегося userId не пишет под гостевой ключ', async () => {
    // Иначе запись гостевого визарда этого устройства слилась бы с аккаунтом:
    // штатная миграция гостевого прогресса (#1430) идёт по другому ключу.
    mockUseAuth.mockReturnValue({ isAuthenticated: true, userId: null })
    const props = await renderQuestScreen()

    expect(props.storageKey).not.toBe('guest_minsk-cmok')
    expect(props.storageKey).toBe('minsk-cmok__u:pending')
  })

  // #2033: стереть копию прохождения, сброшенного на другом устройстве, визард
  // может только по ПОДТВЕРЖДЁННОМУ ответу сервера — упавшее чтение им не является.
  describe('состояние сервера для визарда (#2033)', () => {
    it('подтверждённое отсутствие строки приходит как serverId: null', async () => {
      mockProgressSync.progressMissing = true
      const props = await renderQuestScreen()

      expect(props.initialProgress.serverId).toBeNull()
    })

    it('упавшее чтение приходит пустым снапшотом без поколения', async () => {
      const props = await renderQuestScreen()

      expect(props.initialProgress).toBeDefined()
      expect(props.initialProgress.serverId).toBe(0)
    })

    it('прочитанная строка приходит со своим id', async () => {
      mockProgressSync.progress = {
        id: 42,
        current_index: 1,
        unlocked_index: 1,
        answers: { intro: 'start' },
        attempts: {},
        hints: {},
        show_map: true,
        completed: false,
        updated_at: '2026-09-20T10:00:00Z',
      }
      const props = await renderQuestScreen()

      expect(props.initialProgress.serverId).toBe(42)
    })
  })
})
