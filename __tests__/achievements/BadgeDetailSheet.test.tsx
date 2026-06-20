// __tests__/achievements/BadgeDetailSheet.test.tsx
// Render tests for components/achievements/BadgeDetailSheet.tsx

import React from 'react'
import { render } from '@testing-library/react-native'
import type { Badge } from '@/api/achievements'

jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  }
})

jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
    radii: { xl: 24 },
    typography: { sizes: { xs: 12, sm: 14, md: 16, lg: 20 } },
  },
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockImageCardMedia({ alt, ...props }: any) {
    return React.createElement(View, { accessibilityLabel: alt, ...props })
  }
})

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
})
