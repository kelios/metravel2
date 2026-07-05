import { fireEvent, render, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import ArticleActivationCtaSection from '@/components/article/ArticleActivationCtaSection'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { GUEST_FAVORITE_INTENT_KEY } from '@/utils/guestFavoriteIntent'

const mockPush = jest.fn()
const mockUseAuth = jest.fn()
const mockUseFavorites = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    surface: '#fff',
    border: '#ddd',
    primary: '#ff7043',
    primaryDark: '#e64a19',
    primarySoft: '#fff3e0',
    primaryAlpha30: '#ff70434d',
    text: '#111',
    textSecondary: '#666',
    textOnPrimary: '#fff',
  }),
}))

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

const article = {
  id: 7,
  slug: 'test-article',
  name: 'Test Article',
  description: '<p>Body</p>',
  article_image_thumb_url: 'https://metravel.by/article.jpg',
  article_image_thumb_small_url: 'https://metravel.by/article-small.jpg',
  article_type: { id: 1, name: 'Guide', status: 1, created_at: 0, updated_at: 0 },
}

describe('ArticleActivationCtaSection', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    mockUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      addFavorite: jest.fn(async () => undefined),
    })
  })

  it('stores guest favorite intent and sends the reader to registration', async () => {
    const { getByLabelText } = render(
      <ArticleActivationCtaSection article={article} redirectPath="/article/test-article" />,
    )

    fireEvent.press(getByLabelText('Сохранить статью в избранное'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/registration?redirect=%2Farticle%2Ftest-article&intent=favorite')
    })
    expect(queueAnalyticsEvent).toHaveBeenCalledWith('favorite_intent_guest', {
      item_type: 'article',
      item_id: '7',
      source: 'article_detail',
      url: '/article/test-article',
      auth_state: 'guest',
    })
    expect(queueAnalyticsEvent).toHaveBeenCalledWith('cta_register_click', {
      source: 'article_detail',
      intent: 'favorite_article',
      auth_state: 'guest',
    })

    const rawIntent = await AsyncStorage.getItem(GUEST_FAVORITE_INTENT_KEY)
    expect(rawIntent).toContain('"type":"article"')
    expect(rawIntent).toContain('"url":"/article/test-article"')
  })

  it('saves the article for authenticated readers without auth redirect', async () => {
    const addFavorite = jest.fn(async () => undefined)
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      addFavorite,
    })

    const { getByLabelText } = render(
      <ArticleActivationCtaSection article={article} redirectPath="/article/test-article" />,
    )

    fireEvent.press(getByLabelText('Сохранить статью в избранное'))

    await waitFor(() => {
      expect(addFavorite).toHaveBeenCalledWith({
        id: 7,
        type: 'article',
        title: 'Test Article',
        imageUrl: 'https://metravel.by/article.jpg',
        url: '/article/test-article',
      })
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
