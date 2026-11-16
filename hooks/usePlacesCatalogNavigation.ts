import { Platform } from 'react-native'

import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { isPlacesCatalogHref, trackPlacesCatalogNavigation, type PlacesCatalogSource } from '@/utils/placesCatalogAnalytics'

/** Attach only to the actual catalog link, never to the menu container. */
export function usePlacesCatalogNavigation(href: unknown, source: PlacesCatalogSource) {
  const enabled = Platform.OS === 'web' && isPlacesCatalogHref(href)
  const impression = useTrackedImpression(`places:${source}`, () => {
    if (enabled) trackPlacesCatalogNavigation(source, 'impression')
  })
  return {
    ref: enabled ? impression.ref : undefined,
    onEntry: () => {
      if (enabled) trackPlacesCatalogNavigation(source, 'entry')
    },
  }
}
