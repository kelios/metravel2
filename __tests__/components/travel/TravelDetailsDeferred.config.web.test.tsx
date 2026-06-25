import { TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS } from '@/components/travel/details/hooks/useTravelDeferredSectionsModel'

describe('Travel deferred section load config', () => {
  it('does not force heavy offscreen sections by fallback timer on web', () => {
    for (const sectionKey of ['map', 'sidebar', 'comments', 'footer'] as const) {
      expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS[sectionKey]).toMatchObject({
        fallbackDelay: null,
        priority: 'low',
        rootMargin: '200px',
        threshold: 0.1,
      })
    }
  })

  it('keeps short fallbacks only for lightweight near-fold sections', () => {
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.author.fallbackDelay).toBe(500)
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.rating.fallbackDelay).toBe(600)
  })
})
