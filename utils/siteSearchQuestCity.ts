// Сопоставление запроса поиска по сайту с городом квестов (#2775).
//
// У бэкенда нет текстового поиска по квестам: `/api/quests/?search=` параметр
// игнорирует. Поэтому `/search` находит город по справочнику `/api/quest-cities/`
// и уже по нему берёт квесты (`/api/quests/by-city/{id}/`). Модуль листовой:
// его импортирует экран поиска, и тянуть сюда слой данных квестов нельзя.

/** Короче этого запрос не ищет ни квестов, ни мест — и не уходит в сеть. */
export const SITE_SEARCH_MIN_QUERY_LENGTH = 3

/** Хвост после имени города в запросе («Браславские озёра» → «ские»). */
const MAX_INFLECTION_TAIL = 4
const MIN_CITY_NAME_FOR_TAIL_MATCH = 4

export type SiteSearchQuestCityCandidate = {
  id: number
  name?: string | null
  name_canonical?: string | null
}

/**
 * Регистр, диакритика (в том числе «ё» → «е» и «й» → «и» — обе стороны сравнения
 * проходят одно правило), дефисы и пунктуация, повторные пробелы.
 */
export function normalizeSiteSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-‐‑–—_.,;:!?'’"«»()/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSiteSearchQueryLongEnough(query: string): boolean {
  return normalizeSiteSearchText(query).length >= SITE_SEARCH_MIN_QUERY_LENGTH
}

/** 0 — точное совпадение, 1 — запрос начинает имя, 2 — имя начинает запрос; -1 — мимо. */
function rankCityName(name: string, query: string): number {
  if (!name) return -1
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.length >= MIN_CITY_NAME_FOR_TAIL_MATCH && query.startsWith(name)) {
    const tail = query.slice(name.length).split(' ')[0]
    if (tail.length <= MAX_INFLECTION_TAIL) return 2
  }
  return -1
}

/**
 * Лучший город для запроса. Сверяются оба имени: локализованное (`name` при
 * `?lang=`) и каноническое русское, поэтому «Braslaw» и «Браслав» находят один
 * город на любом языке интерфейса. При равном ранге выигрывает имя, ближайшее
 * к запросу по длине, затем меньший id — порядок не зависит от выдачи API.
 */
export function findQuestCityForQuery<T extends SiteSearchQuestCityCandidate>(
  cities: readonly T[],
  query: string,
): T | null {
  const normalizedQuery = normalizeSiteSearchText(query)
  if (normalizedQuery.length < SITE_SEARCH_MIN_QUERY_LENGTH) return null

  let best: { city: T; rank: number; distance: number } | null = null
  for (const city of cities) {
    for (const rawName of [city.name, city.name_canonical]) {
      const name = normalizeSiteSearchText(rawName)
      const rank = rankCityName(name, normalizedQuery)
      if (rank < 0) continue
      const distance = Math.abs(name.length - normalizedQuery.length)
      const better =
        !best ||
        rank < best.rank ||
        (rank === best.rank && distance < best.distance) ||
        (rank === best.rank && distance === best.distance && city.id < best.city.id)
      if (better) best = { city, rank, distance }
    }
  }
  return best?.city ?? null
}
