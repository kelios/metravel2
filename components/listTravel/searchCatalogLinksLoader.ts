import type { ImmutableRequest } from 'expo-server'
import { fetchPublicRouteJsonResponse, publicRouteError } from '@/utils/ssr/fetchPublicRouteJson'
import { memoizePublicRouteData, type PublicRouteRequest } from '@/utils/ssr/publicRouteData'
import { buildTravelPath } from '@/utils/routePaths'
import { parseSearchCatalogQuery, searchCatalogPagePath } from './searchCatalogPage'

export type SearchCatalogLink = { path: string; title: string }
export type SearchCatalogLinks = {
  page: number
  prevPath: string | null
  nextPath: string | null
  links: SearchCatalogLink[]
}
export type SearchCatalogLinksPayload = SearchCatalogLinks | null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Ответ `GET /api/travels/catalog-links/?page=N` → ссылки страницы; `title: null` — подпись slug. */
export function projectSearchCatalogLinks(data: unknown, page: number): SearchCatalogLinks | null {
  if (!isRecord(data) || !Array.isArray(data.results)) return null
  const pages = Number(data.pages)
  if (!Number.isInteger(pages) || pages < 1) return null
  if (page > pages) throw publicRouteError(404)
  const links: SearchCatalogLink[] = []
  for (const item of data.results) {
    if (!isRecord(item) || typeof item.slug !== 'string') continue
    const path = buildTravelPath(item.slug)
    if (!path) continue
    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : item.slug.trim()
    links.push({ path, title })
  }
  return {
    page,
    prevPath: page > 1 ? searchCatalogPagePath(page - 1) : null,
    nextPath: page < pages ? searchCatalogPagePath(page + 1) : null,
    links,
  }
}

function fetchSearchCatalogLinks(request: PublicRouteRequest, page: number): Promise<SearchCatalogLinksPayload> {
  return memoizePublicRouteData(request, `search-catalog-links:${page}`, async () => {
    try {
      const response = await fetchPublicRouteJsonResponse(request, `travels/catalog-links/?page=${page}`)
      if (response.status === 404 || response.status === 410) throw publicRouteError(404)
      const links = response.ok ? projectSearchCatalogLinks(response.data, page) : null
      if (!links) throw publicRouteError(503)
      return links
    } catch (error) {
      // Первая страница — сам каталог: сбой вспомогательного запроса не роняет
      // /search, блок ссылок просто не рисуется. Адрес `?page=N` существует
      // только ради блока, поэтому там сбой — 503/404.
      if (page === 1) return null
      throw error
    }
  })
}

/**
 * #3323: ссылки на статьи текущей страницы каталога для серверного HTML
 * `/search` и `/search?page=N`. Без SSR-рантайма и на адресе с фильтрами —
 * `null`, и экран работает как раньше.
 */
export async function loadSearchCatalogLinks(request: ImmutableRequest | undefined): Promise<SearchCatalogLinksPayload> {
  if (!request || process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR !== 'true') return null
  const query = parseSearchCatalogQuery(new URL(request.url).searchParams)
  if (query.kind === 'filtered') return null
  // Невалидный `page` — 404, как у страницы вне диапазона: иначе любой мусор в
  // параметре стал бы ещё одной копией каталога.
  if (query.kind === 'invalid') throw publicRouteError(404)
  return fetchSearchCatalogLinks(request, query.page)
}
