/**
 * #1795: второй вход в отзыв на странице квеста. Кнопка обязана появляться
 * только тому, кто квест прошёл и отзыв ещё не оставил, — иначе она зовёт
 * писать отзыв повторно.
 */
import { act, fireEvent, render } from '@testing-library/react-native'

import QuestReviewInvite from '@/components/quests/QuestReviewInvite'

const mockTrackPromptClick = jest.fn()

let mockReviewState: { review: unknown; isLoading: boolean }
// Реальный useQuestReview — подписка react-query: приход отзыва перерисовывает
// сам компонент, а не его родителя. Мок повторяет это состоянием, иначе memo
// съел бы обновление и сценарий «отзыв сохранился» проверялся бы вхолостую.
const reviewStateSetters: Array<(next: { review: unknown; isLoading: boolean }) => void> = []

jest.mock('@/hooks/useQuestReview', () => ({
  useQuestReview: () => {
    const ReactModule = require('react')
    const [state, setState] = ReactModule.useState(mockReviewState)
    ReactModule.useEffect(() => {
      reviewStateSetters.push(setState)
      return () => {
        const index = reviewStateSetters.indexOf(setState)
        if (index >= 0) reviewStateSetters.splice(index, 1)
      }
    }, [])
    return {
      review: state.review,
      submittedReview: null,
      isLoading: state.isLoading,
      hasLoadError: false,
      isSubmitting: false,
      isSubmitted: false,
      hasError: false,
      submit: jest.fn(),
    }
  },
}))

const pushReviewState = (next: { review: unknown; isLoading: boolean }) => {
  act(() => {
    reviewStateSetters.forEach((setState) => setState(next))
  })
}

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

  // #1795 review: гейт видимости раньше стоял выше самого окна, и запись отзыва
  // в общий ключ кэша (onSuccess) уносила открытую форму вместе с экраном
  // «Спасибо за отзыв» и загрузкой прикреплённых фото.
  it('не закрывает открытую форму, когда отзыв сохранился или идёт фоновый refetch', () => {
    const { getByTestId, queryByTestId } = render(
      <QuestReviewInvite questId="minsk-cmok" questNumericId={12} cityId="3" />,
    )

    fireEvent.press(getByTestId('quest-review-invite'))
    expect(getByTestId('quest-review-invite-form')).toBeTruthy()

    // Отправка прошла: тот же ключ кэша теперь отдаёт сохранённый отзыв.
    pushReviewState({ review: { id: 5, rating: 5 }, isLoading: false })
    expect(getByTestId('quest-review-invite-form')).toBeTruthy()
    // Кнопка-вход при этом уходит: второй раз звать писать отзыв незачем.
    expect(queryByTestId('quest-review-invite')).toBeNull()

    // Восстановление сети дёргает refetch — форма с набранным текстом остаётся.
    pushReviewState({ review: null, isLoading: true })
    expect(getByTestId('quest-review-invite-form')).toBeTruthy()
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
