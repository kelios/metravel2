import { act, renderHook, waitFor } from '@testing-library/react-native'

jest.mock('@/api/userPoints', () => ({
  userPointsApi: { getPointsByIds: jest.fn() },
}))
jest.mock('@/utils/logger', () => ({ logError: jest.fn(), logWarn: jest.fn(), logInfo: jest.fn() }))

const { userPointsApi } = require('@/api/userPoints')
const mockGetByIds = userPointsApi.getPointsByIds as jest.Mock

import { userPointDetailsStore, useUserPointDetail } from '@/components/UserPoints/userPointDetailsStore'
import type { ImportedPoint, UserPointPin } from '@/types/userPoints'

const pin = (id: number, extra: Partial<UserPointPin> = {}): UserPointPin =>
  ({ id, latitude: 50 + id, longitude: 20 + id, color: 'blue', status: 'planning', category: 'other', ...extra }) as UserPointPin
const full = (id: number, extra: Partial<ImportedPoint> = {}): ImportedPoint =>
  ({ ...pin(id), name: `Point ${id}`, address: `Addr ${id}`, ...extra }) as unknown as ImportedPoint

const flush = () => new Promise((r) => setTimeout(r, 60))

describe('userPointDetailsStore (#3161)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    userPointDetailsStore.setOwner('1')
    userPointDetailsStore.clear()
    mockGetByIds.mockImplementation(async (ids: number[]) => ids.map((id) => full(id)))
  })

  it('склеивает ensure одного кадра в один запрос ids и отдаёт карточки', async () => {
    const a = await renderHook(() => useUserPointDetail(pin(1)))
    const b = await renderHook(() => useUserPointDetail(pin(2)))
    expect(a.result.current.hydrating).toBe(true)

    await waitFor(() => expect(a.result.current.hydrating).toBe(false))
    await waitFor(() => expect(b.result.current.hydrating).toBe(false))
    expect(mockGetByIds).toHaveBeenCalledTimes(1)
    expect(mockGetByIds.mock.calls[0][0].sort()).toEqual([1, 2])
    expect(a.result.current.point.name).toBe('Point 1')
  })

  it('полная запись (есть name) проходит без запроса', async () => {
    const { result } = await renderHook(() => useUserPointDetail(full(5)))
    expect(result.current.hydrating).toBe(false)
    await flush()
    expect(mockGetByIds).not.toHaveBeenCalled()
  })

  it('поля пина новее карточки: цвет/статус/координаты берутся из пина', async () => {
    userPointDetailsStore.upsert(full(3, { color: 'red', status: 'planning' }))
    const { result } = await renderHook(() => useUserPointDetail(pin(3, { color: 'green', status: 'visited' })))
    expect(result.current.hydrating).toBe(false)
    expect(result.current.point.color).toBe('green')
    expect(result.current.point.status).toBe('visited')
    expect(result.current.point.name).toBe('Point 3')
    expect(mockGetByIds).not.toHaveBeenCalled()
  })

  it('patch/remove/clear меняют карточки без перезапроса, failed помечает упавший запрос', async () => {
    userPointDetailsStore.upsert(full(7))
    userPointDetailsStore.patch([7, 8], { color: 'black' })
    expect(userPointDetailsStore.get(7)?.color).toBe('black')
    userPointDetailsStore.remove([7])
    expect(userPointDetailsStore.get(7)).toBeUndefined()

    mockGetByIds.mockRejectedValueOnce(new Error('network'))
    const { result } = await renderHook(() => useUserPointDetail(pin(9)))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.hydrating).toBe(true)

    // Повторный ensure после обрыва снова идёт на сервер.
    await act(async () => {
      userPointDetailsStore.ensure([9])
      await flush()
    })
    await waitFor(() => expect(result.current.hydrating).toBe(false))
    expect(mockGetByIds).toHaveBeenCalledTimes(2)

    userPointDetailsStore.clear()
    expect(userPointDetailsStore.get(9)).toBeUndefined()
  })

  it('после clear() смонтированная карточка заказывает запись заново, а не остаётся каркасом', async () => {
    const { result } = await renderHook(() => useUserPointDetail(pin(21)))
    await waitFor(() => expect(result.current.hydrating).toBe(false))
    expect(mockGetByIds).toHaveBeenCalledTimes(1)

    await act(async () => {
      userPointDetailsStore.clear()
    })
    await waitFor(() => expect(mockGetByIds).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.hydrating).toBe(false))
  })

  it('упавший запрос store повторяет сам, без нового ensure', async () => {
    jest.useFakeTimers()
    try {
      mockGetByIds.mockRejectedValueOnce(new Error('network'))
      const { result } = await renderHook(() => useUserPointDetail(pin(31)))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60)
      })
      expect(result.current.failed).toBe(true)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2100)
      })
      expect(mockGetByIds).toHaveBeenCalledTimes(2)
      expect(result.current.hydrating).toBe(false)
      expect(result.current.failed).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it('пока летит первый чанк, ensure id второго чанка не дублирует запрос', async () => {
    const releases: Array<() => void> = []
    mockGetByIds.mockImplementation(
      (ids: number[]) => new Promise((resolve) => releases.push(() => resolve(ids.map((id) => full(id))))),
    )
    const ids = Array.from({ length: 70 }, (_, i) => 100 + i)
    userPointDetailsStore.ensure(ids)
    await flush()
    expect(mockGetByIds).toHaveBeenCalledTimes(1)
    userPointDetailsStore.ensure([169])
    await flush()
    expect(mockGetByIds).toHaveBeenCalledTimes(1)
    await act(async () => {
      releases.shift()?.()
      await flush()
    })
    expect(mockGetByIds).toHaveBeenCalledTimes(2)
    expect(mockGetByIds.mock.calls[1][0]).toContain(169)
    await act(async () => {
      releases.shift()?.()
      await flush()
    })
    expect(userPointDetailsStore.get(169)?.name).toBe('Point 169')
  })

  it('id, которого сервер не вернул, помечается gone: пин без каркаса, onMissing уведомляет один раз', async () => {
    mockGetByIds.mockImplementation(async (ids: number[]) => ids.filter((id) => id !== 21).map((id) => full(id)))
    const missing: number[][] = []
    const off = userPointDetailsStore.onMissing((ids) => missing.push(ids))
    const okCard = await renderHook(() => useUserPointDetail(pin(20)))
    const goneCard = await renderHook(() => useUserPointDetail(pin(21)))
    await waitFor(() => expect(okCard.result.current.hydrating).toBe(false))
    await waitFor(() => expect(goneCard.result.current.hydrating).toBe(false))
    expect(goneCard.result.current.failed).toBe(false)
    expect((goneCard.result.current.point as any).name).toBeUndefined()
    expect(missing).toEqual([[21]])
    expect(userPointDetailsStore.isGone(21)).toBe(true)
    // Повторный ensure исчезнувшей точки в сеть не ходит.
    userPointDetailsStore.ensure([21])
    await flush()
    expect(mockGetByIds).toHaveBeenCalledTimes(1)
    off()
  })

  it('пин с name (#3185) всё равно гидратируется: признак полной записи — поля карточки, не name', async () => {
    const { result } = await renderHook(() => useUserPointDetail(pin(30, { name: 'Озеро' })))
    expect(result.current.hydrating).toBe(true)
    await waitFor(() => expect(result.current.hydrating).toBe(false))
    expect(result.current.point.address).toBe('Addr 30')
  })

  it('смена владельца стирает карточки и не кладёт ответ прежнего владельца', async () => {
    let release: (() => void) | null = null
    mockGetByIds.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([full(11)])
        }),
    )
    const { result } = await renderHook(() => useUserPointDetail(pin(11)))
    await flush()
    act(() => userPointDetailsStore.setOwner('2'))
    release?.()
    await flush()
    expect(userPointDetailsStore.get(11)).toBeUndefined()
    expect(result.current.hydrating).toBe(true)
  })
})
