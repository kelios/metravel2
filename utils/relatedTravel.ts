import { getSiteBaseUrl } from '@/utils/seo'

export type RelatedTravelRef = {
  route: string
  id?: number
  slug?: string
}

export const normalizeRelatedTravelRoute = (rawUrl: string | null | undefined): string | null => {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!trimmed) return null

  if (trimmed.startsWith('/')) return trimmed

  try {
    const siteBase = new URL(getSiteBaseUrl())
    const parsed = new URL(trimmed, siteBase)
    if (parsed.host !== siteBase.host) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

/**
 * Resolve an internal app route for a travel link regardless of host.
 *
 * Marker/popup URLs come from the backend and are built against the API host,
 * which on dev/local API is NOT metravel.by (e.g. http://192.168.50.36/travel/...).
 * `normalizeRelatedTravelRoute` rejects foreign hosts, so on native such links
 * would otherwise leak to the external browser. For `/travel(s)/...` paths we
 * only care about the path + query, so we accept any host and return the
 * in-app route for expo-router navigation.
 */
export const resolveInternalTravelRoute = (rawUrl: string | null | undefined): string | null => {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!trimmed) return null

  const sameHostRoute = normalizeRelatedTravelRoute(trimmed)
  if (sameHostRoute) return sameHostRoute

  try {
    const parsed = new URL(trimmed, getSiteBaseUrl())
    const routeRoot = parsed.pathname.split('/').filter(Boolean)[0]
    if (routeRoot !== 'travel' && routeRoot !== 'travels') return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

/**
 * Явный id связанной статьи (#1960): положительный safe integer, иначе null.
 * Единственная проверка для всех источников id — API-поля точки карты, prop
 * стека ♥/статуса, URL-параметр deep-link и `tags` точки пользователя. Строка
 * принимается только из десятичных цифр: в таком виде id приходит в URL.
 */
export const normalizeRelatedTravelId = (value: unknown): number | null => {
  const text = typeof value === 'string' ? value.trim() : ''
  const numeric = typeof value === 'number' ? value : /^\d+$/.test(text) ? Number(text) : Number.NaN
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

/**
 * Единственный писатель `tags.travelUrl` / `tags.travelId` (#1963).
 * Id пишется только рядом со ссылкой и только если он нормализуется: без url
 * попап «Моих точек» стек не рисует, а болтающийся id без ссылки не читается.
 */
export const buildRelatedTravelTags = ({
  travelUrl,
  travelId,
  articleUrl,
  travelName,
}: {
  travelUrl?: string | null
  travelId?: unknown
  articleUrl?: string | null
  travelName?: string | null
}): Record<string, unknown> => {
  const tags: Record<string, unknown> = {}
  if (travelUrl) {
    tags.travelUrl = travelUrl
    const id = normalizeRelatedTravelId(travelId)
    if (id != null) tags.travelId = id
  }
  if (articleUrl) tags.articleUrl = articleUrl
  if (travelName) tags.travelName = travelName
  return tags
}

type MapPointRelatedTravelIdSource = {
  primarySource?: { travelId?: unknown } | null
  travelId?: unknown
}

/**
 * Id статьи, на которую ведёт плоский `urlTravel` точки карты (#1960).
 *
 * `primarySource.travelId` идёт первым: backend собирает `urlTravel` и
 * `primary_source` маркера из одной строки TravelAddress, поэтому это id ТОЙ ЖЕ
 * статьи, а не активного материала pager'а. Плоский `travelId` — для точек без
 * `primarySource`: deep-link из /places, карта «Рядом» и точки пользователя.
 */
export const resolveMapPointRelatedTravelId = (
  point: MapPointRelatedTravelIdSource | null | undefined,
): number | null =>
  normalizeRelatedTravelId(point?.primarySource?.travelId) ??
  normalizeRelatedTravelId(point?.travelId)

/**
 * Канонический путь статьи для structured data (#1960): `/travel(s)/<param>`
 * без query, hash и хоста. `?id=NNN` в JSON-LD размножал адреса статей дублями
 * (#1957), а хост dev/local API в разметку попадать не должен. Не-travel ссылка
 * даёт null. Навигация этим хелпером не пользуется — для переходов остаются
 * `normalizeRelatedTravelRoute`/`resolveInternalTravelRoute`.
 */
export const toCanonicalTravelPath = (rawUrl: string | null | undefined): string | null => {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!trimmed) return null

  try {
    const { pathname } = new URL(trimmed, getSiteBaseUrl())
    const [routeRoot, param] = pathname.split('/').filter(Boolean)
    if ((routeRoot !== 'travel' && routeRoot !== 'travels') || !param) return null
    return pathname
  } catch {
    return null
  }
}

export const resolveRelatedTravelRef = (rawUrl: string | null | undefined): RelatedTravelRef | null => {
  const route = normalizeRelatedTravelRoute(rawUrl)
  if (!route) return null

  try {
    const parsed = new URL(route, getSiteBaseUrl())
    const parts = parsed.pathname.split('/').filter(Boolean)
    const routeRoot = parts[0]
    const rawParam = parts[1] ? decodeURIComponent(parts[1]).trim() : ''

    if (!rawParam || (routeRoot !== 'travel' && routeRoot !== 'travels')) {
      return null
    }

    const normalizedRoute = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const numericId = Number(rawParam)
    if (Number.isFinite(numericId) && numericId > 0) {
      return {
        route: normalizedRoute,
        id: numericId,
      }
    }

    // Legacy fallback: `urlTravel` карты пока несёт id как `?id=NNN`. Основной
    // путь с #1960 — явный id из API (`resolveMapPointRelatedTravelId`), а разбор
    // query нужен до выката #1961 и для уже сохранённых `tags.travelUrl` точек
    // пользователя без `tags.travelId`. Без него стек снова делал бы запрос
    // статьи по slug на каждую карточку (N+1).
    const queryId = Number(parsed.searchParams.get('id'))
    if (Number.isFinite(queryId) && queryId > 0) {
      return {
        route: normalizedRoute,
        id: queryId,
        slug: rawParam,
      }
    }

    return {
      route: normalizedRoute,
      slug: rawParam,
    }
  } catch {
    return null
  }
}
