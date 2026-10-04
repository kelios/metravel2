// #2134: блок — оптимистичный вырез, откат при ошибке, инвалидация реестра;
// разблокировка — мгновенное снятие из списка и возврат контента.
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => '1' }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  reportUser: jest.fn(),
  fetchReportReasons: jest.fn(() => Promise.resolve([])),
  fetchBlockedUsers: jest.fn(() => new Promise(() => {})),
}))

import { useBlockUser, useUnblockUser } from '@/hooks/useUserSafety'
import { blockUser, unblockUser } from '@/api/userSafety'
import {
  installBlockedAuthorGuard,
  resetBlockedAuthorStateForTests,
} from '@/api/blockSensitiveQueries'
import { queryKeys } from '@/api/queryKeys'
import { showToast } from '@/utils/toast'

const BLOCKED = 7
const nearKey = queryKeys.travelsNear(1)
const profileKey = queryKeys.userProfile(String(BLOCKED))
const blockedKey = queryKeys.myBlockedUsers('1')
const articlesKey = ['articles', { page: 1 }]
const favoritesKey = queryKeys.favorites('1')

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  const stop = installBlockedAuthorGuard(qc, { getOwner: () => '1' })
  qc.setQueryData(nearKey, [{ id: 1, userIds: '7' }, { id: 2, userIds: '3' }])
  qc.setQueryData(profileKey, { user: BLOCKED, is_blocked_by_me: false })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, stop, wrapper }
}

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  jest.clearAllMocks()
  resetBlockedAuthorStateForTests()
})

describe('useBlockUser', () => {
  it('hides the author before the server answers and invalidates the registry on settle', async () => {
    const { qc, stop, wrapper } = setup()
    qc.setQueryData(articlesKey, { data: [{ id: 5 }], total: 1 })
    qc.setQueryData(favoritesKey, [{ id: 3 }])
    const request = deferred()
    ;(blockUser as jest.Mock).mockReturnValue(request.promise)
    const invalidate = jest.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useBlockUser(), { wrapper })

    act(() => result.current.mutate(BLOCKED))
    await waitFor(() => expect((qc.getQueryData(nearKey) as any[]).map((t) => t.id)).toEqual([2]))
    expect((qc.getQueryData(profileKey) as any).is_blocked_by_me).toBe(true)
    expect(invalidate).not.toHaveBeenCalled()

    await act(async () => request.resolve())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const invalidatedRoots = invalidate.mock.calls.map(([filters]) => (filters as any)?.queryKey?.[0])
    expect(invalidatedRoots).toEqual(expect.arrayContaining(['travels', 'comments', 'travels-near', 'articles', 'user-blocked']))
    expect(invalidate.mock.calls.every(([filters]) => (filters as any)?.refetchType !== 'all')).toBe(true)
    // Refetch-only копия без наблюдателя сносится; вырезанная лента и офлайн-домен остаются.
    expect(qc.getQueryData(articlesKey)).toBeUndefined()
    expect(qc.getQueryData(favoritesKey)).toEqual([{ id: 3 }])
    expect((qc.getQueryData(nearKey) as any[]).map((t) => t.id)).toEqual([2])

    // Refetch после блока снова принёс автора — guard режет его.
    act(() => {
      qc.setQueryData(nearKey, [{ id: 1, userIds: '7' }, { id: 2, userIds: '3' }])
    })
    expect((qc.getQueryData(nearKey) as any[]).map((t) => t.id)).toEqual([2])
    stop()
  })

  it('rolls the cache back and shows an error toast when the request fails', async () => {
    const { qc, stop, wrapper } = setup()
    qc.setQueryData(articlesKey, { data: [{ id: 5 }], total: 1 })
    ;(blockUser as jest.Mock).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useBlockUser(), { wrapper })

    act(() => result.current.mutate(BLOCKED))
    await waitFor(() => expect(result.current.isError).toBe(true))
    // Сервер ничего не менял: кэш вне экрана не сносится (в том числе без сети).
    expect(qc.getQueryData(articlesKey)).toEqual({ data: [{ id: 5 }], total: 1 })

    expect((qc.getQueryData(nearKey) as any[]).map((t) => t.id)).toEqual([1, 2])
    expect((qc.getQueryData(profileKey) as any).is_blocked_by_me).toBe(false)
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))

    // Откат держится: следующий ответ с автором не режется.
    act(() => {
      qc.setQueryData(nearKey, [{ id: 1, userIds: '7' }])
    })
    expect(qc.getQueryData(nearKey)).toHaveLength(1)
    stop()
  })
})

describe('useUnblockUser', () => {
  it('removes the user from the blocked list at once and refetches or drops stale copies on success', async () => {
    const { qc, stop, wrapper } = setup()
    qc.setQueryData(blockedKey, [{ id: 100, user: BLOCKED }, { id: 101, user: 9 }])
    expect((qc.getQueryData(nearKey) as any[]).map((t) => t.id)).toEqual([2])
    ;(unblockUser as jest.Mock).mockResolvedValue(undefined)
    const invalidate = jest.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUnblockUser(), { wrapper })

    act(() => result.current.mutate(String(BLOCKED)))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(qc.getQueryData(blockedKey)).toEqual([{ id: 101, user: 9 }])
    expect((qc.getQueryData(profileKey) as any).is_blocked_by_me).toBe(false)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['travels'], refetchType: 'active' })
    // Вырезанная копия без наблюдателя сносится, а не перечитывается залпом.
    expect(qc.getQueryData(nearKey)).toBeUndefined()

    act(() => {
      qc.setQueryData(nearKey, [{ id: 1, userIds: '7' }])
    })
    expect(qc.getQueryData(nearKey)).toHaveLength(1)
    stop()
  })

  it('restores the block when unblocking fails', async () => {
    const { qc, stop, wrapper } = setup()
    qc.setQueryData(blockedKey, [{ id: 100, user: BLOCKED }])
    ;(unblockUser as jest.Mock).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useUnblockUser(), { wrapper })

    act(() => result.current.mutate(BLOCKED))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(qc.getQueryData(blockedKey)).toEqual([{ id: 100, user: BLOCKED }])
    expect((qc.getQueryData(profileKey) as any).is_blocked_by_me).toBe(true)
    act(() => {
      qc.setQueryData(nearKey, [{ id: 1, userIds: '7' }])
    })
    expect(qc.getQueryData(nearKey)).toEqual([])
    stop()
  })
})
