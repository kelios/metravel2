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

    return {
      route: normalizedRoute,
      slug: rawParam,
    }
  } catch {
    return null
  }
}
