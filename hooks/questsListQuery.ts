import { queryKeys } from '@/api/queryKeys'
import type { QueryFunctionContext } from '@tanstack/react-query'
import { waitForQuestsCatalogCredentials } from '@/api/questsCatalogInvalidation'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'

/**
 * Единственное определение запроса списка квестов.
 *
 * #1393: под ключом `queryKeys.quests()` ходят экран квестов, промо-блок
 * главной, три мета-хука детали и крошка города. Дедупликация в ОДИН запрос
 * `/quests/` держится на том, что у всех совпадают ключ, queryFn и времена
 * кеша, — а держалась она копипастой в двух местах, где разъехаться могли и
 * `select`, и `retry`, и сигнатура `queryFn`.
 *
 * Модуль намеренно лёгкий: ключи, политика кеша и ожидание смены credentials. Слой адаптеров
 * (`utils/questAdapters` → `utils/geoCountry`) он не тянет, поэтому его можно
 * импортировать из универсальных крошек, которые рендерятся на каждом маршруте.
 *
 * #1552: сам `@/api/quests` тоже вынесен за async-границу. Он загружается
 * ровно тогда, когда запрос реально стартует, поэтому маршруты без списка
 * квестов (travel-детали — основная масса страниц) больше не держат чанк
 * квестового API в стартовом графе.
 */
export function questsListQueryOptions() {
  return {
    queryKey: queryKeys.quests(),
    queryFn: async ({ signal, client }: QueryFunctionContext) => {
      const { fetchQuestsList } = await import('@/api/quests')
      await waitForQuestsCatalogCredentials(client, signal)
      return fetchQuestsList({ signal })
    },
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
  } as const
}
