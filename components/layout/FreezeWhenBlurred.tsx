import React, { Suspense } from 'react'
import { useIsFocused } from 'expo-router'

// Never settles: the card stays suspended until it is focused again.
const blurred = { then() {} }

function Suspender({ frozen, children }: { frozen: boolean; children: React.ReactNode }) {
  if (frozen) throw blurred
  return <>{children}</>
}

/**
 * The web stack keeps every card mounted (`display:none`) and has no
 * `freezeOnBlur`, so a hidden card kept re-rendering against the new URL and
 * its paused queries (#2464). Suspense keeps its last committed tree instead and
 * re-runs layout effects (head tags, published navigation) when it is shown again.
 */
export default function FreezeWhenBlurred({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused()
  return (
    <Suspense fallback={null}>
      <Suspender frozen={!isFocused}>{children}</Suspender>
    </Suspense>
  )
}
