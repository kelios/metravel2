// __tests__/achievements/AchievementsSection.test.tsx
// Регресс на «вечный спиннер» секции «Достижения» (профиль → Обзор).
// Спиннер должен показываться ТОЛЬКО пока запрос реально идёт; для disabled/
// settled-without-data запроса (гость, пауза offlineFirst, ошибка) секция
// разрешает loading-состояние — скрывается или показывает данные, но не крутится.

import React from 'react'
import { render } from '@testing-library/react-native'

import type { MyAchievements } from '@/api/achievements'

const mockUseMyAchievements = jest.fn()
const mockUseUserAchievements = jest.fn()

jest.mock('@/hooks/useAchievementsApi', () => ({
  useMyAchievements: () => mockUseMyAchievements(),
  useUserAchievements: () => mockUseUserAchievements(),
}))

let mockAuthState: { isAuthenticated: boolean; userId: string | null; username: string | null }
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState),
}))

// Тяжёлые дочерние модали/гриды не нужны для проверки loading-логики.
jest.mock('@/components/achievements/RankBar', () => () => null)
jest.mock('@/components/achievements/BadgeMedal', () => () => null)
jest.mock('@/components/achievements/AchievementsGalleryModal', () => () => null)
jest.mock('@/components/achievements/PeerBadgeReceivedRow', () => () => null)

import AchievementsSection from '@/components/achievements/AchievementsSection'

const SPINNER = 'achievements-loading'

const myData: MyAchievements = {
  rank: {
    level: 2,
    title: 'Путешественник',
    totalPoints: 120,
    badgesCount: 3,
    currentLevelMinPoints: 100,
    nextLevelMinPoints: 300,
    nextLevelTitle: 'Гид',
    isMaxLevel: false,
  },
  earned: [],
  locked: [],
  recentlyEarned: [],
}

beforeEach(() => {
  mockAuthState = { isAuthenticated: true, userId: '1', username: 'tester' }
  mockUseUserAchievements.mockReturnValue({ data: undefined })
})

const queryState = (over: Record<string, unknown>) => ({
  data: undefined,
  isError: false,
  isFetching: false,
  ...over,
})

it('показывает спиннер, только пока запрос реально идёт', () => {
  mockUseMyAchievements.mockReturnValue(queryState({ isFetching: true }))
  const { queryByTestId } = render(<AchievementsSection />)
  expect(queryByTestId(SPINNER)).not.toBeNull()
})

it('disabled/paused запрос без данных (гость) — секция скрыта, не спиннер', () => {
  mockAuthState = { isAuthenticated: false, userId: null, username: null }
  mockUseMyAchievements.mockReturnValue(queryState({}))
  const { queryByTestId, queryByText } = render(<AchievementsSection />)
  expect(queryByTestId(SPINNER)).toBeNull()
  expect(queryByText('Достижения')).toBeNull()
})

it('settled-without-data у авторизованного (пауза offlineFirst) — без вечного спиннера', () => {
  // isFetching=false, data=undefined, isError=false — это и был залипший кейс.
  mockUseMyAchievements.mockReturnValue(queryState({}))
  const { queryByTestId } = render(<AchievementsSection />)
  expect(queryByTestId(SPINNER)).toBeNull()
})

it('ошибка запроса — секция скрыта', () => {
  mockUseMyAchievements.mockReturnValue(queryState({ isError: true }))
  const { queryByTestId, queryByText } = render(<AchievementsSection />)
  expect(queryByTestId(SPINNER)).toBeNull()
  expect(queryByText('Достижения')).toBeNull()
})

it('данные пришли — спиннер уходит, рендерится контент', () => {
  mockUseMyAchievements.mockReturnValue(queryState({ data: myData }))
  const { queryByTestId, queryByText } = render(<AchievementsSection />)
  expect(queryByTestId(SPINNER)).toBeNull()
  expect(queryByText('Достижения')).not.toBeNull()
})
