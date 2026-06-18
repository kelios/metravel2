import { Platform } from 'react-native'

import { getMapPointKey } from '@/hooks/map/useMapTravels'
import { buildPlaceTitleParts } from '@/components/MapPage/Map/placeTitle'

export const IS_WEB = Platform.OS === 'web'
export const WEB_LIST_OVERSCAN_ITEMS = 5
export const WEB_ESTIMATED_ITEM_HEIGHT_PX = 340
export const WEB_DEFAULT_VIEWPORT_HEIGHT = 600
export const LOAD_MORE_THRESHOLD_RATIO = 0.5
export const PLACE_COUNT_BADGE_CAP = 999
// Запас снизу для native-списка мест внутри шторки (+ safe-area inset сверху).
export const LIST_BOTTOM_PADDING = 96

export const EMPTY_FAVORITES = new Set<string | number>()

export function getPlacesLabel(count: number) {
  const absCount = Math.abs(count) % 100
  const lastDigit = absCount % 10
  if (absCount > 10 && absCount < 20) return 'мест'
  if (lastDigit === 1) return 'место'
  if (lastDigit >= 2 && lastDigit <= 4) return 'места'
  return 'мест'
}

export function buildTravelListSummaryHint({
  travelsCount,
  compactPreview,
  currentRadiusKm,
  userLocation,
}: {
  travelsCount: number
  compactPreview: boolean
  currentRadiusKm?: string | number | null
  userLocation?: { latitude: number; longitude: number } | null
}) {
  if (compactPreview) {
    return 'Ближайшие места одним взглядом. Полный список откроет больше вариантов.'
  }

  const placesCountLabel =
    travelsCount > PLACE_COUNT_BADGE_CAP ? `${PLACE_COUNT_BADGE_CAP}+` : String(travelsCount)
  const placesWord = getPlacesLabel(travelsCount)
  const hasRadiusContext = currentRadiusKm != null && String(currentRadiusKm).trim() !== ''

  if (hasRadiusContext) {
    return `${placesCountLabel} ${placesWord} в радиусе ${currentRadiusKm} км${userLocation ? ' рядом с вами' : ''}. Нажмите на карточку, чтобы сфокусировать карту.`
  }

  if (userLocation) {
    return `${placesCountLabel} ${placesWord} рядом с вами. Нажмите на карточку, чтобы сфокусировать карту.`
  }

  return `${placesCountLabel} ${placesWord} рядом. Нажмите на карточку, чтобы сфокусировать карту.`
}

// Clean POI title for the compact preview card, shared with the popup and the
// «Места рядом» list cards (buildPlaceTitleParts) so titles never diverge.
export const getTravelItemTitle = (item: any): string => {
  const { title } = buildPlaceTitleParts({ name: item?.name ?? item?.title, address: item?.address })
  return title
}

export const getTravelItemSubtitle = (item: any): string => {
  const category = item?.categoryName || item?.category || item?.typeName
  if (category) return String(category)
  if (item?.coord) return String(item.coord)
  return 'Место рядом'
}

export const getTravelItemId = (item: any): string | number | undefined =>
  item?.id ?? item?._id ?? item?.slug ?? item?.uid

// Координат-уникальный ключ, консистентный с getMapTravelIdentity: после
// перехода дедупа на (urlTravel@coord) одно путешествие даёт несколько точек,
// и ключ по travel-уровню (id/urlTravel) рождал дубли React-ключей.
// index обязателен и идёт в хвост — гарантирует уникальность при совпадении
// координат. index должен быть АБСОЛЮТНЫМ по visibleTravelsData, чтобы web-окно
// (itemKeys + recordItemHeight) и нативный keyExtractor совпадали.
export const getTravelItemKey = (item: any, index: number): string =>
  getMapPointKey(item, index)

// Variable-height windowing: card heights vary (~200–360px depending on
// breakpoint/content), so a single fixed estimate produces drifting spacers
// and scroll jumps. We use measured heights (falling back to the estimate for
// rows not yet laid out) and a running offset scan.
export function computeVirtualWindowVariable(
  scrollY: number,
  viewportH: number,
  itemCount: number,
  getItemHeight: (index: number) => number,
  overscan: number,
) {
  let startIndex = 0
  let endIndex = itemCount
  let topSpacerHeight = 0
  let bottomSpacerHeight = 0

  let offset = 0
  let i = 0
  for (; i < itemCount; i++) {
    const h = getItemHeight(i)
    if (offset + h > scrollY) break
    offset += h
  }
  startIndex = Math.max(0, i - overscan)

  let topOffset = 0
  for (let k = 0; k < startIndex; k++) topOffset += getItemHeight(k)
  topSpacerHeight = topOffset

  let visibleBottom = topOffset
  let j = startIndex
  for (; j < itemCount; j++) {
    if (visibleBottom > scrollY + viewportH) break
    visibleBottom += getItemHeight(j)
  }
  endIndex = Math.min(itemCount, j + overscan)

  let bottomOffset = 0
  for (let k = endIndex; k < itemCount; k++) bottomOffset += getItemHeight(k)
  bottomSpacerHeight = Math.max(0, bottomOffset)

  return { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight }
}
