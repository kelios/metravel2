// #2133 (Apple 1.2(c)): жалоба на отзыв квеста. Автора бэк не отдаёт (#2163) —
// в меню только «Пожаловаться» и «Скрыть».

import React from 'react'
import { fireEvent, render as rtlRender } from '@testing-library/react-native'

import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/stores/authStore', () => require('../../helpers/contentSafetyMocks').authStoreMock)
jest.mock('@/api/userSafety', () => require('../../helpers/contentSafetyMocks').userSafetyApiMock)
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(() => Promise.resolve()) }))
jest.mock('@/api/quests', () => ({
  ...jest.requireActual('@/api/quests'),
  fetchQuestReviews: jest.fn(() =>
    Promise.resolve([
      {
        id: 3,
        rating: 4,
        liked: 'Красивый маршрут',
        disliked: '',
        authorName: 'Игрок',
        authorAvatar: null,
        createdAt: null,
        photos: [],
      },
    ]),
  ),
}))

import QuestReviewsModal from '@/components/quests/QuestReviewsModal'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: createQueryWrapper().Wrapper })

beforeEach(() => {
  useHiddenContentStore.setState({ byOwner: {} })
})

describe('QuestReviewsModal safety (#2133)', () => {
  it('offers report and hide, but no block without a known author', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(
      <QuestReviewsModal questId="minsk" visible onClose={jest.fn()} />,
    )
    fireEvent.press(await findByTestId('quest-review-3-safety-menu'))
    expect(getByTestId('quest-review-3-safety-report')).toBeTruthy()
    expect(getByTestId('quest-review-3-safety-hide')).toBeTruthy()
    expect(queryByTestId('quest-review-3-safety-block')).toBeNull()
  })

  it('replaces a hidden review with the placeholder', async () => {
    useHiddenContentStore.setState({ byOwner: { '1': ['quest_review:3'] } })
    const { findByTestId, queryByTestId } = render(
      <QuestReviewsModal questId="minsk" visible onClose={jest.fn()} />,
    )
    expect(await findByTestId('hidden-content')).toBeTruthy()
    expect(queryByTestId('quest-review-item-3')).toBeNull()
  })
})
