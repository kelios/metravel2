// #2357 F2: отправка полной книги за период серверным v2-заданием.
//
// Выбор «все путешествия за 2012–2013» делает сервер (B1 filters), а не клиент:
// каталог грузит страницы по 20 карточек, и «выбрать все загруженные» никогда не
// равно «все найденные». Клиент только задаёт период и порядок, подтверждает
// число и хеш замороженного выбора и создаёт задание с ключом идемпотентности.
// Повтор после неопределённого ответа идёт тем же ключом и тем же телом — второе
// задание не появляется. Ошибка не уводит в локальную сборку книги в браузере.

import {
  createBookExportV2Job,
  createBookSelection,
  finalizeBookSelection,
  type BookSelectionDraft,
  type BookSelectionFinalized,
} from '@/api/bookExportApi'
import { ApiError } from '@/api/clientErrors'
import {
  BOOK_SETTINGS_SCHEMA_VERSION,
  toBookSettingsDto,
  type BookSettings,
  type BookSettingsLocale,
} from '@/types/bookSettings'

export type FullBookSortOrder = BookSettings['sortOrder']

export interface FullBookPeriod {
  yearFrom: number
  yearTo: number
}

export interface FullBookPeriodDraft extends FullBookPeriod {
  selectionId: string
  sortOrder: FullBookSortOrder
  travelCount: number
}

export interface FullBookSubmission {
  jobId: string
  selection: BookSelectionFinalized
}

export const FULL_BOOK_MIN_YEAR = 1900
export const FULL_BOOK_SUBMIT_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1000

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function isValidFullBookPeriod(period: FullBookPeriod, currentYear = new Date().getFullYear()): boolean {
  const { yearFrom, yearTo } = period
  return (
    Number.isInteger(yearFrom) &&
    Number.isInteger(yearTo) &&
    yearFrom >= FULL_BOOK_MIN_YEAR &&
    yearTo <= currentYear &&
    yearFrom <= yearTo
  )
}

export function createFullBookOperationKey(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoRef?.randomUUID === 'function') return `book-v2-${cryptoRef.randomUUID()}`
  return `book-v2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

// Повторяем только то, где исход на сервере неизвестен: сеть, таймаут, 5xx.
// 4xx — окончательный ответ контракта (доступ, конфликт, схема).
export function isUncertainSubmitError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 0 || error.status >= 500
  return true
}

async function withUncertainRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < FULL_BOOK_SUBMIT_ATTEMPTS; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (!isUncertainSubmitError(error) || attempt === FULL_BOOK_SUBMIT_ATTEMPTS - 1) break
      await delay(RETRY_BASE_DELAY_MS * 2 ** attempt)
    }
  }
  throw lastError
}

export async function createFullBookPeriodDraft(
  period: FullBookPeriod,
  sortOrder: FullBookSortOrder,
): Promise<FullBookPeriodDraft> {
  const draft: BookSelectionDraft = await createBookSelection({
    mode: 'filters',
    filters: { year_from: period.yearFrom, year_to: period.yearTo },
    sort_order: sortOrder,
  })
  return {
    ...period,
    selectionId: draft.selection_id,
    sortOrder,
    travelCount: draft.travel_count,
  }
}

export interface SubmitFullBookOptions {
  draft: FullBookPeriodDraft
  settings: BookSettings
  locale: BookSettingsLocale
  operationKey: string
  /** Retain the exact selection when the same user operation is retried. */
  checkpoint?: FullBookSubmissionCheckpoint
  /** Owner-scoped callers stop subsequent requests if the account changes. */
  assertOwner?: () => void
}

export interface FullBookSubmissionCheckpoint {
  orderedDraft?: FullBookPeriodDraft
  selection?: BookSelectionFinalized
}

// Порядок книги задаёт выбор: сервер требует settings.sortOrder == sort_order
// замороженного выбора. Если в настройках выбран другой порядок, выбор за тот же
// период пересоздаётся — подменять порядок молча нельзя.
export async function submitFullBookExport({
  draft,
  settings,
  locale,
  operationKey,
  checkpoint = {},
  assertOwner = () => {},
}: SubmitFullBookOptions): Promise<FullBookSubmission> {
  assertOwner()
  const orderedDraft = checkpoint.orderedDraft ?? (
    draft.sortOrder === settings.sortOrder ? draft : await createFullBookPeriodDraft(draft, settings.sortOrder)
  )
  checkpoint.orderedDraft = orderedDraft

  const selection = checkpoint.selection ?? await withUncertainRetry(() => {
    assertOwner()
    return finalizeBookSelection(orderedDraft.selectionId)
  })
  checkpoint.selection = selection
  const payload = {
    contract_version: 2 as const,
    selection_id: selection.selection_id,
    settings_version: BOOK_SETTINGS_SCHEMA_VERSION,
    settings: toBookSettingsDto(settings, locale),
    format: 'pdf' as const,
    idempotency_key: operationKey,
  }
  const created = await withUncertainRetry(() => {
    assertOwner()
    return createBookExportV2Job(payload)
  })
  return { jobId: created.job_id, selection }
}
