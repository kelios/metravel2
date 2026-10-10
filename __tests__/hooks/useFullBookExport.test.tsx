// #2357 F2: жизненный цикл полной книги — готовность сервера, восстановление
// задания из owner job list после перезагрузки, одно задание на двойной клик,
// скачивание только при полном подтверждении.

import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { BookExportCapabilities, BookExportV2Job } from '@/api/bookExportApi'
import { apiClient } from '@/api/client'
import { ApiError } from '@/api/clientErrors'
import {
  isFullBookJobActive,
  isFullBookJobDownloadable,
  useFullBookExport,
} from '@/hooks/useFullBookExport'
import { useFullBookExportStore } from '@/stores/fullBookExportStore'
import { DEFAULT_BOOK_SETTINGS } from '@/types/bookSettings'

jest.mock('@/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
  },
}))

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

let mockOwner: string | null = 'owner-1'
jest.mock('@/hooks/useQueryOwner', () => ({
  useQueryOwner: () => mockOwner,
}))

jest.mock('@/i18n/format', () => ({
  ...jest.requireActual('@/i18n/format'),
  getActiveLocale: () => 'pl',
}))

const mockedGet = apiClient.get as jest.Mock
const mockedPost = apiClient.post as jest.Mock

const readyCapabilities: BookExportCapabilities = {
  contract_versions: [1, 2],
  settings_version: 1,
  renderer_version: 'r1',
  pdf_available: true,
  resumable: true,
  direct_download: true,
  unavailable_reason: null,
}

const makeJob = (overrides: Partial<BookExportV2Job> = {}): BookExportV2Job => ({
  job_id: 'job-1',
  status: 'running',
  stage: 'snapshot',
  counters: {
    travels: { expected: 23, completed: 5 },
    blocks: { expected: null, completed: 0 },
    mediaOccurrences: { expected: null, completed: 40 },
    pages: { expected: null, completed: 0 },
  },
  snapshot_hash: null,
  settings_hash: 's',
  completeness: 'pending',
  error_code: '',
  retryable: false,
  expires_at: null,
  download: null,
  snapshot_state: 'pending',
  artifact_url: null,
  ...overrides,
})

const routeGet = (capabilities: BookExportCapabilities, jobs: BookExportV2Job[], detail = jobs[0]) => {
  mockedGet.mockImplementation((endpoint: string) => {
    if (endpoint === '/exports/books/capabilities/') return Promise.resolve(capabilities)
    if (endpoint.startsWith('/exports/books/?')) return Promise.resolve({ results: jobs, next_cursor: null })
    if (detail && endpoint === `/exports/books/${detail.job_id}/`) return Promise.resolve(detail)
    return Promise.reject(new Error(`unexpected GET ${endpoint}`))
  })
}

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, Wrapper }
}

