import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/userPoints', () => {
  const getPoints = jest.fn()
  return {
    userPointsApi: {
      getPoints,
      // Mirror the real implementation: delegate to getPoints and derive hasMore.
      getPointsPage: jest.fn(async (page: number, perPage: number) => {
        const items = await getPoints({ page, perPage })
        return { items, hasMore: items.length >= perPage, total: (getPoints as any).total }
      }),
    },
  }
})

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({ categoryTravelAddress: [] })),
}))

jest.mock('@/utils/logger', () => ({ logError: jest.fn(), logWarn: jest.fn(), logInfo: jest.fn() }))

const { userPointsApi } = require('@/api/userPoints')
const mockGetPoints = userPointsApi.getPoints as jest.Mock

import { queryKeys } from '@/api/queryKeys'
import { readPointsPaginationState } from '@/api/userPointsCollectionCache'
import {
  STREAM_CONCURRENCY,
  mergeFirstPageIntoCollection,
  usePointsDataModel,
} from '@/components/UserPoints/usePointsDataModel'

const PER_PAGE = 200

const makePoints = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: from + i,
    name: `P${from + i}`,
    latitude: 1,
    longitude: 2,
    color: 'blue',
    status: 'planning',
  }))

/** Сервер с `TOTAL` точками и честным `count`: страница N — срез коллекции. */
const serveCollection = (total: number) => {
  ;(mockGetPoints as any).total = total
  mockGetPoints.mockImplementation(async ({ page }: { page: number }) => {
    const offset = (page - 1) * PER_PAGE
    return makePoints(offset + 1, Math.max(0, Math.min(PER_PAGE, total - offset)))
  })
}

const pagesRequested = () =>
  mockGetPoints.mock.calls.map(([args]: [{ page: number }]) => args.page).sort((a: number, b: number) => a - b)

const renderModel = async (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const rendered = await renderHook(
    () =>
      usePointsDataModel({
        defaultPerPage: PER_PAGE,
        filters: { page: 1, perPage: PER_PAGE, radiusKm: 100 } as any,
        searchQuery: '',
        currentLocation: null,
        defaultPointColors: ['blue'],
      }),
    { wrapper }
  )
  return { ...rendered, client }
}

