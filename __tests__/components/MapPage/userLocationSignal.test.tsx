import React from 'react'

const renderer = require('react-test-renderer')

import {
  createUserLocationSignal,
  useHasUserLocation,
  useUserLocationSignal,
} from '@/components/MapPage/Map/userLocationSignal'

describe('userLocationSignal', () => {
  it('starts with no location and no subscriber churn', () => {
    const signal = createUserLocationSignal(null)
    expect(signal.hasLocation()).toBe(false)
    expect(signal.current).toBeNull()
  })

  it('flips hasLocation once on the null→present transition and notifies subscribers', () => {
    const signal = createUserLocationSignal(null)
    const listener = jest.fn()
    signal.subscribe(listener)

    signal.set({ lat: 53.9, lng: 27.56 })
    expect(signal.hasLocation()).toBe(true)
    expect(signal.current).toEqual({ lat: 53.9, lng: 27.56 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does NOT notify on subsequent coordinate updates while location stays present', () => {
    const signal = createUserLocationSignal({ lat: 1, lng: 1 })
    const listener = jest.fn()
    signal.subscribe(listener)

    // Simulate a stream of GPS ticks — the coarse boolean never changes.
    signal.set({ lat: 1.0001, lng: 1.0001 })
    signal.set({ lat: 1.0002, lng: 1.0002 })
    signal.set({ lat: 1.0003, lng: 1.0003 })

    expect(listener).not.toHaveBeenCalled()
    // Precise coords are still live for route-building.
    expect(signal.current).toEqual({ lat: 1.0003, lng: 1.0003 })
  })

  it('notifies again when location is lost (present→null)', () => {
    const signal = createUserLocationSignal({ lat: 1, lng: 1 })
    const listener = jest.fn()
    signal.subscribe(listener)

    signal.set(null)
    expect(signal.hasLocation()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops notifications', () => {
    const signal = createUserLocationSignal(null)
    const listener = jest.fn()
    const unsub = signal.subscribe(listener)
    unsub()
    signal.set({ lat: 2, lng: 2 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('useUserLocationSignal keeps a stable instance across renders and tracks the prop', () => {
    const instances: unknown[] = []
    const Owner: React.FC<{ loc: { lat: number; lng: number } | null }> = ({ loc }) => {
      const signal = useUserLocationSignal(loc)
      instances.push(signal)
      return null
    }

    let root: any
    renderer.act(() => {
      root = renderer.create(<Owner loc={null} />)
    })
    renderer.act(() => {
      root.update(<Owner loc={{ lat: 53.9, lng: 27.56 }} />)
    })

    // Same instance across renders (stable identity → factory never rebuilds).
    expect(instances[0]).toBe(instances[1])
    const signal = instances[0] as ReturnType<typeof createUserLocationSignal>
    expect(signal.hasLocation()).toBe(true)
    expect(signal.current).toEqual({ lat: 53.9, lng: 27.56 })
  })

  it('a popup consumer re-renders exactly once when the location arrives after mount', () => {
    // Mirrors production: the OWNER (map screen / bottom card) holds the signal and
    // updates it when its own `userLocation` prop changes; the CONSUMER (popup) only
    // subscribes to the coarse boolean and never re-runs the owner's hook.
    const signal = createUserLocationSignal(null)
    let consumerRenders = 0
    let gateOpen = false

    const Consumer: React.FC = () => {
      const has = useHasUserLocation(signal)
      consumerRenders += 1
      gateOpen = has
      return null
    }

    renderer.act(() => {
      renderer.create(<Consumer />)
    })

    // Mounted without a fix → «Маршрут» gate closed.
    expect(gateOpen).toBe(false)
    const rendersBefore = consumerRenders

    // First GPS fix arrives asynchronously.
    renderer.act(() => {
      signal.set({ lat: 53.9, lng: 27.56 })
    })

    // Gate opens with exactly one extra render — no external state update needed.
    expect(gateOpen).toBe(true)
    expect(consumerRenders).toBe(rendersBefore + 1)

    // Subsequent coordinate ticks must NOT re-render (ref-perf intent preserved).
    renderer.act(() => {
      signal.set({ lat: 53.9001, lng: 27.5601 })
      signal.set({ lat: 53.9002, lng: 27.5602 })
    })
    expect(consumerRenders).toBe(rendersBefore + 1)
    // …but precise coords are live for route-building.
    expect(signal.current).toEqual({ lat: 53.9002, lng: 27.5602 })
  })
})
