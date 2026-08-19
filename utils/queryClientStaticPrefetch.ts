import type { QueryClient } from '@tanstack/react-query'

import {
  fetchPointCategoryDictionary,
  pointCategoryDictionaryQueryKey,
} from '@/utils/pointCategoryDictionaryQuery'
import { queryConfigs } from '@/utils/reactQueryConfig'

// Маршрутный предикат живёт в отдельном модуле без импортов api/*: его тянет
// корневой layout, а этот файл грузится динамически, чтобы словари фильтров не
// попадали в стартовый бандл.
export { shouldPrefetchTravelStatics } from '@/utils/staticPrefetchRoutes'

/**
 * Прогрев словаря фильтров для визарда путешествия (PointList читает его через
 * queryKeys.filters()).
 *
 * Здесь намеренно `fetchFiltersOptimized`, а не сырой `fetchFilters`: у него
 * общий кэш и дедупликация in-flight с прямыми вызовами из `useTravelFilters` и
 * `fetchAllFiltersOptimized`, поэтому префетч и экран делят ОДИН сетевой
 * запрос, а не делают два одинаковых.
 *
 * Справочник стран отсюда убран: ключ `queryKeys.countries()` не читал никто,
 * а рулетка и каталог берут страны вместе с фильтрами по `filterOptions()`,
 * так что отдельный запрос был чистым расходом канала.
 */
export function runStaticQueryClientPrefetch(client: QueryClient) {
  // Промис возвращается только чтобы прогрев можно было дождаться в тестах:
  // вызывающий код по-прежнему запускает его fire-and-forget на idle.
  // Ключ, загрузчик и TTL — общие с потребителем (`pointCategoryDictionaryQuery`,
  // `queryConfigs.static`), иначе под одним ключом снова разъедутся формы.
  return client.prefetchQuery({
    queryKey: pointCategoryDictionaryQueryKey(),
    queryFn: fetchPointCategoryDictionary,
    staleTime: queryConfigs.static.staleTime,
  })
}
