import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'
import { useQuestContentLocale } from '@/hooks/useQuestContentLocale'
import { translate as i18nT, translatePlural } from '@/i18n'
import { formatInteger } from '@/i18n/format'
import { readRetryOnce } from '@/utils/queryRetryPolicy'
import { findQuestCityForQuery, isSiteSearchQueryLongEnough } from '@/utils/siteSearchQuestCity'
import SearchAlsoFoundSummary, { type SearchAlsoFoundStatus } from '../SearchAlsoFoundSummary'

// Справочник городов меняется редко: сутки свежести, чтобы повторные запросы
// поиска не ходили за ним снова.
const QUEST_CITIES_STALE_TIME = 24 * 60 * 60 * 1000
const PLACES_STALE_TIME = 5 * 60 * 1000

// Раскрытый список (карточка квеста с медиа) — отдельный чанк. Он догружается,
// как только есть что раскрывать, поэтому тап по сводке открывает готовый список.
let listRequest: Promise<typeof import('../SearchAlsoFound')> | null = null
const loadList = () => {
  listRequest ??= import('../SearchAlsoFound').catch((error: unknown) => {
    listRequest = null
    throw error
  })
  return listRequest
}
const SearchAlsoFoundList = lazy(loadList)

const loadExtras = () => import('@/api/siteSearchExtras')

const NO_QUESTS: never[] = []
const NO_PLACES: never[] = []

type Input = {
  /** Уже дебаунснутый запрос каталога (`debSearch`). */
  query: string
  /** Экран `/search`: справочник городов прогревается сразу, до ввода запроса. */
  enabled: boolean
  userId: string | null
}

function buildSummaryLabel(status: SearchAlsoFoundStatus, questsTotal: number, placesTotal: number): string {
  if (status === 'loading') return i18nT('travel:components.listTravel.SearchAlsoFound.loading')
  if (status === 'empty') return i18nT('travel:components.listTravel.SearchAlsoFound.empty')
  const quests = questsTotal > 0
    ? translatePlural('travel:components.listTravel.SearchAlsoFound.questsCount', questsTotal, { value1: formatInteger(questsTotal) })
    : null
  const places = placesTotal > 0
    ? translatePlural('travel:components.listTravel.SearchAlsoFound.placesCount', placesTotal, { value1: formatInteger(placesTotal) })
    : null
  if (quests && places) {
    return i18nT('travel:components.listTravel.SearchAlsoFound.summaryBoth', { value1: quests, value2: places })
  }
  return i18nT('travel:components.listTravel.SearchAlsoFound.summary', { value1: quests ?? places ?? '' })
}

/**
 * Строка «Ещё по запросу» над карточками `/search` (#2775). Место одно и
 * детерминированное: пока запрос активен (≥3 символов), строка фиксированной
 * высоты стоит в шапке списка с первого кадра — сначала «ищем», затем сводка
 * «N квестов · M мест» или «ничего не нашлось». Ответ источников меняет только
 * текст строки; список раскрывается по тапу, то есть действием пользователя.
 */
export function useSearchAlsoFound({ query, enabled, userId }: Input): ReactNode {
  const locale = useQuestContentLocale()
  const trimmedQuery = query.trim()
  const active = enabled && isSiteSearchQueryLongEnough(trimmedQuery)

  const citiesQuery = useQuery({
    queryKey: queryKeys.questCitiesDirectory(locale),
    queryFn: async ({ signal }) => (await loadExtras()).fetchQuestCitiesDirectory(locale, signal),
    enabled,
    staleTime: QUEST_CITIES_STALE_TIME,
    gcTime: QUEST_CITIES_STALE_TIME,
    retry: readRetryOnce,
  })

  const city = useMemo(
    () => (active && citiesQuery.data ? findQuestCityForQuery(citiesQuery.data, trimmedQuery) : null),
    [active, citiesQuery.data, trimmedQuery],
  )

  const cityQuestsQuery = useQuery({
    queryKey: queryKeys.siteSearchCityQuests(city?.id, userId, locale),
    queryFn: async () => (await loadExtras()).fetchSiteSearchCityQuests(city!.id, locale),
    enabled: active && city != null,
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
    retry: readRetryOnce,
  })

  const placesQuery = useQuery({
    queryKey: queryKeys.siteSearchPlaces(trimmedQuery),
    queryFn: async ({ signal }) => (await loadExtras()).fetchSiteSearchPlaces(trimmedQuery, signal),
    enabled: active,
    staleTime: PLACES_STALE_TIME,
    retry: readRetryOnce,
  })

  // Ошибка источника — «по нему ничего»: строка не ждёт повторов и не
  // показывает ошибку поверх выдачи статей.
  const questsSettled =
    citiesQuery.isError ||
    (citiesQuery.isSuccess && (city == null || cityQuestsQuery.isSuccess || cityQuestsQuery.isError))
  const placesSettled = placesQuery.isSuccess || placesQuery.isError

  const cityQuests = city ? cityQuestsQuery.data : undefined
  const places = placesQuery.data
  const quests = cityQuests?.quests ?? NO_QUESTS
  const placeItems = places?.places ?? NO_PLACES
  const questsTotal = quests.length ? cityQuests?.total ?? quests.length : 0
  const placesTotal = placeItems.length ? places?.total ?? placeItems.length : 0
  const status: SearchAlsoFoundStatus = !(questsSettled && placesSettled)
    ? 'loading'
    : questsTotal || placesTotal ? 'found' : 'empty'

  const [expandedQuery, setExpandedQuery] = useState<string | null>(null)
  const expanded = status === 'found' && expandedQuery === trimmedQuery
  const handleToggle = useCallback(() => {
    setExpandedQuery((current) => (current === trimmedQuery ? null : trimmedQuery))
  }, [trimmedQuery])

  useEffect(() => {
    if (active && status === 'found') void loadList().catch(() => undefined)
  }, [active, status])

  // Подпись считается в рендере: смена языка интерфейса перерисовывает экран.
  const label = buildSummaryLabel(status, questsTotal, placesTotal)

  return useMemo(() => {
    if (!active) return null
    return (
      <SearchAlsoFoundSummary
        status={status}
        label={label}
        expanded={expanded}
        onToggle={handleToggle}
      >
        <Suspense fallback={null}>
          <SearchAlsoFoundList
            query={trimmedQuery}
            quests={quests}
            questsTotal={questsTotal}
            questCityName={cityQuests?.cityName || city?.name || ''}
            questCitySegment={cityQuests?.citySegment ?? null}
            places={placeItems}
            placesTotal={placesTotal}
          />
        </Suspense>
      </SearchAlsoFoundSummary>
    )
  }, [active, city?.name, cityQuests, expanded, handleToggle, label, placeItems, placesTotal, quests, questsTotal, status, trimmedQuery])
}
