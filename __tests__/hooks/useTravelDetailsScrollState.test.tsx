import { act, renderHook } from '@testing-library/react-native'
import { act as actDOM, createElement, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Platform } from 'react-native'

import { useTravelDetailsScrollState } from '@/hooks/useTravelDetailsScrollState'

describe('useTravelDetailsScrollState', () => {
  const originalOS = Platform.OS
  afterEach(() => { Platform.OS = originalOS })

  it.each(['web', 'android', 'ios'] as const)('tracks content and viewport measurements on %s', async platform => {
    Platform.OS = platform
    const { result } = await renderHook(() => useTravelDetailsScrollState())

    await act(() => {
      result.current.handleContentSizeChange(0, 1200)
    })
    await act(() => {
      result.current.handleLayout({ nativeEvent: { layout: { height: 640 } } })
    })

    expect(result.current.contentHeight).toBe(1200)
    expect(result.current.viewportHeight).toBe(640)
  })

  it.each(['content', 'viewport'] as const)('keeps the visible web frame while %s-dependent chrome suspends', async measurement => {
    Platform.OS = 'web'
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let latest!: ReturnType<typeof useTravelDetailsScrollState>
    let blocked = true
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    function MeasuredChrome({ contentHeight, viewportHeight }: { contentHeight: number; viewportHeight: number }) {
      if (blocked && (contentHeight > 0 || viewportHeight > 0)) throw pending
      return createElement('div', null, `${contentHeight}:${viewportHeight}`)
    }
    function Probe() {
      latest = useTravelDetailsScrollState()
      return createElement(Suspense, { fallback: createElement('div', null, 'Loading') }, createElement(MeasuredChrome, latest))
    }
    try {
      await actDOM(async () => { root.render(createElement(Probe)) })
      expect(host.textContent).toBe('0:0')
      await actDOM(async () => {
        if (measurement === 'content') latest.handleContentSizeChange(390, 1200)
        else latest.handleLayout({ nativeEvent: { layout: { height: 640, width: 390, x: 0, y: 0 } } } as Parameters<typeof latest.handleLayout>[0])
      })
      expect(host.textContent).toBe('0:0')

      await actDOM(async () => {
        blocked = false
        release()
        await pending
      })
      expect(host.textContent).toBe(measurement === 'content' ? '1200:0' : '0:640')
    } finally {
      await actDOM(async () => { root.unmount() })
      host.remove()
    }
  })
})
