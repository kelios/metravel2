import { Platform } from 'react-native'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined
const getClientSnapshot = () => true
const getServerSnapshot = () => false

/**
 * Returns false for SSR and the first web hydration render, then switches to
 * true immediately after this consumer commits. Native renders are always ready.
 */
export function useHydrationReady(): boolean {
  const hydrationReady = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  )

  return Platform.OS !== 'web' || hydrationReady
}
