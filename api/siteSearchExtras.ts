// Источники блока «Ещё по запросу» на `/search` (#2775): квесты города и места.
//
// Модуль грузится динамическим импортом из `useSearchAlsoFound`: слой данных
// квестов (адаптеры, офлайн-кэш) и каталог мест не должны попадать в eager-граф
// каталога статей, который делят `/search`, `/travelsby` и `/metravel`.

import { apiClient } from '@/api/client'
import { fetchPlacesCatalog } from '@/api/places'
import { withQuestMetaDefaults, type ApiQuestMeta } from '@/api/quests'
import type { CatalogPlace } from '@/utils/placesCatalog'
import { adaptMeta, type QuestMeta } from '@/utils/questAdapters'

const SITE_SEARCH_PLACES_LIMIT = 3

type QuestCityPreviewDto = {
  city: { slug: string; name: string } | null
  count: number
  results: ApiQuestMeta[]
}

export type SiteSearchCityQuests = {
  quests: QuestMeta[]
  total: number
  citySegment: string | null
  cityName: string
}

export async function fetchSiteSearchQuestPreview(
  query: string,
  locale: string,
  signal: AbortSignal,
): Promise<SiteSearchCityQuests> {
  const params = new URLSearchParams({ q: query, locale })
  const preview = await apiClient.get<QuestCityPreviewDto>(
    `/quests/search-city-preview/?${params}`,
    undefined,
    { signal },
  )
  return {
    quests: preview.results.map((quest) => adaptMeta(withQuestMetaDefaults(quest))),
    total: preview.count,
    citySegment: preview.city?.slug ?? null,
    cityName: preview.city?.name ?? '',
  }
}

export type SiteSearchPlaces = {
  places: CatalogPlace[]
  total: number
}

/** Первые места каталога по названию (`/api/places/catalog/?q=`). */
export async function fetchSiteSearchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<SiteSearchPlaces> {
  const page = await fetchPlacesCatalog({ page: 1, perPage: SITE_SEARCH_PLACES_LIMIT, q: query }, signal)
  return {
    places: page.places.slice(0, SITE_SEARCH_PLACES_LIMIT),
    total: Math.max(page.count, page.places.length),
  }
}
