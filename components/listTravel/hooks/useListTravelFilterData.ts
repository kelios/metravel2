import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { fetchAllFiltersOptimized } from '@/api/miscOptimized'
import { fetchTravelFacets } from '@/api/travelListQueries'
import { buildFacetCounts } from '../utils/filterGroups'
import { normalizeFilterOptions } from '../ListTravelBase.helpers'
import type { FacetCounts } from '../utils/filterGroups'
import type { FilterOptions } from '../utils/listTravelTypes'

export interface UseListTravelFilterOptionsReturn {
  options: FilterOptions | undefined
  filterOptionsLoading: boolean
  hasFilterOptionsError: boolean
  refetchFilterOptions: () => Promise<unknown>
}

/**
 * Filter-options query (categories/transports/countries/…) shared across the
 * catalog. Runs before `useListTravelFilters` because the resolved options feed
 * the filter query params.
 */
export function useListTravelFilterOptions(enabled: boolean): UseListTravelFilterOptionsReturn {
  const {
    data: rawOptions,
    isLoading: filterOptionsLoading,
    isError: hasFilterOptionsQueryError,
    refetch: refetchFilterOptions,
  } = useQuery({
    queryKey: queryKeys.filterOptions(),
    queryFn: ({ signal }) => fetchAllFiltersOptimized({ signal }),
    enabled,
    staleTime: 10 * 60 * 1000,
  })

  const options = useMemo(() => normalizeFilterOptions(rawOptions), [rawOptions])
  const hasFilterOptionsError = hasFilterOptionsQueryError && !rawOptions

  return { options, filterOptionsLoading, hasFilterOptionsError, refetchFilterOptions }
}

export interface UseListTravelFacetsProps {
  /** Gate matching the filter-options query (sheet relevant / deep link). */
  enabled: boolean
  search: string
  queryParams: Record<string, unknown>
}

/**
 * Facet counters for the filter sheet. Consumes search+queryParams (not
 * filterOptions) so it isn't serialized behind the options request.
 */
export function useListTravelFacets({
  enabled,
  search,
  queryParams,
}: UseListTravelFacetsProps): FacetCounts {
  const { data: facetsData } = useQuery({
    queryKey: queryKeys.travelFacets(search, queryParams),
    queryFn: ({ signal }) => fetchTravelFacets(search, queryParams, { signal }),
    enabled,
    staleTime: 30 * 1000,
  })

  return useMemo(() => buildFacetCounts(facetsData?.facets), [facetsData?.facets])
}
