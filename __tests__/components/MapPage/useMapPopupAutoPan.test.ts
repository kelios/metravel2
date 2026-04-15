import { act, renderHook } from '@testing-library/react-native'

import { useMapPopupAutoPan } from '@/components/MapPage/Map/useMapPopupAutoPan'

describe('useMapPopupAutoPan', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame
  const originalCancelAnimationFrame = global.cancelAnimationFrame
  const originalResizeObserver = global.ResizeObserver
  let resizeObserverInstances: Array<{
    callback: ResizeObserverCallback
    disconnected: boolean
    observe: jest.Mock
    disconnect: jest.Mock
    trigger: () => void
  }> = []

  beforeEach(() => {
    jest.useFakeTimers()
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }) as typeof requestAnimationFrame
    global.cancelAnimationFrame = jest.fn()
    resizeObserverInstances = []
    ;(global as any).ResizeObserver = class ResizeObserverMock {
      callback: ResizeObserverCallback
      disconnected = false
      observe = jest.fn()
      disconnect = jest.fn(() => {
        this.disconnected = true
      })

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        resizeObserverInstances.push({
          callback,
          disconnected: false,
          observe: this.observe,
          disconnect: this.disconnect,
          trigger: () => {
            if (this.disconnected) return
            this.callback([], this as unknown as ResizeObserver)
          },
        })
      }
    } as any
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    global.requestAnimationFrame = originalRequestAnimationFrame
    global.cancelAnimationFrame = originalCancelAnimationFrame
    ;(global as any).ResizeObserver = originalResizeObserver
  })

  it('uses mobile top auto-pan padding on narrow web viewports', () => {
    const mapRef = { current: null }

    const { result } = renderHook(() =>
      useMapPopupAutoPan({
        mapRef,
        mapPaneWidth: 393,
        popupBottomOffset: 0,
      })
    )

    expect(result.current.popupAutoPanPadding).toEqual(
      expect.objectContaining({
        autoPanPaddingTopLeft: [12, 110],
        autoPanPaddingBottomRight: [12, 124],
      })
    )
  })

  it('re-centers popup into the mobile safe area when it overlaps the header and chips area', () => {
    const panBy = jest.fn()
    const on = jest.fn()
    const off = jest.fn()

    const mapEl = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 393,
        bottom: 852,
        width: 393,
        height: 852,
      }),
    } as HTMLElement

    const popupEl = {
      getBoundingClientRect: () => ({
        left: 96,
        top: 90,
        right: 296,
        bottom: 390,
        width: 200,
        height: 300,
      }),
      querySelector: jest.fn(() => null),
    } as unknown as HTMLElement

    const mapRef = {
      current: {
        getContainer: () => mapEl,
        panBy,
        on,
        off,
      },
    }

    const { result } = renderHook(() =>
      useMapPopupAutoPan({
        mapRef,
        mapPaneWidth: 393,
        popupBottomOffset: 0,
      })
    )

    result.current.popupAutoPanPadding.eventHandlers.popupopen({
      popup: {
        getElement: () => popupEl,
      },
    })

    expect(panBy).toHaveBeenCalledWith([0, -179], { animate: true, duration: 0.35 })
    expect(on).toHaveBeenCalledWith('popupclose', expect.any(Function))
  })

  it('keeps observing popup size changes after the first second so late image growth can re-pan', () => {
    const panBy = jest.fn()
    const on = jest.fn()
    const off = jest.fn()
    let popupTop = 269

    const mapEl = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 393,
        bottom: 852,
        width: 393,
        height: 852,
      }),
    } as HTMLElement

    const popupEl = {
      getBoundingClientRect: () => ({
        left: 96,
        top: popupTop,
        right: 296,
        bottom: popupTop + 300,
        width: 200,
        height: 300,
      }),
      querySelector: jest.fn(() => null),
    } as unknown as HTMLElement

    const mapRef = {
      current: {
        getContainer: () => mapEl,
        panBy,
        on,
        off,
      },
    }

    const { result } = renderHook(() =>
      useMapPopupAutoPan({
        mapRef,
        mapPaneWidth: 393,
        popupBottomOffset: 0,
      })
    )

    result.current.popupAutoPanPadding.eventHandlers.popupopen({
      popup: {
        getElement: () => popupEl,
      },
    })

    expect(resizeObserverInstances).toHaveLength(1)
    expect(panBy).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    popupTop = 88

    act(() => {
      resizeObserverInstances[0]?.trigger()
    })

    expect(panBy).toHaveBeenCalledWith([0, -181], { animate: true, duration: 0.35 })
  })
})
