// api/bookExportApi.ts
// #716/#713: backend async export job для книги путешествий.
// POST /api/exports/books/ → { job_id, status, progress }; GET /api/exports/books/{id}/ → job;
// GET {artifact_url} → файл. format:"pdf" на проде может быть недоступен
// (error_code PDF_RENDERER_UNAVAILABLE) — результат capability запоминается на сессию,
// чтобы не создавать заведомо-failed job на каждый экспорт.

import { apiClient } from '@/api/client'
import { ApiError } from '@/api/clientErrors'
import type { DownloadResponse } from '@/api/clientTypes'

export type BookExportFormat = 'html' | 'pdf'
export type BookExportJobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface BookExportSettingsPayload {
  template?: string
  include_gallery?: boolean
  include_map?: boolean
  include_recommendations?: boolean
  include_plus_minus?: boolean
  include_toc?: boolean
  language?: string
}

export interface BookExportJob {
  job_id: string
  status: BookExportJobStatus
  progress: number
  stage?: string | null
  message?: string | null
  artifact_url?: string | null
  expires_at?: string | null
  error_code?: string | null
  error_message?: string | null
}

export const PDF_RENDERER_UNAVAILABLE_CODE = 'PDF_RENDERER_UNAVAILABLE'

const BOOK_EXPORTS_ENDPOINT = '/exports/books/'
const DEFAULT_POLL_INTERVAL_MS = 1500
const DEFAULT_JOB_TIMEOUT_MS = 120_000

export class BookExportJobFailedError extends Error {
  readonly errorCode: string | null

  constructor(job: BookExportJob) {
    super(job.error_message || job.message || 'Экспорт книги на сервере не удался')
    this.name = 'BookExportJobFailedError'
    this.errorCode = job.error_code ?? null
  }
}

export class BookExportJobTimeoutError extends Error {
  constructor(jobId: string) {
    super(`Экспорт книги не завершился вовремя (job ${jobId})`)
    this.name = 'BookExportJobTimeoutError'
  }
}

export function createBookExportJob(
  travelIds: number[],
  settings: BookExportSettingsPayload,
  format: BookExportFormat,
): Promise<BookExportJob> {
  return apiClient.post<BookExportJob>(BOOK_EXPORTS_ENDPOINT, {
    travel_ids: travelIds,
    settings,
    format,
  })
}

export function getBookExportJob(jobId: string): Promise<BookExportJob> {
  return apiClient.get<BookExportJob>(`${BOOK_EXPORTS_ENDPOINT}${encodeURIComponent(jobId)}/`)
}

// Прод отдаёт artifact_url абсолютным (наблюдалось http://metravel.by/...) — сводим к
// относительному endpoint под API base, чтобы скачивание шло через apiClient
// (https + Authorization), без mixed-content.
export function bookExportArtifactEndpoint(job: BookExportJob): string {
  const fallback = `${BOOK_EXPORTS_ENDPOINT}${encodeURIComponent(job.job_id)}/download/`
  const raw = job.artifact_url
  if (!raw) return fallback
  try {
    const parsed = new URL(raw, 'https://metravel.by')
    const apiIndex = parsed.pathname.indexOf('/api/')
    if (apiIndex === -1) return fallback
    return `${parsed.pathname.slice(apiIndex + '/api'.length)}${parsed.search}`
  } catch {
    return fallback
  }
}

export function downloadBookExportArtifact(job: BookExportJob): Promise<DownloadResponse> {
  return apiClient.download(bookExportArtifactEndpoint(job))
}

export interface RunBookExportJobOptions {
  travelIds: number[]
  settings: BookExportSettingsPayload
  format: BookExportFormat
  pollIntervalMs?: number
  timeoutMs?: number
  onProgress?: (job: BookExportJob) => void
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function runBookExportJob(options: RunBookExportJobOptions): Promise<BookExportJob> {
  const { travelIds, settings, format, onProgress } = options
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS

  let job = await createBookExportJob(travelIds, settings, format)
  onProgress?.(job)

  const deadline = Date.now() + timeoutMs
  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() >= deadline) {
      throw new BookExportJobTimeoutError(job.job_id)
    }
    await delay(pollIntervalMs)
    job = await getBookExportJob(job.job_id)
    onProgress?.(job)
  }

  if (job.status === 'failed') {
    throw new BookExportJobFailedError(job)
  }
  return job
}

// Session-scoped capability: «сервер заведомо не умеет этот формат» (renderer не настроен
// или старый бэк без exports API). Сбрасывается перезагрузкой приложения.
const unavailableFormats = new Set<BookExportFormat>()

export function isServerBookExportUnavailable(format: BookExportFormat): boolean {
  return unavailableFormats.has(format)
}

export function resetServerBookExportCapabilityForTests(): void {
  unavailableFormats.clear()
}

function isPermanentServerExportFailure(error: unknown): boolean {
  if (error instanceof BookExportJobFailedError) {
    return error.errorCode === PDF_RENDERER_UNAVAILABLE_CODE
  }
  // 404/405 — старый бэк без /api/exports/books/
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 405
  }
  return false
}

// Попытка серверного экспорта. null = использовать клиентский fallback (любая ошибка —
// сетевая, failed job, таймаут — прозрачно уводит на клиентский рантайм; детерминированные
// отказы дополнительно запоминаются, чтобы не повторять попытку в этой сессии).
export async function requestServerBookExport(
  options: RunBookExportJobOptions,
): Promise<BookExportJob | null> {
  if (isServerBookExportUnavailable(options.format)) {
    return null
  }
  try {
    return await runBookExportJob(options)
  } catch (error) {
    if (isPermanentServerExportFailure(error)) {
      unavailableFormats.add(options.format)
    }
    return null
  }
}
