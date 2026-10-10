// #2357 F2: полная книга за период — серверный выбор, подтверждённый снимок и
// ровно одно задание при повторах после неопределённого ответа.

import { ApiError } from '@/api/clientErrors'
import { apiClient } from '@/api/client'
import {
  FULL_BOOK_SUBMIT_ATTEMPTS,
  createFullBookPeriodDraft,
  isUncertainSubmitError,
  isValidFullBookPeriod,
  submitFullBookExport,
  type FullBookPeriodDraft,
  type SubmitFullBookOptions,
} from '@/services/book/fullBookExportSubmission'
import { DEFAULT_BOOK_SETTINGS, type BookSettings } from '@/types/bookSettings'

jest.mock('@/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
  },
}))

const mockedPost = apiClient.post as jest.Mock

const draft: FullBookPeriodDraft = {
  yearFrom: 2012,
  yearTo: 2013,
  selectionId: 'sel-1',
  sortOrder: 'date-asc',
  travelCount: 23,
}

const settings: BookSettings = { ...DEFAULT_BOOK_SETTINGS, title: 'Архив 2012–2013', sortOrder: 'date-asc' }

const finalized = { selection_id: 'sel-1', state: 'finalized', travel_count: 23, selection_hash: 'hash-1' }
const created = { job_id: 'job-1', status: 'queued', settings_hash: 'settings-hash' }

const networkError = () => new TypeError('Failed to fetch')

