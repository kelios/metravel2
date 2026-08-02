/**
 * @jest-environment jsdom
 */
import { Platform } from 'react-native'
import { renderHook } from '@testing-library/react-native'

import {
  MAP_VIEWPORT_HEIGHT_CSS_VAR,
  useMapViewportHeightVar,
} from '@/hooks/useMapViewportHeightVar'

type Listener = () => void

function installVisualViewport(height: number) {
  const listeners: Record<string, Listener[]> = {}
  const vv = {
    height,
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), fn]
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== fn)
    },
  }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  return {
    vv,
    emit: (type: string) => (listeners[type] ?? []).forEach((fn) => fn()),
  }
}

describe('useMapViewportHeightVar', () => {
  const originalPlatform = Platform.OS
  let rafCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    Platform.OS = 'web'
    rafCallbacks = []
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    Platform.OS = originalPlatform
    jest.restoreAllMocks()
    document.documentElement.style.removeProperty(MAP_VIEWPORT_HEIGHT_CSS_VAR)
  })

  const flushRaf = () => {
    const pending = rafCallbacks
    rafCallbacks = []
    pending.forEach((cb) => cb(0))
  }

  it('writes the measured visible-viewport height on mount', () => {
    installVisualViewport(742)
    renderHook(() => useMapViewportHeightVar())

    expect(document.documentElement.style.getPropertyValue(MAP_VIEWPORT_HEIGHT_CSS_VAR)).toBe(
      '742px',
    )
  })

  it('skips redundant writes when the viewport height did not change', () => {
    const { emit } = installVisualViewport(742)
    const setProperty = jest.spyOn(document.documentElement.style, 'setProperty')

    renderHook(() => useMapViewportHeightVar())
    expect(setProperty).toHaveBeenCalledTimes(1)

    // iOS Safari emits these on every frame while the dynamic toolbar collapses.
    for (let i = 0; i < 10; i += 1) emit('scroll')
    flushRaf()

    expect(setProperty).toHaveBeenCalledTimes(1)
  })

  it('writes again once the height actually changes', () => {
    const { vv, emit } = installVisualViewport(742)
    renderHook(() => useMapViewportHeightVar())

    vv.height = 812
    emit('resize')
    flushRaf()

    expect(document.documentElement.style.getPropertyValue(MAP_VIEWPORT_HEIGHT_CSS_VAR)).toBe(
      '812px',
    )
  })
})
