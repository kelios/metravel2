// __tests__/achievements/useGamification.test.tsx
// React Query hooks для геймификации-2 (Sprint 10, AC #375): прогрессия,
// персонаж и выбор пути. Закрывает явный пробел прошлого ревью — хуки не были
// покрыты. Проверяем enabled-гейт по auth, проброс userId, и что мутация
// useChooseCharacterPath кладёт результат в кэш персонажа и шлёт аналитику.

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/gamification')
jest.mock('@/utils/gamificationAnalytics', () => ({
  trackPathChosen: jest.fn(),
}))

// useMyGamificationProgress and useMyCharacter wait for the consolidated
// /achievements/me/ response (#588) before deciding whether to fire separate
// requests. Mock useMyAchievements to immediately resolve with no embedded
// progression/character so the hooks fall back to their own fetches.
jest.mock('@/hooks/useAchievementsApi', () => ({
  useMyAchievements: () => ({
    data: { progressionDto: null, characterDto: null },
    isSuccess: true,
    isFetching: false,
  }),
}))

const isAuthenticatedRef = { value: true }
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: isAuthenticatedRef.value }),
}))

import {
  useMyGamificationProgress,
  useUserGamificationProgress,
  useMyCharacter,
  useUserCharacter,
  useChooseCharacterPath,
} from '@/hooks/useGamification'
import {
  fetchMyGamificationProgress,
  fetchUserGamificationProgress,
  fetchMyCharacter,
  fetchUserCharacter,
  chooseCharacterPath,
  type CharacterState,
  type GamificationProgress,
} from '@/api/gamification'
import { queryKeys } from '@/api/queryKeys'
import { trackPathChosen } from '@/utils/gamificationAnalytics'

const mockFetchProgressMe = fetchMyGamificationProgress as jest.MockedFunction<
  typeof fetchMyGamificationProgress
>
const mockFetchProgressUser = fetchUserGamificationProgress as jest.MockedFunction<
  typeof fetchUserGamificationProgress
>
const mockFetchCharMe = fetchMyCharacter as jest.MockedFunction<typeof fetchMyCharacter>
const mockFetchCharUser = fetchUserCharacter as jest.MockedFunction<
  typeof fetchUserCharacter
>
const mockChoosePath = chooseCharacterPath as jest.MockedFunction<
  typeof chooseCharacterPath
>

const progress: GamificationProgress = {
  lines: [
    {
      slug: 'fox',
      name: 'Лисья',
      activityKind: 'reader',
      activityName: 'Читатель',
      level: 5,
      levelTitle: 'Мудрая лиса',
      current: 1523,
      currentLevelMin: 300,
      nextLevelMin: null,
      nextLevelTitle: null,
      isMaxLevel: true,
      emoji: '🦊',
    },
  ],
}

const character: CharacterState = {
  id: 104,
  name: 'Лисья',
  level: 5,
  pathSlug: null,
  pathName: null,
  details: [{ slug: 'collar', name: 'Ошейник', unlocked: true }],
  pendingChoice: true,
  pathOptions: [
    { slug: 'fox', name: 'Лисья', description: 'Ветка читателя', emoji: '🦊' },
  ],
}

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  jest.clearAllMocks()
  isAuthenticatedRef.value = true
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
})

afterEach(() => {
  queryClient.clear()
})

// ── useMyGamificationProgress ──────────────────────────────────────────────────

describe('useMyGamificationProgress', () => {
  it('fetches progression lines when authenticated', async () => {
    mockFetchProgressMe.mockResolvedValueOnce(progress)
    const { result } = renderHook(() => useMyGamificationProgress(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.lines).toHaveLength(1)
    expect(result.current.data?.lines[0].slug).toBe('fox')
    expect(mockFetchProgressMe).toHaveBeenCalledTimes(1)
  })

  it('is disabled (does not fetch) when not authenticated', async () => {
    isAuthenticatedRef.value = false
    const { result } = renderHook(() => useMyGamificationProgress(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchProgressMe).not.toHaveBeenCalled()
  })
})

// ── useUserGamificationProgress ────────────────────────────────────────────────

describe('useUserGamificationProgress', () => {
  it('fetches with the given userId regardless of auth', async () => {
    isAuthenticatedRef.value = false
    mockFetchProgressUser.mockResolvedValueOnce(progress)
    const { result } = renderHook(() => useUserGamificationProgress(77), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetchProgressUser).toHaveBeenCalledWith(77)
  })

  it('is disabled when userId is null', async () => {
    const { result } = renderHook(() => useUserGamificationProgress(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchProgressUser).not.toHaveBeenCalled()
  })

  it('is disabled when userId is empty string', async () => {
    const { result } = renderHook(() => useUserGamificationProgress(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchProgressUser).not.toHaveBeenCalled()
  })
})

// ── useMyCharacter ─────────────────────────────────────────────────────────────

describe('useMyCharacter', () => {
  it('fetches the character when authenticated', async () => {
    mockFetchCharMe.mockResolvedValueOnce(character)
    const { result } = renderHook(() => useMyCharacter(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe(104)
    expect(result.current.data?.pendingChoice).toBe(true)
  })

  it('is disabled when not authenticated', async () => {
    isAuthenticatedRef.value = false
    const { result } = renderHook(() => useMyCharacter(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchCharMe).not.toHaveBeenCalled()
  })
})

// ── useUserCharacter ───────────────────────────────────────────────────────────

describe('useUserCharacter', () => {
  it('fetches with userId regardless of auth', async () => {
    isAuthenticatedRef.value = false
    mockFetchCharUser.mockResolvedValueOnce(character)
    const { result } = renderHook(() => useUserCharacter(42), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetchCharUser).toHaveBeenCalledWith(42)
  })

  it('is disabled when userId missing', async () => {
    const { result } = renderHook(() => useUserCharacter(undefined), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchCharUser).not.toHaveBeenCalled()
  })
})

// ── useChooseCharacterPath ─────────────────────────────────────────────────────

describe('useChooseCharacterPath', () => {
  it('POSTs the chosen line slug, writes the result into the character cache', async () => {
    const chosen: CharacterState = {
      ...character,
      pathSlug: 'fox',
      pathName: 'Лисья',
      pendingChoice: false,
      pathOptions: [],
    }
    mockChoosePath.mockResolvedValueOnce(chosen)

    const { result } = renderHook(() => useChooseCharacterPath(), { wrapper })
    result.current.mutate({ pathSlug: 'fox' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockChoosePath.mock.calls[0][0]).toEqual({ pathSlug: 'fox' })
    const cached = queryClient.getQueryData<CharacterState>(
      queryKeys.gamificationCharacterMe(),
    )
    expect(cached?.pathSlug).toBe('fox')
    expect(cached?.pendingChoice).toBe(false)
  })

  it('tracks path_chosen analytics with the new character level', async () => {
    const chosen: CharacterState = { ...character, pathSlug: 'fox', level: 5 }
    mockChoosePath.mockResolvedValueOnce(chosen)

    const { result } = renderHook(() => useChooseCharacterPath(), { wrapper })
    result.current.mutate({ pathSlug: 'fox' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(trackPathChosen).toHaveBeenCalledWith({ pathSlug: 'fox', characterLevel: 5 })
  })

  it('surfaces the error and does not touch cache/analytics on failure', async () => {
    mockChoosePath.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useChooseCharacterPath(), { wrapper })
    result.current.mutate({ pathSlug: 'bird' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(
      queryClient.getQueryData(queryKeys.gamificationCharacterMe()),
    ).toBeUndefined()
    expect(trackPathChosen).not.toHaveBeenCalled()
  })
})
