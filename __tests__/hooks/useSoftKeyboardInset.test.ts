import { resolveSoftKeyboardInsets } from '@/hooks/useSoftKeyboardInset'

describe('resolveSoftKeyboardInsets', () => {
  it('keeps Android fullscreen content above IME and restores nav inset for root overlap', () => {
    expect(
      resolveSoftKeyboardInsets({
        nativeKeyboardHeight: 300,
        platform: 'android',
        safeAreaBottom: 24,
        webKeyboardOverlap: 0,
      }),
    ).toEqual({
      contentViewportInset: 300,
      rootBottomOverlap: 324,
    })
  })

  it('uses visualViewport overlap on mobile web', () => {
    expect(
      resolveSoftKeyboardInsets({
        nativeKeyboardHeight: 0,
        platform: 'web',
        safeAreaBottom: 0,
        webKeyboardOverlap: 280,
      }),
    ).toEqual({
      contentViewportInset: 280,
      rootBottomOverlap: 280,
    })
  })

  it('does not double-apply manual viewport padding on iOS', () => {
    expect(
      resolveSoftKeyboardInsets({
        nativeKeyboardHeight: 280,
        platform: 'ios',
        safeAreaBottom: 20,
        webKeyboardOverlap: 0,
      }),
    ).toEqual({
      contentViewportInset: 0,
      rootBottomOverlap: 280,
    })
  })

  it('returns zero for hidden or invalid keyboard measurements', () => {
    expect(
      resolveSoftKeyboardInsets({
        nativeKeyboardHeight: Number.NaN,
        platform: 'android',
        safeAreaBottom: 24,
        webKeyboardOverlap: 0,
      }),
    ).toEqual({
      contentViewportInset: 0,
      rootBottomOverlap: 0,
    })
  })
})
