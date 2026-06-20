// __tests__/achievements/RankBar.test.tsx
// Render tests for components/achievements/RankBar.tsx

import React from 'react'
import { render } from '@testing-library/react-native'
import type { UserRank } from '@/api/achievements'

// expo-linear-gradient — мокаем как в WelcomeBanner.test.tsx
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  }
})

// DESIGN_TOKENS — минимальный стаб для StyleSheet.create в RankBar
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    spacing: { sm: 8, xs: 4 },
    typography: { sizes: { xs: 12, sm: 14, md: 16 } },
  },
}))

// useThemedColors — глобально мокается в __tests__/setup.ts,
// но на случай если мок не поддерживает нужные ключи — дополняем здесь через
// те же данные, что setup уже возвращает (не перекрываем глобальный мок).

import RankBar from '@/components/achievements/RankBar'

// ── fixtures ───────────────────────────────────────────────────────────────────

const makeRank = (overrides: Partial<UserRank> = {}): UserRank => ({
  level: 3,
  title: 'Бывалый',
  totalPoints: 450,
  badgesCount: 5,
  currentLevelMinPoints: 400,
  nextLevelMinPoints: 900,
  nextLevelTitle: 'Писатель',
  ...overrides,
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('RankBar', () => {
  it('renders level number', () => {
    const { getByText } = render(<RankBar rank={makeRank({ level: 3 })} />)
    expect(getByText('3')).toBeTruthy()
  })

  it('renders rank title', () => {
    const { getByText } = render(<RankBar rank={makeRank({ title: 'Бывалый' })} />)
    expect(getByText('Бывалый')).toBeTruthy()
  })

  it('renders XP and badge count in non-compact mode', () => {
    const { getByText } = render(
      <RankBar rank={makeRank({ totalPoints: 450, badgesCount: 5 })} />,
    )
    expect(getByText('450 XP · значков: 5')).toBeTruthy()
  })

  it('does NOT render XP line in compact mode', () => {
    const { queryByText } = render(
      <RankBar rank={makeRank({ totalPoints: 450, badgesCount: 5 })} compact />,
    )
    expect(queryByText(/XP · значков/)).toBeNull()
  })

  it('renders caption "До «...»: N XP" with correct remaining value', () => {
    // totalPoints=450, nextLevelMinPoints=900 → remaining=450
    const { getByText } = render(
      <RankBar
        rank={makeRank({
          totalPoints: 450,
          currentLevelMinPoints: 400,
          nextLevelMinPoints: 900,
          nextLevelTitle: 'Писатель',
        })}
      />,
    )
    expect(getByText('До «Писатель»: 450 XP')).toBeTruthy()
  })

  it('renders maximum level caption when nextLevelMinPoints is null', () => {
    const { getByText } = render(
      <RankBar
        rank={makeRank({ nextLevelMinPoints: null, nextLevelTitle: null })}
      />,
    )
    expect(getByText('Максимальный уровень достигнут 🏆')).toBeTruthy()
  })

  it('does NOT render progress caption in compact mode', () => {
    const { queryByText } = render(
      <RankBar rank={makeRank()} compact />,
    )
    expect(queryByText(/До «/)).toBeNull()
    expect(queryByText(/Максимальный уровень/)).toBeNull()
  })

  it('root element has accessibilityRole="summary"', () => {
    const { UNSAFE_getByProps } = render(<RankBar rank={makeRank()} />)
    expect(UNSAFE_getByProps({ accessibilityRole: 'summary' })).toBeTruthy()
  })

  it('accessibilityLabel includes level and title for non-max rank', () => {
    const { getByLabelText } = render(
      <RankBar
        rank={makeRank({
          level: 3,
          title: 'Бывалый',
          totalPoints: 450,
          nextLevelMinPoints: 900,
          nextLevelTitle: 'Писатель',
        })}
      />,
    )
    // Label contains level, title, totalPoints, and remaining
    const el = getByLabelText(/Уровень 3, Бывалый/)
    expect(el).toBeTruthy()
  })

  it('accessibilityLabel says "Максимальный уровень" when nextLevelMinPoints is null', () => {
    const { getByLabelText } = render(
      <RankBar
        rank={makeRank({ nextLevelMinPoints: null, nextLevelTitle: null })}
      />,
    )
    expect(getByLabelText(/Максимальный уровень/)).toBeTruthy()
  })

  it('accepts testID prop', () => {
    const { getByTestId } = render(
      <RankBar rank={makeRank()} testID="rank-bar-test" />,
    )
    expect(getByTestId('rank-bar-test')).toBeTruthy()
  })

  it('renders without crash when totalPoints equals currentLevelMinPoints', () => {
    // ratio = 0, remaining = nextLevel - totalPoints
    const { getByText } = render(
      <RankBar
        rank={makeRank({
          totalPoints: 400,
          currentLevelMinPoints: 400,
          nextLevelMinPoints: 900,
          nextLevelTitle: 'Писатель',
        })}
      />,
    )
    expect(getByText('До «Писатель»: 500 XP')).toBeTruthy()
  })

  it('clamps remaining to 0 when totalPoints exceeds nextLevelMinPoints', () => {
    const { getByText } = render(
      <RankBar
        rank={makeRank({
          totalPoints: 1000,
          currentLevelMinPoints: 400,
          nextLevelMinPoints: 900,
          nextLevelTitle: 'Писатель',
        })}
      />,
    )
    // remaining = max(0, 900 - 1000) = 0
    expect(getByText('До «Писатель»: 0 XP')).toBeTruthy()
  })
})
