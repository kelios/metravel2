import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import OptimizedFavoriteButton from '@/components/travel/OptimizedFavoriteButton'
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

describe('OptimizedFavoriteButton', () => {
  const originalPlatform = Platform.OS
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')

  const setDocumentForTest = (value: unknown) => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value,
    })
  }

  const restoreDocument = () => {
    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, 'document', originalDocumentDescriptor)
    }
  }

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    restoreDocument()
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
    restoreDocument()
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

  it('adds an authenticated Android travel result to favorites without showing an error toast', async () => {
    const addFavorite = jest.fn(async () => undefined)

    ;(Platform as any).OS = 'android'
    setDocumentForTest(undefined)
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      addFavorite,
      removeFavorite: jest.fn(),
    })

    render(
      <OptimizedFavoriteButton
        id={514}
        type="travel"
        title="Random travel"
        url="/travels/random-travel"
        imageUrl="https://metravel.by/media/random.jpg"
        country="Польша"
      />
    )

    fireEvent.press(screen.getByTestId('favorite-button'))

    await waitFor(() => {
      expect(addFavorite).toHaveBeenCalledWith({
        id: 514,
        type: 'travel',
        title: 'Random travel',
        url: '/travels/random-travel',
        imageUrl: 'https://metravel.by/media/random.jpg',
        country: 'Польша',
        city: undefined,
      })
    })
    expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      text1: 'Не удалось обновить избранное',
    }))
  })
})
