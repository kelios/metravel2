import React from 'react'
import { Text } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'

import MapErrorBoundary from '@/components/MapPage/MapErrorBoundary'

// #217 — desktop→mobile→desktop breakpoint flips remount the Leaflet container.
// Each remount can throw "reused by another instance", which the boundary
// auto-recovers from. The lifetime budget (2) must RESET after a successful
// recovery, otherwise the third flip's error is left uncaught → blank map.
//
// react-test-renderer re-throws boundary-caught render errors to the caller, so
// we drive the boundary's lifecycle methods directly (the same path React calls)
// and assert the observable state + private retry counter.

const REUSED_ERROR = new Error('Map container is being reused by another instance')
const UNRELATED_ERROR = new Error('Some unrelated unrecoverable failure')
const noopInfo = {} as React.ErrorInfo

describe('MapErrorBoundary retry budget reset (#217)', () => {
  const originalError = console.error
  const originalInfo = console.info
  beforeAll(() => {
    console.error = jest.fn()
    console.info = jest.fn()
  })
  afterAll(() => {
    console.error = originalError
    console.info = originalInfo
  })

  function makeBoundary() {
    const instance = new (MapErrorBoundary as any)({ children: null })
    const setState = jest.fn((updater: any) => {
      const next = typeof updater === 'function' ? updater(instance.state) : updater
      instance.state = { ...instance.state, ...next }
    })
    instance.setState = setState
    return instance
  }

  it('resets the retry budget after each successful recovery (survives >2 flips)', () => {
    const boundary = makeBoundary()

    // Simulate 4 breakpoint flips. Each: error caught → auto-reset → healthy
    // re-render (componentDidUpdate restores the budget).
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const before = { ...boundary.state }
      // 1) Error thrown during a flip.
      boundary.state = (MapErrorBoundary as any).getDerivedStateFromError(REUSED_ERROR)
      boundary.componentDidCatch(REUSED_ERROR, noopInfo)

      // componentDidCatch auto-recovers a "reused" error within budget → hasError false.
      expect(boundary.state.hasError).toBe(false)

      // 2) Boundary re-renders the (now healthy) child: prevState had hasError true.
      boundary.componentDidUpdate({ children: null }, { ...before, hasError: true })
    }

    // After the loop the private counter must be back at 0 — i.e. the budget was
    // refreshed every cycle, so a 5th flip would still recover.
    expect((boundary as any)._autoRetryCount).toBe(0)
  })

  it('does NOT auto-recover unrelated errors (fallback is shown with a retry button)', () => {
    function HardBoom(): React.ReactElement {
      throw UNRELATED_ERROR
    }

    const { getByText } = render(
      <MapErrorBoundary>
        <HardBoom />
      </MapErrorBoundary>,
    )

    expect(getByText('Ошибка загрузки карты')).toBeTruthy()
    const retry = getByText('Попробовать снова')
    fireEvent.press(retry)
    expect(getByText('Ошибка загрузки карты')).toBeTruthy()
  })

  it('renders children normally when no error occurs', () => {
    const { getByText } = render(
      <MapErrorBoundary>
        <Text>map-ok</Text>
      </MapErrorBoundary>,
    )
    expect(getByText('map-ok')).toBeTruthy()
  })
})
