import type { QueryClient } from '@tanstack/react-query'

import { fetchFiltersOptimized } from '@/api/miscOptimized'
import { queryKeys } from '@/queryKeys'

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
  client.prefetchQuery({
    queryKey: queryKeys.filters(),
    queryFn: () => fetchFiltersOptimized(),
    staleTime: 30 * 60 * 1000,
  })
}
