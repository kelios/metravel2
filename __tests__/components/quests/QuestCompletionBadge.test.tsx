import React from 'react'
import { render } from '@testing-library/react-native'

import QuestCompletionBadge from '@/components/quests/QuestCompletionBadge'

describe('QuestCompletionBadge', () => {
  it('renders the completed marker when the quest is completed by me', () => {
    const { queryByText } = render(
      <QuestCompletionBadge isCompleted completionsCount={0} variant="card" />,
    )
    expect(queryByText('Пройден')).toBeTruthy()
  })

  it('renders the detail marker and pluralized count', () => {
    const { queryByText } = render(
      <QuestCompletionBadge isCompleted completionsCount={5} variant="detail" />,
    )
    expect(queryByText('Вы прошли этот квест')).toBeTruthy()
    expect(queryByText('Пройдено 5 раз')).toBeTruthy()
  })

  it('renders only the count when not completed by me', () => {
    const { queryByText } = render(
      <QuestCompletionBadge isCompleted={false} completionsCount={2} variant="card" />,
    )
    expect(queryByText('Пройден')).toBeNull()
    expect(queryByText('Пройдено 2 раза')).toBeTruthy()
  })

  it('renders nothing when neither completed nor any completions', () => {
    const { toJSON } = render(
      <QuestCompletionBadge isCompleted={false} completionsCount={0} variant="card" />,
    )
    expect(toJSON()).toBeNull()
  })
})
