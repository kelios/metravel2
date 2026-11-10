import type { Travel } from '@/types/types'
import type { AnchorsMap } from './TravelDetailsTypes'

// Metro resolves travelDetailsDeferredLoader.web.ts / .native.ts and Jest (jest-expo,
// platform ios) the .native.ts file; this unprefixed module is the type-checking
// entry and mirrors the web contract without test-environment branches (#3214).

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

export function getInitialDeferredSectionsComponent(): DeferredSectionsComponentType | null {
  return null
}

export async function loadDeferredSectionsComponent(): Promise<DeferredSectionsComponentType> {
  if (!deferredSectionsLoader) {
    deferredSectionsLoader = Promise.resolve(import('@/components/travel/details/TravelDetailsDeferred')).then(
      (m) => m.TravelDeferredSections,
    )
  }

  return deferredSectionsLoader
}

export type { DeferredSectionsComponentType }
