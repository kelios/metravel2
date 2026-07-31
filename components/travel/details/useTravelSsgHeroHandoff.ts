import { useCallback, useRef } from 'react'

export type TravelSsgHeroHandoff = {
  active: boolean
  hostRef: React.MutableRefObject<any>
  release: () => void
}

/** Native/SSR fallback. The browser implementation lives in the .web file. */
export function useTravelSsgHeroHandoff(
  _onAdopted: () => void,
): TravelSsgHeroHandoff {
  const hostRef = useRef<any>(null)
  const release = useCallback(() => {}, [])

  return { active: false, hostRef, release }
}
