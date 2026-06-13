import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDeferredSectionsModel } from '@/components/travel/details/hooks/useTravelDeferredSectionsModel'

describe('useTravelDeferredSectionsModel', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    jest.useFakeTimers()
  })

  afterEach(() => {
    Platform.OS = originalOS
    jest.useRealTimers()
  })

  it('does not enable heavy content synchronously on web (first render is false)', () => {
    const { result } = renderHook(
      ({ travelId }) => useTravelDeferredSectionsModel({ travelId }),
      { initialProps: { travelId: 1 } }
    )

    expect(result.current.canRenderHeavy).toBe(false)
  })

  it('enables heavy content after browser idle on web', () => {
    const { result } = renderHook(
      ({ travelId }) => useTravelDeferredSectionsModel({ travelId }),
      { initialProps: { travelId: 1 } }
    )

    expect(result.current.canRenderHeavy).toBe(false)

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(result.current.canRenderHeavy).toBe(true)
  })

  it('resets heavy content to false during render on a cache-hit travel swap', () => {
    const { result, rerender } = renderHook(
      ({ travelId }) => useTravelDeferredSectionsModel({ travelId }),
      { initialProps: { travelId: 1 } }
    )

    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(result.current.canRenderHeavy).toBe(true)

    // SPA navigation to a cached travel: same hook instance, new travelId.
    act(() => {
      rerender({ travelId: 2 })
    })

    // The heavy tree (incl. the Leaflet map) must not carry over as true.
    expect(result.current.canRenderHeavy).toBe(false)

    // Then it re-reveals progressively via idle.
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(result.current.canRenderHeavy).toBe(true)
  })
})
