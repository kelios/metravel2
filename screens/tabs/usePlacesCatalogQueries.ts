// #2184: слой данных каталога мест. Правило слоя — «один ресурс каталога = один
// запрос». Каждый запрос `/api/places/catalog/` стоит бэкенду полного расчёта
// (фасеты, группировка, count), поэтому сам по себе уходит только запрос списка,
// а всё, что уже лежит в его ответе, экран читает из кэша:
//
// - «объём без категорий» (итог и фасеты по текущим поиску и стране) — первая
//   страница списка без категорий несёт ровно его, отдельный запрос был дублем;
// - счётчик подборки — `count` списка, открытого по её категориям.
//
// Отдельный запрос объёма нужен, только когда его нет в кэше (прямой заход по
// ссылке с `?category=`: фасеты в ответе списка сужены до совпавших мест), и
// уходит он после успешного ответа списка. #2223: на измеренной web-ширине
// от760px один агрегат category-groups считает все подборки после списка;
// mobile/native не запрашивают его. Открытый список уточняет одну подборку
// отдельно от aggregate-кэша, чтобы поздний агрегат не затёр точный count.

import { useMemo } from 'react'
import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { fetchPlacesCatalog, fetchPlacesCatalogCategoryGroups, type PlacesCatalogSort } from '@/api/places'
import { queryKeys } from '@/api/queryKeys'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'
import { heavyReadRetry } from '@/utils/queryRetryPolicy'

import { type CategoryCollection, PLACES_PAGE_SIZE, isSameCategorySet } from './PlacesScreen.helpers'

/** Итог и фасеты каталога по поиску и стране, без учёта выбранных категорий. */
export type PlacesCatalogScope = Pick<PlacesCatalogPage, 'count' | 'categoryFacets' | 'countryFacets'>

/** Число мест в подборке: агрегат или успешное уточнение её списка. */
export type PlacesCollectionCounts = Readonly<Record<string, number>>

type PlacesCatalogListParams = {
  q: string | undefined
  categories: string[] | undefined
  country: string | undefined
  sort: PlacesCatalogSort
}

type PlacesCatalogQueriesInput = {
  enabled: boolean
  showCollections: boolean
  /** Поисковый запрос, уже обрезанный и с паузой ввода: каждое значение — запрос. */
  q: string | undefined
  categories: string[]
  country: string | null
  sort: PlacesCatalogSort
  collections: readonly CategoryCollection[]
}

const CATALOG_STALE_MS = 5 * 60 * 1000
const CATALOG_GC_MS = 20 * 60 * 1000

const toScope = ({ count, categoryFacets, countryFacets }: PlacesCatalogPage): PlacesCatalogScope => ({
  count,
  categoryFacets,
  countryFacets,
})

/** Раскладывает первую страницу списка по проекциям кэша. */
const primeCatalogProjections = (
  queryClient: QueryClient,
  params: PlacesCatalogListParams,
  page: PlacesCatalogPage,
  collections: readonly CategoryCollection[],
) => {
  const { q, categories, country } = params
  if (!categories) {
    queryClient.setQueryData<PlacesCatalogScope>(queryKeys.placesCatalogScope({ q, country }), toScope(page))
    return
  }
  // Счётчик подборки не зависит от поиска — ответ с `q` его не описывает.
  if (q) return
  const collection = collections.find((item) => isSameCategorySet(categories, item.categories))
  if (!collection) return
  queryClient.setQueryData<PlacesCollectionCounts>(
    queryKeys.placesCatalogCollectionCounts({ country, groups: collections.map(({ id, categories }) => ({ id, categories })), source: 'list' }),
    (current) => ({ ...current, [collection.id]: page.count }),
  )
}

