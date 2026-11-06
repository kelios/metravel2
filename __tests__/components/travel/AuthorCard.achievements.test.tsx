import React from 'react'
import { Platform } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'

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
  peerReceived: [],
  activityTypes: [],
}
const mockAchievementsRef: { data: PublicAchievements | undefined } = { data: mockData }
const mockUseUserAchievements = jest.fn((_userId: number | string | null) => ({ data: mockAchievementsRef.data }))

jest.mock('@/hooks/useAchievementsApi', () => ({
  useUserAchievements: (userId: number | string | null) => mockUseUserAchievements(userId),
}))

const baseTravel: any = {
  id: 1,
  userName: 'Test User',
  userId: 42,
  userTravelsCount: 3,
  travel_image_thumb_small_url: null,
}

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const renderWithClient = async (ui: React.ReactElement, client = makeClient()) => {
  return await render(ui, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
}

describe('AuthorCard achievements block', () => {
  beforeEach(() => {
    mockAchievementsRef.data = mockData
    mockUseUserAchievements.mockReset().mockImplementation(() => ({ data: mockAchievementsRef.data }))
  })

  it('shows the identity medal alongside the existing gallery from one public achievement query', async () => {
    const originalPlatform = Platform.OS
    Platform.OS = 'web'
    const data: PublicAchievements = {
      ...mockData,
      earned: [
        ...mockData.earned,
        { ...mockData.earned[0], id: 102, badge: { ...mockData.earned[0].badge, id: 2, slug: 'first-travel', name: 'Автор MeTravel' } },
      ],
    }
    const fetchAchievements = jest.fn(async () => data)
    const queryKey = ['public-author-achievements', 42]
    const client = makeClient()
    mockUseUserAchievements.mockImplementation(function useTrackedPublicAchievements() {
      return useQuery({ queryKey, queryFn: fetchAchievements })
    })
    try {
      const view = await renderWithClient(<AuthorCard travel={baseTravel} />, client)
      await waitFor(() => expect(view.getByRole('button', { name: 'Открыть награду «Автор MeTravel»' })).toBeTruthy())
      expect(view.getByText('Значки автора')).toBeTruthy()
      expect(client.getQueryCache().find({ queryKey })?.getObserversCount()).toBe(1)
      expect(fetchAchievements).toHaveBeenCalledTimes(1)
    } finally {
      client.clear()
      Platform.OS = originalPlatform
    }
  })

  it('explains the rank with a "Уровень:" prefix', async () => {
    const { getByText } = await renderWithClient(<AuthorCard travel={baseTravel} />)
    expect(getByText('Уровень: Эксперт')).toBeTruthy()
  })

  it('labels the top badges so they are not unexplained', async () => {
    const { getByText } = await renderWithClient(<AuthorCard travel={baseTravel} />)
    expect(getByText('Значки автора')).toBeTruthy()
    expect(getByText('Хайкер')).toBeTruthy()
  })

  it('opens BadgeDetailSheet with real badge data on badge tap', async () => {
    const { getByLabelText, getByTestId, getByText } = await renderWithClient(
      <AuthorCard travel={baseTravel} />,
    )
    await fireEvent.press(getByLabelText(/Хайкер, .*получен/))
    expect(getByTestId('badge-detail-sheet')).toBeTruthy()
    // Реальное описание значка из данных, а не выдуманный текст
    expect(getByText('За 3 завершённых похода')).toBeTruthy()
    expect(getByText('30 XP')).toBeTruthy()
  })

  it.each([false, true])('uses the active author description after a locale change (cold=%s)', async cold => {
    const view = await renderWithClient(<AuthorCard travel={baseTravel} />)
    await fireEvent.press(view.getByLabelText(/Хайкер, .*получен/))
    expect(view.getByText('За 3 завершённых похода')).toBeTruthy()

    if (cold) {
      mockAchievementsRef.data = undefined
      await view.rerender(<AuthorCard travel={{ ...baseTravel }} />)
      expect(view.queryByText('За 3 завершённых похода')).toBeNull()
    }
    mockAchievementsRef.data = {
      ...mockData,
      earned: [{ ...mockData.earned[0], badge: { ...mockData.earned[0].badge, description: 'Opis po polsku' } }],
    }
    await view.rerender(<AuthorCard travel={{ ...baseTravel }} />)

    expect(view.getByText('Opis po polsku')).toBeTruthy()
    expect(view.queryByText('За 3 завершённых похода')).toBeNull()
  })
})
