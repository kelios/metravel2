/**
 * Показ промодерированных фото игрока в читалке отзывов (#1579).
 * Читалка — единственная поверхность отзывов: её открывают и со страницы
 * квеста (`app/(tabs)/quests/[city]/[questId].tsx:475`), и с карточки квеста
 * (`screens/tabs/QuestCard.tsx:515`).
 */

import { fireEvent, render as rtlRender } from '@testing-library/react-native'
import { createQueryWrapper } from '../../helpers/testQueryClient'
import QuestReviewsModal from '@/components/quests/QuestReviewsModal'
import type { QuestReview } from '@/api/quests'

// #2133: меню жалобы в рендере зовёт мутации блокировки — нужен QueryClient, как в приложении.
const render = (ui: Parameters<typeof rtlRender>[0]) =>
  rtlRender(ui, { wrapper: createQueryWrapper().Wrapper })

let mockReviews: QuestReview[] = []

jest.mock('@/components/travel/FullscreenGallery', () => {
  const { View, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: (props: any) => (
      <View testID="review-fullscreen-gallery" {...props}>
        <Pressable testID="review-gallery-close" onPress={props.onClose} />
      </View>
    ),
  }
})

// Плитка фото — обычный потребитель общего примитива медиа, поэтому проверяем
// то, что принадлежит читалке: адрес снимка, режим вписывания и подпись. Сам
// `ImageCardMedia` до загрузки рисует только плейсхолдер, и настоящая картинка
// в тестовом рендере не монтируется вовсе.
jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: any) => <View testID={props.testID || 'image-card-media'} {...props} />,
  }
})

jest.mock('@/hooks/useQuestsApi', () => ({
  useQuestReviews: () => ({
    data: mockReviews,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
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
    primaryDark: '#1e40af',
    textOnPrimary: '#ffffff',
  }),
}))

const baseReview = (over: Partial<QuestReview> = {}): QuestReview => ({
  id: 1,
  rating: 5,
  liked: 'Отличный маршрут',
  disliked: '',
  authorName: 'Путешественник',
  authorAvatar: null,
  authorId: null,
  createdAt: null,
  photos: [],
  ...over,
})

describe('QuestReviewsModal photos', () => {
  it('opens the selected photo with only that review’s images and returns to reviews on close', async () => {
    mockReviews = [
      baseReview({ photos: [
        { id: 11, url: 'https://cdn/one.jpg', stepId: null },
        { id: 12, url: 'https://cdn/two.jpg', stepId: null },
      ] }),
      baseReview({ id: 2, photos: [{ id: 13, url: 'https://cdn/other.jpg', stepId: null }] }),
    ]
    const onClose = jest.fn()
    const view = render(<QuestReviewsModal questId="minsk-cmok" visible onClose={onClose} />)
    fireEvent.press(view.getByTestId('quest-review-photo-open-12'))
    const gallery = await view.findByTestId('review-fullscreen-gallery')
    expect(gallery.props.initialIndex).toBe(1)
    expect(gallery.props.maxImageSize).toBe(640)
    expect(gallery.props.images).toEqual([
      { url: 'https://cdn/one.jpg', alt: 'Фото из отзыва о квесте' },
      { url: 'https://cdn/two.jpg', alt: 'Фото из отзыва о квесте' },
    ])
    expect(view.queryByTestId('quest-reviews-modal')).toBeNull()
    fireEvent.press(view.getByTestId('review-gallery-close'))
    expect(view.queryByTestId('review-fullscreen-gallery')).toBeNull()
    expect(view.getByTestId('quest-reviews-modal')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clears the gallery when reviews close externally or the quest changes', async () => {
    mockReviews = [baseReview({ photos: [{ id: 11, url: 'https://cdn/one.jpg', stepId: null }] })]
    const onClose = jest.fn()
    const view = render(<QuestReviewsModal questId="minsk-cmok" visible onClose={onClose} />)
    fireEvent.press(view.getByTestId('quest-review-photo-open-11'))
    await view.findByTestId('review-fullscreen-gallery')
    view.rerender(<QuestReviewsModal questId="minsk-cmok" visible={false} onClose={onClose} />)
    expect(view.queryByTestId('review-fullscreen-gallery')).toBeNull()
    view.rerender(<QuestReviewsModal questId="minsk-cmok" visible onClose={onClose} />)
    expect(view.getByTestId('quest-reviews-modal')).toBeTruthy()
    fireEvent.press(view.getByTestId('quest-review-photo-open-11'))
    await view.findByTestId('review-fullscreen-gallery')
    view.rerender(<QuestReviewsModal questId="another-quest" visible onClose={onClose} />)
    expect(view.queryByTestId('review-fullscreen-gallery')).toBeNull()
  })

  it('renders the moderated photos the server returned', () => {
    mockReviews = [
      baseReview({
        photos: [
          { id: 11, url: 'https://cdn/one.jpg', stepId: null },
          { id: 12, url: 'https://cdn/two.jpg', stepId: 903 },
        ],
      }),
    ]

    const view = render(<QuestReviewsModal questId="minsk-cmok" visible onClose={jest.fn()} />)

    const gallery = view.getByTestId('quest-review-photos-1')
    expect(gallery).toBeTruthy()

    const tiles = [
      view.getByTestId('quest-review-photo-11'),
      view.getByTestId('quest-review-photo-12'),
    ]
    expect(tiles.map((tile) => tile.props.src)).toEqual([
      'https://cdn/one.jpg',
      'https://cdn/two.jpg',
    ])
    // Инвариант проекта: снимок игрока вписывается целиком, поле — фон слота
    // (docs/RULES.md → Images and placeholders, «No per-surface exception»).
    tiles.forEach((tile) => {
      expect(tile.props.fit).toBe('contain')
      expect(tile.props.alt).toBe('Фото из отзыва о квесте')
    })
  })

  it('renders a review without photos exactly as before, with no empty gallery slot', () => {
    mockReviews = [baseReview()]

    const view = render(<QuestReviewsModal questId="minsk-cmok" visible onClose={jest.fn()} />)

    expect(view.getByTestId('quest-review-item-1')).toBeTruthy()
    expect(view.queryByTestId('quest-review-photos-1')).toBeNull()
    expect(view.queryByText('Фото игрока')).toBeNull()
  })
})
