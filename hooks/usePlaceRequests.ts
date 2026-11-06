import { useQuery } from '@tanstack/react-query'

import { fetchPlaceRequest, fetchPlaceRequests } from '@/api/placeRequests'
import { queryKeys } from '@/api/queryKeys'
import { useLocale } from '@/i18n/LocaleProvider'
import { readRetryOnce } from '@/utils/queryRetryPolicy'

export function usePlaceRequests(enabled: boolean) {
  const { locale } = useLocale()
  return useQuery({
    queryKey: queryKeys.placeRequests(locale),
    queryFn: ({ signal }) => fetchPlaceRequests(locale, signal),
    enabled,
    retry: readRetryOnce,
    staleTime: 30_000,
  })
}

export function usePlaceRequest(id: string | null, enabled = true) {
  const { locale } = useLocale()
  return useQuery({
    queryKey: queryKeys.placeRequest(id, locale),
    queryFn: ({ signal }) => fetchPlaceRequest(id ?? '', locale, signal),
    enabled: Boolean(id) && enabled,
    retry: readRetryOnce,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}
