import { Platform, StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import FavoriteButton from '@/components/travel/FavoriteButton'
import { showToast } from '@/utils/toast'

const mockUseAuth = jest.fn()
const mockRequireAuth = jest.fn()
const mockUseFavorites = jest.fn()

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ requireAuth: mockRequireAuth }),
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

describe('FavoriteButton (overlay variant)', () => {
  const originalPlatform = Platform.OS
  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    mockUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
    })
    mockRequireAuth.mockClear()
    ;(showToast as jest.Mock).mockClear()
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('marks the web hit area as a card action for clickable-card containment', async () => {
    await render(
      <FavoriteButton
        variant="overlay"
        id={42}
        type="travel"
        title="Test travel"
        url="/travels/test-travel"
      />
    )

    // Только `dataSet` доходит до DOM (`data-card-action="true"`): сырой
    // `data-card-action` react-native-web отбрасывает (#2035).
    const hitArea = screen.getByLabelText('Добавить в «Хочу поехать»')
    expect(hitArea.props.dataSet).toEqual({ cardAction: 'true' })
    expect(hitArea.props['data-card-action']).toBeUndefined()
  })

  it('keeps the web hit area at the 44px accessibility minimum', async () => {
    await render(
      <FavoriteButton
        variant="overlay"
        id={42}
        type="travel"
        title="Test travel"
        url="/travels/test-travel"
      />
    )

    expect(StyleSheet.flatten(screen.getByLabelText('Добавить в «Хочу поехать»').props.style)).toMatchObject({
      height: 44,
      width: 44,
    })
  })
})
