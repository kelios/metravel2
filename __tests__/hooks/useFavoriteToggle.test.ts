import { Platform } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'

import { useFavoriteToggle } from '@/hooks/useFavoriteToggle'
import { showToast } from '@/utils/toast'

const mockUseAuth = jest.fn()
const mockRequireAuth = jest.fn()
const mockAdd = jest.fn()
const mockRemove = jest.fn()
const mockIsFavorite = jest.fn()

jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
jest.mock('@/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ requireAuth: mockRequireAuth }) }))
jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({ addFavorite: mockAdd, removeFavorite: mockRemove, isFavorite: mockIsFavorite }),
}))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/haptics', () => ({ hapticImpact: jest.fn(), hapticNotification: jest.fn() }))
jest.mock('@/utils/guestFavoriteIntent', () => ({ saveGuestFavoriteIntent: jest.fn() }))
jest.mock('@/utils/growthFunnelAnalytics', () => ({ trackFavoriteIntentGuest: jest.fn() }))

const toast = showToast as jest.Mock
const target = { id: 7, type: 'travel' as const, title: 'T', url: '/travels/t' }

describe('useFavoriteToggle', () => {
  const originalOS = Platform.OS
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform as any).OS = 'ios'
    mockUseAuth.mockReturnValue({ isAuthenticated: true, authReady: true })
    mockIsFavorite.mockReturnValue(false)
    mockAdd.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue(undefined)
  })
  afterEach(() => {
    ;(Platform as any).OS = originalOS
  })

  it('adds, toasts «Добавлено в избранное» with undo, and undo removes', async () => {
    const { result } = renderHook(() => useFavoriteToggle())
    await act(async () => {
      expect(await result.current.toggle(target)).toBe('success')
    })
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 7, type: 'travel', url: '/travels/t' }))
    const payload = toast.mock.calls[0][0]
    expect(payload).toMatchObject({ type: 'success', text1: 'Добавлено в избранное' })
    await act(async () => {
      payload.action.onPress()
    })
    expect(mockRemove).toHaveBeenCalledWith(7, 'travel')
  })

  it('removes when already favorite; undo re-adds', async () => {
    mockIsFavorite.mockReturnValue(true)
    const { result } = renderHook(() => useFavoriteToggle())
    await act(async () => {
      await result.current.toggle(target)
    })
    expect(mockRemove).toHaveBeenCalledWith(7, 'travel')
    const payload = toast.mock.calls[0][0]
    expect(payload.text1).toBe('Удалено из избранного')
    await act(async () => {
      payload.action.onPress()
    })
    expect(mockAdd).toHaveBeenCalledTimes(1)
  })

  it('reports an error toast when the network call fails', async () => {
    mockAdd.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useFavoriteToggle())
    await act(async () => {
      expect(await result.current.toggle(target)).toBe('error')
    })
    expect(toast.mock.calls[0][0]).toMatchObject({ type: 'error', text1: 'Не удалось обновить избранное' })
  })

  it('ignores a double tap while the first is in flight', async () => {
    let release!: () => void
    mockAdd.mockImplementation(() => new Promise<void>((r) => { release = r }))
    const { result } = renderHook(() => useFavoriteToggle())
    let first!: Promise<string>
    let second = ''
    await act(async () => {
      first = result.current.toggle(target)
      second = await result.current.toggle(target)
    })
    expect(second).toBe('busy')
    expect(mockAdd).toHaveBeenCalledTimes(1)
    await act(async () => {
      release()
      await first
    })
  })

  it('guest: explains and opens sign-in, does not call the API', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, authReady: true })
    const { result } = renderHook(() => useFavoriteToggle())
    await act(async () => {
      expect(await result.current.toggle(target)).toBe('auth')
    })
    expect(mockRequireAuth).toHaveBeenCalledTimes(1)
    expect(mockAdd).not.toHaveBeenCalled()
    expect(toast.mock.calls[0][0].text1).toBe('Войдите, чтобы сохранять маршруты')
  })

  it('!authReady: the tap is deferred, not lost, and replays once auth is ready', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, authReady: false })
    const { result, rerender } = renderHook(() => useFavoriteToggle())
    await act(async () => {
      expect(await result.current.toggle(target)).toBe('deferred')
    })
    expect(mockAdd).not.toHaveBeenCalled()
    expect(mockRequireAuth).not.toHaveBeenCalled()

    mockUseAuth.mockReturnValue({ isAuthenticated: true, authReady: true })
    await act(async () => {
      rerender({})
    })
    expect(mockAdd).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0].text1).toBe('Добавлено в избранное')
  })

  it('!authReady then guest: the replay opens sign-in', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, authReady: false })
    const { result, rerender } = renderHook(() => useFavoriteToggle())
    await act(async () => {
      await result.current.toggle(target)
    })
    mockUseAuth.mockReturnValue({ isAuthenticated: false, authReady: true })
    await act(async () => {
      rerender({})
    })
    expect(mockRequireAuth).toHaveBeenCalledTimes(1)
  })

  it('does not add a favorite without a url (#1438)', async () => {
    const { result } = renderHook(() => useFavoriteToggle())
    await act(async () => {
      expect(await result.current.toggle({ ...target, url: '' })).toBe('invalid')
    })
    expect(mockAdd).not.toHaveBeenCalled()
  })
})
