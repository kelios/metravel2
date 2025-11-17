import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import FavoriteButton from '@/components/FavoriteButton'

// Mock FavoritesContext
const mockAddFavorite = jest.fn()
const mockRemoveFavorite = jest.fn()
const mockIsFavorite = jest.fn()

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    isFavorite: mockIsFavorite,
    addFavorite: mockAddFavorite,
    removeFavorite: mockRemoveFavorite,
  }),
}))

describe('FavoriteButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly when not favorite', () => {
    mockIsFavorite.mockReturnValue(false)
    
    const { getByLabelText } = render(
      <FavoriteButton
        id="1"
        type="travel"
        title="Test Travel"
        url="/travels/1"
      />
    )
    
    expect(
      getByLabelText(/Добавить "Test Travel" в избранное/)
    ).toBeTruthy()
  })

  it('renders correctly when favorite', () => {
    mockIsFavorite.mockReturnValue(true)
    
    const { getByLabelText } = render(
      <FavoriteButton
        id="1"
        type="travel"
        title="Test Travel"
        url="/travels/1"
      />
    )
    
    expect(
      getByLabelText(/Удалить "Test Travel" из избранного/)
    ).toBeTruthy()
  })

  it('calls addFavorite when pressing non-favorite item', async () => {
    mockIsFavorite.mockReturnValue(false)
    
    const { getByLabelText } = render(
      <FavoriteButton
        id="1"
        type="travel"
        title="Test Travel"
        url="/travels/1"
        country="Belarus"
      />
    )
    
    const button = getByLabelText(/Добавить "Test Travel" в избранное/)
    fireEvent.press(button)
    
    await waitFor(() => {
      expect(mockAddFavorite).toHaveBeenCalledWith({
        id: '1',
        type: 'travel',
        title: 'Test Travel',
        url: '/travels/1',
        country: 'Belarus',
        imageUrl: undefined,
        city: undefined,
      })
    })
  })

  it('calls removeFavorite when pressing favorite item', async () => {
    mockIsFavorite.mockReturnValue(true)
    
    const { getByLabelText } = render(
      <FavoriteButton
        id="1"
        type="article"
        title="Test Article"
        url="/article/1"
      />
    )
    
    const button = getByLabelText(/Удалить "Test Article" из избранного/)
    fireEvent.press(button)
    
    await waitFor(() => {
      expect(mockRemoveFavorite).toHaveBeenCalledWith('1', 'article')
    })
  })

  it('applies custom size and color', () => {
    mockIsFavorite.mockReturnValue(false)
    
    const { getByLabelText } = render(
      <FavoriteButton
        id="1"
        type="travel"
        title="Test"
        url="/travels/1"
        size={32}
        color="#ff0000"
      />
    )
    
    expect(getByLabelText(/Добавить "Test" в избранное/)).toBeTruthy()
  })
})

