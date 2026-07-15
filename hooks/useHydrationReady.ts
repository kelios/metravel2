import { Platform } from 'react-native'
import { useEffect, useState } from 'react'

/**
 * Returns false for SSR and the first web hydration render, then switches to
 * true immediately after this consumer commits. Native renders are always ready.
 */
export function useHydrationReady(): boolean {
  const [hydrationReady, setHydrationReady] = useState(Platform.OS !== 'web')

  useEffect(() => {
    if (Platform.OS === 'web') {
      setHydrationReady(true)
    }
  }, [])

  return hydrationReady
}
