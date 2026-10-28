// 1.2(d), TestFlight 1.0.5 (12): блок автора всех загруженных карточек каталога.
// Клиентский guard нужен и при анонимном fallback публичного чтения, когда
// сервер не может применить блокировки сессии. Первая страница целиком от
// автора: после вырезки она пуста, и лента обязана догрузить следующую,
// а не показать «пусто». Session transport проверяется отдельным API-тестом.
import React, { forwardRef, useImperativeHandle } from 'react'
import { act, render, renderHook, waitFor } from '@testing-library/react-native'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'

let mockOwner: string | null = '242'
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => mockOwner }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  blockUser: jest.fn(() => Promise.resolve()),
  unblockUser: jest.fn(() => Promise.resolve()),
  reportContent: jest.fn(),
  fetchReportReasons: jest.fn(() => Promise.resolve([])),
  fetchBlockedUsers: jest.fn(() => new Promise(() => {})),
}))
jest.mock('@/api/travelListQueries', () => ({
  fetchTravels: jest.fn(),
  fetchRandomTravels: jest.fn(),
}))

import { useListTravelData, useRandomTravelData, type UseListTravelDataReturn } from '@/components/listTravel/hooks/useListTravelData'
import { fetchTravels, fetchRandomTravels } from '@/api/travelListQueries'
import { useBlockUser, useUnblockUser } from '@/hooks/useUserSafety'
import { applyAuthorBlock, installBlockedAuthorGuard, resetBlockedAuthorStateForTests } from '@/api/blockSensitiveQueries'
import { queryKeys } from '@/api/queryKeys'

const AUTHOR = 1
const PER_PAGE = 20
const TOTAL = 429

// Прод 13.10.2026: первые 20 карточек `sort=newest` — от user 1 (у него 338 из 429).
// Здесь две первые страницы целиком от автора, на третьей одна чужая карточка.
const VISIBLE_ID = 50
const travelAt = (index: number) => ({
  id: index + 1,
  title: `Travel ${index + 1}`,
  userIds: index + 1 === VISIBLE_ID || index >= 60 ? '2' : String(AUTHOR),
})

const serveCatalog = () =>
  (fetchTravels as jest.Mock).mockImplementation(async (page: number) => ({
    data: Array.from({ length: PER_PAGE }, (_, i) => travelAt(page * PER_PAGE + i)),
    total: TOTAL,
  }))

type HarnessProps = { enabled: boolean }

const renders: UseListTravelDataReturn[] = []

const Catalog = forwardRef<UseListTravelDataReturn, HarnessProps>(({ enabled }, ref) => {
  const hook = useListTravelData({ queryParams: { sort: 'newest' }, search: '', isQueryEnabled: enabled })
  renders.push(hook)
  useImperativeHandle(ref, () => hook)
  return null
})
Catalog.displayName = 'CatalogHarness'

const setup = async (enabled = true) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  const stop = installBlockedAuthorGuard(qc, { getOwner: () => mockOwner })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const ref = React.createRef<UseListTravelDataReturn>()
  const view = await render(<Catalog ref={ref} enabled={enabled} />, { wrapper })
  const current = () => ref.current as UseListTravelDataReturn
  return { qc, stop, wrapper, view, current, ref }
}

const ids = (list: UseListTravelDataReturn) => list.data.map((travel) => Number(travel.id))

beforeEach(() => {
  renders.length = 0
  mockOwner = '242'
  jest.clearAllMocks()
  resetBlockedAuthorStateForTests()
  serveCatalog()
})

afterEach(() => onlineManager.setOnline(true))

