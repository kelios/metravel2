// __tests__/achievements/BadgeDetailSheet.test.tsx
// Render tests for components/achievements/BadgeDetailSheet.tsx

import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import type { Badge } from '@/api/achievements'

jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  }
})

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockImageCardMedia({ alt, ...props }: any) {
    return React.createElement(View, { accessibilityLabel: alt, ...props })
  }
})

// Регрессия на FE-баг #384: share-card требует UserBadge.id заработанной записи,
// а не каталожный badge.id (иначе BE 403). Мокаем нижний слой createShareCard,
// чтобы проверить, какой achievementId реально доходит до запроса.
const mockCreateShareCard = jest.fn()
jest.mock('@/api/achievementsShare', () => ({
  createShareCard: (...args: any[]) => mockCreateShareCard(...args),
}))
jest.mock('@/utils/externalLinks', () => ({
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

import BadgeDetailSheet from '@/components/achievements/BadgeDetailSheet'

const makeBadge = (over: Partial<Badge> = {}): Badge => ({
  id: 4,
  slug: 'author-silver',
  name: 'Серебряный автор',
  description: '15 опубликованных путешествий',
  categorySlug: 'writer',
  categoryName: 'Автор',
  tier: 'silver',
  imageUrl: null,
  points: 60,
  isSecret: false,
  order: 4,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateShareCard.mockResolvedValue({
    shareToken: 'tok',
    imageUrl: 'https://cdn/x.png',
    publicUrl: 'https://metravel.by/achievements/104',
    expiresAt: null,
  })
})

describe('BadgeDetailSheet', () => {
  it('shows "Как получить" criteria + progress count and remaining for locked', () => {
    const { getByText, queryByText } = render(
      <BadgeDetailSheet
        visible
        onClose={() => {}}
        detail={{
          badge: makeBadge(),
          earned: false,
          progress: { current: 9, threshold: 15 },
        }}
      />,
    )

    expect(getByText('Как получить')).toBeTruthy()
    expect(getByText('15 опубликованных путешествий')).toBeTruthy()
    expect(getByText('Прогресс')).toBeTruthy()
    expect(getByText('9 / 15')).toBeTruthy()
    expect(getByText('осталось 6')).toBeTruthy()
    expect(queryByText('Значок получен')).toBeNull()
  })

  it('shows "За что получен" and earned state without progress for earned', () => {
    const { getByText, queryByText } = render(
      <BadgeDetailSheet
        visible
        onClose={() => {}}
        detail={{ badge: makeBadge(), earned: true }}
      />,
    )

    expect(getByText('За что получен')).toBeTruthy()
    expect(getByText('Значок получен')).toBeTruthy()
    expect(queryByText('Прогресс')).toBeNull()
  })

  it('renders nothing when detail is null', () => {
    const { toJSON } = render(
      <BadgeDetailSheet visible={false} onClose={() => {}} detail={null} />,
    )
    expect(toJSON()).toBeNull()
  })

  it('hides share when earned but userBadgeId is unknown (avoids 403)', () => {
    const { queryByLabelText } = render(
      <BadgeDetailSheet
        visible
        onClose={() => {}}
        detail={{ badge: makeBadge(), earned: true }}
        ownerName="Юлия"
      />,
    )
    expect(queryByLabelText('Поделиться достижением')).toBeNull()
  })

  it('shares with UserBadge.id, not the catalog badge.id', async () => {
    const { getByLabelText, getByTestId } = render(
      <BadgeDetailSheet
        visible
        onClose={() => {}}
        detail={{ badge: makeBadge({ id: 4 }), earned: true, userBadgeId: 104 }}
        ownerName="Юлия"
      />,
    )

    fireEvent.press(getByLabelText('Поделиться достижением'))
    // Лист открыт — дожидаемся запроса карточки.
    await waitFor(() => expect(mockCreateShareCard).toHaveBeenCalled())

    expect(mockCreateShareCard).toHaveBeenCalledWith(
      expect.objectContaining({ achievementId: 104 }),
    )
    expect(mockCreateShareCard).not.toHaveBeenCalledWith(
      expect.objectContaining({ achievementId: 4 }),
    )
    // sanity: лист действительно отрисован
    expect(getByTestId('share-card-preview')).toBeTruthy()
  })
})
