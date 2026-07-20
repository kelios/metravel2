/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native'
import { Animated, InteractionManager, Platform } from 'react-native'

import { useTravelDeferredSectionsModel } from '@/components/travel/details/hooks/useTravelDeferredSectionsModel'

describe('useTravelDeferredSectionsModel', () => {
  const originalOS = Platform.OS
  const originalIntersectionObserver = window.IntersectionObserver
  let intersectionCallbacks: IntersectionObserverCallback[]

  beforeEach(() => {
    Platform.OS = 'web'
    jest.useFakeTimers()
    intersectionCallbacks = []
    window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      intersectionCallbacks.push(callback)
      return {
        disconnect: jest.fn(),
        observe: jest.fn(),
        takeRecords: jest.fn(() => []),
        unobserve: jest.fn(),
      } as unknown as IntersectionObserver
    }) as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    Platform.OS = originalOS
    window.IntersectionObserver = originalIntersectionObserver
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

  it('keeps heavy offscreen sections unloaded by timer and loads them through one shared observer', () => {
    const { result } = renderHook(
      ({ travelId }) => useTravelDeferredSectionsModel({ travelId }),
      { initialProps: { travelId: 1 } }
    )

    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(result.current.canRenderHeavy).toBe(true)

    const mapElement = document.createElement('section')
    const commentsElement = document.createElement('section')
    const footerElement = document.createElement('section')

    act(() => {
      result.current.setMapRef(mapElement)
      result.current.setCommentsRef(commentsElement)
      result.current.setFooterRef(footerElement)
    })

    expect(window.IntersectionObserver).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(result.current.shouldLoadMap).toBe(false)
    expect(result.current.shouldLoadComments).toBe(false)
    expect(result.current.shouldLoadFooter).toBe(false)

    act(() => {
      intersectionCallbacks[0]?.(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
            target: commentsElement,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    expect(result.current.shouldLoadComments).toBe(true)
    expect(result.current.shouldLoadMap).toBe(false)
    expect(result.current.shouldLoadFooter).toBe(false)
  })

  it('uses settled native offsets without subscribing JS to every scroll frame', () => {
    Platform.OS = 'android'
    const interactionSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((callback: any) => {
        callback()
        return { cancel: jest.fn() } as any
      })
    const scrollY = new Animated.Value(0)
    const addListenerSpy = jest.spyOn(scrollY, 'addListener')

    const { result, rerender } = renderHook(
      ({ settledScrollOffsetY }) => useTravelDeferredSectionsModel({
        travelId: 1,
        scrollY,
        settledScrollOffsetY,
        viewportHeight: 800,
      }),
      { initialProps: { settledScrollOffsetY: 0 } },
    )

    expect(addListenerSpy).not.toHaveBeenCalled()
    expect(result.current.shouldLoadMap).toBe(false)

    act(() => {
      rerender({ settledScrollOffsetY: 300 })
    })

    expect(addListenerSpy).not.toHaveBeenCalled()
    expect(result.current.shouldLoadMap).toBe(true)
    interactionSpy.mockRestore()
  })
})
