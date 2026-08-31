/**
 * Шаг «Как прошло?» с фото: порядок «подтверждённый отзыв → загрузка» и
 * частичный успех (#1579).
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native'

import QuestReviewSection from '@/components/quests/QuestReviewSection'

const mockSubmit = jest.fn()
const mockUploadPhoto = jest.fn()
const mockTrackPhotoUpload = jest.fn()
const mockLaunchLibrary = jest.fn()

jest.mock('@/hooks/useQuestReview', () => {
  const React = require('react')
  return {
    useQuestReview: () => {
      // Заглушка ведёт себя как настоящий хук: `submittedReview` появляется
      // только после подтверждённого сохранения — до него нет `id`, по которому
      // адресуется загрузка фото.
      const [submitted, setSubmitted] = React.useState<{ id: number } | null>(null)
      return {
        review: null,
        submittedReview: submitted,
        isLoading: false,
        hasLoadError: false,
        isSubmitting: false,
        isSubmitted: !!submitted,
        hasError: false,
        submit: (input: unknown) => {
          mockSubmit(input)
          setSubmitted({ id: 77 })
        },
      }
    },
  }
})

jest.mock('@/api/questReviewPhoto', () => ({
  uploadQuestReviewPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  QUEST_REVIEW_PHOTO_LIMIT: 3,
  QUEST_REVIEW_PHOTO_COLLECTION: 'questReviewPhoto',
}))

jest.mock('@/utils/questReviewAnalytics', () => ({
  trackQuestPhotoUpload: (...args: unknown[]) => mockTrackPhotoUpload(...args),
  trackQuestReviewSubmit: jest.fn(),
}))

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...args),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}))

jest.mock('@/utils/imageCompressor', () => ({
  compressTravelPhoto: jest.fn(async (uri: string) => ({ uri, width: 10, height: 10 })),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isAuthenticated: true, authReady: true, requireAuth: jest.fn() }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    backgroundSecondary: '#f3f4f6',
    borderLight: '#e5e7eb',
    primary: '#2563eb',
    primaryText: '#1d4ed8',
    textOnPrimary: '#ffffff',
    success: '#16a34a',
    danger: '#dc2626',
  }),
}))

const rate = (view: ReturnType<typeof render>) => {
  const stars = view.getAllByLabelText('Оценить на 5 из 5')
  fireEvent.press(stars[stars.length - 1])
}

describe('QuestReviewSection photos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUploadPhoto.mockResolvedValue({ id: 1, url: 'https://cdn/a.jpg' })
  })

  it('submits a photoless review exactly as before and uploads nothing', async () => {
    const view = render(<QuestReviewSection questId="minsk-cmok" questNumericId={5} />)
    rate(view)
    fireEvent.press(view.getByTestId('quest-review-section-submit'))

    await waitFor(() => expect(view.getByText('Спасибо за отзыв!')).toBeTruthy())
    expect(mockSubmit).toHaveBeenCalledTimes(1)
    expect(mockUploadPhoto).not.toHaveBeenCalled()
    expect(mockTrackPhotoUpload).not.toHaveBeenCalled()
    expect(view.queryByTestId('quest-review-section-photo-moderation')).toBeNull()
  })

  it('uploads only after the review is confirmed and explains the moderation wait', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
    })

    const view = render(<QuestReviewSection questId="minsk-cmok" questNumericId={5} />)
    fireEvent.press(view.getByTestId('quest-review-section-photos-add'))
    await waitFor(() =>
      expect(view.getByTestId('quest-review-section-photos-counter')).toHaveTextContent(
        'Выбрано 1 из 3',
      ),
    )
    // До подтверждения отзыва загрузки быть не может: адресовать её нечем.
    expect(mockUploadPhoto).not.toHaveBeenCalled()

    rate(view)
    fireEvent.press(view.getByTestId('quest-review-section-submit'))

    await waitFor(() => expect(mockUploadPhoto).toHaveBeenCalledTimes(1))
    expect(mockUploadPhoto.mock.calls[0][0]).toMatchObject({ reviewId: 77 })
    await waitFor(() =>
      expect(view.getByTestId('quest-review-section-photo-moderation')).toHaveTextContent(
        'Фото появятся в отзывах после проверки модератором.',
      ),
    )
    expect(mockTrackPhotoUpload).toHaveBeenCalledTimes(1)
  })

  it('keeps the saved review saved when a photo fails and names the file', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///broken.jpg', fileName: 'broken.jpg', mimeType: 'image/jpeg' }],
    })
    mockUploadPhoto.mockRejectedValueOnce(new Error('network'))

    const view = render(<QuestReviewSection questId="minsk-cmok" questNumericId={5} />)
    fireEvent.press(view.getByTestId('quest-review-section-photos-add'))
    await waitFor(() =>
      expect(view.getByTestId('quest-review-section-photos-counter')).toHaveTextContent(
        'Выбрано 1 из 3',
      ),
    )

    rate(view)
    fireEvent.press(view.getByTestId('quest-review-section-submit'))

    await waitFor(() =>
      expect(view.getByTestId('quest-review-section-photo-error')).toHaveTextContent(
        'Отзыв сохранён, но не удалось загрузить фото: broken.jpg.',
      ),
    )
    // Сетевой сбой на снимке не заставляет писать отзыв заново.
    expect(view.getByText('Спасибо за отзыв!')).toBeTruthy()
    expect(mockTrackPhotoUpload).not.toHaveBeenCalled()
  })
})
