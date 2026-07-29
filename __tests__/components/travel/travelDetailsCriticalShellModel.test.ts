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

    it.each([
      ['blurhash', { blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH' }],
      ['dominant color', { dominant_color: '#345678' }],
    ])('allows hiding skeleton for a local %s hero placeholder', (_label, media) => {
      expect(
        isTravelDetailsFirstScreenReady(
          {
            gallery: [{ id: 1 }],
            media: {
              gallery: [{ id: 1, ...media }],
            },
          },
          false,
        ),
      ).toBe(true)
    })

    it('keeps skeleton visible for a URL-backed LQIP placeholder', () => {
      expect(
        isTravelDetailsFirstScreenReady(
          {
            gallery: [{ id: 1 }],
            media: {
              gallery: [{ id: 1, lqip_url: 'https://example.com/lqip.jpg' }],
            },
          },
          false,
        ),
      ).toBe(false)
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
