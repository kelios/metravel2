import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'

export type PlacesCatalogSource = 'desktop_navigation' | 'mobile_menu' | 'direct'
export type PlacesCatalogAction = 'collection' | 'open_map' | 'open_travel'
export type PlacesCatalogSearchOutcome = 'found' | 'empty' | 'error'

export const placesCatalogSource = (value: unknown): PlacesCatalogSource =>
  value === 'desktop_navigation' || value === 'mobile_menu' ? value : 'direct'

export const isPlacesCatalogHref = (href: unknown): href is string =>
  typeof href === 'string' && /^\/(?:ru\/|be\/|uk\/|pl\/|en\/)?places\/?(?:[?#]|$)/.test(href)

/** A finite source belongs in real hrefs; no opaque identifier or private context. */
export function placesCatalogHref(href: string, source: PlacesCatalogSource): string {
  if (!isPlacesCatalogHref(href)) return href
  const url = new URL(href, 'https://metravel.by')
  url.searchParams.set('places_source', placesCatalogSource(source))
  return `${url.pathname}${url.search}${url.hash}`
}

type CatalogEvent = 'places_catalog_impression' | 'places_catalog_entry' | 'places_catalog_opened'
  | 'places_catalog_search' | 'places_catalog_collection' | 'places_catalog_open_map' | 'places_catalog_open_travel'

export function emitPlacesCatalogEvent(event: CatalogEvent, source: PlacesCatalogSource, params: Record<string, unknown> = {}): void {
  if (Platform.OS !== 'web') return
  void sendAnalyticsEvent(event, {
    event_category: 'places_catalog',
    event_label: source,
    source,
    ...params,
  })
}

export function trackPlacesCatalogNavigation(source: PlacesCatalogSource, stage: 'impression' | 'entry'): void {
  emitPlacesCatalogEvent(stage === 'impression' ? 'places_catalog_impression' : 'places_catalog_entry', source)
}
