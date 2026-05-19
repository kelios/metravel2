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

    // Slug routes from the places catalog carry the canonical id as `?id=NNN`.
    // Reading it lets the related-travel buttons render without a per-card
    // travel-detail fetch (avoids an N+1 across the list).
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
