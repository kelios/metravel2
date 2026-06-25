import type { Travel } from '@/types/types'
import type { AnchorsMap } from './TravelDetailsTypes'
import { TravelDeferredSections } from '@/components/travel/details/TravelDetailsDeferred'

type DeferredSectionsComponentType = React.ComponentType<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollY?: any
  viewportHeight?: number
  scrollToMapSection: () => void
}>

export function getInitialDeferredSectionsComponent() {
  return TravelDeferredSections as DeferredSectionsComponentType
}

export async function loadDeferredSectionsComponent(): Promise<DeferredSectionsComponentType> {
  return TravelDeferredSections as DeferredSectionsComponentType
}

export type { DeferredSectionsComponentType }