describe('usePointsDataModel incremental streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockGetPoints as any).total = undefined
  })

  it('requests the first page with perPage=200', async () => {
    serveCollection(10)

    await renderModel()

    await waitFor(() => {
      expect(mockGetPoints).toHaveBeenCalledWith({ page: 1, perPage: PER_PAGE })
    })
  })

  it('does not fetch a second page when the first page is short', async () => {
    serveCollection(42)

    const { result } = await renderModel()

    await waitFor(() => {
      expect(result.current.points).toHaveLength(42)
    })

    // Give any background effect a chance to run.
    await new Promise((r) => setTimeout(r, 20))

    expect(mockGetPoints).toHaveBeenCalledTimes(1)
    expect(mockGetPoints).not.toHaveBeenCalledWith({ page: 2, perPage: PER_PAGE })
  })

  it('streams the tail in parallel by count and writes the collection once (#3130)', async () => {
    const TOTAL = PER_PAGE * 2 + 30 // 3 pages
    ;(mockGetPoints as any).total = TOTAL
    // Pages 2 and 3 resolve only once BOTH were requested: a sequential stream
    // would deadlock here and the test would time out.
    let tailRequested = 0
    let releaseTail: () => void = () => {}
    const tailGate = new Promise<void>((resolve) => {
      releaseTail = resolve
    })
    mockGetPoints.mockImplementation(async ({ page }: { page: number }) => {
      if (page > 1) {
        tailRequested += 1
        if (tailRequested === 2) releaseTail()
        await tailGate
      }
      const offset = (page - 1) * PER_PAGE
      return makePoints(offset + 1, Math.max(0, Math.min(PER_PAGE, TOTAL - offset)))
    })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const lengths: number[] = []
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey[0] === 'userPointsAll' && event.query.queryKey.length === 2) {
        const data = event.query.state.data
        if (Array.isArray(data)) lengths.push(data.length)
      }
    })
    const { result } = await renderModel(client)
    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL)
    })
    unsubscribe()

    expect(pagesRequested()).toEqual([1, 2, 3])
    // Коллекция не растёт по одной странице: после первой страницы в кэш уходит один снимок.
    expect(new Set(lengths)).toEqual(new Set([PER_PAGE, TOTAL]))
    expect(result.current.loadProgress).toEqual({ loaded: TOTAL, total: TOTAL, complete: true, failed: false })
  })

  it('splits a long tail into batches of STREAM_CONCURRENCY pages', async () => {
    const PAGES = STREAM_CONCURRENCY + 3 // 1 first page + 8 tail pages = 2 batches
    const TOTAL = PER_PAGE * PAGES - 5
    serveCollection(TOTAL)

    const { result } = await renderModel()
    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL)
    })

    expect(pagesRequested()).toEqual(Array.from({ length: PAGES }, (_, i) => i + 1))
    expect(mockGetPoints).toHaveBeenCalledTimes(PAGES)
  })

  it('does not stream at all when the backend ignores perPage (#752)', async () => {
    // Backend returns the whole oversized set for page 1.
    mockGetPoints.mockResolvedValue(makePoints(1, PER_PAGE * 2))

    const { result } = await renderModel()

    await waitFor(() => {
      expect(result.current.points).toHaveLength(PER_PAGE * 2)
    })

    await new Promise((r) => setTimeout(r, 20))

    // Oversized first page = full set already loaded -> no background pages.
    expect(mockGetPoints).toHaveBeenCalledTimes(1)
    expect(mockGetPoints).not.toHaveBeenCalledWith({ page: 2, perPage: PER_PAGE })
  })

  it('stops after the first batch when pages add zero new ids and count is unknown', async () => {
    // Page 1 looks properly paginated, but every page repeats the same items and
    // the server sends no count.
    mockGetPoints.mockImplementation(async () => makePoints(1, PER_PAGE))

    const { result } = await renderModel()

    await waitFor(() => {
      expect(result.current.points).toHaveLength(PER_PAGE)
    })
    await waitFor(() => {
      expect(result.current.loadProgress.complete).toBe(true)
    })

    // One speculative batch, then stop: no page beyond 1 + STREAM_CONCURRENCY.
    expect(mockGetPoints).toHaveBeenCalledTimes(1 + STREAM_CONCURRENCY)
    expect(mockGetPoints).not.toHaveBeenCalledWith({ page: 2 + STREAM_CONCURRENCY, perPage: PER_PAGE })
  })

  it('marks the stream failed on a broken page and resumes on retry (#3130)', async () => {
    const TOTAL = PER_PAGE * 2 + 30
    ;(mockGetPoints as any).total = TOTAL
    let broken = true
    mockGetPoints.mockImplementation(async ({ page }: { page: number }) => {
      if (page === 3 && broken) throw new Error('network down')
      const offset = (page - 1) * PER_PAGE
      return makePoints(offset + 1, Math.max(0, Math.min(PER_PAGE, TOTAL - offset)))
    })

    const { result, client } = await renderModel()

    await waitFor(() => {
      expect(result.current.loadProgress.failed).toBe(true)
    })
    // Префикс остаётся на экране, но полным не считается (#1709).
    expect(result.current.points).toHaveLength(PER_PAGE)
    expect(result.current.loadProgress.complete).toBe(false)
    expect(result.current.loadProgress.total).toBe(TOTAL)
    expect(readPointsPaginationState(client, null)).toMatchObject({ complete: false, failed: true, nextPage: 2 })
    const callsBeforeRetry = mockGetPoints.mock.calls.length

    broken = false
    await act(async () => {
      result.current.resumeStream()
    })

    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL)
    })
    expect(result.current.loadProgress).toEqual({ loaded: TOTAL, total: TOTAL, complete: true, failed: false })
    // Повтор качает только хвост — первая страница не перечитывается.
    expect(mockGetPoints.mock.calls.length - callsBeforeRetry).toBe(2)
    expect(mockGetPoints).not.toHaveBeenNthCalledWith(callsBeforeRetry + 1, { page: 1, perPage: PER_PAGE })
  })

  it('restarts the stream after invalidateQueries without a remount (#3130 1а)', async () => {
    const TOTAL = PER_PAGE + 30
    serveCollection(TOTAL)

    const { result, client } = await renderModel()
    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL)
    })
    const callsBefore = mockGetPoints.mock.calls.length

    // Импорт добавил точки: коллекция выросла на сервере.
    serveCollection(TOTAL + 40)
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.userPointsAll(null) })
    })

    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL + 40)
    })
    expect(result.current.loadProgress).toEqual({ loaded: TOTAL + 40, total: TOTAL + 40, complete: true, failed: false })
    expect(mockGetPoints.mock.calls.length - callsBefore).toBe(2)
  })

  it('keeps the streamed tail on a page-1 refetch instead of shrinking the screen', async () => {
    const TOTAL = PER_PAGE + 30
    serveCollection(TOTAL)

    const { result, client } = await renderModel()
    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL)
    })

    const lengths: number[] = []
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey[0] === 'userPointsAll' && event.query.queryKey.length === 2) {
        const data = event.query.state.data
        if (Array.isArray(data)) lengths.push(data.length)
      }
    })
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.userPointsAll(null), exact: true })
    })
    await waitFor(() => {
      expect(result.current.loadProgress.complete).toBe(true)
    })
    unsubscribe()

    expect(Math.min(...lengths)).toBe(TOTAL)
  })

  it('keeps an optimistic write made while the tail is in flight (#3130 review)', async () => {
    const TOTAL = PER_PAGE + 30
    ;(mockGetPoints as any).total = TOTAL
    let releaseTail: () => void = () => {}
    const tailGate = new Promise<void>((resolve) => {
      releaseTail = resolve
    })
    mockGetPoints.mockImplementation(async ({ page }: { page: number }) => {
      if (page > 1) await tailGate
      const offset = (page - 1) * PER_PAGE
      return makePoints(offset + 1, Math.max(0, Math.min(PER_PAGE, TOTAL - offset)))
    })

    const { result, client } = await renderModel()
    await waitFor(() => {
      expect(pagesRequested()).toContain(2)
    })
    // usePointsManualForm: созданная точка встаёт ПЕРЕД страницей 1.
    const created = { ...makePoints(9999, 1)[0] }
    await act(async () => {
      client.setQueryData(queryKeys.userPointsAll(null), (prev: any[] = []) => [created, ...prev])
    })
    await act(async () => {
      releaseTail()
    })

    await waitFor(() => {
      expect(result.current.loadProgress.complete).toBe(true)
    })
    const ids = result.current.points.map((p: any) => p.id)
    expect(ids).toHaveLength(TOTAL + 1)
    expect(ids).toContain(9999)
    // Последняя точка страницы 1 не выпадает из снимка.
    expect(ids).toContain(PER_PAGE)
  })

  it('drops tail points deleted elsewhere on a page-1 refetch', async () => {
    const TOTAL = PER_PAGE + 30
    serveCollection(TOTAL)

    const { result, client } = await renderModel()
    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL)
    })

    // Точку хвоста удалили на другом устройстве.
    ;(mockGetPoints as any).total = TOTAL - 1
    mockGetPoints.mockImplementation(async ({ page }: { page: number }) => {
      const all = makePoints(1, TOTAL).filter((p) => p.id !== PER_PAGE + 5)
      return all.slice((page - 1) * PER_PAGE, page * PER_PAGE)
    })
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.userPointsAll(null), exact: true })
    })
    await waitFor(() => {
      expect(result.current.points).toHaveLength(TOTAL - 1)
    })
    expect(result.current.points.map((p: any) => p.id)).not.toContain(PER_PAGE + 5)
  })
})

describe('mergeFirstPageIntoCollection', () => {
  it('returns the fresh page when the cache is empty or not longer than the page', () => {
    const page = makePoints(1, 3)
    expect(mergeFirstPageIntoCollection(undefined, page)).toBe(page)
    expect(mergeFirstPageIntoCollection(makePoints(1, 3), page)).toBe(page)
  })

  it('puts the fresh page first and keeps the tail without duplicating ids', () => {
    const previous = [...makePoints(1, 3), ...makePoints(4, 3)]
    const fresh = [{ ...previous[1], name: 'renamed' }, previous[0], { id: 99, name: 'new' } as any]
    const merged = mergeFirstPageIntoCollection(previous as any, fresh as any)
    expect(merged.map((p) => p.id)).toEqual([2, 1, 99, 3, 4, 5, 6])
    expect(merged[0].name).toBe('renamed')
  })
})
