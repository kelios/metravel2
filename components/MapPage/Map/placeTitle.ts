/**
 * Shared title/subtitle derivation for map places.
 *
 * Reverse-geocoded points arrive with a `name` that is often a raw address
 * («3, Рыночная площадь, Old Town, Краков, …») rather than a clean POI label.
 * This util turns such a record into a clean title + secondary address line.
 *
 * Used by both the marker popup (createMapPopupComponent) and the list cards
 * («Места рядом») so the two paths never diverge.
 */

export interface PlaceTitleSource {
  name?: unknown
  address?: unknown
}

export interface PlaceTitleParts {
  title: string
  subtitle?: string
}

export const stripCountryFromCategoryString = (raw: unknown, address?: string | null): string => {
  const category = String(raw ?? '').trim()
  if (!category) return ''
  const addr = String(address ?? '').trim()
  const countryCandidate = addr
    ? addr
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(-1)[0]
    : ''
  if (!countryCandidate) return category
  const filtered = category
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0)
  return filtered.join(', ')
}

/**
 * Splits a comma-separated address into trimmed, non-empty segments and removes
 * duplicate tokens (case/accent-insensitive). Reverse-geocoded addresses often
 * repeat a place name in two languages or list the same district twice, e.g.
 * «Wawel, Podzamcze, Old Town, Stare Miasto, Old Town, Краков, …». We keep the
 * first occurrence and drop any later repeat (not just consecutive ones).
 */
export const dedupeAddressSegments = (rawAddress: string): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of rawAddress.split(',').map((p) => p.trim())) {
    if (!part) continue
    const key = part.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(part)
  }
  return out
}

// Segments that are pure postal codes / house numbers — not a meaningful name.
export const isNoiseSegment = (segment: string): boolean => /^[\d\s-]+$/.test(segment)

export const buildPlaceTitleParts = (point: PlaceTitleSource): PlaceTitleParts => {
  const rawName = String(point?.name ?? '').trim()
  const rawAddress = String(point?.address ?? '').trim()

  const addressSegments = rawAddress ? dedupeAddressSegments(rawAddress) : []
  const dedupedAddress = addressSegments.join(', ')

  // Explicit name that differs from the address → use it as the title and show
  // the (deduped) full address as the secondary line.
  if (
    rawName &&
    dedupedAddress &&
    rawName.localeCompare(dedupedAddress, undefined, { sensitivity: 'accent' }) !== 0
  ) {
    return { title: rawName, subtitle: dedupedAddress }
  }

  if (rawName) {
    return { title: rawName }
  }

  if (addressSegments.length === 0) {
    return { title: 'Точка маршрута' }
  }

  // No name: take the first meaningful segment as the title (skipping pure
  // numeric noise like postal codes), keep the rest as the secondary address.
  const headIndex = addressSegments.findIndex((s) => !isNoiseSegment(s))
  const title = headIndex >= 0 ? addressSegments[headIndex]! : addressSegments[0]!
  const subtitle = addressSegments
    .filter((_, i) => i !== headIndex)
    .join(', ')
    .trim()

  return subtitle ? { title, subtitle } : { title }
}
