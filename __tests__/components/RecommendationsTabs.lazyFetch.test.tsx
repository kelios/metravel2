import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

const mockEnsureServerDataBackend = jest.fn()
const ensureSeenKinds = new Set<string>()

const mockEnsureServerData = jest.fn(async (kind: string) => {
  if (ensureSeenKinds.has(kind)) return
  ensureSeenKinds.add(kind)
  mockEnsureServerDataBackend(kind)
})

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    favorites: [],
    viewHistory: [],
    clearFavorites: jest.fn(),
    clearHistory: jest.fn(),
    ensureServerData: mockEnsureServerData,
  }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}))

jest.mock('@/components/PersonalizedRecommendations', () => {
  const React = require('react')
  const { View } = require('react-native')
  return () => React.createElement(View, { testID: 'personalized-recommendations' })
})

jest.mock('@/components/WeeklyHighlights', () => {
  const React = require('react')
  const { View } = require('react-native')
  return (props: any) => React.createElement(View, { testID: 'weekly-highlights', enabled: props.enabled })
})

import RecommendationsTabs from '@/components/listTravel/RecommendationsTabs'

describe('RecommendationsTabs lazy backend fetching', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ensureSeenKinds.clear()
  })

  it('does not fetch server data when collapsed; fetches only for active tab when visible', async () => {
    const { getByTestId, getByText, queryByText } = render(<RecommendationsTabs />)

    // Default tab is highlights -> no server fetches
    expect(mockEnsureServerData).not.toHaveBeenCalled()

    // Switch to Favorites -> should fetch favorites
    fireEvent.press(getByText('Избранное'))
    await waitFor(() => {
      expect(mockEnsureServerData).toHaveBeenCalledWith('favorites')
    })

    expect(mockEnsureServerDataBackend).toHaveBeenCalledWith('favorites')

    // Switch to History -> should fetch history
    fireEvent.press(getByText('История'))
    await waitFor(() => {
      expect(mockEnsureServerData).toHaveBeenCalledWith('history')
    })

    expect(mockEnsureServerDataBackend).toHaveBeenCalledWith('history')

    // Collapse panel
    fireEvent.press(getByTestId('recommendations-tabs-collapse'))

    // When collapsed, tab labels are not rendered, and no extra fetch is triggered
    expect(queryByText('Избранное')).toBeNull()

    const backendCallsBefore = mockEnsureServerDataBackend.mock.calls.length

    // Expand panel back
    fireEvent.press(getByTestId('recommendations-tabs-expand'))

    // Expanding may re-run the effect (ensureServerData can be called again),
    // but it must NOT trigger a new backend fetch because the kind was already loaded.
    expect(mockEnsureServerDataBackend.mock.calls.length).toBe(backendCallsBefore)
  })
})
