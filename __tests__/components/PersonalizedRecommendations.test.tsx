import { render, fireEvent, waitFor } from '@testing-library/react-native'
import PersonalizedRecommendations from '@/components/travel/PersonalizedRecommendations'
import type { FavoriteItem, ViewHistoryItem } from '@/context/FavoritesContext'

// Mock contexts
const mockFavorites: FavoriteItem[] = []
const mockViewHistory: ViewHistoryItem[] = []
const mockRecommended: FavoriteItem[] = []
let mockIsAuthenticated = false
const mockPush = jest.fn()

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    favorites: mockFavorites,
    viewHistory: mockViewHistory,
  }),
}))

// recommended теперь приходит из React Query hook, а не из useFavorites (#994).
jest.mock('@/hooks/useRecommendedTravels', () => ({
  useRecommendedTravels: () => mockRecommended,
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}))

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  }
})

// Mock window for web
global.window = {
  location: { href: '' },
} as any

describe('PersonalizedRecommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFavorites.length = 0
    mockViewHistory.length = 0
    mockRecommended.length = 0
    mockIsAuthenticated = false
    mockPush.mockClear()
  })

  it('renders login prompt when not authenticated', async () => {
    const { findByText, queryByText } = render(<PersonalizedRecommendations />)
    
    expect(await findByText('Рекомендации для вас')).toBeTruthy()
    expect(queryByText('Для вас')).toBeNull()
    expect(
      await findByText(/Войдите, чтобы получать персональные рекомендации/)
    ).toBeTruthy()
  })

  it('renders empty state when authenticated but no favorites or history', async () => {
    mockIsAuthenticated = true
    
    const { findByText } = render(<PersonalizedRecommendations />)
    
    expect(await findByText('Рекомендации для вас')).toBeTruthy()
    expect(
      await findByText(/Начните просматривать путешествия/)
    ).toBeTruthy()
  })

  it('does not duplicate the header with a "Для вас" badge or a no-op "Все маршруты" link', async () => {
    mockIsAuthenticated = true
    mockRecommended.push({
      id: '3',
      type: 'travel' as const,
      title: 'Recommended Travel',
      url: '/travels/3',
      addedAt: Date.now(),
    })

    const { findByTestId, queryByText } = render(
      <PersonalizedRecommendations onlyRecommendations />
    )

    expect(await findByTestId('personalized-recommendations-list-section')).toBeTruthy()
    expect(queryByText('Для вас')).toBeNull()
    expect(queryByText('Все маршруты')).toBeNull()
  })

  it('renders favorites section when authenticated with favorites', async () => {
    mockIsAuthenticated = true
    const testFavorite: FavoriteItem = {
      id: '1',
      type: 'travel' as const,
      title: 'Test Travel',
      url: '/travels/1',
      addedAt: Date.now(),
    }
    mockFavorites.push(testFavorite)
    
    const { findByText, findByLabelText, findByTestId } = render(<PersonalizedRecommendations />)

    expect(await findByText('Хочу поехать')).toBeTruthy()
    expect(await findByTestId('personalized-favorites-section')).toBeTruthy()
    expect(await findByTestId('personalized-favorites-rail')).toBeTruthy()
    // Travel names are in accessibility labels, not as text content
    expect(await findByLabelText(/Test Travel/)).toBeTruthy()
  })

  it('renders view history section when authenticated with history', async () => {
    mockIsAuthenticated = true
    mockViewHistory.push({
      id: '2',
      type: 'article' as const,
      title: 'Test Article',
      url: '/article/2',
      viewedAt: Date.now(),
    })
    
    const { findByText, findByTestId } = render(<PersonalizedRecommendations />)

    expect(await findByText('Недавно просмотрено')).toBeTruthy()
    expect(await findByTestId('personalized-history-section')).toBeTruthy()
    expect(await findByTestId('personalized-history-rail')).toBeTruthy()
  })

  it('handles item press by navigating via router', async () => {
    mockIsAuthenticated = true
    const testFavorite: FavoriteItem = {
      id: '1',
      type: 'travel' as const,
      title: 'Test Travel',
      url: '/travels/1',
      addedAt: Date.now(),
    }
    mockFavorites.push(testFavorite)
    
    const { findByLabelText } = render(<PersonalizedRecommendations />)
    const item = await findByLabelText(/Test Travel/)
    
    fireEvent.press(item)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/travels/1')
    })
  })
})
