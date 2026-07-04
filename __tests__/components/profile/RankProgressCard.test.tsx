import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { UserRank } from '@/api/achievements'
import RankProgressCard from '@/components/profile/RankProgressCard'

const makeRank = (overrides: Partial<UserRank> = {}): UserRank => ({
  level: 2,
  title: 'Путешественник',
  totalPoints: 150,
  badgesCount: 3,
  currentLevelMinPoints: 100,
  nextLevelMinPoints: 300,
  nextLevelTitle: 'Исследователь',
  isMaxLevel: false,
  progressRatio: 0.25,
  remainingPoints: 150,
  ...overrides,
})

describe('RankProgressCard', () => {
  it('keeps the overview rank card visible while rank is loading', () => {
    const onPress = jest.fn()
    const { getByTestId, getByText } = render(
      <RankProgressCard rank={undefined} onPress={onPress} />,
    )

    fireEvent.press(getByTestId('rank-progress-card'))

    expect(getByTestId('rank-progress-card-loading')).toBeTruthy()
    expect(getByText('Загружаем XP, уровень и значки.')).toBeTruthy()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders loaded rank details', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <RankProgressCard rank={makeRank()} />,
    )

    expect(getByTestId('rank-progress-card')).toBeTruthy()
    expect(queryByTestId('rank-progress-card-loading')).toBeNull()
    expect(getByText('Путешественник')).toBeTruthy()
  })
})
