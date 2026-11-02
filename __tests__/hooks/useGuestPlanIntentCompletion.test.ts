import AsyncStorage from '@react-native-async-storage/async-storage'
import { renderHook, waitFor } from '@testing-library/react-native'

import { useGuestPlanIntentCompletion } from '@/hooks/useGuestPlanIntentCompletion'
import { getTravelStatus, loadTravelStatus, setTravelStatus } from '@/stores/travelStatusStore'
import { GUEST_PLAN_INTENT_KEY, saveGuestPlanIntent } from '@/utils/guestPlanIntent'
import { showToast } from '@/utils/toast'

jest.mock('@/stores/travelStatusStore', () => ({
  getTravelStatus: jest.fn(),
  loadTravelStatus: jest.fn().mockResolvedValue(true),
  setTravelStatus: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))

describe('useGuestPlanIntentCompletion (#2898)', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    ;(loadTravelStatus as jest.Mock).mockResolvedValue(true)
    await AsyncStorage.clear()
  })

  it('adds the guest’s route to the plan once after sign-in and confirms with a toast', async () => {
    ;(getTravelStatus as jest.Mock).mockReturnValue(undefined)
    await saveGuestPlanIntent({ id: '42', title: 'Гродно за 1 день', url: '/travels/grodno' })

    const { rerender } = await renderHook(({ auth }) => useGuestPlanIntentCompletion(auth, auth ? 'u1' : null), {
      initialProps: { auth: false },
    })
    expect(setTravelStatus).not.toHaveBeenCalled()

    await rerender({ auth: true })
    await waitFor(() => expect(setTravelStatus).toHaveBeenCalledTimes(1))
    expect(setTravelStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: '42', type: 'travel', status: 'planned', title: 'Гродно за 1 день' }),
      'u1',
    )
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ text1: '«Гродно за 1 день» — в вашем плане' })))
    expect(await AsyncStorage.getItem(GUEST_PLAN_INTENT_KEY)).toBeNull()
  })

  it('does not overwrite a status the user already has for that route', async () => {
    ;(getTravelStatus as jest.Mock).mockReturnValue({ id: '42', status: 'visited' })
    await saveGuestPlanIntent({ id: '42', title: 'Гродно' })
    await renderHook(() => useGuestPlanIntentCompletion(true, 'u1'))
    await waitFor(async () => expect(await AsyncStorage.getItem(GUEST_PLAN_INTENT_KEY)).toBeNull())
    expect(setTravelStatus).not.toHaveBeenCalled()
  })

  it('reads the user’s server statuses first, so a status the cache did not have yet is kept', async () => {
    // Сразу после входа кэш пуст; «Был» приходит только после loadTravelStatus.
    let loaded = false
    ;(loadTravelStatus as jest.Mock).mockImplementation(async () => {
      loaded = true
      return true
    })
    ;(getTravelStatus as jest.Mock).mockImplementation(() => (loaded ? { id: '42', status: 'visited' } : undefined))
    await saveGuestPlanIntent({ id: '42', title: 'Гродно' })
    await renderHook(() => useGuestPlanIntentCompletion(true, 'u1'))
    await waitFor(() => expect(loadTravelStatus).toHaveBeenCalledWith('u1'))
    await waitFor(() => expect(getTravelStatus).toHaveBeenCalledWith('u1', '42'))
    await waitFor(async () => expect(await AsyncStorage.getItem(GUEST_PLAN_INTENT_KEY)).toBeNull())
    expect(setTravelStatus).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('does not write when the server statuses failed to load (status unknown)', async () => {
    ;(loadTravelStatus as jest.Mock).mockResolvedValue(false)
    ;(getTravelStatus as jest.Mock).mockReturnValue(undefined)
    await saveGuestPlanIntent({ id: '42', title: 'Гродно' })
    await renderHook(() => useGuestPlanIntentCompletion(true, 'u1'))
    await waitFor(() => expect(loadTravelStatus).toHaveBeenCalledWith('u1'))
    expect(setTravelStatus).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })
})
