import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { TravelHeroFavoriteToggle } from '@/components/travel/details/TravelHeroFavoriteToggle'
import { showToast } from '@/utils/toast'

const mockAddFavorite = jest.fn()
const mockRemoveFavorite = jest.fn()
const mockIsFavorite = jest.fn()
const mockRequireAuth = jest.fn()

jest.mock('@/components/travel/details/TravelDetailsHeroStyles', () => ({
  useTravelDetailsHeroStyles: () => ({
    heroFavoriteBtn: {},
    heroFavoriteBtnActive: {},
    heroFavoriteBtnMobile: {},
    heroFavoriteBtnLabel: {},
    heroFavoriteBtnLabelActive: {},
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ textOnDark: '#fff' }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    addFavorite: mockAddFavorite,
    removeFavorite: mockRemoveFavorite,
    isFavorite: mockIsFavorite,
  }),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ requireAuth: mockRequireAuth }),
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

const { useAuth } = jest.requireMock('@/context/AuthContext') as {
  useAuth: jest.Mock
}

describe('TravelHeroFavoriteToggle', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    Platform.OS = originalPlatformOS as any
    useAuth.mockReturnValue({ isAuthenticated: true })
    mockAddFavorite.mockReset()
    mockRemoveFavorite.mockReset()
    mockIsFavorite.mockReset()
    mockRequireAuth.mockReset()
    ;(showToast as jest.Mock).mockReset()
  })

  afterAll(() => {
    Platform.OS = originalPlatformOS as any
  })

  it('uses desktop a11y label and hides text on web desktop', () => {
    Platform.OS = 'web' as any
    mockIsFavorite.mockReturnValue(false)

    const { getByLabelText, queryByText } = render(
      <TravelHeroFavoriteToggle
        travel={{ id: 1, slug: 'desktop', name: 'Desktop travel' } as any}
        isMobile={false}
      />
    )

    expect(getByLabelText('Добавить в избранное')).toBeTruthy()
    expect(queryByText('В избранное')).toBeNull()
  })

  it('uses mobile label text as a11y label and shows text', () => {
    Platform.OS = 'ios' as any
    mockIsFavorite.mockReturnValue(true)

    const { getByLabelText, getByText } = render(
      <TravelHeroFavoriteToggle
        travel={{ id: 2, slug: 'mobile', name: 'Mobile travel' } as any}
        isMobile
      />
    )

    expect(getByLabelText('В избранном')).toBeTruthy()
    expect(getByText('В избранном')).toBeTruthy()
  })

  it('requires auth when user is not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false })
    mockIsFavorite.mockReturnValue(false)

    const { getByLabelText } = render(
      <TravelHeroFavoriteToggle
        travel={{ id: 3, slug: 'auth', name: 'Auth travel' } as any}
        isMobile={false}
      />
    )

    fireEvent.press(getByLabelText('Добавить в избранное'))

    expect(mockRequireAuth).toHaveBeenCalled()
    expect(mockAddFavorite).not.toHaveBeenCalled()
    expect(mockRemoveFavorite).not.toHaveBeenCalled()
  })

  it('adds favorite and shows success toast', async () => {
    mockIsFavorite.mockReturnValue(false)
    mockAddFavorite.mockResolvedValue(undefined)

    const { getByLabelText } = render(
      <TravelHeroFavoriteToggle
        travel={{
          id: 4,
          slug: 'add',
          name: 'Add travel',
          travel_image_thumb_url: 'https://cdn.example.com/thumb.jpg',
          countryName: 'Беларусь',
        } as any}
        isMobile={false}
      />
    )

    fireEvent.press(getByLabelText('Добавить в избранное'))

    await waitFor(() => {
      expect(mockAddFavorite).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 4,
          type: 'travel',
          title: 'Add travel',
          url: '/travels/add',
        })
      )
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text1: 'Добавлено в избранное',
      })
    )
  })

  it('removes favorite and shows success toast', async () => {
    mockIsFavorite.mockReturnValue(true)
    mockRemoveFavorite.mockResolvedValue(undefined)

    const { getByLabelText } = render(
      <TravelHeroFavoriteToggle
        travel={{ id: 5, slug: 'remove', name: 'Remove travel' } as any}
        isMobile={false}
      />
    )

    fireEvent.press(getByLabelText('Удалить из избранного'))

    await waitFor(() => {
      expect(mockRemoveFavorite).toHaveBeenCalledWith(5, 'travel')
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text1: 'Удалено из избранного',
      })
    )
  })
})
