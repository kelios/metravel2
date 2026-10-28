/**
 * @jest-environment node
 */
// Native-путь выбирается по отсутствию `document`; в jsdom 26 его убрать нельзя — окружение node,
// где setup.ts подкладывает заглушку document, а тест её снимает (#2735).
import { Platform } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

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

describe('FavoriteButton (overlay variant, native)', () => {
  const originalPlatform = Platform.OS
  const originalDocument = (globalThis as any).document

  beforeEach(() => {
    delete (globalThis as any).document
    mockRequireAuth.mockClear()
    ;(showToast as jest.Mock).mockClear()
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    ;(globalThis as any).document = originalDocument
  })

  it('adds an authenticated Android travel result to favorites without showing an error toast', async () => {
    const addFavorite = jest.fn(async () => undefined)

    ;(Platform as any).OS = 'android'
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      addFavorite,
      removeFavorite: jest.fn(),
    })

    await render(
      <FavoriteButton
        variant="overlay"
        id={514}
        type="travel"
        title="Random travel"
        url="/travels/random-travel"
        imageUrl="https://metravel.by/media/random.jpg"
        country="Польша"
      />
    )

    await fireEvent.press(screen.getByTestId('favorite-button'))

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
      text1: 'Не удалось обновить «Хочу поехать»',
    }))
  })

  it('adds an Android guest travel result locally instead of opening login', async () => {
    const addFavorite = jest.fn(async () => undefined)

    ;(Platform as any).OS = 'android'
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    mockUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      addFavorite,
      removeFavorite: jest.fn(),
    })

    await render(
      <FavoriteButton
        variant="overlay"
        id={514}
        type="travel"
        title="Random travel"
        url="/travels/random-travel"
      />
    )

    await fireEvent.press(screen.getByTestId('favorite-button'))

    await waitFor(() => {
      expect(addFavorite).toHaveBeenCalledWith({
        id: 514,
        type: 'travel',
        title: 'Random travel',
        url: '/travels/random-travel',
        imageUrl: undefined,
        country: undefined,
        city: undefined,
      })
    })
    expect(mockRequireAuth).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      text1: 'Сохранено на этом устройстве',
    }))
  })
})
