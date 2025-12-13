jest.unmock('@/context/FavoritesContext')

import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { View, Text, Pressable } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import { FavoritesProvider, useFavorites } from '@/context/FavoritesContext'
import { AuthProvider } from '@/context/AuthContext'

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
  useAuth: () => ({
    isAuthenticated: false,
    userId: null,
  }),
}))

const TestComponent = () => {
  const { addFavorite, removeFavorite, isFavorite, favorites } = useFavorites()
  
  return (
    <View>
      <Pressable
        testID="add-favorite"
        onPress={() => addFavorite({
          id: 'test-1',
          type: 'travel',
          title: 'Test Travel',
          url: '/test-1',
        })}
      >
        <Text>Add Favorite</Text>
      </Pressable>
      <Pressable
        testID="remove-favorite"
        onPress={() => removeFavorite('test-1', 'travel')}
      >
        <Text>Remove Favorite</Text>
      </Pressable>
      <Text testID="is-favorite">{isFavorite('test-1', 'travel') ? 'true' : 'false'}</Text>
      <Text testID="favorites-count">{favorites.length}</Text>
    </View>
  )
}

describe('FavoritesContext (Fixed - Local Only)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

    const addButton = getByTestId('add-favorite')
    fireEvent.press(addButton)

    await waitFor(() => {
      expect(getByTestId('favorites-count').props.children).toBe(1)
      expect(getByTestId('is-favorite').props.children).toBe('true')
    })

    // Verify localStorage was used
    expect(mockAsyncStorage.setItem).toHaveBeenCalled()
    
    // Verify Toast was shown for local save
    expect(Toast.show).toHaveBeenCalledWith({
      type: 'success',
      text1: 'Добавлено в избранное',
      text2: 'Сохранено на этом устройстве',
    })
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
    fireEvent.press(removeButton)

    await waitFor(() => {
      expect(getByTestId('favorites-count').props.children).toBe(0)
      expect(getByTestId('is-favorite').props.children).toBe('false')
    })

    // Verify localStorage was used
    expect(mockAsyncStorage.setItem).toHaveBeenCalled()
    
    // Verify Toast was shown for local removal
    expect(Toast.show).toHaveBeenCalledWith({
      type: 'info',
      text1: 'Удалено из избранного',
      text2: 'Удалено с этого устройства',
    })
  })

  it('should handle invalid favorite IDs gracefully', async () => {
    const TestComponentWithInvalid = () => {
      const { addFavorite, favorites } = useFavorites()
      
      // Try to add with invalid ID (HTTP error code)
      React.useEffect(() => {
        addFavorite({
          id: 404,
          type: 'travel',
          title: 'Invalid Travel',
          url: '/invalid',
        })
      }, [addFavorite])
      
      return <Text testID="invalid-test">{favorites.length}</Text>
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
    })
  })
})
