import React, { createContext, useContext } from 'react'

// #565: scroll-derived state changes on every scroll frame. Keep it scoped to
// scroll-only chrome (progress, section sheet, scroll-to-top, sticky actions) so
// the heavy post-LCP runtime with map/comments does not consume this context.
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
