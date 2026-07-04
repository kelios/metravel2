// #716/#713: серверный async export книги — happy path, capability-memo и fallback-сигналы.

import {
  bookExportArtifactEndpoint,
  createBookExportJob,
  downloadBookExportArtifact,
  isServerBookExportUnavailable,
  requestServerBookExport,
  resetServerBookExportCapabilityForTests,
  runBookExportJob,
  BookExportJobFailedError,
  type BookExportJob,
} from '@/api/bookExportApi'
import { ApiError } from '@/api/clientErrors'
import { apiClient } from '@/api/client'

jest.mock('@/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    download: jest.fn(),
  },
}))

const mockedPost = apiClient.post as jest.Mock
const mockedGet = apiClient.get as jest.Mock
const mockedDownload = apiClient.download as jest.Mock

const queuedJob: BookExportJob = {
  job_id: 'job-1',
  status: 'queued',
  progress: 0,
}

const doneJob: BookExportJob = {
  job_id: 'job-1',
  status: 'done',
  progress: 100,
  stage: 'done',
  message: 'Book export is ready',
  artifact_url: 'http://metravel.by/api/exports/books/job-1/download/',
  expires_at: '2026-07-11T18:30:40Z',
  error_code: null,
  error_message: null,
}

const failedPdfJob: BookExportJob = {
  job_id: 'job-2',
  status: 'failed',
  progress: 100,
  stage: 'failed',
  message: 'Book export failed',
  artifact_url: null,
  expires_at: null,
  error_code: 'PDF_RENDERER_UNAVAILABLE',
  error_message: 'Native PDF renderer is not configured; request format="html" artifact.',
}

beforeEach(() => {
  jest.clearAllMocks()
  resetServerBookExportCapabilityForTests()
})

describe('api/bookExportApi', () => {
  it('создаёт job и поллит до done (html happy path)', async () => {
    mockedPost.mockResolvedValueOnce(queuedJob)
    mockedGet
      .mockResolvedValueOnce({ ...queuedJob, status: 'running', progress: 40 })
      .mockResolvedValueOnce(doneJob)

    const progressStatuses: string[] = []
    const job = await runBookExportJob({
      travelIds: [439],
      settings: { template: 'minimal', include_gallery: false },
      format: 'html',
      pollIntervalMs: 1,
      onProgress: (j) => progressStatuses.push(j.status),
    })

    expect(job).toEqual(doneJob)
    expect(mockedPost).toHaveBeenCalledWith('/exports/books/', {
      travel_ids: [439],
      settings: { template: 'minimal', include_gallery: false },
      format: 'html',
    })
    expect(mockedGet).toHaveBeenCalledWith('/exports/books/job-1/')
    expect(progressStatuses).toEqual(['queued', 'running', 'done'])
  })

  it('createBookExportJob шлёт контрактный payload', async () => {
    mockedPost.mockResolvedValueOnce(queuedJob)
    await createBookExportJob([1, 2], { include_map: true }, 'pdf')
    expect(mockedPost).toHaveBeenCalledWith('/exports/books/', {
      travel_ids: [1, 2],
      settings: { include_map: true },
      format: 'pdf',
    })
  })

  it('нормализует artifact_url (http://…/api/…) к относительному endpoint и качает через apiClient', async () => {
    expect(bookExportArtifactEndpoint(doneJob)).toBe('/exports/books/job-1/download/')
    expect(bookExportArtifactEndpoint({ ...doneJob, artifact_url: null })).toBe(
      '/exports/books/job-1/download/',
    )
    expect(
      bookExportArtifactEndpoint({ ...doneJob, artifact_url: 'https://elsewhere.example/file.pdf' }),
    ).toBe('/exports/books/job-1/download/')

    mockedDownload.mockResolvedValueOnce({ blob: {} as Blob, contentType: 'text/html' })
    await downloadBookExportArtifact(doneJob)
    expect(mockedDownload).toHaveBeenCalledWith('/exports/books/job-1/download/')
  })

  it('runBookExportJob бросает BookExportJobFailedError с error_code при failed', async () => {
    mockedPost.mockResolvedValueOnce(failedPdfJob)

    await expect(
      runBookExportJob({ travelIds: [439], settings: {}, format: 'pdf', pollIntervalMs: 1 }),
    ).rejects.toMatchObject({
      name: 'BookExportJobFailedError',
      errorCode: 'PDF_RENDERER_UNAVAILABLE',
    })
  })

  describe('requestServerBookExport (canonical → fallback)', () => {
    it('failed PDF_RENDERER_UNAVAILABLE → null + capability memo (второй экспорт не ходит в API)', async () => {
      mockedPost.mockResolvedValueOnce(queuedJob)
      mockedGet.mockResolvedValueOnce(failedPdfJob)

      const first = await requestServerBookExport({
        travelIds: [439],
        settings: {},
        format: 'pdf',
        pollIntervalMs: 1,
      })
      expect(first).toBeNull()
      expect(isServerBookExportUnavailable('pdf')).toBe(true)
      expect(isServerBookExportUnavailable('html')).toBe(false)

      const second = await requestServerBookExport({
        travelIds: [439],
        settings: {},
        format: 'pdf',
        pollIntervalMs: 1,
      })
      expect(second).toBeNull()
      expect(mockedPost).toHaveBeenCalledTimes(1)
    })

    it('старый бэк (404 на create) → null + capability memo', async () => {
      mockedPost.mockRejectedValueOnce(new ApiError(404, 'Not found'))

      const result = await requestServerBookExport({
        travelIds: [439],
        settings: {},
        format: 'pdf',
        pollIntervalMs: 1,
      })
      expect(result).toBeNull()
      expect(isServerBookExportUnavailable('pdf')).toBe(true)
    })

    it('сетевая ошибка → null БЕЗ memo (следующий экспорт пробует сервер снова)', async () => {
      mockedPost.mockRejectedValueOnce(new ApiError(0, 'Нет подключения', { offline: true }))

      const result = await requestServerBookExport({
        travelIds: [439],
        settings: {},
        format: 'html',
        pollIntervalMs: 1,
      })
      expect(result).toBeNull()
      expect(isServerBookExportUnavailable('html')).toBe(false)

      mockedPost.mockResolvedValueOnce(doneJob)
      const retry = await requestServerBookExport({
        travelIds: [439],
        settings: {},
        format: 'html',
        pollIntervalMs: 1,
      })
      expect(retry).toEqual(doneJob)
      expect(mockedPost).toHaveBeenCalledTimes(2)
    })

    it('успешный job возвращается вызывающему коду', async () => {
      mockedPost.mockResolvedValueOnce(doneJob)
      const result = await requestServerBookExport({
        travelIds: [439],
        settings: {},
        format: 'html',
        pollIntervalMs: 1,
      })
      expect(result).toEqual(doneJob)
    })
  })

  it('BookExportJobFailedError использует error_message как message', () => {
    const error = new BookExportJobFailedError(failedPdfJob)
    expect(error.message).toContain('Native PDF renderer')
  })
})