describe('fullBookExportSubmission', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    jest.useRealTimers()
  })

  it('accepts only an ordered period within supported years', () => {
    expect(isValidFullBookPeriod({ yearFrom: 2012, yearTo: 2013 }, 2026)).toBe(true)
    expect(isValidFullBookPeriod({ yearFrom: 2013, yearTo: 2013 }, 2026)).toBe(true)
    expect(isValidFullBookPeriod({ yearFrom: 2014, yearTo: 2013 }, 2026)).toBe(false)
    expect(isValidFullBookPeriod({ yearFrom: 1899, yearTo: 2013 }, 2026)).toBe(false)
    expect(isValidFullBookPeriod({ yearFrom: 2012, yearTo: 2027 }, 2026)).toBe(false)
    expect(isValidFullBookPeriod({ yearFrom: Number.NaN, yearTo: 2013 }, 2026)).toBe(false)
  })

  it('asks the server for all matching travels of the period instead of loaded cards', async () => {
    mockedPost.mockResolvedValueOnce({ selection_id: 'sel-9', state: 'draft', travel_count: 23, next_sequence: 1 })

    const result = await createFullBookPeriodDraft({ yearFrom: 2012, yearTo: 2013 }, 'date-asc')

    expect(mockedPost).toHaveBeenCalledWith('/exports/books/selections/', {
      mode: 'filters',
      filters: { year_from: 2012, year_to: 2013 },
      sort_order: 'date-asc',
    })
    expect(result).toEqual({ yearFrom: 2012, yearTo: 2013, selectionId: 'sel-9', sortOrder: 'date-asc', travelCount: 23 })
  })

  it('finalizes the selection and creates one v2 job with the full settings DTO', async () => {
    mockedPost.mockResolvedValueOnce(finalized).mockResolvedValueOnce(created)

    const result = await submitFullBookExport({ draft, settings, locale: 'BE', operationKey: 'op-1' })

    expect(mockedPost).toHaveBeenNthCalledWith(1, '/exports/books/selections/sel-1/finalize/', {})
    const [endpoint, payload] = mockedPost.mock.calls[1]
    expect(endpoint).toBe('/exports/books/')
    expect(payload).toMatchObject({
      contract_version: 2,
      selection_id: 'sel-1',
      settings_version: 1,
      format: 'pdf',
      idempotency_key: 'op-1',
    })
    expect(payload.settings).toMatchObject({ title: 'Архив 2012–2013', sortOrder: 'date-asc', locale: 'BE' })
    expect(Object.keys(payload.settings)).toEqual(
      expect.arrayContaining(['galleryLayout', 'photoPageLayout', 'checklistSections', 'coverImage']),
    )
    expect(result).toEqual({ jobId: 'job-1', selection: finalized })
  })

  it('recreates the period selection when the chosen book order differs from the draft order', async () => {
    mockedPost
      .mockResolvedValueOnce({ selection_id: 'sel-2', state: 'draft', travel_count: 23, next_sequence: 1 })
      .mockResolvedValueOnce({ ...finalized, selection_id: 'sel-2' })
      .mockResolvedValueOnce(created)

    await submitFullBookExport({
      draft,
      settings: { ...settings, sortOrder: 'alphabetical' },
      locale: 'RU',
      operationKey: 'op-2',
    })

    expect(mockedPost).toHaveBeenNthCalledWith(1, '/exports/books/selections/', {
      mode: 'filters',
      filters: { year_from: 2012, year_to: 2013 },
      sort_order: 'alphabetical',
    })
    expect(mockedPost).toHaveBeenNthCalledWith(2, '/exports/books/selections/sel-2/finalize/', {})
    expect(mockedPost.mock.calls[2][1]).toMatchObject({ selection_id: 'sel-2', settings: { sortOrder: 'alphabetical' } })
  })

  it('refuses a reordered selection whose confirmed count differs from the one the author saw', async () => {
    mockedPost
      .mockResolvedValueOnce({ selection_id: 'sel-2', state: 'draft', travel_count: 22, next_sequence: 1 })
      .mockResolvedValueOnce({ ...finalized, selection_id: 'sel-2', travel_count: 22 })

    await expect(
      submitFullBookExport({ draft, settings: { ...settings, sortOrder: 'alphabetical' }, locale: 'RU', operationKey: 'op-3' }),
    ).rejects.toMatchObject({ status: 409, data: { error_code: 'REVISION_CONFLICT' } })
    expect(mockedPost).toHaveBeenCalledTimes(2)
  })

  it('retries an uncertain job creation with the same key and body, never a second operation', async () => {
    jest.useFakeTimers()
    mockedPost
      .mockResolvedValueOnce(finalized)
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(new ApiError(502, 'Bad gateway'))
      .mockResolvedValueOnce(created)

    const pending = submitFullBookExport({ draft, settings, locale: 'RU', operationKey: 'op-3' })
    await jest.advanceTimersByTimeAsync(10_000)
    const result = await pending

    const createCalls = mockedPost.mock.calls.filter(([endpoint]) => endpoint === '/exports/books/')
    expect(createCalls).toHaveLength(FULL_BOOK_SUBMIT_ATTEMPTS)
    expect(new Set(createCalls.map(([, body]) => JSON.stringify(body))).size).toBe(1)
    expect(createCalls[0][1].idempotency_key).toBe('op-3')
    expect(result.jobId).toBe('job-1')
  })

  it('stops on a definitive contract answer and never creates a job after a failed finalize', async () => {
    mockedPost.mockRejectedValueOnce(new ApiError(409, 'conflict', { error_code: 'REVISION_CONFLICT' }))

    await expect(submitFullBookExport({ draft, settings, locale: 'RU', operationKey: 'op-4' })).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(mockedPost).toHaveBeenCalledTimes(1)
    expect(mockedPost.mock.calls.some(([endpoint]) => endpoint === '/exports/books/')).toBe(false)
  })

  it('reuses the frozen reordered selection after all automatic attempts lost their responses', async () => {
    jest.useFakeTimers()
    mockedPost
      .mockResolvedValueOnce({ selection_id: 'sel-2', state: 'draft', travel_count: 23, next_sequence: 1 })
      .mockResolvedValueOnce({ ...finalized, selection_id: 'sel-2' })
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce(created)
    const operation: SubmitFullBookOptions = {
      draft, settings: { ...settings, sortOrder: 'alphabetical' }, locale: 'RU',
      operationKey: 'same-operation', checkpoint: {},
    }
    const pending = expect(submitFullBookExport(operation)).rejects.toThrow('Failed to fetch')
    await jest.advanceTimersByTimeAsync(10_000)
    await pending
    await expect(submitFullBookExport(operation)).resolves.toMatchObject({ jobId: 'job-1' })
    const creates = mockedPost.mock.calls.filter(([endpoint]) => endpoint === '/exports/books/')
    expect(creates).toHaveLength(4)
    expect(new Set(creates.map(([, payload]) => JSON.stringify(payload))).size).toBe(1)
    expect(mockedPost.mock.calls.filter(([endpoint]) => endpoint === '/exports/books/selections/')).toHaveLength(1)
  })

  it('stops the retry chain before using the next account session', async () => {
    jest.useFakeTimers()
    let ownerMatches = true
    mockedPost.mockResolvedValueOnce(finalized).mockImplementationOnce(() => {
      ownerMatches = false
      return Promise.reject(networkError())
    })
    const pending = expect(submitFullBookExport({
      draft, settings, locale: 'RU', operationKey: 'owner-operation',
      assertOwner: () => { if (!ownerMatches) throw new ApiError(403, 'Owner changed') },
    })).rejects.toThrow('Owner changed')
    await jest.advanceTimersByTimeAsync(10_000)
    await pending
    expect(mockedPost.mock.calls.filter(([endpoint]) => endpoint === '/exports/books/')).toHaveLength(1)
  })

  it('classifies only network, timeout and 5xx answers as uncertain', () => {
    expect(isUncertainSubmitError(networkError())).toBe(true)
    expect(isUncertainSubmitError(new ApiError(503, 'unavailable'))).toBe(true)
    expect(isUncertainSubmitError(new ApiError(400, 'invalid'))).toBe(false)
    expect(isUncertainSubmitError(new ApiError(403, 'forbidden'))).toBe(false)
    expect(isUncertainSubmitError(new ApiError(409, 'conflict'))).toBe(false)
  })
})
