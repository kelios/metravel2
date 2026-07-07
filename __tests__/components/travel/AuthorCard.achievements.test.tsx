import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AuthorCard from '@/components/travel/AuthorCard'
import type { PublicAchievements } from '@/api/achievements'

// ── mocks ────────────────────────────────────────────────────────────────────
jest.mock('@/hooks/useUserProfileCached', () => ({
  useUserProfileCached: () => ({ profile: null }),
}))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ userId: '99', isAuthenticated: true }),
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  }
})
// ShareBadgeSheet (внутри BadgeDetailSheet) тянет сетевые/native-модули — глушим.
jest.mock('@/api/achievementsShare', () => ({ createShareCard: jest.fn() }))
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(),
  openExternalUrlInNewTab: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/utils/downloadUrlOnWeb', () => ({ downloadUrlOnWeb: jest.fn(() => true) }))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/gamificationAnalytics', () => ({
  trackBadgeShareOpened: jest.fn(),
  trackBadgeShared: jest.fn(),
  trackShareCardClick: jest.fn(),
}))

const mockData: PublicAchievements = {
  rank: {
    level: 5,
    title: 'Эксперт',
    totalPoints: 840,
    badgesCount: 7,
    currentLevelMinPoints: 800,
    nextLevelMinPoints: null,
    nextLevelTitle: null,
    isMaxLevel: false,
    progressRatio: null,
    remainingPoints: null,
  },
  earned: [
    {
      id: 101,
      earnedAt: '2026-01-01T00:00:00Z',
      badge: {
        id: 1,
        slug: 'hiker-bronze',
        name: 'Хайкер',
        description: 'За 3 завершённых похода',
        categorySlug: 'explorer',
        categoryName: 'Исследователь',
        tier: 'bronze',
        imageUrl: null,
        points: 30,
      },
    },
  ],
}

jest.mock('@/hooks/useAchievementsApi', () => ({
  useUserAchievements: () => ({ data: mockData }),
}))

const baseTravel: any = {
  id: 1,
  userName: 'Test User',
  userId: 42,
  userTravelsCount: 3,
  travel_image_thumb_small_url: null,
}

const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('AuthorCard achievements block', () => {
  it('explains the rank with a "Уровень:" prefix', () => {
    const { getByText } = renderWithClient(<AuthorCard travel={baseTravel} />)
    expect(getByText('Уровень: Эксперт')).toBeTruthy()
  })

  it('labels the top badges so they are not unexplained', () => {
    const { getByText } = renderWithClient(<AuthorCard travel={baseTravel} />)
    expect(getByText('Значки автора')).toBeTruthy()
    expect(getByText('Хайкер')).toBeTruthy()
  })

  it('opens BadgeDetailSheet with real badge data on badge tap', () => {
    const { getByLabelText, getByTestId, getByText } = renderWithClient(
      <AuthorCard travel={baseTravel} />,
    )
    fireEvent.press(getByLabelText(/Хайкер, .*получен/))
    expect(getByTestId('badge-detail-sheet')).toBeTruthy()
    // Реальное описание значка из данных, а не выдуманный текст
    expect(getByText('За 3 завершённых похода')).toBeTruthy()
    expect(getByText('30 XP')).toBeTruthy()
  })
})
