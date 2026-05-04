import { isTravelDetailsFirstScreenReady } from '@/components/travel/details/travelDetailsCriticalShellModel'

describe('travelDetailsCriticalShellModel', () => {
  describe('isTravelDetailsFirstScreenReady', () => {
    it('keeps skeleton visible while hero media exists but LCP image is not ready', () => {
      expect(
        isTravelDetailsFirstScreenReady(
          {
            gallery: [{ id: 1, url: 'https://example.com/hero.jpg' }],
          },
          false,
        ),
      ).toBe(false)
    })

    it('allows hiding skeleton once the hero LCP image is ready', () => {
      expect(
        isTravelDetailsFirstScreenReady(
          {
            gallery: [{ id: 1, url: 'https://example.com/hero.jpg' }],
          },
          true,
        ),
      ).toBe(true)
    })

    it('does not wait for LCP when the page has no hero media', () => {
      expect(
        isTravelDetailsFirstScreenReady(
          {
            gallery: [],
          },
          false,
        ),
      ).toBe(true)
    })

    it('stays blocked until travel data exists', () => {
      expect(isTravelDetailsFirstScreenReady(undefined, false)).toBe(false)
    })
  })
})

