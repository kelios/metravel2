import type { GalleryItem } from './types'

const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '')

export const safeEncodeUrl = (value: string): string => {
  try {
    return encodeURI(decodeURI(value))
  } catch {
    return encodeURI(value)
  }
}

export const isBackendImageId = (value: string | null | undefined): boolean => {
  if (!value) return false
  return /^\d+$/.test(String(value))
}

export const extractBackendImageIdFromUrl = (value: string | null | undefined): string | null => {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const match = raw.match(/(?:\/media)?\/gallery\/(\d+)(?:\/|$)/)
  if (match?.[1]) return match[1]

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://example.test')
    const id = parsed.searchParams.get('id')
    return isBackendImageId(id) ? String(id) : null
  } catch {
    return null
  }
}

export const canonicalizeUrlForDedupe = (value: string): string => {
  const raw = String(value ?? '').trim()
  if (!raw) return raw
  if (/^(blob:|data:)/i.test(raw)) return raw

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://example.test')
    parsed.searchParams.delete('__retry')
    parsed.hash = ''

    if (/^https?:$/i.test(parsed.protocol)) {
      const search = parsed.searchParams.toString()
      return `${parsed.pathname}${search ? `?${search}` : ''}`
    }

    return parsed.toString()
  } catch {
    return raw.replace(/([?&])__retry=\d+(&)?/g, '$1').replace(/[?&]$/, '').split('#')[0]
  }
}

export const dedupeGalleryItems = (items: GalleryItem[]): GalleryItem[] => {
  const map = new Map<string, GalleryItem>()
  const order: string[] = []

  for (const item of items) {
    const canonicalUrl = canonicalizeUrlForDedupe(String(item.url || ''))
    const key = canonicalUrl ? `url:${canonicalUrl}` : `id:${String(item.id ?? '')}`

    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      order.push(key)
      continue
    }

    const existingBackend = isBackendImageId(existing.id)
    const nextBackend = isBackendImageId(item.id)
    if (!existingBackend && nextBackend) {
      map.set(key, item)
      continue
    }

    const existingUploading = Boolean(existing.isUploading)
    const nextUploading = Boolean(item.isUploading)
    if (existingUploading && !nextUploading) {
      map.set(key, item)
    }
  }

  const snapshot = order.map((k) => map.get(k)!).filter(Boolean)

  const seenBackendIds = new Set<string>()
  return snapshot.filter((item) => {
    if (!isBackendImageId(item.id)) return true
    const id = String(item.id)
    if (seenBackendIds.has(id)) return false
    seenBackendIds.add(id)
    return true
  })
}

export const ensureAbsoluteUrl = (value: string): string => {
  if (!value) return value

  try {
    return safeEncodeUrl(new URL(value).toString())
  } catch {
    void 0
  }

  const base =
    API_BASE_URL?.replace(/\/api\/?$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : undefined)
  if (!base) return value

  try {
    return safeEncodeUrl(new URL(value, base).toString())
  } catch {
    return value
  }
}

export const buildApiPrefixedUrl = (value: string): string | null => {
  try {
    const baseRaw = process.env.EXPO_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!/\/api\/?$/i.test(baseRaw)) return null

    const apiOrigin = baseRaw.replace(/\/api\/?$/, '')
    const parsed = new URL(value, apiOrigin)
    if (parsed.pathname.startsWith('/api/')) return null

    return `${apiOrigin}/api${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

export const normalizeDisplayUrl = (value: string): string => {
  const absolute = ensureAbsoluteUrl(value)
  if (typeof window === 'undefined') return absolute

  try {
    const parsed = new URL(absolute)
    const currentOrigin = window.location.origin

    const isPrivateIp = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(absolute)
    const isOnLocalhost = /localhost|127\.0\.0\.1/i.test(currentOrigin)

    if (isPrivateIp && isOnLocalhost) {
      if (parsed.protocol === 'https:') {
        parsed.protocol = 'http:'
      }
      return parsed.toString()
    }

    if (window.location.protocol === 'https:' && parsed.protocol === 'http:' && parsed.hostname === window.location.hostname) {
      parsed.protocol = 'https:'
      return parsed.toString()
    }
    return parsed.toString()
  } catch {
    return absolute
  }
}
