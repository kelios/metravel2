import { Platform, StyleSheet } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import FavoriteButton from '@/components/travel/FavoriteButton'
import { showToast } from '@/utils/toast'

const mockAdd = jest.fn()
const mockIsFavorite = jest.fn()

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, authReady: true }),
}))
jest.mock('@/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ requireAuth: jest.fn() }) }))
jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({ isFavorite: mockIsFavorite, addFavorite: mockAdd, removeFavorite: jest.fn() }),
}))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/haptics', () => ({ hapticImpact: jest.fn(), hapticNotification: jest.fn() }))

describe('FavoriteButton: оба варианта дают один и тот же отклик (#2103)', () => {
  const originalOS = Platform.OS
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  beforeEach(() => {
    // overlay выбирает web-ветку по наличию document — для native-пути его нет
    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined })
    jest.clearAllMocks()
    ;(Platform as any).OS = 'ios'
    mockIsFavorite.mockReturnValue(false)
    mockAdd.mockResolvedValue(undefined)
  })
  afterEach(() => {
    ;(Platform as any).OS = originalOS
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  })

  it.each(['overlay', 'plain'] as const)('%s: success toast with «Отменить»', async (variant) => {
    const { getByLabelText } = render(
      <FavoriteButton id={5} type="travel" title="Мост" url="/travels/most" variant={variant} />,
    )
    fireEvent.press(getByLabelText(/Добавить/))
    await waitFor(() => expect(showToast).toHaveBeenCalled())
    const payload = (showToast as jest.Mock).mock.calls[0][0]
    expect(payload.text1).toBe('Добавлено в «Хочу поехать»')
    expect(payload.action?.label).toBe('Отменить')
  })

  it.each(['overlay', 'plain'] as const)('%s: active heart has a filled danger disc, not only an outline', (variant) => {
    mockIsFavorite.mockReturnValue(true)
    const { getByLabelText } = render(
      <FavoriteButton id={5} type="travel" title="Мост" url="/travels/most" variant={variant} />,
    )
    const flat = StyleSheet.flatten(getByLabelText(/Удалить/).props.style)
    expect(flat.backgroundColor).toBeTruthy()
    expect(flat.minWidth ?? flat.width).toBeGreaterThanOrEqual(44)
  })
})
