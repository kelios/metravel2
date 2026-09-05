/**
 * #1795: второй вход в отзыв на странице квеста. Кнопка обязана появляться
 * только тому, кто квест прошёл и отзыв ещё не оставил, — иначе она зовёт
 * писать отзыв повторно.
 */
import { fireEvent, render } from '@testing-library/react-native'

import QuestReviewInvite from '@/components/quests/QuestReviewInvite'

const mockTrackPromptClick = jest.fn()

let mockReviewState: { review: unknown; isLoading: boolean }

jest.mock('@/hooks/useQuestReview', () => ({
  useQuestReview: () => ({
    review: mockReviewState.review,
    submittedReview: null,
    isLoading: mockReviewState.isLoading,
    hasLoadError: false,
    isSubmitting: false,
    isSubmitted: false,
    hasError: false,
    submit: jest.fn(),
  }),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isAuthenticated: true, authReady: true, requireAuth: jest.fn() }),
}))

jest.mock('@/hooks/useQuestReviewPhotoUpload', () => ({
  useQuestReviewPhotoUpload: () => ({
    statuses: {},
    failedNames: [],
    isUploading: false,
    hasUploaded: false,
    uploadAll: jest.fn(),
  }),
}))

jest.mock('@/utils/questReviewAnalytics', () => ({
  ...jest.requireActual('@/utils/questReviewAnalytics'),
  trackQuestReviewPromptClick: (...args: unknown[]) => mockTrackPromptClick(...args),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    background: '#ffffff',
    backgroundSecondary: '#f3f4f6',
    border: '#e5e7eb',
    borderLight: '#e5e7eb',
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    textOnPrimary: '#ffffff',
    success: '#16a34a',
    warning: '#f59e0b',
    error: '#dc2626',
  }),
}))

describe('QuestReviewInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReviewState = { review: null, isLoading: false }
  })

  it('показывает вход в отзыв прошедшему квест без отзыва', () => {
    const { getByTestId } = render(
      <QuestReviewInvite questId="minsk-cmok" questNumericId={12} cityId="3" />,
    )

    expect(getByTestId('quest-review-invite')).toBeTruthy()
  })

  it('молчит, когда отзыв уже оставлен', () => {
    mockReviewState = { review: { id: 5, rating: 5 }, isLoading: false }

    const { queryByTestId } = render(
      <QuestReviewInvite questId="minsk-cmok" questNumericId={12} cityId="3" />,
    )

    expect(queryByTestId('quest-review-invite')).toBeNull()
  })

  it('не мигает кнопкой, пока префилл отзыва ещё грузится', () => {
    mockReviewState = { review: null, isLoading: true }

    const { queryByTestId } = render(
      <QuestReviewInvite questId="minsk-cmok" questNumericId={12} cityId="3" />,
    )

    expect(queryByTestId('quest-review-invite')).toBeNull()
  })

  it('без числового id квеста отзыв адресовать некуда — кнопки нет', () => {
    const { queryByTestId } = render(<QuestReviewInvite questId="minsk-cmok" cityId="3" />)

    expect(queryByTestId('quest-review-invite')).toBeNull()
  })

  it('открывает ту же форму отзыва и отмечает переход в аналитике', () => {
    const { getByTestId } = render(
      <QuestReviewInvite questId="minsk-cmok" questNumericId={12} cityId="3" />,
    )

    fireEvent.press(getByTestId('quest-review-invite'))

    expect(getByTestId('quest-review-invite-form')).toBeTruthy()
    expect(mockTrackPromptClick).toHaveBeenCalledWith({
      questId: 'minsk-cmok',
      cityId: '3',
      source: 'quest_page',
    })
  })
})
