/**
 * Показ промодерированных фото игрока в читалке отзывов (#1579).
 * Читалка — единственная поверхность отзывов: её открывают и со страницы
 * квеста (`app/(tabs)/quests/[city]/[questId].tsx:475`), и с карточки квеста
 * (`screens/tabs/QuestCard.tsx:515`).
 */

import { render } from '@testing-library/react-native'

import QuestReviewsModal from '@/components/quests/QuestReviewsModal'
import type { QuestReview } from '@/api/quests'

let mockReviews: QuestReview[] = []

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
  createdAt: null,
  photos: [],
  ...over,
})

describe('QuestReviewsModal photos', () => {
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
