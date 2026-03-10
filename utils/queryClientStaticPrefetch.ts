import type { QueryClient } from '@tanstack/react-query'

import { fetchAllCountries, fetchFilters } from '@/api/misc'
import { queryKeys } from '@/queryKeys'

export function runStaticQueryClientPrefetch(client: QueryClient) {
  client.prefetchQuery({
    queryKey: queryKeys.filters(),
    queryFn: () => fetchFilters(),
    staleTime: 30 * 60 * 1000,
  })

  client.prefetchQuery({
    queryKey: queryKeys.countries(),
    queryFn: () => fetchAllCountries(),
    staleTime: 30 * 60 * 1000,
  })
}
