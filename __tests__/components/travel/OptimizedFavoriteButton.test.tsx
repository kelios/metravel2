import React from 'react'
import { Platform } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import OptimizedFavoriteButton from '@/components/travel/OptimizedFavoriteButton'

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

describe('OptimizedFavoriteButton', () => {
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
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('marks the web hit area as a card action for clickable-card containment', () => {
    render(
      <OptimizedFavoriteButton
        id={42}
        type="travel"
        title="Test travel"
        url="/travels/test-travel"
      />
    )

    expect(screen.getByLabelText('Добавить в избранное').props['data-card-action']).toBe('true')
  })
})
