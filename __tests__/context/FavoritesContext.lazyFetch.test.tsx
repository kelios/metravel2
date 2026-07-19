import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Pressable, View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setActiveQueryClient } from '@/api/activeQueryClient'

// IMPORTANT: setup.ts globally mocks FavoritesContext. We explicitly unmock it here
// to test the real provider + lazy server fetching behavior.
jest.unmock('@/context/FavoritesContext')

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/api/user', () => ({
  fetchUserFavoriteTravels: jest.fn(async () => []),
  fetchUserHistory: jest.fn(async () => []),
  fetchUserRecommendedTravels: jest.fn(async () => []),
  clearUserHistory: jest.fn(async () => null),
  clearUserFavorites: jest.fn(async () => null),
}))

jest.mock('@/api/travelsFavorites', () => ({
  markTravelAsFavorite: jest.fn(async () => ({})),
  unmarkTravelAsFavorite: jest.fn(async () => ({})),
}))

describe('FavoritesContext lazy server fetching', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    jest.clearAllMocks()

    const auth = require('@/context/AuthContext')
    auth.useAuth.mockReturnValue({ isAuthenticated: true, userId: '1' })

    // viewHistory ensureServerData ходит через активный RQ-клиент (#994).
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    setActiveQueryClient(queryClient)
  })

  afterEach(() => setActiveQueryClient(null))

  it('does not call backend fetches on mount; only when ensureServerData is called', async () => {
    const { useFavorites } = require('@/context/FavoritesContext')
    const { FavoritesProvider } = require('@/context/FavoritesProvider')
    const apiUser = require('@/api/user')

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
      <QueryClientProvider client={queryClient}>
        <FavoritesProvider>
          <Harness />
        </FavoritesProvider>
      </QueryClientProvider>
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
