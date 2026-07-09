import { render } from '@testing-library/react-native'

import QuestCompletionBadge from '@/components/quests/QuestCompletionBadge'

describe('QuestCompletionBadge', () => {
  it('renders the completed marker when the quest is completed by me', () => {
    const { queryByText } = render(
      <QuestCompletionBadge isCompleted completionsCount={0} variant="card" />,
    )
    expect(queryByText('Пройден')).toBeTruthy()
  })

  it('renders compact detail chips with count and accessible labels', () => {
    const { queryByText, queryByLabelText } = render(
      <QuestCompletionBadge isCompleted completionsCount={5} variant="detail" />,
    )
    expect(queryByLabelText('Вы прошли этот квест')).toBeTruthy()
    expect(queryByLabelText('Пройдено 5 раз')).toBeTruthy()
    expect(queryByText('5')).toBeTruthy()
    expect(queryByText('Пройдено 5 раз')).toBeNull()
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
