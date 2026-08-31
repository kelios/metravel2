import { render, fireEvent, waitFor } from '@testing-library/react-native'

import QuestReviewSection from '@/components/quests/QuestReviewSection'

const mockSubmit = jest.fn()
const mockRequireAuth = jest.fn()
let mockIsAuthenticated = true
let mockAuthReady = true

let mockReviewState: {
  review: unknown
  isLoading: boolean
  hasLoadError: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  hasError: boolean
}

jest.mock('@/hooks/useQuestReview', () => ({
  useQuestReview: () => ({
    review: mockReviewState.review,
    // Заполняется только подтверждённой отправкой; в этих сценариях её нет,
    // поэтому загрузка фото не стартует (#1579).
    submittedReview: null,
    isLoading: mockReviewState.isLoading,
    hasLoadError: mockReviewState.hasLoadError,
    isSubmitting: mockReviewState.isSubmitting,
    isSubmitted: mockReviewState.isSubmitted,
    hasError: mockReviewState.hasError,
    submit: mockSubmit,
  }),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    authReady: mockAuthReady,
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
    mockIsAuthenticated = true
    mockAuthReady = true
    mockReviewState = {
      review: null,
      isLoading: false,
      hasLoadError: false,
      isSubmitting: false,
      isSubmitted: false,
      hasError: false,
    }
  })

  it('opens auth when a guest taps a star without changing the draft', () => {
    mockIsAuthenticated = false
    const view = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    const fourStar = view.getAllByLabelText('Оценить на 4 из 5')
    fireEvent.press(fourStar[fourStar.length - 1])

    expect(mockRequireAuth).toHaveBeenCalledTimes(1)
    expect(mockSubmit).not.toHaveBeenCalled()

    // После возврата из auth-flow компонент может пережить rerender. Если бы
    // guest-тап записал черновик, кнопка стала бы активной и отправила рейтинг.
    mockIsAuthenticated = true
    view.rerender(<QuestReviewSection questId="krakow-dragon" questNumericId={1} />)
    fireEvent.press(view.getByTestId('quest-review-section-submit'))
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('keeps stars disabled until auth initialization finishes', () => {
    mockIsAuthenticated = false
    mockAuthReady = false
    const { getAllByLabelText } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    const fourStar = getAllByLabelText('Оценить на 4 из 5')
    fireEvent.press(fourStar[fourStar.length - 1])

    expect(mockRequireAuth).not.toHaveBeenCalled()
    expect(mockSubmit).not.toHaveBeenCalled()
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

  it('keeps a tapped rating local until the review is submitted', () => {
    const { getAllByLabelText, getByText } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    const fourStar = getAllByLabelText('Оценить на 4 из 5')
    fireEvent.press(fourStar[fourStar.length - 1])

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(getByText('Оценка сохранится вместе с отзывом. Текстовый отзыв — по желанию.')).toBeTruthy()
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

  it('allows a rating-only review because text is optional', async () => {
    const { getAllByLabelText, getByTestId } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    const fiveStar = getAllByLabelText('Оценить на 5 из 5')
    fireEvent.press(fiveStar[fiveStar.length - 1])

    fireEvent.press(getByTestId('quest-review-section-submit'))

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        rating: 5,
        liked: '',
        disliked: '',
      })
    })
  })

  it('does not submit while the existing-review prefill is loading', () => {
    mockReviewState.isLoading = true
    const { getAllByLabelText, getByTestId } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    const fiveStar = getAllByLabelText('Оценить на 5 из 5')
    fireEvent.press(fiveStar[fiveStar.length - 1])
    fireEvent.press(getByTestId('quest-review-section-submit'))

    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('does not overwrite a review when its prefill failed to load', () => {
    mockReviewState.hasLoadError = true
    const { getAllByLabelText, getByTestId, getByText } = render(
      <QuestReviewSection questId="krakow-dragon" questNumericId={1} />,
    )

    const fiveStar = getAllByLabelText('Оценить на 5 из 5')
    fireEvent.press(fiveStar[fiveStar.length - 1])
    fireEvent.press(getByTestId('quest-review-section-submit'))

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(getByText('Не удалось загрузить отзывы')).toBeTruthy()
  })

  // #1486: до этой задачи «Спасибо за отзыв» показывалось оптимистично, по
  // самому нажатию кнопки, — то есть и поверх упавшего запроса. Отзыва нет, а
  // игрок уверен, что оставил его.
  it('shows an error and keeps the filled form when the save fails', () => {
    mockReviewState.hasError = true

    const { getAllByLabelText, getByPlaceholderText, getByTestId, getByText, queryByText } =
      render(<QuestReviewSection questId="krakow-dragon" questNumericId={1} />)

    const fourStar = getAllByLabelText('Оценить на 4 из 5')
    fireEvent.press(fourStar[fourStar.length - 1])
    fireEvent.changeText(getByPlaceholderText('Расскажите, что было интересно'), 'Сюжет')

    expect(queryByText('Спасибо за отзыв!')).toBeNull()
    expect(getByTestId('quest-review-section-error')).toBeTruthy()
    expect(getByText('Ошибка при отправке.')).toBeTruthy()

    // Введённое остаётся в форме, поэтому отправку можно повторить тем же
    // содержимым, ничего не набирая заново.
    fireEvent.press(getByTestId('quest-review-section-submit'))
    expect(mockSubmit).toHaveBeenCalledWith({ rating: 4, liked: 'Сюжет', disliked: '' })
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
