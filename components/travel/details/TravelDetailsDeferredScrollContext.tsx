import React, { createContext, useContext } from 'react'

// #565: scroll-derived state (scroll-spy active section, content/viewport height,
// animated scroll offset) changes on every scroll frame. Flowing it through this
// context — instead of through the root deferred-runtime element's props/memo key —
// keeps the root `<TravelDetailsDeferredRuntimeSlot>` element identity stable across
// scroll, so changing `activeSection` no longer rebuilds the whole deferred subtree
// (and no longer reconciles the map/comments/sticky runtime) on each scroll.
export type TravelDetailsDeferredScrollState = {
  activeSection: string | null
  contentHeight: number
  viewportHeight: number
  scrollY: any
}

const TravelDetailsDeferredScrollContext =
  createContext<TravelDetailsDeferredScrollState | null>(null)

export function TravelDetailsDeferredScrollProvider({
  value,
  children,
}: {
  value: TravelDetailsDeferredScrollState
  children: React.ReactNode
}) {
  return (
    <TravelDetailsDeferredScrollContext.Provider value={value}>
      {children}
    </TravelDetailsDeferredScrollContext.Provider>
  )
}

export function useTravelDetailsDeferredScroll(): TravelDetailsDeferredScrollState {
  const value = useContext(TravelDetailsDeferredScrollContext)
  if (!value) {
    throw new Error(
      'useTravelDetailsDeferredScroll must be used within a TravelDetailsDeferredScrollProvider',
    )
  }
  return value
}
