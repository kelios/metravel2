/**
 * Лексическая половина гибрида: ранжированный поиск бэкенда (#1581) —
 * `GET /api/travels/?query=<q>&page_size=<n>`. Замер на проде 18.10.2026: `searchextended`
 * из плана отдаёт 404; `cards/?query=` не кэшируется и отвечает 3,6–5,5 с на любой запрос;
 * `travels/?query=` кэшируется бэкендом на час (первый вызов 5,4 с, повторный 0,43 с) — его и
 * используем. Любой сбой или таймаут → null: сервис отвечает векторной частью с
 * `degraded: true`, а не ждёт и не падает.
 */

import { coverUrl } from '../ai-index/chunk.ts'

export interface LexicalHit {
  source_id: number
  title: string
  /** Абсолютный URL страницы, как в индексе. */
  url: string
  city: string | null
  country: string | null
  cover: string | null
}

export type LexicalSearch = (q: string, limit: number) => Promise<LexicalHit[] | null>

interface CardRow {
  id?: unknown
  title?: unknown
  name?: unknown
  url?: unknown
  slug?: unknown
  cityName?: unknown
  countryName?: unknown
  travel_image_thumb_url?: unknown
}

const BROKEN_SEGMENT = /\/(?:null|undefined|0)(?:\/|$)/

/**
 * Путь статьи: сначала slug (как buildTravelPathFromTravel в utils/routePaths.ts), поле url бэкенда —
 * запасной вариант: в #1438 оно приходило как /travels/null и /travels/undefined.
 */
function travelPath(row: CardRow): string {
  if (typeof row.slug === 'string' && row.slug && !BROKEN_SEGMENT.test(`/${row.slug}`)) return `/travels/${row.slug}`
  if (typeof row.url === 'string' && row.url && !BROKEN_SEGMENT.test(row.url)) return row.url
  return ''
}

export function parseCards(payload: unknown, siteUrlInput: string): LexicalHit[] {
  const siteUrl = siteUrlInput.replace(/\/+$/, '')
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown }).results)
      ? ((payload as { results: unknown[] }).results as CardRow[])
      : []
  const out: LexicalHit[] = []
  for (const row of rows as CardRow[]) {
    const id = Number(row.id)
    if (!Number.isInteger(id) || id <= 0) continue
    const title = typeof row.title === 'string' && row.title ? row.title : typeof row.name === 'string' ? row.name : ''
    const path = travelPath(row)
    if (!path) continue
    out.push({
      source_id: id,
      title,
      url: /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`,
      city: typeof row.cityName === 'string' && row.cityName ? row.cityName : null,
      country: typeof row.countryName === 'string' && row.countryName ? row.countryName : null,
      cover: coverUrl(row.travel_image_thumb_url),
    })
  }
  return out
}

export interface LexicalOptions {
  backendUrl: string
  timeoutMs: number
  /** База абсолютных URL в ответе (как в индексе), по умолчанию — сайт. */
  siteUrl?: string
  fetchImpl?: typeof fetch
  log?: (line: string) => void
}

export function createLexicalSearch(options: LexicalOptions): LexicalSearch {
  const siteUrl = options.siteUrl ?? 'https://metravel.by'
  const backendUrl = options.backendUrl.replace(/\/+$/, '')
  const fetchImpl = options.fetchImpl ?? fetch
  return async (q, limit) => {
    const url = `${backendUrl}/api/travels/?query=${encodeURIComponent(q)}&page_size=${limit}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs)
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'metravel-assist/1.0' },
      })
      if (!response.ok) {
        options.log?.(`lexical: ${response.status} от ${options.backendUrl}`)
        return null
      }
      return parseCards(await response.json(), siteUrl)
    } catch (error) {
      options.log?.(`lexical: ${error instanceof Error ? error.message : String(error)}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}
