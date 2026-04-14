import type { Travel } from '@/types/types'
import type { AnchorsMap } from './TravelDetailsTypes'

type DeferredSectionsComponentType = React.ComponentType<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollY: any
  viewportHeight: number
  scrollToMapSection: () => void
}>

const isTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

let deferredSectionsLoader: Promise<DeferredSectionsComponentType> | null = null

export function getInitialDeferredSectionsComponent() {
  if (!isTestEnv) return null
  const mod = require('@/components/travel/details/TravelDetailsDeferred')
  return mod.TravelDeferredSections as DeferredSectionsComponentType
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
