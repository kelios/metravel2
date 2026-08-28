import type { Travel } from '@/types/types'
import type { AnchorsMap } from './TravelDetailsTypes'

type DeferredSectionsComponentType = React.ComponentType<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollY?: any
  settledScrollOffsetY?: number
  viewportHeight?: number
  scrollToMapSection: () => void
}>

let deferredSectionsLoader: Promise<DeferredSectionsComponentType> | null = null

export function getInitialDeferredSectionsComponent() {
  return null
}

export async function loadDeferredSectionsComponent(): Promise<DeferredSectionsComponentType> {
  if (!deferredSectionsLoader) {
    deferredSectionsLoader = import('@/components/travel/details/TravelDetailsDeferred').then(
      (m) => m.TravelDeferredSections,
    )
  }

  return deferredSectionsLoader
}

export type { DeferredSectionsComponentType }
