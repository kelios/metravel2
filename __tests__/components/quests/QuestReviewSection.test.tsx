import { render, fireEvent, waitFor } from '@testing-library/react-native'

import QuestReviewSection from '@/components/quests/QuestReviewSection'

const mockSubmit = jest.fn()
const mockRequireAuth = jest.fn()

let mockReviewState: {
  review: unknown
  isSubmitting: boolean
  isSubmitted: boolean
  hasError: boolean
}

jest.mock('@/hooks/useQuestReview', () => ({
  useQuestReview: () => ({
    review: mockReviewState.review,
    isLoading: false,
    isSubmitting: mockReviewState.isSubmitting,
    isSubmitted: mockReviewState.isSubmitted,
    hasError: mockReviewState.hasError,
    submit: mockSubmit,
  }),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    isAuthenticated: true,
    requireAuth: mockRequireAuth,
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    backgroundSecondary: '#f3f4f6',
    borderLight: '#e5e7eb',
    primary: '#2563eb',
    textOnPrimary: '#ffffff',
    success: '#16a34a',
    warning: '#f59e0b',
    error: '#dc2626',
  }),
}))

describe('QuestReviewSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReviewState = { review: null, isSubmitting: false, isSubmitted: false, hasError: false }
  })

  it('requires a rating before submitting (text alone is not enough)', () => {
    const { getByTestId, getByPlaceholderText } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    fireEvent.changeText(
      getByPlaceholderText('Расскажите, что было интересно'),
      'Очень понравилось',
    )

    // Submit without a star rating must not call the mutation (BE: rating 1..5 NOT NULL).
    fireEvent.press(getByTestId('quest-review-section-submit'))
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('submits the tapped rating together with the text fields', async () => {
    const { getByTestId, getAllByLabelText, getByPlaceholderText } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    fireEvent.changeText(
      getByPlaceholderText('Расскажите, что было интересно'),
      '  Сюжет и точки  ',
    )

    const fourStar = getAllByLabelText('Оценить на 4 из 5')
    fireEvent.press(fourStar[fourStar.length - 1])

    fireEvent.press(getByTestId('quest-review-section-submit'))

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        rating: 4,
        liked: 'Сюжет и точки',
        disliked: '',
      })
    })
  })

  it('shows a thank-you state when the user already left a review', () => {
    mockReviewState.review = { id: 7, user: 1, quest: 1, rating: 5, liked: 'x', disliked: '' }

    const { getByText, queryByPlaceholderText } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    expect(getByText('Спасибо за отзыв!')).toBeTruthy()
    expect(queryByPlaceholderText('Расскажите, что было интересно')).toBeNull()
  })
})
