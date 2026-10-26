// Источники блока «Ещё по запросу» на `/search` (#2775): квесты города и места.
//
// Модуль грузится динамическим импортом из `useSearchAlsoFound`: слой данных
// квестов (адаптеры, офлайн-кэш) и каталог мест не должны попадать в eager-граф
// каталога статей, который делят `/search`, `/travelsby` и `/metravel`.

import { apiClient } from '@/api/client'
import { unwrapPaginated } from '@/api/clientResponse'
import { fetchPlacesCatalog } from '@/api/places'
import { fetchQuestsByCity, type ApiQuestCity } from '@/api/quests'
import { withQuestLang } from '@/api/questContentLocale'
import { fetchAllPages } from '@/utils/fetchAllPages'
import type { CatalogPlace } from '@/utils/placesCatalog'
import { adaptMeta, type QuestMeta } from '@/utils/questAdapters'
import { buildQuestCityLandingGroups } from '@/utils/questCityAlias'
import { selectPopularQuests } from '@/utils/questPopularity'

/** Потолок пагинации бэкенда (`max_page_size = 100`): справочник — две страницы. */
const QUEST_CITIES_PAGE_SIZE = 100
const QUEST_CITIES_MAX_PAGES = 10

export const SITE_SEARCH_PREVIEW_LIMIT = 3

/** Справочник городов квестов на языке `locale` (`name` локализован, `name_canonical` — источник). */
export async function fetchQuestCitiesDirectory(
  locale: string,
  signal?: AbortSignal,
): Promise<ApiQuestCity[]> {
  return fetchAllPages<ApiQuestCity>(
    async (page) => {
      const path = `/quest-cities/?page_size=${QUEST_CITIES_PAGE_SIZE}${page > 1 ? `&page=${page}` : ''}`
      const payload = await apiClient.get<unknown>(
        withQuestLang(path, locale),
        undefined,
        signal ? { signal } : undefined,
      )
      return unwrapPaginated<ApiQuestCity>(payload)
    },
    { maxPages: QUEST_CITIES_MAX_PAGES },
  )
}

export type SiteSearchCityQuests = {
  quests: QuestMeta[]
  total: number
  /** Сегмент посадочной `/quests/<segment>`: alias города или его id. */
  citySegment: string
  /** Имя города на языке запроса (`city_name_localized`), иначе имя контента. */
  cityName: string
}

/** До трёх самых популярных квестов города и адрес посадочной города. */
export async function fetchSiteSearchCityQuests(
  cityId: number,
  locale: string,
): Promise<SiteSearchCityQuests> {
  const list = await fetchQuestsByCity(cityId, locale)
  const group = buildQuestCityLandingGroups(list)[0]
  return {
    quests: selectPopularQuests(list, SITE_SEARCH_PREVIEW_LIMIT).map(adaptMeta),
    total: list.length,
    citySegment: group?.segment ?? String(cityId),
    cityName: group?.cityName ?? '',
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
  const page = await fetchPlacesCatalog({ page: 1, perPage: SITE_SEARCH_PREVIEW_LIMIT, q: query }, signal)
  return {
    places: page.places.slice(0, SITE_SEARCH_PREVIEW_LIMIT),
    total: Math.max(page.count, page.places.length),
  }
}
