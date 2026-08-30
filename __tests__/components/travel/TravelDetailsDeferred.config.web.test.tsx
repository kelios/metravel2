import { TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS } from '@/components/travel/details/hooks/useTravelDeferredSectionsModel'

describe('Travel deferred section load config', () => {
  it('does not force heavy offscreen sections by fallback timer on web', () => {
    for (const sectionKey of ['map', 'sidebar', 'comments', 'footer'] as const) {
      expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS[sectionKey]).toMatchObject({
        fallbackDelay: null,
        priority: 'low',
        threshold: 0.1,
      })
    }
  })

  it('gives the height-reserving sections a viewport of extra lookahead', () => {
    // Their reserve only hides growth while their top edge is still on screen,
    // so `Рядом/Популярные` and comments must resolve before the fold reaches
    // them; the heavy map keeps the tight default (#1642).
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.sidebar.rootMargin).toBe('200%')
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.comments.rootMargin).toBe('200%')
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.map.rootMargin).toBe('200px')
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.footer.rootMargin).toBe('200px')
  })

  it('keeps short fallbacks only for lightweight near-fold sections', () => {
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.author.fallbackDelay).toBe(500)
    expect(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.rating.fallbackDelay).toBe(600)
  })
})
