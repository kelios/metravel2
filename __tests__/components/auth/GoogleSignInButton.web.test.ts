/**
 * @jest-environment jsdom
 */

import { getGoogleAvailability } from '@/components/auth/GoogleSignInButton.web'

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
