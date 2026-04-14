import type { Travel } from '@/types/types'
import {
  areSameTravelLists,
  getTravelDetailsSidebarSectionFlags,
  TRAVEL_DETAILS_SIDEBAR_PROGRESSIVE_LOAD_CONFIG,
} from '@/components/travel/details/hooks/travelDetailsSidebarSectionModel'

describe('travelDetailsSidebarSectionModel', () => {
  it('compares travel lists by stable travel ids', () => {
    const first = [{ id: 1 }, { id: 2 }] as Travel[]
    const second = [{ id: 1 }, { id: 2 }] as Travel[]
    const third = [{ id: 1 }, { id: 3 }] as Travel[]

    expect(areSameTravelLists(first, second)).toBe(true)
    expect(areSameTravelLists(first, third)).toBe(false)
  })

  it('builds sidebar flags from travel id and related travels', () => {
    const flags = getTravelDetailsSidebarSectionFlags({
      canRenderHeavy: true,
      relatedTravels: [{ id: 4 }] as Travel[],
      travelId: 12,
    })

    expect(flags.hasValidTravelId).toBe(true)
    expect(flags.progressiveEnabled).toBe(true)
    expect(flags.shouldShowNavigationArrows).toBe(true)
  })

  it('keeps the shared progressive load config stable', () => {
    expect(TRAVEL_DETAILS_SIDEBAR_PROGRESSIVE_LOAD_CONFIG).toMatchObject({
      priority: 'low',
      rootMargin: '200px',
      threshold: 0.1,
      fallbackDelay: 1000,
    })
  })
})
