import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { ApiError } from '@/api/clientErrors'
import type { BookExportV2Job } from '@/api/bookExportApi'
import { queryKeys } from '@/api/queryKeys'
import { useBookExportJob } from '@/hooks/useBookExportJob'
import { downloadFullBookFile } from '@/services/book/fullBookDownload'

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))
jest.mock('@/services/book/fullBookDownload', () => ({ downloadFullBookFile: jest.fn() }))
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
let mockOwner: string | null = 'owner-1'
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => mockOwner }))
const mockedGet = apiClient.get as jest.Mock
const mockedPost = apiClient.post as jest.Mock
const mockedDownload = downloadFullBookFile as jest.Mock
const JOB = '1b2f8c70-3c9e-4a65-8f44-6f8a8e1c0d11'
const OTHER_JOB = '2b2f8c70-3c9e-4a65-8f44-6f8a8e1c0d11'
const makeJob = (overrides: Partial<BookExportV2Job> = {}): BookExportV2Job => ({
  job_id: JOB, status: 'running', stage: 'lambda_render',
  counters: { travels: { completed: 2, expected: 2 }, blocks: { completed: 8, expected: null },
    mediaOccurrences: { completed: 4, expected: null }, pages: { completed: 1, expected: null } },
  snapshot_hash: 'snapshot', settings_hash: 'settings', completeness: 'pending', error_code: '',
  retryable: false, expires_at: null, download: null, snapshot_state: 'frozen', artifact_url: null,
  ...overrides,
})
const completeJob = () => makeJob({ status: 'done', completeness: 'complete',
  download: { available: true, checksum: 'hash', size_bytes: 100 } })

async function setup(initialJobId: string | null = JOB, enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const hook = await renderHook(({ jobId, active }) => useBookExportJob(jobId, active), {
    initialProps: { jobId: initialJobId, active: enabled }, wrapper,
  })
  return { ...hook, client }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockOwner = 'owner-1'
  mockedGet.mockResolvedValue(makeJob())
})

it('observes only the exact route job without capabilities, latest list or creating a job', async () => {
  const { result } = await setup()
  await waitFor(() => expect(result.current.job?.job_id).toBe(JOB))
  expect(mockedGet).toHaveBeenCalledTimes(1)
  expect(mockedGet).toHaveBeenCalledWith(`/exports/books/${JOB}/`)
  expect(mockedPost).not.toHaveBeenCalled()
})

it('does not read while auth is unready or the route ID is absent', async () => {
  await setup(JOB, false)
  await setup(null)
  expect(mockedGet).not.toHaveBeenCalled()
})

it('does not expose a previous owner or route while the new job is loading', async () => {
  const { result, rerender } = await setup()
  await waitFor(() => expect(result.current.job).not.toBeNull())
  mockedGet.mockReturnValue(new Promise(() => undefined))
  mockOwner = 'owner-2'
  await rerender({ jobId: OTHER_JOB, active: true })
  expect(result.current.job).toBeNull()
  expect(result.current.isObservingJob).toBe(true)
})

it('hides cached private metadata immediately after a missing/foreign response', async () => {
  const { result } = await setup()
  await waitFor(() => expect(result.current.job).not.toBeNull())
  mockedGet.mockRejectedValue(new ApiError(404, 'not found'))
  await act(() => result.current.refresh())
  await waitFor(() => expect(result.current.isJobMissing).toBe(true))
  expect(result.current.job).toBeNull()
})

it('keeps confirmed progress during an observation error without creating another job', async () => {
  const { result } = await setup()
  await waitFor(() => expect(result.current.job).not.toBeNull())
  mockedGet.mockRejectedValue(new ApiError(500, 'offline'))
  await act(() => result.current.refresh())
  await waitFor(() => expect(result.current.isReconnecting).toBe(true))
  expect(result.current.job?.counters.pages.completed).toBe(1)
  expect(mockedPost).not.toHaveBeenCalled()
})

it('retries the same failed job and updates its exact cache without a create POST', async () => {
  mockedGet.mockResolvedValue(makeJob({ status: 'failed', retryable: true }))
  mockedPost.mockResolvedValue(makeJob({ status: 'queued' }))
  const { result, client } = await setup()
  await waitFor(() => expect(result.current.job?.status).toBe('failed'))
  await act(() => { result.current.retry(); result.current.retry() })
  await waitFor(() => expect(result.current.job?.status).toBe('queued'))
  expect(mockedPost).toHaveBeenCalledTimes(1)
  expect(mockedPost).toHaveBeenCalledWith(`/exports/books/${JOB}/retry/`, {})
  expect(client.getQueryData(queryKeys.fullBookExportJob('owner-1', JOB))).toEqual(makeJob({ status: 'queued' }))
})

