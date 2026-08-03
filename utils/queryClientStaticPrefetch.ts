import type { QueryClient } from '@tanstack/react-query'

import { fetchAllCountries, fetchFilters } from '@/api/misc'
import { queryKeys } from '@/queryKeys'

// Маршрутный предикат живёт в отдельном модуле без импортов api/*: его тянет
// корневой layout, а этот файл грузится динамически, чтобы словари фильтров не
// попадали в стартовый бандл.
export { shouldPrefetchTravelStatics } from '@/utils/staticPrefetchRoutes'

export function runStaticQueryClientPrefetch(client: QueryClient) {
  client.prefetchQuery({
    queryKey: queryKeys.filters(),
    queryFn: () => fetchFilters({ throwOnError: true }),
    staleTime: 30 * 60 * 1000,
  })

  client.prefetchQuery({
    queryKey: queryKeys.countries(),
    queryFn: () => fetchAllCountries({ throwOnError: true }),
    staleTime: 30 * 60 * 1000,
  })
}
