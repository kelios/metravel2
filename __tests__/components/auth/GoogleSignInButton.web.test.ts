/**
 * @jest-environment jsdom
 */

import {
  getGoogleAvailability,
  measureGsiRenderedWidth,
  resolveGsiOverflowWidth,
  resolveGsiRenderWidth,
} from '@/components/auth/GoogleSignInButton.web'

const fakeContainer = (scrollWidth: number, childWidths: number[]) =>
  ({
    scrollWidth,
    children: childWidths.map((width) => ({
      getBoundingClientRect: () => ({ width }),
    })),
  }) as unknown as { children: ArrayLike<Element>; scrollWidth: number }

describe('GoogleSignInButton web hydration availability', () => {
  it('keeps Google enabled for SSR and the first hydration render', () => {
    expect(getGoogleAvailability(true, false)).toEqual({
      enabled: true,
      fallbackText: '',
    })
  })

  it('applies the localhost fallback only after hydration commits', () => {
    expect(window.location.hostname).toBe('localhost')
    expect(getGoogleAvailability(true, true).enabled).toBe(false)
    expect(getGoogleAvailability(true, true).fallbackText).not.toBe('')
  })
})

// INV2-07 (#1477): the Google button must carry the same visual weight as the
// full-width Facebook button, i.e. render at the column width instead of a
// fixed 300/320px that overflowed a 295px mobile card column and got its
// rounded sides clipped by the container's overflowY:hidden quirk.
describe('GSI render width', () => {
  it('asks for the column width so the button matches the Facebook button', () => {
    expect(resolveGsiRenderWidth(295)).toBe(295)
    expect(resolveGsiRenderWidth(360)).toBe(360)
  })

  it('clamps to the range GSI honours', () => {
    expect(resolveGsiRenderWidth(120)).toBe(200)
    expect(resolveGsiRenderWidth(900)).toBe(400)
  })

  it('returns null before the host has any layout', () => {
    expect(resolveGsiRenderWidth(0)).toBeNull()
    expect(resolveGsiRenderWidth(Number.NaN)).toBeNull()
  })

  it('floors a fractional column instead of overflowing it', () => {
    // Rounding 294.6 up to 295 asks GSI for more than the column has; the host
    // answers a sub-pixel overflow with a horizontal scrollbar.
    expect(resolveGsiRenderWidth(294.6)).toBe(294)
  })
})

describe('GSI rendered width measurement', () => {
  it('ignores GSI\'s permanently zero-width first child', () => {
    // GSI injects its hidden credential holder first; reading only
    // firstElementChild reports "not painted" and the compensation never fires.
    expect(measureGsiRenderedWidth(fakeContainer(305, [0, 305]))).toBe(305)
  })

  it('prefers a fractional child box over the rounded scrollWidth', () => {
    // scrollWidth rounds down to 304 and would leave the button clipped by a pixel.
    expect(measureGsiRenderedWidth(fakeContainer(304, [0, 304.4]))).toBe(305)
  })

  it('reports nothing while the container is empty', () => {
    expect(measureGsiRenderedWidth(fakeContainer(0, []))).toBeNull()
  })
})

describe('GSI overflow width', () => {
  it('widens the container when the label could not fit the column', () => {
    // RU "Вход через аккаунт Google" cannot render below ~233px.
    expect(resolveGsiOverflowWidth(233, 220)).toBe(233)
  })

  it('stays unset when the button fit the requested width', () => {
    expect(resolveGsiOverflowWidth(295, 295)).toBeNull()
  })

  it('ignores a measurement wider than GSI can render', () => {
    // An absolutely positioned helper node inflates scrollWidth; widening the
    // container to that would push the button clean out of the card.
    expect(resolveGsiOverflowWidth(9999, 295)).toBeNull()
  })

  it('documents why the comparison takes the requested width, not the container', () => {
    // Column 220, label cannot render below 233 -> compensate to 233.
    expect(resolveGsiOverflowWidth(233, 220)).toBe(233)
    // Applying that 233 as min-width makes the container measure 233. Passing the
    // container width here instead of the requested width would report "fits" on
    // the very next check, drop the compensation and oscillate.
    expect(resolveGsiOverflowWidth(233, 233)).toBeNull()
  })
})
