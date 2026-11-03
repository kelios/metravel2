import { onlineManager } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { fetchAllCountriesOptimized } from '@/api/miscOptimized'
import { fetchUserCountryProgress } from '@/api/user'
import { useCountryProgressStats } from '@/hooks/useCountryProgressStats'
import { createQueryWrapper } from '../../../helpers/testQueryClient'

jest.mock('@/api/miscOptimized', () => ({ fetchAllCountriesOptimized: jest.fn() }))
jest.mock('@/api/user', () => ({ fetchUserCountryProgress: jest.fn() }))

const fetchProgress = jest.mocked(fetchUserCountryProgress)
const fetchCatalog = jest.mocked(fetchAllCountriesOptimized)

const emptyProgress = { total_count: 0, visited_count: 0, remaining_count: 0, countries: [] }

beforeEach(() => {
  jest.resetAllMocks()
})

it('treats an empty canonical result as valid and keeps it after a failed refresh', async () => {
  fetchProgress.mockResolvedValueOnce(emptyProgress).mockRejectedValueOnce(new Error('offline'))
  const { Wrapper } = createQueryWrapper()
  const { result, rerender } = await renderHook(
    ({ enabled }) => useCountryProgressStats({ userId: '1', enabled, travels: [], personalTravelStatusEntries: [] }),
    { initialProps: { enabled: false }, wrapper: Wrapper },
  )

  expect(fetchProgress).not.toHaveBeenCalled()
  await rerender({ enabled: true })
  await waitFor(() => expect(result.current.backendStats?.totalCount).toBe(0))
  await act(async () => { await result.current.refetch() })

  expect(result.current.backendStats?.totalCount).toBe(0)
  expect(result.current.shouldLoadFallbackCatalog).toBe(false)
  expect(fetchCatalog).not.toHaveBeenCalled()
})

it('activates fallback only on a settled failure and drops its result on owner change', async () => {
  let rejectProgress: (reason: Error) => void = () => {}
  fetchProgress
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectProgress = reject }))
    .mockResolvedValueOnce(emptyProgress)
  fetchCatalog.mockResolvedValue([{ country_id: '1', title_ru: 'Польша', country_code: 'PL' }])
  const { Wrapper } = createQueryWrapper()
  const { result, rerender } = await renderHook(
    ({ userId }) => useCountryProgressStats({
      userId,
      enabled: true,
      travels: [],
      personalTravelStatusEntries: [
        { id: 42, type: 'travel', title: 'Варшава', url: '/travels/warsaw', country: 'Польша', status: 'visited', addedAt: 1 },
      ],
    }),
    { initialProps: { userId: '1' }, wrapper: Wrapper },
  )

  expect(result.current.isInitialLoading).toBe(true)
  expect(result.current.shouldLoadFallbackCatalog).toBe(false)
  expect(fetchCatalog).not.toHaveBeenCalled()
  await act(async () => { rejectProgress(new Error('offline')) })
  await waitFor(() => expect(fetchCatalog).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(result.current.countriesLoading).toBe(false))
  expect(result.current.shouldLoadFallbackCatalog).toBe(true)
  expect(result.current.stats.rows).toEqual([expect.objectContaining({ code: 'PL', visited: true })])

  await rerender({ userId: '2' })
  expect(result.current.stats.rows).toEqual([])
  expect(result.current.shouldLoadFallbackCatalog).toBe(false)
  await waitFor(() => expect(result.current.backendStats?.totalCount).toBe(0))
  expect(fetchProgress.mock.calls).toEqual([['1'], ['2']])
  expect(fetchCatalog).toHaveBeenCalledTimes(1)
})

it('keeps a paused request pending and releases refresh while offline', async () => {
  const wasOnline = onlineManager.isOnline()
  onlineManager.setOnline(false)
  const { Wrapper } = createQueryWrapper()
  try {
    const { result, unmount } = await renderHook(
      () => useCountryProgressStats({ userId: '1', enabled: true, travels: [], personalTravelStatusEntries: [] }),
      { wrapper: Wrapper },
    )
    try {
      let refreshFinished = false
      await act(async () => {
        void result.current.refetch().then(() => { refreshFinished = true })
      })
      expect(refreshFinished).toBe(true)
      expect(result.current.isInitialLoading).toBe(true)
      expect(result.current.shouldLoadFallbackCatalog).toBe(false)
      expect(fetchProgress).not.toHaveBeenCalled()
      expect(fetchCatalog).not.toHaveBeenCalled()
    } finally {
      await unmount()
    }
  } finally {
    onlineManager.setOnline(wasOnline)
  }
})
