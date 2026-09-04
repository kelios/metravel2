import { translate as i18nT } from '@/i18n'
import { isChainNoiseSegment, splitGeocodeChain } from '@/utils/geocodeHelpers'
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

/** Индекс первого сегмента, который годится в заголовок: номер дома или индекс пропускается. */
const headSegmentIndex = (segments: string[]): number => {
  const index = segments.findIndex((s) => !isChainNoiseSegment(s))
  return index >= 0 ? index : 0
}

export const buildPlaceTitleParts = (point: PlaceTitleSource): PlaceTitleParts => {
  const rawName = String(point?.name ?? '').trim()
  const rawAddress = String(point?.address ?? '').trim()

  const addressSegments = rawAddress ? splitGeocodeChain(rawAddress) : []
  const dedupedAddress = addressSegments.join(', ')

  // Имя точки тоже бывает целой цепочкой геокодера — так писали до #1717, и так
  // лежат 84 % сохранённых точек. Заголовком берём его первый значимый сегмент,
  // цепочка целиком остаётся во второй строке (#1750).
  const nameSegments = rawName ? splitGeocodeChain(rawName) : []
  const name = nameSegments.length > 1 ? nameSegments[headSegmentIndex(nameSegments)]! : rawName

  // Explicit name that differs from the address → use it as the title and show
  // the (deduped) full address as the secondary line.
  if (
    name &&
    dedupedAddress &&
    name.localeCompare(dedupedAddress, undefined, { sensitivity: 'accent' }) !== 0
  ) {
    return { title: name, subtitle: dedupedAddress }
  }

  if (name) {
    return { title: name }
  }

  if (addressSegments.length === 0) {
    return { title: i18nT('map:components.MapPage.Map.placeTitle.tochka_marshruta_5d3f867d') }
  }

  // No name: take the first meaningful segment as the title (skipping pure
  // numeric noise like postal codes), keep the rest as the secondary address.
  const headIndex = headSegmentIndex(addressSegments)
  const title = addressSegments[headIndex]!
  const subtitle = addressSegments
    .filter((_, i) => i !== headIndex)
    .join(', ')
    .trim()

  return subtitle ? { title, subtitle } : { title }
}
