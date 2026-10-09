import { apiClient } from '@/api/client'
import { ApiError } from '@/api/clientErrors'
import {
  appendBookSelection,
  cancelBookExportV2Job,
  createBookExportV2Job,
  createBookSelection,
  finalizeBookSelection,
  getBookExportCapabilities,
  getBookExportV2Job,
  listBookExportV2Jobs,
  retryBookExportV2Job,
} from '@/api/bookExportApi'
import type { BookExportV2CreatePayload, BookExportV2Job, BookExportV2JobStatus } from '@/api/bookExportApi'
import { BOOK_SETTINGS_LOCALES, DEFAULT_BOOK_SETTINGS, toBookSettingsDto } from '@/types/bookSettings'

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), download: jest.fn() },
}))

const get = jest.mocked(apiClient.get)
const post = jest.mocked(apiClient.post)
const patch = jest.mocked(apiClient.patch)

const job: BookExportV2Job = {
  job_id: 'owner-job',
  status: 'queued',
  stage: 'awaiting_renderer',
  counters: {
    travels: { expected: 250, completed: 250 },
    blocks: { expected: null, completed: 0 },
    mediaOccurrences: { expected: null, completed: 1100 },
    pages: { expected: null, completed: 0 },
  },
  snapshot_hash: 'snapshot-sha',
  settings_hash: 'settings-sha',
  completeness: 'pending',
  error_code: '',
  retryable: false,
  expires_at: null,
  download: null,
  snapshot_state: 'frozen',
  artifact_url: null,
}

beforeEach(() => jest.resetAllMocks())