it('does not retry again after REBUILD_REQUIRED', async () => {
  mockedGet.mockResolvedValue(makeJob({ status: 'failed', retryable: true }))
  mockedPost.mockRejectedValue(new ApiError(409, 'rebuild', { error_code: 'REBUILD_REQUIRED' }))
  const { result } = await setup()
  await waitFor(() => expect(result.current.job).not.toBeNull())
  await act(() => result.current.retry())
  await waitFor(() => expect(result.current.retryError).toBeTruthy())
  await act(() => result.current.retry())
  expect(mockedPost).toHaveBeenCalledTimes(1)
})

it('prevents cancellation after cancellation was already requested', async () => {
  mockedGet.mockResolvedValue(makeJob({ status: 'cancel_requested' }))
  const { result } = await setup()
  await waitFor(() => expect(result.current.job).not.toBeNull())
  await act(() => result.current.cancel())
  expect(mockedPost).not.toHaveBeenCalled()
})

it('blocks stale download after JOB_EXPIRED and refreshes the exact job', async () => {
  mockedGet.mockResolvedValue(completeJob())
  mockedDownload.mockRejectedValue(new ApiError(410, 'expired', { error_code: 'JOB_EXPIRED' }))
  const { result } = await setup()
  await waitFor(() => expect(result.current.job).not.toBeNull())
  await act(() => result.current.download())
  await waitFor(() => expect(result.current.downloadError).toBeTruthy())
  await act(() => result.current.download())
  expect(mockedDownload).toHaveBeenCalledTimes(1)
  expect(mockedGet.mock.calls.length).toBeGreaterThanOrEqual(2)
})

it('guards delayed ticket delivery after account change and unmount', async () => {
  mockedGet.mockResolvedValue(completeJob())
  let verifyOwner: (() => void) | undefined
  mockedDownload.mockImplementation((_id, _now, guard) => {
    verifyOwner = guard
    return new Promise(() => undefined)
  })
  const { result, rerender, unmount } = await setup()
  await waitFor(() => expect(result.current.job).not.toBeNull())
  await act(() => result.current.download())
  await waitFor(() => expect(verifyOwner).toBeDefined())
  mockOwner = 'owner-2'
  await rerender({ jobId: JOB, active: true })
  expect(() => verifyOwner?.()).toThrow('BOOK_EXPORT_OWNER_CHANGED')
  await unmount()
  expect(() => verifyOwner?.()).toThrow('BOOK_EXPORT_OWNER_CHANGED')
})

it('surfaces an initial read failure as observation/reconnection instead of an empty status', async () => {
  mockedGet.mockRejectedValue(new ApiError(500, 'server failed'))
  const { result } = await setup()
  await waitFor(() => expect(result.current.isReconnecting).toBe(true))
  expect(result.current.job).toBeNull()
  expect(result.current.isObservingJob).toBe(true)
})

it('surfaces an initially paused offline read as reconnecting instead of a permanent skeleton', async () => {
  onlineManager.setOnline(false)
  try {
    const { result } = await setup()
    await waitFor(() => expect(result.current.isObservingJob).toBe(true))
    expect(result.current.isReconnecting).toBe(true)
    expect(mockedGet).not.toHaveBeenCalled()
  } finally {
    onlineManager.setOnline(true)
  }
})

it('stops polling once the server confirms a terminal job', async () => {
  mockedGet.mockResolvedValue(completeJob())
  const { result, unmount } = await setup()
  await waitFor(() => expect(result.current.job?.status).toBe('done'))
  jest.useFakeTimers()
  try {
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
    expect(mockedGet).toHaveBeenCalledTimes(1)
    await unmount()
    await act(async () => { await jest.runOnlyPendingTimersAsync() })
  } finally {
    jest.useRealTimers()
  }
})

it('does not expose pending retry errors or responses after switching route and owner', async () => {
  mockedGet.mockResolvedValue(makeJob({ status: 'failed', retryable: true }))
  let rejectRetry: ((error: unknown) => void) | undefined
  mockedPost.mockImplementation(() => new Promise((_resolve, reject) => { rejectRetry = reject }))
  const { result, rerender } = await setup()
  await waitFor(() => expect(result.current.job?.status).toBe('failed'))
  await act(() => result.current.retry())
  await waitFor(() => expect(rejectRetry).toBeDefined())
  mockOwner = 'owner-2'
  mockedGet.mockResolvedValue(makeJob({ job_id: OTHER_JOB }))
  await rerender({ jobId: OTHER_JOB, active: true })
  await act(async () => { rejectRetry?.(new ApiError(409, 'rebuild', { error_code: 'REBUILD_REQUIRED' })) })
  await waitFor(() => expect(result.current.job?.job_id).toBe(OTHER_JOB))
  expect(result.current.retryError).toBeNull()
  expect(result.current.isRetrying).toBe(false)
})
