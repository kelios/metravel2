// __tests__/achievements/RareAwardCard.test.tsx
// Render tests for components/achievements/RareAwardCard.tsx (#379/#381).

import React from 'react'
import { render } from '@testing-library/react-native'
import type { RareAward } from '@/api/achievements'

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

import RareAwardCard from '@/components/achievements/RareAwardCard'

const makeAward = (overrides: Partial<RareAward> = {}): RareAward => ({
  id: 901,
  slug: 'first-wave',
  category: 'first-wave',
  title: 'Первая волна',
  level: 'legendary',
  reason: 'Один из первых авторов сообщества',
  grantedAt: '2025-08-01T09:00:00Z',
  grantedByProfile: { id: 1, name: 'Команда MeTravel' },
  ownerLimit: 100,
  isRare: true,
  shareTemplate: 'rare',
  ...overrides,
})

describe('RareAwardCard', () => {
  it('renders the award title and reason', () => {
    const { getByText } = render(<RareAwardCard award={makeAward()} />)
    expect(getByText('Первая волна')).toBeTruthy()
    expect(getByText('Один из первых авторов сообщества')).toBeTruthy()
  })

  it('renders the granter name when present', () => {
    const { getByText } = render(<RareAwardCard award={makeAward()} />)
    expect(getByText(/Команда MeTravel/)).toBeTruthy()
  })

  it('renders without reason or granter (sparse award)', () => {
    const { getByText, queryByText } = render(
      <RareAwardCard
        award={makeAward({ reason: '', grantedByProfile: null, grantedAt: '' })}
      />,
    )
    expect(getByText('Первая волна')).toBeTruthy()
    expect(queryByText(/Команда MeTravel/)).toBeNull()
  })

  it('forwards testID', () => {
    const { getByTestId } = render(
      <RareAwardCard award={makeAward()} testID="rare-901" />,
    )
    expect(getByTestId('rare-901')).toBeTruthy()
  })
})
