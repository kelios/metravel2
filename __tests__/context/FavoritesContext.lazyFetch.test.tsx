import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Pressable, View } from 'react-native'

// IMPORTANT: setup.ts globally mocks FavoritesContext. We explicitly unmock it here
// to test the real provider + lazy server fetching behavior.
jest.unmock('@/context/FavoritesContext')

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/src/api/user', () => ({
  fetchUserFavoriteTravels: jest.fn(async () => []),
  fetchUserHistory: jest.fn(async () => []),
  fetchUserRecommendedTravels: jest.fn(async () => []),
  clearUserHistory: jest.fn(async () => null),
  clearUserFavorites: jest.fn(async () => null),
}))

jest.mock('@/src/api/travelsFavorites', () => ({
  markTravelAsFavorite: jest.fn(async () => ({})),
  unmarkTravelAsFavorite: jest.fn(async () => ({})),
}))

describe('FavoritesContext lazy server fetching', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    const auth = require('@/context/AuthContext')
    auth.useAuth.mockReturnValue({ isAuthenticated: true, userId: '1' })
  })

  it('does not call backend fetches on mount; only when ensureServerData is called', async () => {
    const { FavoritesProvider, useFavorites } = require('@/context/FavoritesContext')
    const apiUser = require('@/src/api/user')

    const Harness = () => {
      const { ensureServerData } = useFavorites() as any
      return (
        <View>
          <Pressable testID="load-favorites" onPress={() => ensureServerData('favorites')} />
          <Pressable testID="load-history" onPress={() => ensureServerData('history')} />
        </View>
      )
    }

    const { getByTestId } = render(
      <FavoritesProvider>
        <Harness />
      </FavoritesProvider>
    )

    // No auto-fetch on mount
    expect(apiUser.fetchUserFavoriteTravels).not.toHaveBeenCalled()
    expect(apiUser.fetchUserHistory).not.toHaveBeenCalled()
    expect(apiUser.fetchUserRecommendedTravels).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('load-favorites'))

    await waitFor(() => {
      expect(apiUser.fetchUserFavoriteTravels).toHaveBeenCalledTimes(1)
      expect(apiUser.fetchUserFavoriteTravels).toHaveBeenCalledWith('1')
    })

    // Other endpoints still not called
    expect(apiUser.fetchUserHistory).not.toHaveBeenCalled()
    expect(apiUser.fetchUserRecommendedTravels).not.toHaveBeenCalled()

    // Calling the same kind again should not refetch (cached in provider)
    fireEvent.press(getByTestId('load-favorites'))
    await new Promise((r) => setTimeout(r, 0))
    expect(apiUser.fetchUserFavoriteTravels).toHaveBeenCalledTimes(1)

    // Another kind triggers its own fetch
    fireEvent.press(getByTestId('load-history'))
    await waitFor(() => {
      expect(apiUser.fetchUserHistory).toHaveBeenCalledTimes(1)
      expect(apiUser.fetchUserHistory).toHaveBeenCalledWith('1')
    })
  })
})