describe('published B1/B2 v2 book wire', () => {
  it('reads availability without creating a probe job', async () => {
    const capabilities = {
      contract_versions: [1, 2], settings_version: 1, renderer_version: 'unavailable',
      pdf_available: false, resumable: true, direct_download: false,
      unavailable_reason: 'PDF_PIPELINE_NOT_READY',
    }
    get.mockResolvedValueOnce(capabilities)
    expect(await getBookExportCapabilities()).toEqual(capabilities)
    expect(get).toHaveBeenCalledWith('/exports/books/capabilities/')
    expect(post).not.toHaveBeenCalled()
  })

  it('uses the server inclusive year-range count independently of loaded cards', async () => {
    const draft = { selection_id: 'selection', state: 'draft', travel_count: 250, next_sequence: 1 }
    post.mockResolvedValueOnce(draft)
    const payload = { mode: 'filters' as const, filters: { year_from: 2012, year_to: 2013 }, sort_order: 'date-asc' as const }
    expect(await createBookSelection(payload)).toEqual(draft)
    expect(post).toHaveBeenCalledWith('/exports/books/selections/', payload)
  })

  it('retains manual order, append sequence and stable keys beyond a total of 100 IDs', async () => {
    post.mockResolvedValueOnce({ selection_id: 'selection', state: 'draft', travel_count: 0, next_sequence: 1 })
    await createBookSelection({ mode: 'ordered' })
    expect(post).toHaveBeenCalledWith('/exports/books/selections/', { mode: 'ordered' })
    const first = { sequence: 1, travel_ids: Array.from({ length: 100 }, (_, index) => 100 - index), idempotency_key: 'append-1' }
    const second = { sequence: 2, travel_ids: [102, 101], idempotency_key: 'append-2' }
    patch.mockResolvedValue({ selection_id: 'selection', state: 'draft', travel_count: 102, next_sequence: 3 })
    await appendBookSelection('selection', first)
    await appendBookSelection('selection', first)
    expect(await appendBookSelection('selection', second)).toHaveProperty('travel_count', 102)
    expect(patch.mock.calls).toEqual([
      ['/exports/books/selections/selection/', first],
      ['/exports/books/selections/selection/', first],
      ['/exports/books/selections/selection/', second],
    ])
  })

  it('finalizes with an empty body and preserves confirmed count/hash without claiming frozen bytes', async () => {
    const finalized = { selection_id: 'selection', state: 'finalized', travel_count: 250, selection_hash: 'selection-sha' }
    post.mockResolvedValueOnce(finalized)
    expect(await finalizeBookSelection('selection')).toEqual(finalized)
    expect(post).toHaveBeenCalledWith('/exports/books/selections/selection/finalize/', {})
  })

  it.each(BOOK_SETTINGS_LOCALES)('sends full settings schema/locale %s and retains retry identity', async (locale) => {
    const payload: BookExportV2CreatePayload = {
      contract_version: 2, selection_id: 'selection', settings_version: 1,
      settings: toBookSettingsDto({ ...DEFAULT_BOOK_SETTINGS, galleryPhotosPerPage: 0 }, locale),
      format: 'pdf', idempotency_key: 'same-job-key',
    }
    const created = { job_id: 'owner-job', status: 'queued', settings_hash: 'settings-sha' }
    post.mockResolvedValue(created)
    expect(await createBookExportV2Job(payload)).toEqual(created)
    await createBookExportV2Job(payload)
    expect(post.mock.calls).toEqual([
      ['/exports/books/', payload], ['/exports/books/', payload],
    ])
    expect(payload.settings).toMatchObject({ locale, galleryPhotosPerPage: 0, subtitle: '', photoPageLayout: 'full-bleed' })
    expect(payload.settings).not.toHaveProperty('include_gallery')
  })

  it.each<BookExportV2JobStatus>([
    'queued', 'running', 'retry_wait', 'cancel_requested', 'cancelled', 'done', 'failed', 'expired',
  ])('observes %s without fabricating progress, polling deadline or new jobs', async (status) => {
    const observed = { ...job, status }
    get.mockResolvedValueOnce(observed)
    expect(await getBookExportV2Job(job.job_id)).toEqual(observed)
    expect(get).toHaveBeenCalledWith('/exports/books/owner-job/')
    expect(get).toHaveBeenCalledTimes(1)
    expect(post).not.toHaveBeenCalled()
    expect(apiClient.download).not.toHaveBeenCalled()
  })

  it('preserves source-capture null expected counters, pending coverage and unavailable delivery', async () => {
    get.mockResolvedValueOnce(job)
    expect(await getBookExportV2Job(job.job_id)).toMatchObject({
      counters: { blocks: { expected: null, completed: 0 }, pages: { expected: null, completed: 0 } },
      completeness: 'pending', download: null, artifact_url: null,
    })
  })

  it('discovers owner jobs and encodes the opaque cursor without altering the server page', async () => {
    const page = { results: [job], next_cursor: 'next-signed-cursor' }
    get.mockResolvedValue(page)
    expect(await listBookExportV2Jobs()).toEqual(page)
    expect(get).toHaveBeenLastCalledWith('/exports/books/')
    expect(await listBookExportV2Jobs({ cursor: 'signed+cursor/&=', page_size: 100 })).toEqual(page)
    expect(get).toHaveBeenLastCalledWith('/exports/books/?cursor=signed%2Bcursor%2F%26%3D&page_size=100')
  })

  it('posts empty-body cancel/retry to the same job and retains rebuild-required errors', async () => {
    post.mockResolvedValueOnce({ ...job, status: 'cancel_requested' })
    expect(await cancelBookExportV2Job('owner-job')).toHaveProperty('status', 'cancel_requested')
    expect(post).toHaveBeenLastCalledWith('/exports/books/owner-job/cancel/', {})
    const rebuild = new ApiError(409, 'Rebuild required', { error_code: 'REBUILD_REQUIRED' })
    post.mockRejectedValueOnce(rebuild)
    await expect(retryBookExportV2Job('owner-job')).rejects.toBe(rebuild)
    expect(post).toHaveBeenLastCalledWith('/exports/books/owner-job/retry/', {})
  })

  it.each([0, 400, 401, 403, 404, 409])('propagates status %s/error_code without swallowing or local fallback', async (status) => {
    const error = new ApiError(status, 'Request failed', { error_code: 'CONTRACT_ERROR' })
    get.mockRejectedValueOnce(error)
    await expect(getBookExportV2Job('owner-job')).rejects.toBe(error)
    expect(post).not.toHaveBeenCalled()
    expect(apiClient.download).not.toHaveBeenCalled()
  })

  it('encodes resource IDs without allowing extra path components', async () => {
    await appendBookSelection('selection/other', { sequence: 1, travel_ids: [1], idempotency_key: 'append-key' })
    await cancelBookExportV2Job('job/other')
    expect(patch).toHaveBeenCalledWith('/exports/books/selections/selection%2Fother/', expect.any(Object))
    expect(post).toHaveBeenCalledWith('/exports/books/job%2Fother/cancel/', {})
  })
})