describe('catalog after blocking the author of every loaded card', () => {
  it('isolates guest and signed catalog caches on login and logout', async () => {
    mockOwner = null
    ;(fetchTravels as jest.Mock).mockImplementation(async () => ({
      data: [{ id: mockOwner === null ? 1 : 2, userIds: mockOwner === null ? '1' : '2' }],
      total: 1,
    }))
    const { qc, stop, current, view, ref } = await setup()
    await waitFor(() => expect(ids(current())).toEqual([1]))
    mockOwner = '242'
    await view.rerender(<Catalog ref={ref} enabled />)
    await waitFor(() => expect(ids(current())).toEqual([2]))
    const owners = qc.getQueryCache().findAll({ queryKey: queryKeys.travels() })
      .map((query) => (query.queryKey[1] as { owner: string | null }).owner)
    expect(owners).toEqual(expect.arrayContaining([null, '242']))

    mockOwner = null
    await view.rerender(<Catalog ref={ref} enabled />)
    await waitFor(() => expect(ids(current())).toEqual([1]))
    expect(current().data.some((travel) => travel.id === 2)).toBe(false)
    stop()
  })

  it('loads the next pages instead of showing the empty state', async () => {
    const { stop, wrapper, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))

    const { result } = await renderHook(() => useBlockUser(), { wrapper })
    await act(() => result.current.mutate(AUTHOR))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await waitFor(() => expect(ids(current())).toEqual([VISIBLE_ID]))
    expect(current().isEmpty).toBe(false)
    expect(current().hasMore).toBe(true)
    // Из общего счётчика убираем скрытое во всех трёх загруженных страницах.
    expect(current().total).toBe(TOTAL - (3 * PER_PAGE - 1))
    expect((fetchTravels as jest.Mock).mock.calls.map(([page]) => page)).toEqual(expect.arrayContaining([1, 2]))
    stop()
  })

  it('shows loading, never the empty state, while pages emptied by the block are replaced', async () => {
    const { stop, wrapper, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    const from = renders.length
    const { result } = await renderHook(() => useBlockUser(), { wrapper })

    await act(() => result.current.mutate(AUTHOR))
    await waitFor(() => expect(ids(current())).toEqual([VISIBLE_ID]))

    const afterBlock = renders.slice(from)
    expect(afterBlock.some((hook) => hook.isEmpty)).toBe(false)
    afterBlock
      .filter((hook) => hook.data.length === 0)
      .forEach((hook) => expect(hook.isInitialLoading).toBe(true))
    stop()
  })

  it('shows the empty state once the feed ends with nothing visible', async () => {
    ;(fetchTravels as jest.Mock).mockImplementation(async (page: number) => ({
      data: page < 2 ? Array.from({ length: PER_PAGE }, (_, i) => travelAt(page * PER_PAGE + i)) : [],
      total: 2 * PER_PAGE,
    }))
    const { stop, wrapper, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    const { result } = await renderHook(() => useBlockUser(), { wrapper })

    await act(() => result.current.mutate(AUTHOR))
    await waitFor(() => expect(current().isEmpty).toBe(true))
    expect(current().hasMore).toBe(false)
    expect(current().data).toEqual([])
    expect(current().total).toBe(0)
    stop()
  })

  it('stops at the server total when all pages are hidden', async () => {
    ;(fetchTravels as jest.Mock).mockImplementation(async (page: number) => ({
      data: page < 2 ? Array.from({ length: PER_PAGE }, (_, i) => travelAt(page * PER_PAGE + i)) : [],
      total: 2 * PER_PAGE,
    }))
    const { qc, stop, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    await act(() => applyAuthorBlock(qc, AUTHOR))
    await waitFor(() => expect(current().isEmpty).toBe(true))
    expect((fetchTravels as jest.Mock).mock.calls.map(([page]) => page)).toEqual([0, 1])
    stop()
  })

  it('blocks and unblocks the sole card without refetching beyond the end', async () => {
    ;(fetchTravels as jest.Mock).mockResolvedValue({ data: [travelAt(0)], total: 1 })
    const { stop, wrapper, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(1))
    const { result: block } = await renderHook(() => useBlockUser(), { wrapper })
    await act(() => block.current.mutate(AUTHOR))
    await waitFor(() => expect(block.current.isSuccess).toBe(true))
    await waitFor(() => expect(current().isEmpty).toBe(true))
    expect(current().hasMore).toBe(false)
    expect(current().total).toBe(0)
    expect((fetchTravels as jest.Mock).mock.calls.every(([page]) => page === 0)).toBe(true)

    const { result: unblock } = await renderHook(() => useUnblockUser(), { wrapper })
    await act(() => unblock.current.mutate(AUTHOR))
    await waitFor(() => expect(current().data).toHaveLength(1))
    expect(current().total).toBe(1)
    stop()
  })

  it('does not advance a genuinely empty server feed', async () => {
    ;(fetchTravels as jest.Mock).mockResolvedValue({ data: [], total: 0 })
    const { qc, stop, current } = await setup()
    await waitFor(() => expect(current().isEmpty).toBe(true))
    await act(() => applyAuthorBlock(qc, AUTHOR))
    expect(current().hasMore).toBe(false)
    expect(fetchTravels).toHaveBeenCalledTimes(1)
    stop()
  })

  it('preserves other authors and stops pagination after a partial-page block', async () => {
    ;(fetchTravels as jest.Mock).mockImplementation(async (page: number) => ({
      data: Array.from({ length: PER_PAGE }, (_, index) => ({
        id: page * PER_PAGE + index + 1,
        userIds: page === 0 && index === 0 ? String(AUTHOR) : '2',
      })),
      total: 2 * PER_PAGE,
    }))
    const { qc, stop, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    await act(() => applyAuthorBlock(qc, AUTHOR))
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE - 1))
    expect(fetchTravels).toHaveBeenCalledTimes(1)
    await act(() => current().handleEndReached())
    await waitFor(() => expect(current().data).toHaveLength(2 * PER_PAGE - 1))
    expect(current().hasMore).toBe(false)
    expect(current().total).toBe(2 * PER_PAGE - 1)
    stop()
  })

  it('reports a failed replacement-page fetch instead of spinning or claiming an empty feed', async () => {
    ;(fetchTravels as jest.Mock).mockImplementation(async (page: number) => {
      if (page > 0) throw new Error('Offline')
      return { data: Array.from({ length: PER_PAGE }, (_, index) => travelAt(index)), total: TOTAL }
    })
    const { qc, stop, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    await act(() => applyAuthorBlock(qc, AUTHOR))
    await waitFor(() => expect(current().isError).toBe(true))
    expect(current().isEmpty).toBe(false)
    expect(current().isInitialLoading).toBe(false)
    expect(fetchTravels).toHaveBeenCalledTimes(2)
    stop()
  })

  it('reports offline replacement-page loading and recovers when the connection returns', async () => {
    const { qc, stop, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    await act(() => {
      onlineManager.setOnline(false)
      applyAuthorBlock(qc, AUTHOR)
    })
    await waitFor(() => expect(current().isError).toBe(true))
    expect(current().isEmpty).toBe(false)
    expect(current().isInitialLoading).toBe(false)
    expect(fetchTravels).toHaveBeenCalledTimes(1)
    await act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(ids(current())).toEqual([VISIBLE_ID]))
    expect(current().isError).toBe(false)
    stop()
  })

  it('waits for a hidden catalog to become enabled before advancing its emptied page', async () => {
    const { qc, stop, current, view, ref } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    await view.rerender(<Catalog ref={ref} enabled={false} />)
    await act(() => applyAuthorBlock(qc, AUTHOR))
    await act(async () => { await Promise.resolve() })
    expect(fetchTravels).toHaveBeenCalledTimes(1)

    await view.rerender(<Catalog ref={ref} enabled />)
    await waitFor(() => expect(ids(current())).toEqual([VISIBLE_ID]))
    expect(current().isEmpty).toBe(false)
    stop()
  })

  it.each([false, true])('finishes a manual roulette spin across hidden pages (all hidden: %s)', async (allHidden) => {
    ;(fetchRandomTravels as jest.Mock).mockImplementation(async (page: number) => ({
      data: page < 2 ? Array.from({ length: PER_PAGE }, (_, i) => travelAt(page * PER_PAGE + i))
        : allHidden ? [] : [{ id: VISIBLE_ID, userIds: '2' }],
      total: allHidden ? 2 * PER_PAGE : 2 * PER_PAGE + 1,
    }))
    const { qc, stop, wrapper } = await setup(false)
    await act(() => applyAuthorBlock(qc, AUTHOR))
    const { result } = await renderHook(() => useRandomTravelData({ queryParams: {}, search: '', isQueryEnabled: false }), { wrapper })
    expect(fetchRandomTravels).not.toHaveBeenCalled()

    let response: Awaited<ReturnType<UseListTravelDataReturn['refetch']>>
    await act(async () => { response = await result.current.refetch() })
    expect((fetchRandomTravels as jest.Mock).mock.calls.map(([page]) => page)).toEqual(allHidden ? [0, 1] : [0, 1, 2])
    expect(response!.data.pages.flatMap((page: { data: unknown[] }) => page.data)).toHaveLength(allHidden ? 0 : 1)
    await waitFor(() => {
      expect(ids(result.current)).toEqual(allHidden ? [] : [VISIBLE_ID])
      expect(result.current.isEmpty).toBe(allHidden)
      expect(result.current.isInitialLoading).toBe(false)
    })
    stop()
  })

  it('returns a manual roulette replacement error without reporting an empty feed', async () => {
    ;(fetchRandomTravels as jest.Mock).mockImplementation(async (page: number) => {
      if (page > 0) throw new Error('Offline')
      return { data: Array.from({ length: PER_PAGE }, (_, i) => travelAt(i)), total: TOTAL }
    })
    const { qc, stop, wrapper } = await setup(false)
    await act(() => applyAuthorBlock(qc, AUTHOR))
    const { result } = await renderHook(() => useRandomTravelData({ queryParams: {}, search: '', isQueryEnabled: false }), { wrapper })
    await act(async () => { await result.current.refetch() })
    expect((fetchRandomTravels as jest.Mock).mock.calls.map(([page]) => page)).toEqual([0, 1])
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.isEmpty).toBe(false)
    expect(result.current.isInitialLoading).toBe(false)
    stop()
  })

  it('returns the cards after unblocking without a reload', async () => {
    const { qc, stop, wrapper, current, view } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    const { result: block } = await renderHook(() => useBlockUser(), { wrapper })
    await act(() => block.current.mutate(AUTHOR))
    await waitFor(() => expect(ids(current())).toEqual([VISIBLE_ID]))
    qc.setQueryData(queryKeys.myBlockedUsers('242'), [{ id: 900, user: AUTHOR }])

    // Разблокировка с другого экрана: каталог на фоне (`enabled={isFocused}`).
    await view.rerender(<Catalog ref={React.createRef()} enabled={false} />)
    const { result: unblock } = await renderHook(() => useUnblockUser(), { wrapper })
    await act(() => unblock.current.mutate(AUTHOR))
    await waitFor(() => expect(unblock.current.isSuccess).toBe(true))

    const ref = React.createRef<UseListTravelDataReturn>()
    await view.rerender(<Catalog ref={ref} enabled />)
    await waitFor(() => expect(ref.current?.data.length).toBeGreaterThanOrEqual(PER_PAGE))
    expect(ref.current?.data[0]).toMatchObject({ id: 1 })
    expect(ref.current?.total).toBe(TOTAL)
    expect(ref.current?.isEmpty).toBe(false)
    stop()
  })

  it('returns the cards after unblocking while the catalog stays on screen', async () => {
    const { qc, stop, wrapper, current } = await setup()
    await waitFor(() => expect(current().data).toHaveLength(PER_PAGE))
    const { result: block } = await renderHook(() => useBlockUser(), { wrapper })
    await act(() => block.current.mutate(AUTHOR))
    await waitFor(() => expect(ids(current())).toEqual([VISIBLE_ID]))
    qc.setQueryData(queryKeys.myBlockedUsers('242'), [{ id: 900, user: AUTHOR }])

    const { result: unblock } = await renderHook(() => useUnblockUser(), { wrapper })
    await act(() => unblock.current.mutate(AUTHOR))
    await waitFor(() => expect(unblock.current.isSuccess).toBe(true))

    await waitFor(() => expect(current().data[0]).toMatchObject({ id: 1 }))
    expect(current().total).toBe(TOTAL)
    expect(current().isEmpty).toBe(false)
    stop()
  })
})
