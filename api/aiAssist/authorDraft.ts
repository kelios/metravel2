/**
 * Клиент `POST /ai/author-draft` (#2885): панель «Помощник автора» в визарде статьи
 * просит у службы metravel-assist варианты заголовка, лида или SEO-описания по тексту
 * статьи. Один запрос — один `fetch` с таймаутом `AUTHOR_DRAFT_TIMEOUT_MS`; коды
 * сервера превращаются в `AuthorDraftError.kind`, по которому панель выбирает
 * состояние: `limit` (429 limit) · `unavailable` (503, 429 busy, сеть, таймаут) ·
 * `bad_request` (400). Модуль живёт в `api/aiAssist`, то есть попадает в сборку
 * только под `EXPO_PUBLIC_AI_ASSISTANT` (#2738) — панель грузит его отложенным чанком.
 */

import { AI_AUTHOR_DRAFT_MAX_TEXT_CHARS, type AiAuthorDraftKind } from './policy'

export const AUTHOR_DRAFT_TIMEOUT_MS = 20_000

export type AuthorDraftErrorKind = 'limit' | 'unavailable' | 'bad_request'

export class AuthorDraftError extends Error {
  readonly kind: AuthorDraftErrorKind
  readonly status: number | null
  readonly retryAfterSec: number | null

  constructor(kind: AuthorDraftErrorKind, message: string, options: { status?: number | null; retryAfterSec?: number | null } = {}) {
    super(message)
    this.name = 'AuthorDraftError'
    this.kind = kind
    this.status = options.status ?? null
    this.retryAfterSec = options.retryAfterSec ?? null
  }
}

export const isAuthorDraftError = (error: unknown): error is AuthorDraftError =>
  error instanceof AuthorDraftError || (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AuthorDraftError')

export type AuthorDraftRequest = {
  /** Origin службы без слэша; пустая строка — same-origin (web за Metro/nginx). */
  baseUrl: string
  text: string
  kind: AiAuthorDraftKind
  locale: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export type AuthorDraftResult = {
  variants: string[]
  /** Сколько запросов помощника осталось сегодня; `null` — сервер не сообщил. */
  remaining: number | null
}

/** Текст для запроса: хвост длиннее бюджета службы отбрасывается по границе слова. */
export const trimAuthorDraftText = (text: string, maxChars: number = AI_AUTHOR_DRAFT_MAX_TEXT_CHARS): string => {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  const head = normalized.slice(0, maxChars)
  const wordEnd = head.lastIndexOf(' ')
  return wordEnd > maxChars / 2 ? head.slice(0, wordEnd) : head
}

const readRetryAfter = (response: Response, body: Record<string, unknown> | null): number | null => {
  const fromBody = Number(body?.retry_after_sec)
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody
  const header = Number(response.headers?.get?.('retry-after'))
  return Number.isFinite(header) && header > 0 ? header : null
}

export async function requestAuthorDraft({ baseUrl, text, kind, locale, signal, fetchImpl, timeoutMs }: AuthorDraftRequest): Promise<AuthorDraftResult> {
  const doFetch = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs ?? AUTHOR_DRAFT_TIMEOUT_MS)
  const forwardAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', forwardAbort, { once: true })
  }

  try {
    let response: Response
    try {
      response = await doFetch(`${String(baseUrl ?? '').replace(/\/+$/, '')}/ai/author-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ text: trimAuthorDraftText(text), kind, locale }),
        signal: controller.signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new AuthorDraftError('unavailable', timedOut ? `author-draft timed out after ${timeoutMs ?? AUTHOR_DRAFT_TIMEOUT_MS} ms` : 'author-draft unreachable')
    }

    let body: Record<string, unknown> | null = null
    try {
      body = (await response.json()) as Record<string, unknown>
    } catch {
      body = null
    }

    if (response.ok) {
      const variants = Array.isArray(body?.variants) ? (body!.variants as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
      if (!variants.length) throw new AuthorDraftError('unavailable', 'author-draft returned no variants', { status: response.status })
      const remaining = Number(body?.remaining)
      return { variants, remaining: Number.isFinite(remaining) ? remaining : null }
    }

    const code = typeof body?.error === 'string' ? body.error : ''
    const detail = typeof body?.detail === 'string' ? body.detail : `author-draft HTTP ${response.status}`
    const retryAfterSec = readRetryAfter(response, body)
    if (response.status === 400) throw new AuthorDraftError('bad_request', detail, { status: 400 })
    if (response.status === 429 && code === 'limit') throw new AuthorDraftError('limit', detail, { status: 429, retryAfterSec })
    throw new AuthorDraftError('unavailable', detail, { status: response.status, retryAfterSec })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
