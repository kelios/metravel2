/**
 * #3323: постраничные адреса каталога статей для робота — `/search?page=N`.
 *
 * Свой адрес и серверный блок ссылок есть только у «чистого» каталога: без
 * параметров, кроме `page`. Адрес с фильтрами (`search`, `categories`, `sort`, …)
 * остаётся как был — без блока и с canonical на `/search`.
 */
export const SEARCH_CATALOG_PATH = '/search'

export type SearchCatalogQuery =
  | { kind: 'catalog'; page: number }
  | { kind: 'filtered' }
  | { kind: 'invalid' }

// Без ведущих нулей и знака: у страницы ровно один адрес.
const PAGE_PATTERN = /^[1-9]\d{0,5}$/

/** Разбор query каталога; повтор `page` и мусор в нём — `invalid`. */
export function parseSearchCatalogQuery(entries: Iterable<readonly [string, string]>): SearchCatalogQuery {
  const pages: string[] = []
  for (const [key, value] of entries) {
    if (key !== 'page') return { kind: 'filtered' }
    pages.push(value)
  }
  if (!pages.length) return { kind: 'catalog', page: 1 }
  if (pages.length > 1 || !PAGE_PATTERN.test(pages[0])) return { kind: 'invalid' }
  return { kind: 'catalog', page: Number(pages[0]) }
}

/** Пары query из `useLocalSearchParams` (значение бывает массивом). */
export function searchParamsEntries(params: Record<string, string | string[] | undefined>): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) entries.push([key, item])
  }
  return entries
}

/** Адрес страницы каталога: первая — сам `/search`, без `?page=1`. */
export function searchCatalogPagePath(page: number): string {
  return page > 1 ? `${SEARCH_CATALOG_PATH}?page=${page}` : SEARCH_CATALOG_PATH
}
