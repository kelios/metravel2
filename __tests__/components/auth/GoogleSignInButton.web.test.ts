/**
 * @jest-environment jsdom
 */

import {
  getGoogleAvailability,
  resolveGsiOverflowWidth,
  resolveGsiRenderWidth,
} from '@/components/auth/GoogleSignInButton.web'

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
})

describe('GSI overflow width', () => {
  it('widens the container when the label could not fit the column', () => {
    // RU "Вход через аккаунт Google" cannot render below ~233px.
    expect(resolveGsiOverflowWidth(233, 220)).toBe(233)
  })

  it('stays unset when the button fit the requested width', () => {
    expect(resolveGsiOverflowWidth(295, 295)).toBeNull()
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
