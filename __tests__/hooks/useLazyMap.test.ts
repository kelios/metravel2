import React, { useEffect } from 'react'
import { Platform, View } from 'react-native'
import { render } from '@testing-library/react-native'
import { useLazyMap } from '@/hooks/useLazyMap'

// Тестовый компонент-обёртка для хука
function LazyMapTestComponent(props: { enabled?: boolean; onState: (state: any) => void }) {
  const { shouldLoad, isLoading, setElementRef } = useLazyMap({ enabled: props.enabled })

  useEffect(() => {
    props.onState({ shouldLoad, isLoading, setElementRef })
  }, [shouldLoad, isLoading, setElementRef, props])

  return React.createElement(View, { ref: setElementRef as any, testID: 'lazy-map-root' })
}

describe('useLazyMap', () => {
  const originalPlatformOS = Platform.OS
  const originalIntersectionObserver = (global as any).IntersectionObserver

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    ;(global as any).IntersectionObserver = class {
      observe() {}
      disconnect() {}
    } as any
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatformOS
    ;(global as any).IntersectionObserver = originalIntersectionObserver
  })

  it('on non-web platforms shouldLoad is true immediately', () => {
    ;(Platform as any).OS = 'ios'

    let latestState: any = null

    render(React.createElement(LazyMapTestComponent, { enabled: true, onState: (s: any) => { latestState = s } }))

    expect(latestState.shouldLoad).toBe(true)
    expect(latestState.isLoading).toBe(false)
  })

  it('when enabled=false shouldLoad is true immediately (no lazy behavior)', () => {
    let latestState: any = null

    render(React.createElement(LazyMapTestComponent, { enabled: false, onState: (s: any) => { latestState = s } }))

    expect(latestState.shouldLoad).toBe(true)
    expect(latestState.isLoading).toBe(false)
  })

  it('on web with enabled=true starts with shouldLoad=false', () => {
    let latestState: any = null

    render(React.createElement(LazyMapTestComponent, { enabled: true, onState: (s: any) => { latestState = s } }))

    expect(latestState.shouldLoad).toBe(false)
    expect(latestState.isLoading).toBe(false)
  })

  it('falls back to immediate load when IntersectionObserver is not available', () => {
    delete (global as any).IntersectionObserver

    let latestState: any = null

    render(React.createElement(LazyMapTestComponent, { enabled: true, onState: (s: any) => { latestState = s } }))

    expect(latestState.shouldLoad).toBe(true)
  })
})
