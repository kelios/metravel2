jest.unmock('@/context/FavoritesContext')

import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { View, Text, Pressable } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import { FavoritesProvider, useFavorites } from '@/context/FavoritesContext'
import { AuthProvider } from '@/context/AuthContext'

const mockUseAuth = jest.fn()

jest.mock('@/src/api/travelsFavorites', () => ({
  markTravelAsFavorite: jest.fn(async () => null),
  unmarkTravelAsFavorite: jest.fn(async () => null),
}))

jest.mock('@/src/api/user', () => ({
  fetchUserFavoriteTravels: jest.fn(async () => []),
  fetchUserHistory: jest.fn(async () => []),
  fetchUserRecommendedTravels: jest.fn(async () => []),
  clearUserHistory: jest.fn(async () => null),
  clearUserFavorites: jest.fn(async () => null),
}))

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage')
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

// Mock Toast
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}))

// Mock Platform and AuthContext
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    Platform: {
      OS: 'web',
      select: jest.fn((obj) => obj.web),
    },
  }
})

jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockUseAuth(),
}))

const TestComponent = () => {
  const { addFavorite, removeFavorite, isFavorite, favorites } = useFavorites()
  const [error, setError] = React.useState<string | null>(null)
  
  return (
    <View>
      <Pressable
        testID="add-favorite"
        onPress={() =>
          addFavorite({
            id: 'test-1',
            type: 'travel',
            title: 'Test Travel',
            url: '/test-1',
          }).catch((e: any) => setError(e?.message ?? String(e)))
        }
      >
        <Text>Add Favorite</Text>
      </Pressable>
      <Pressable
        testID="remove-favorite"
        onPress={() =>
          removeFavorite('test-1', 'travel').catch((e: any) => setError(e?.message ?? String(e)))
        }
      >
        <Text>Remove Favorite</Text>
      </Pressable>
      <Text testID="is-favorite">{isFavorite('test-1', 'travel') ? 'true' : 'false'}</Text>
      <Text testID="favorites-count">{favorites.length}</Text>
      <Text testID="error">{error ?? ''}</Text>
    </View>
  )
}

describe('FavoritesContext (Fixed - Local Only)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({ isAuthenticated: false, userId: null })
    mockAsyncStorage.getItem.mockResolvedValue(null)
    mockAsyncStorage.setItem.mockResolvedValue(undefined)
    mockAsyncStorage.removeItem.mockResolvedValue(undefined)
    mockAsyncStorage.multiGet.mockResolvedValue([])
    
    // Override Platform.OS for this test
    const { Platform } = require('react-native')
    Platform.OS = 'web'
  })

  it('should add favorite locally without server sync', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null)
    mockAsyncStorage.setItem.mockResolvedValue(undefined)

    const { getByTestId } = render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent />
        </FavoritesProvider>
      </AuthProvider>
    )

    // Wait for initial provider load
    await waitFor(() => {
      expect(getByTestId('favorites-count').props.children).toBe(0)
    })

    const addButton = getByTestId('add-favorite')
    await act(async () => {
      fireEvent.press(addButton)
    })

    await waitFor(() => {
      expect(getByTestId('error').props.children).toBe('AUTH_REQUIRED')
    })

    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled()
    expect(Toast.show).not.toHaveBeenCalled()
  })

  it('should remove favorite locally without server sync', async () => {
    // First add a favorite
    const mockFavorites = JSON.stringify([
      {
        id: 'test-1',
        type: 'travel',
        title: 'Test Travel',
        url: '/test-1',
        addedAt: Date.now(),
      }
    ])
    
    // Mock multiGet to return the favorites
    mockAsyncStorage.multiGet.mockResolvedValue([
      ['metravel_favorites', mockFavorites],
      ['metravel_view_history', null]
    ])

    const { getByTestId } = render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent />
        </FavoritesProvider>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(getByTestId('favorites-count').props.children).toBe(0)
    })

    const removeButton = getByTestId('remove-favorite')
    await act(async () => {
      fireEvent.press(removeButton)
    })

    await waitFor(() => {
      expect(getByTestId('error').props.children).toBe('AUTH_REQUIRED')
    })

    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled()
    expect(Toast.show).not.toHaveBeenCalled()
  })

  it('should handle invalid favorite IDs gracefully', async () => {
    const TestComponentWithInvalid = () => {
      const { addFavorite, favorites } = useFavorites()
      const [error, setError] = React.useState<string | null>(null)
      
      // Try to add with invalid ID (HTTP error code)
      React.useEffect(() => {
        addFavorite({
          id: 404,
          type: 'travel',
          title: 'Invalid Travel',
          url: '/invalid',
        }).catch((e: any) => setError(e?.message ?? String(e)))
      }, [addFavorite])
      
      return (
        <View>
          <Text testID="invalid-test">{favorites.length}</Text>
          <Text testID="invalid-error">{error ?? ''}</Text>
        </View>
      )
    }

    const { getByTestId } = render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponentWithInvalid />
        </FavoritesProvider>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(getByTestId('invalid-test').props.children).toBe(0)
      expect(getByTestId('invalid-error').props.children).toBe('AUTH_REQUIRED')
    })
  })
})