export function usePlacesCatalogQueries({ q, categories, country, sort, collections, enabled, showCollections }: PlacesCatalogQueriesInput) {
  const queryClient = useQueryClient()
  const listParams = useMemo<PlacesCatalogListParams>(() => ({
    q,
    categories: categories.length > 0 ? categories : undefined,
    country: country ?? undefined,
    sort,
  }), [q, categories, country, sort])

  const placesQuery = useInfiniteQuery({
    queryKey: queryKeys.placesCatalogList(listParams),
    enabled,
    queryFn: async ({ pageParam, signal }) => {
      const page = await fetchPlacesCatalog({ page: pageParam, perPage: PLACES_PAGE_SIZE, ...listParams }, signal)
      if (pageParam === 1) primeCatalogProjections(queryClient, listParams, page, collections)
      return page
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.places.length, 0)
      return loaded < lastPage.count ? allPages.length + 1 : undefined
    },
    placeholderData: keepPreviousData,
    staleTime: CATALOG_STALE_MS,
    gcTime: CATALOG_GC_MS,
    ...heavyReadRetry,
    refetchOnWindowFocus: false,
  })

  // Объём ждёт список: пока тот не ответил успешно, второй тяжёлый расчёт рядом
  // не запускается. Без категорий проекцию пишет сам ответ списка, поэтому
  // запрос включён, только пока её нет в кэше: иначе инвалидация корня (блок
  // автора) перечитывала бы объём рядом с первой страницей списка — тот же
  // расчёт дважды. С категориями список объём не описывает, и запрос остаётся
  // включённым, чтобы инвалидация обновила фасеты.
  const scopeParams = useMemo(() => ({ q, country: country ?? undefined }), [q, country])
  const listReady = enabled && placesQuery.isSuccess && !placesQuery.isPlaceholderData
  const hasCategoryFilter = listParams.categories !== undefined
  const scopeQuery = useQuery<PlacesCatalogScope>({
    queryKey: queryKeys.placesCatalogScope(scopeParams),
    queryFn: ({ signal }) => fetchPlacesCatalog({ page: 1, perPage: 1, ...scopeParams }, signal).then(toScope),
    enabled: (query) => listReady && (hasCategoryFilter || query.state.data === undefined),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: CATALOG_GC_MS,
    ...heavyReadRetry,
    refetchOnWindowFocus: false,
  })

  const groups = useMemo(() => collections.map(({ id, categories }) => ({ id, categories })), [collections])
  const collectionScope = { country: country ?? undefined, groups }
  // A partial selected-list projection cannot make the aggregate cache fresh.
  // Both scopes include exact groups/country and deliberately exclude search q.
  const collectionCountsQuery = useQuery<PlacesCollectionCounts>({
    queryKey: queryKeys.placesCatalogCollectionCounts({ ...collectionScope, source: 'aggregate' }),
    queryFn: ({ signal }) => fetchPlacesCatalogCategoryGroups(collectionScope, signal),
    enabled: showCollections && listReady,
    staleTime: Infinity,
    gcTime: CATALOG_GC_MS,
    ...heavyReadRetry,
    refetchOnWindowFocus: false,
  })
  const selectedCollectionCountsQuery = useQuery<PlacesCollectionCounts>({
    queryKey: queryKeys.placesCatalogCollectionCounts({ ...collectionScope, source: 'list' }),
    queryFn: skipToken,
    gcTime: CATALOG_GC_MS,
  })

  const currentCollection = listReady && !q && listParams.categories
    ? collections.find(({ categories }) => isSameCategorySet(listParams.categories!, categories))
    : undefined
  const currentCount = currentCollection ? placesQuery.data?.pages[0]?.count : undefined
  const currentRefinement = currentCollection && currentCount !== undefined
    ? { [currentCollection.id]: currentCount }
    : undefined
  const scope = scopeQuery.data
  return {
    collectionCounts: collectionCountsQuery.data || selectedCollectionCountsQuery.data || currentRefinement
      ? { ...collectionCountsQuery.data, ...selectedCollectionCountsQuery.data, ...currentRefinement }
      : undefined,
    // Объёма ещё нет, но ничего не упало — значит, он в пути (вместе со списком).
    isScopeLoading: scope === undefined && !placesQuery.isError && !scopeQuery.isError,
    placesQuery,
    scope,
  }
}
