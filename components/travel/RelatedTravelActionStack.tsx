import React, { useMemo } from 'react'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries'
import OptimizedFavoriteButton from '@/components/travel/OptimizedFavoriteButton'
import TravelStatusButton from '@/components/travel/TravelStatusButton'
import { resolveRelatedTravelRef } from '@/utils/relatedTravel'

type Props = {
  relatedTravelUrl?: string | null
  fallbackTitle: string
  fallbackImageUrl?: string | null
  fallbackCountry?: string | null
  fallbackCity?: string | null
  style?: StyleProp<ViewStyle>
}

const stopWebCardEvent = (event?: {
  preventDefault?: () => void
  stopPropagation?: () => void
  nativeEvent?: {
    stopPropagation?: () => void
    stopImmediatePropagation?: () => void
  }
}) => {
  if (Platform.OS !== 'web') return
  event?.preventDefault?.()
  event?.stopPropagation?.()
  event?.nativeEvent?.stopPropagation?.()
  event?.nativeEvent?.stopImmediatePropagation?.()
}

export default function RelatedTravelActionStack({
  relatedTravelUrl,
  fallbackTitle,
  fallbackImageUrl,
  fallbackCountry,
  fallbackCity,
  style,
}: Props) {
  const travelRef = useMemo(() => resolveRelatedTravelRef(relatedTravelUrl), [relatedTravelUrl])

  // For id-based URLs we already have everything the buttons need (id + fallbacks),
  // so the request is only required to resolve a slug into a numeric id. Keeping it
  // disabled for id refs avoids an N+1 of full travel-detail fetches across the list,
  // while React Query still serves cached detail data if the travel was visited.
  const needsFetch = Boolean(travelRef && !travelRef.id && travelRef.slug)

  const { data: relatedTravel } = useQuery({
    queryKey: travelRef ? queryKeys.travel(travelRef.id ?? travelRef.slug ?? 'related') : ['travel', 'related', 'missing'],
    queryFn: ({ signal }) => {
      if (!travelRef) return null
      if (travelRef.id) return fetchTravel(travelRef.id, { signal })
      if (travelRef.slug) return fetchTravelBySlug(travelRef.slug, { signal })
      return null
    },
    enabled: needsFetch,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
  })

  const resolvedTravelId = relatedTravel?.id ?? travelRef?.id
  if (!travelRef || !resolvedTravelId) return null

  const travelTitle = relatedTravel?.name || fallbackTitle
  const travelUrl = relatedTravel?.url || travelRef.route
  const travelImageUrl = relatedTravel?.travel_image_thumb_url || fallbackImageUrl || undefined
  const travelCountry = relatedTravel?.countryName || fallbackCountry || undefined
  const travelCity = relatedTravel?.cityName || fallbackCity || undefined

  return (
    <View
      pointerEvents="box-none"
      style={[styles.stack, style]}
      {...(Platform.OS === 'web'
        ? ({
            'data-card-action': 'true',
            onClick: stopWebCardEvent,
            onMouseDown: stopWebCardEvent,
          } as any)
        : null)}
    >
      <OptimizedFavoriteButton
        id={resolvedTravelId}
        type="travel"
        title={travelTitle}
        imageUrl={travelImageUrl}
        url={travelUrl}
        country={travelCountry}
        city={travelCity}
        size={18}
      />
      <TravelStatusButton
        travelId={resolvedTravelId}
        travelTitle={travelTitle}
        travelUrl={travelUrl}
        travelImageUrl={travelImageUrl}
        travelCountry={travelCountry}
        travelCity={travelCity}
        travelYear={relatedTravel?.year}
        travelMonthName={relatedTravel?.monthName}
        compact
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: {
    flexDirection: 'column',
    gap: 6,
  },
})
