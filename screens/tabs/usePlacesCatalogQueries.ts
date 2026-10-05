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
// уходит он после успешного ответа списка, а не параллельно с ним. Отдельных
// запросов-счётчиков подборок нет: точное число даёт только расчёт с категориями
// подборки, а по расчёту на подборку при открытии экрана — это и был fan-out.

import { useMemo } from 'react'
import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { fetchPlacesCatalog, type PlacesCatalogSort } from '@/api/places'
import { queryKeys } from '@/api/queryKeys'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'
import { heavyReadRetry } from '@/utils/queryRetryPolicy'

import { type CategoryCollection, PLACES_PAGE_SIZE, isSameCategorySet } from './PlacesScreen.helpers'

/** Итог и фасеты каталога по поиску и стране, без учёта выбранных категорий. */
export type PlacesCatalogScope = Pick<PlacesCatalogPage, 'count' | 'categoryFacets' | 'countryFacets'>

/** Число мест в подборке по её id; подборки без ответа списка в карте нет. */
export type PlacesCollectionCounts = Readonly<Record<string, number>>

type PlacesCatalogListParams = {
  q: string | undefined
  categories: string[] | undefined
  country: string | undefined
  sort: PlacesCatalogSort
}

type PlacesCatalogQueriesInput = {
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
    queryKeys.placesCatalogCollectionCounts({ country }),
    (current) => ({ ...current, [collection.id]: page.count }),
  )
}

export function usePlacesCatalogQueries({ q, categories, country, sort, collections }: PlacesCatalogQueriesInput) {
  const queryClient = useQueryClient()
  const listParams = useMemo<PlacesCatalogListParams>(() => ({
    q,
    categories: categories.length > 0 ? categories : undefined,
    country: country ?? undefined,
    sort,
  }), [q, categories, country, sort])

  const placesQuery = useInfiniteQuery({
    queryKey: queryKeys.placesCatalogList(listParams),
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
  const listReady = placesQuery.isSuccess && !placesQuery.isPlaceholderData
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

  // Проекция без собственного запроса: её пишет ответ списка, экран только читает.
  const collectionCountsQuery = useQuery<PlacesCollectionCounts>({
    queryKey: queryKeys.placesCatalogCollectionCounts({ country: country ?? undefined }),
    queryFn: skipToken,
    gcTime: CATALOG_GC_MS,
  })

  const scope = scopeQuery.data
  return {
    collectionCounts: collectionCountsQuery.data,
    // Объёма ещё нет, но ничего не упало — значит, он в пути (вместе со списком).
    isScopeLoading: scope === undefined && !placesQuery.isError && !scopeQuery.isError,
    placesQuery,
    scope,
  }
}
