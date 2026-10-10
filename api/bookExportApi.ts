// api/bookExportApi.ts
// #716/#713: backend async export job для книги путешествий.
// POST /api/exports/books/ → { job_id, status, progress }; GET /api/exports/books/{id}/ → job;
// GET {artifact_url} → файл. format:"pdf" на проде может быть недоступен
// (error_code PDF_RENDERER_UNAVAILABLE) — результат capability запоминается на сессию,
// чтобы не создавать заведомо-failed job на каждый экспорт.

import { apiClient } from '@/api/client'
import { ApiError } from '@/api/clientErrors'
import type { DownloadResponse } from '@/api/clientTypes'
import type { BookSettingsDto } from '@/types/bookSettings'
import { translate as i18nT } from '@/i18n'

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

export interface BookExportCapabilities {
  contract_versions: number[]
  settings_version: number
  renderer_version: string
  pdf_available: boolean
  resumable: boolean
  direct_download: boolean
  unavailable_reason: string | null
}

export type BookSelectionCreatePayload =
  | {
      mode: 'filters'
      filters: { year_from: number; year_to: number }
      sort_order?: BookSettingsDto['sortOrder']
    }
  | { mode: 'ordered'; sort_order?: 'manual' }

export interface BookSelectionDraft {
  selection_id: string
  state: 'draft'
  travel_count: number
  next_sequence: number
}

export interface BookSelectionFinalized {
  selection_id: string
  state: 'finalized'
  travel_count: number
  selection_hash: string
}

export interface BookSelectionAppendPayload {
  sequence: number
  travel_ids: number[]
  idempotency_key: string
}

export interface BookExportV2CreatePayload {
  contract_version: 2
  selection_id: string
  settings_version: 1
  settings: BookSettingsDto
  format: 'pdf'
  idempotency_key: string
}

export interface BookExportV2CreatedJob {
  job_id: string
  status: 'queued'
  settings_hash: string
}

export type BookExportV2JobStatus =
  | 'queued'
  | 'running'
  | 'retry_wait'
  | 'cancel_requested'
  | 'cancelled'
  | 'done'
  | 'failed'
  | 'expired'

export interface BookExportV2Counter {
  expected: number | null
  completed: number
}

export interface BookExportV2Job {
  job_id: string
  status: BookExportV2JobStatus
  stage: string
  counters: Record<'travels' | 'blocks' | 'mediaOccurrences' | 'pages', BookExportV2Counter>
  snapshot_hash: string | null
  settings_hash: string
  completeness: 'complete' | 'incomplete' | 'pending'
  error_code: string
  retryable: boolean
  expires_at: string | null
  download: { available: boolean; size_bytes: number | null; checksum: string | null } | null
  snapshot_state: 'pending' | 'frozen' | 'failed'
  artifact_url: null
}

export interface BookExportV2JobPage {
  results: BookExportV2Job[]
  next_cursor: string | null
}

export interface BookExportV2JobListOptions {
  cursor?: string
  page_size?: number
}

export function getBookExportCapabilities(): Promise<BookExportCapabilities> {
  return apiClient.get<BookExportCapabilities>(`${BOOK_EXPORTS_ENDPOINT}capabilities/`)
}

export function createBookSelection(payload: BookSelectionCreatePayload): Promise<BookSelectionDraft> {
  return apiClient.post<BookSelectionDraft>(`${BOOK_EXPORTS_ENDPOINT}selections/`, payload)
}

export function appendBookSelection(
  selectionId: string,
  payload: BookSelectionAppendPayload,
): Promise<BookSelectionDraft> {
  return apiClient.patch<BookSelectionDraft>(
    `${BOOK_EXPORTS_ENDPOINT}selections/${encodeURIComponent(selectionId)}/`,
    payload,
  )
}

export function finalizeBookSelection(selectionId: string): Promise<BookSelectionFinalized> {
  return apiClient.post<BookSelectionFinalized>(
    `${BOOK_EXPORTS_ENDPOINT}selections/${encodeURIComponent(selectionId)}/finalize/`,
    {},
  )
}

export function createBookExportV2Job(payload: BookExportV2CreatePayload): Promise<BookExportV2CreatedJob> {
  return apiClient.post<BookExportV2CreatedJob>(BOOK_EXPORTS_ENDPOINT, payload)
}

export function getBookExportV2Job(jobId: string): Promise<BookExportV2Job> {
  return apiClient.get<BookExportV2Job>(`${BOOK_EXPORTS_ENDPOINT}${encodeURIComponent(jobId)}/`)
}

export function listBookExportV2Jobs(options: BookExportV2JobListOptions = {}): Promise<BookExportV2JobPage> {
  const params = new URLSearchParams()
  if (options.cursor !== undefined) params.set('cursor', options.cursor)
  if (options.page_size !== undefined) params.set('page_size', String(options.page_size))
  const query = params.toString()
  return apiClient.get<BookExportV2JobPage>(`${BOOK_EXPORTS_ENDPOINT}${query ? `?${query}` : ''}`)
}

// #2357: полная книга идёт серверным v2-заданием только при полной готовности
// конвейера — PDF, возобновляемость и прямая выдача файла. Частичная готовность
// (например, только снимок B2 без рендера B3) считается недоступностью.
export function isFullBookExportAvailable(capabilities: BookExportCapabilities | null | undefined): boolean {
  return Boolean(
    capabilities &&
      capabilities.contract_versions.includes(2) &&
      capabilities.settings_version === 1 &&
      capabilities.pdf_available &&
      capabilities.resumable &&
      capabilities.direct_download,
  )
}

export interface BookExportDownloadTicket {
  download_url: string
  expires_at: string
}

// #2356 B3: короткоживущий билет на одно задание владельца. Тело пустое —
// задание и владелец берутся из пути и сессии; сам файл браузер забирает
// прямым GET по download_url, без Blob в памяти страницы.
export function requestBookExportDownloadTicket(jobId: string): Promise<BookExportDownloadTicket> {
  return apiClient.post<BookExportDownloadTicket>(
    `${BOOK_EXPORTS_ENDPOINT}${encodeURIComponent(jobId)}/download-ticket/`,
    {},
  )
}

export function cancelBookExportV2Job(jobId: string): Promise<BookExportV2Job> {
  return apiClient.post<BookExportV2Job>(`${BOOK_EXPORTS_ENDPOINT}${encodeURIComponent(jobId)}/cancel/`, {})
}

export function retryBookExportV2Job(jobId: string): Promise<BookExportV2Job> {
  return apiClient.post<BookExportV2Job>(`${BOOK_EXPORTS_ENDPOINT}${encodeURIComponent(jobId)}/retry/`, {})
}

export class BookExportJobFailedError extends Error {
  readonly errorCode: string | null

  constructor(job: BookExportJob) {
    super(job.error_message || job.message || i18nT('errorsStatic:api.bookExport.serverFailed'))
    this.name = 'BookExportJobFailedError'
    this.errorCode = job.error_code ?? null
  }
}

export class BookExportJobTimeoutError extends Error {
  constructor(jobId: string) {
    super(i18nT('errorsStatic:api.bookExport.timeout', { jobId }))
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
