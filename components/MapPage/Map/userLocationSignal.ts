import { useEffect, useRef, useSyncExternalStore } from 'react'

export type LatLng = { lat: number; lng: number }

/**
 * Subscribe-able «есть ли геолокация пользователя» signal for the map popup.
 *
 * The popup reads PRECISE coordinates from a ref (`current`) so that frequent GPS
 * ticks never re-render it (see `createMapPopupComponent`). But the «Маршрут»
 * button + distance chip are gated on location being AVAILABLE, and that gate has
 * to flip exactly once when the first fix arrives (null → present). This store
 * exposes that single coarse boolean via `useSyncExternalStore`, so the popup
 * re-renders once on the null→present transition and does NOT re-render on every
 * subsequent coordinate update (the boolean stays `true`).
 */
export interface UserLocationSignal {
  /** Live precise coordinates; read at route-build time, never triggers a render. */
  current: LatLng | null | undefined
  /** Push a new value; notifies subscribers only when the coarse boolean flips. */
  set: (value: LatLng | null | undefined) => void
  /** True when a location is currently available. */
  hasLocation: () => boolean
  subscribe: (listener: () => void) => () => void
}

export function createUserLocationSignal(
  initial: LatLng | null | undefined = null,
): UserLocationSignal {
  let current: LatLng | null | undefined = initial
  let has = current != null
  const listeners = new Set<() => void>()

  return {
    get current() {
      return current
    },
    set(value: LatLng | null | undefined) {
      current = value
      const nextHas = value != null
      if (nextHas !== has) {
        has = nextHas
        listeners.forEach((l) => l())
      }
    },
    hasLocation() {
      return has
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * Stable per-mount signal instance. The parent updates `.set(...)` in an effect on
 * every GPS change; the instance identity stays constant so the popup factory built
 * from it keeps a stable identity (no remount → no lost internal state).
 */
export function useUserLocationSignal(
  value: LatLng | null | undefined,
): UserLocationSignal {
  const ref = useRef<UserLocationSignal | null>(null)
  if (!ref.current) {
    ref.current = createUserLocationSignal(value)
  }
  const signal = ref.current

  useEffect(() => {
    signal.set(value)
  }, [signal, value])
  return signal
}

/** Reactive coarse boolean: re-renders the caller only when location null↔present. */
export function useHasUserLocation(signal: UserLocationSignal | undefined): boolean {
  return useSyncExternalStore(
    (listener) => (signal ? signal.subscribe(listener) : () => {}),
    () => (signal ? signal.hasLocation() : false),
    () => (signal ? signal.hasLocation() : false),
  )
}
