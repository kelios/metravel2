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

// Default fixture leaves progressRatio/remainingPoints null → exercises the legacy
// client-side compute path (thresholds from current/next). Server-summary cases pass
// them explicitly below.
const makeRank = (overrides: Partial<UserRank> = {}): UserRank => ({
  level: 3,
  title: 'Бывалый',
  totalPoints: 450,
  badgesCount: 5,
  currentLevelMinPoints: 400,
  nextLevelMinPoints: 900,
  nextLevelTitle: 'Писатель',
  isMaxLevel: false,
  progressRatio: null,
  remainingPoints: null,
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

  it('renders maximum level caption when isMaxLevel is true', () => {
    const { getByText } = render(
      <RankBar
        rank={makeRank({ nextLevelMinPoints: null, nextLevelTitle: null, isMaxLevel: true })}
      />,
    )
    expect(getByText('Максимальный уровень достигнут')).toBeTruthy()
  })

  it('does NOT render XP bar or caption in unknown mode (null thresholds, isMaxLevel false)', () => {
    // Public profile endpoint: no rank_levels → nextLevelMinPoints null, isMaxLevel false
    // RankBar skips the track+caption block entirely in 'unknown' mode.
    const { queryByText, getAllByTestId } = render(
      <RankBar
        rank={makeRank({ nextLevelMinPoints: null, nextLevelTitle: null, isMaxLevel: false })}
      />,
    )
    expect(queryByText(/До «/)).toBeNull()
    expect(queryByText(/Максимальный уровень/)).toBeNull()
    // In unknown mode only the level-chip gradient renders (1 LinearGradient),
    // not the progress-bar gradient (which would be a second one).
    expect(getAllByTestId('linear-gradient')).toHaveLength(1)
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

  it('accessibilityLabel says "Максимальный уровень" when isMaxLevel is true', () => {
    const { getByLabelText } = render(
      <RankBar
        rank={makeRank({ nextLevelMinPoints: null, nextLevelTitle: null, isMaxLevel: true })}
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

  it('uses server-provided remainingPoints when present (canonical #721)', () => {
    // Server summary: remainingPoints=35 must win over any client-computed value
    // (totalPoints/nextLevelMinPoints here would give 450, but server says 35).
    const { getByText } = render(
      <RankBar
        rank={makeRank({
          totalPoints: 15,
          currentLevelMinPoints: 0,
          nextLevelMinPoints: 50,
          nextLevelTitle: 'Путешественник',
          progressRatio: 0.3,
          remainingPoints: 35,
        })}
      />,
    )
    expect(getByText('До «Путешественник»: 35 XP')).toBeTruthy()
  })

  it('uses server-provided progressRatio for the fill width', () => {
    const { getByLabelText } = render(
      <RankBar
        rank={makeRank({
          level: 5,
          title: 'Эксперт',
          totalPoints: 840,
          nextLevelMinPoints: 1200,
          nextLevelTitle: 'Легенда',
          progressRatio: 0.28,
          remainingPoints: 360,
        })}
      />,
    )
    // remaining 360 comes straight from the server summary
    expect(getByLabelText(/осталось 360/)).toBeTruthy()
  })

  it('falls back to client compute when server progress fields are null (legacy)', () => {
    // progressRatio/remainingPoints null → compute: 900-450 = 450
    const { getByText } = render(
      <RankBar
        rank={makeRank({
          totalPoints: 450,
          currentLevelMinPoints: 400,
          nextLevelMinPoints: 900,
          nextLevelTitle: 'Писатель',
          progressRatio: null,
          remainingPoints: null,
        })}
      />,
    )
    expect(getByText('До «Писатель»: 450 XP')).toBeTruthy()
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