describe('useFullBookExport', () => {
  beforeEach(() => {
    mockOwner = 'owner-1'
    mockedGet.mockReset()
    mockedPost.mockReset()
    useFullBookExportStore.setState({ byOwner: {} })
  })

  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  it('stays hidden and never lists jobs while the server pipeline is not ready', async () => {
    routeGet({ ...readyCapabilities, pdf_available: false, renderer_version: 'unavailable' }, [makeJob()])
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.capabilityState).toBe('unavailable'))
    expect(result.current.isAvailable).toBe(false)
    expect(mockedGet).toHaveBeenCalledTimes(1)
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('restores the latest owner job after reload without creating a new one', async () => {
    routeGet(readyCapabilities, [makeJob()])
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.job?.job_id).toBe('job-1'))
    expect(mockedGet).toHaveBeenCalledWith('/exports/books/?page_size=1')
    expect(result.current.job?.counters.travels).toEqual({ expected: 23, completed: 5 })
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('hides a finished job the owner dismissed and keeps the preference per owner', async () => {
    routeGet(readyCapabilities, [makeJob({ status: 'cancelled', stage: 'snapshot' })])
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.job?.status).toBe('cancelled'))

    act(() => result.current.dismiss())

    await waitFor(() => expect(result.current.job).toBeNull())
    expect(useFullBookExportStore.getState().byOwner['owner-1']?.dismissedJobId).toBe('job-1')
  })

  it('reports a job that disappeared on the server and lets the owner hide it', async () => {
    const listed = makeJob()
    mockedGet.mockImplementation((endpoint: string) => {
      if (endpoint === '/exports/books/capabilities/') return Promise.resolve(readyCapabilities)
      if (endpoint.startsWith('/exports/books/?')) return Promise.resolve({ results: [listed], next_cursor: null })
      return Promise.reject(new ApiError(404, 'Not found'))
    })
    const { client, Wrapper } = createWrapper()
    const { result } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.job?.job_id).toBe('job-1'))

    await act(async () => {
      await client.refetchQueries({ queryKey: ['full-book-export', 'owner-1', 'job', 'job-1'] })
    })
    await waitFor(() => expect(result.current.isJobMissing).toBe(true))

    act(() => result.current.dismiss())
    await waitFor(() => expect(result.current.isJobMissing).toBe(false))
    expect(result.current.job).toBeNull()
  })

  it('creates exactly one job when the build is started twice in a row', async () => {
    routeGet(readyCapabilities, [])
    mockedPost.mockImplementation((endpoint: string) => {
      if (endpoint === '/exports/books/selections/') {
        return Promise.resolve({ selection_id: 'sel-1', state: 'draft', travel_count: 23, next_sequence: 1 })
      }
      if (endpoint === '/exports/books/selections/sel-1/finalize/') {
        return Promise.resolve({ selection_id: 'sel-1', state: 'finalized', travel_count: 23, selection_hash: 'h' })
      }
      if (endpoint === '/exports/books/') {
        return Promise.resolve({ job_id: 'job-new', status: 'queued', settings_hash: 's' })
      }
      return Promise.reject(new Error(`unexpected POST ${endpoint}`))
    })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isAvailable).toBe(true))

    act(() => result.current.findPeriod({ yearFrom: 2012, yearTo: 2013 }))
    await waitFor(() => expect(result.current.draft?.travelCount).toBe(23))
    expect(useFullBookExportStore.getState().byOwner['owner-1']).toMatchObject({ yearFrom: 2012, yearTo: 2013 })

    const settings = { ...DEFAULT_BOOK_SETTINGS, title: 'Архив', sortOrder: 'date-asc' as const }
    await act(async () => {
      await Promise.all([result.current.submit(settings), result.current.submit(settings)])
    })

    const createCalls = mockedPost.mock.calls.filter(([endpoint]) => endpoint === '/exports/books/')
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0][1].settings.locale).toBe('PL')
    expect(result.current.draft).toBeNull()
  })

  it('does not read another owner draft or job after an account switch', async () => {
    routeGet(readyCapabilities, [makeJob()])
    const { Wrapper } = createWrapper()
    const { result, rerender } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.job?.job_id).toBe('job-1'))

    mockOwner = null
    rerender({})

    expect(result.current.job).toBeNull()
    expect(result.current.isAvailable).toBe(false)
  })

  it('keeps a delayed selection response with the owner who started it', async () => {
    routeGet(readyCapabilities, [])
    let finishSelection!: (value: unknown) => void
    mockedPost.mockReturnValue(new Promise((resolve) => { finishSelection = resolve }))
    const { Wrapper } = createWrapper()
    const { result, rerender } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isAvailable).toBe(true))
    act(() => result.current.findPeriod({ yearFrom: 2012, yearTo: 2013 }))
    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1))
    mockOwner = 'owner-2'
    rerender({})
    await act(async () => {
      finishSelection({ selection_id: 'owner-1-selection', state: 'draft', travel_count: 23, next_sequence: 1 })
    })
    await waitFor(() => expect(result.current.isFindingPeriod).toBe(false))
    expect(result.current.draft).toBeNull()
    expect(useFullBookExportStore.getState().byOwner['owner-2']).toBeUndefined()
    expect(useFullBookExportStore.getState().byOwner['owner-1']).toMatchObject({ yearFrom: 2012, yearTo: 2013 })
  })

  it('keeps the idempotency key when the owner retries after every uncertain response', async () => {
    routeGet(readyCapabilities, [])
    const keys: string[] = []
    let failCreate = true
    mockedPost.mockImplementation((endpoint: string, payload: { idempotency_key?: string }) => {
      if (endpoint === '/exports/books/selections/') return Promise.resolve({ selection_id: 'sel-1', state: 'draft', travel_count: 23 })
      if (endpoint.endsWith('/finalize/')) return Promise.resolve({ selection_id: 'sel-1', state: 'finalized', travel_count: 23, selection_hash: 'h' })
      if (endpoint === '/exports/books/') {
        keys.push(payload.idempotency_key!)
        return failCreate ? Promise.reject(new ApiError(503, 'Unavailable')) : Promise.resolve({ job_id: 'job-new', status: 'queued', settings_hash: 's' })
      }
      return Promise.reject(new Error('Unexpected endpoint'))
    })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isAvailable).toBe(true))
    act(() => result.current.findPeriod({ yearFrom: 2012, yearTo: 2013 }))
    await waitFor(() => expect(result.current.draft).not.toBeNull())
    const settings = { ...DEFAULT_BOOK_SETTINGS, sortOrder: 'date-asc' as const }
    await act(async () => { await expect(result.current.submit(settings)).rejects.toThrow('Unavailable') })
    failCreate = false
    await act(async () => { await result.current.submit(settings) })
    expect(keys).toHaveLength(4)
    expect(new Set(keys).size).toBe(1)
  })

  it('keeps observing a newly accepted job when every initial detail attempt failed', async () => {
    let detailReads = 0
    mockedGet.mockImplementation((endpoint: string) => {
      if (endpoint.endsWith('/capabilities/')) return Promise.resolve(readyCapabilities)
      if (endpoint.startsWith('/exports/books/?')) return Promise.resolve({ results: [], next_cursor: null })
      detailReads++
      return detailReads <= 3 ? Promise.reject(new ApiError(503, 'Unavailable')) : Promise.resolve(makeJob({ job_id: 'job-new' }))
    })
    mockedPost.mockImplementation((endpoint: string) => {
      if (endpoint === '/exports/books/selections/') return Promise.resolve({ selection_id: 'sel-1', state: 'draft', travel_count: 23 })
      if (endpoint.endsWith('/finalize/')) return Promise.resolve({ selection_id: 'sel-1', state: 'finalized', travel_count: 23, selection_hash: 'h' })
      return Promise.resolve({ job_id: 'job-new', status: 'queued', settings_hash: 's' })
    })
    const { client, Wrapper } = createWrapper()
    client.setDefaultOptions({ queries: { retryDelay: 0 }, mutations: { retry: false } })
    const { result } = renderHook(() => useFullBookExport({ enabled: true }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isAvailable).toBe(true))
    act(() => result.current.findPeriod({ yearFrom: 2012, yearTo: 2013 }))
    await waitFor(() => expect(result.current.draft).not.toBeNull())
    await act(async () => { await result.current.submit({ ...DEFAULT_BOOK_SETTINGS, sortOrder: 'date-asc' }) })
    await waitFor(() => expect(result.current.isReconnecting).toBe(true))
    expect(result.current.isObservingJob).toBe(true)
    expect(result.current.job).toBeNull()
    await waitFor(() => expect(result.current.job?.job_id).toBe('job-new'), { timeout: 5000 })
    expect(result.current.isObservingJob).toBe(false)
  }, 10_000)
})

describe('full book job predicates', () => {
  it('treats only server-confirmed complete output as downloadable', () => {
    const ready = makeJob({
      status: 'done',
      stage: 'done',
      completeness: 'complete',
      snapshot_state: 'frozen',
      download: { available: true, size_bytes: 1024, checksum: 'c' },
    })
    expect(isFullBookJobDownloadable(ready)).toBe(true)
    expect(isFullBookJobDownloadable({ ...ready, completeness: 'incomplete' })).toBe(false)
    expect(isFullBookJobDownloadable({ ...ready, snapshot_state: 'pending' })).toBe(false)
    expect(isFullBookJobDownloadable({ ...ready, download: { available: false, size_bytes: null, checksum: null } })).toBe(
      false,
    )
    expect(isFullBookJobDownloadable({ ...ready, status: 'expired' })).toBe(false)
  })

  it('keeps observing every non-terminal server state', () => {
    for (const status of ['queued', 'running', 'retry_wait', 'cancel_requested'] as const) {
      expect(isFullBookJobActive(makeJob({ status }))).toBe(true)
    }
    for (const status of ['done', 'failed', 'cancelled', 'expired'] as const) {
      expect(isFullBookJobActive(makeJob({ status }))).toBe(false)
    }
  })
})
