import { createContext, createElement, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useIsFocused } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { recordTravelView } from '@/api/travelViews'

const TravelViewVisitContext = createContext<{ current: number | null } | null>(null)

/** Keep the visit across responsive content remounts, but never across routes. */
export function TravelViewVisitProvider({ children }: { children: ReactNode }) {
  const attemptedId = useRef<number | null>(null)
  const isFocused = useIsFocused()
  useEffect(() => {
    if (!isFocused) attemptedId.current = null
  }, [isFocused])
  return createElement(TravelViewVisitContext.Provider, { value: attemptedId }, children)
}

export function useTravelView(travelId: number | undefined): void {
  const isFocused = useIsFocused()
  const authReady = useAuth(state => state.authReady)
  const localAttemptedId = useRef<number | null>(null)
  const visit = useContext(TravelViewVisitContext)
  const attemptedId = visit ?? localAttemptedId

  useEffect(() => {
    if (!isFocused) {
      attemptedId.current = null
      return
    }
    if (
      authReady !== true ||
      typeof travelId !== 'number' ||
      !Number.isSafeInteger(travelId) ||
      travelId <= 0 ||
      attemptedId.current === travelId
    ) return

    attemptedId.current = travelId
    void recordTravelView(travelId)
  }, [attemptedId, authReady, isFocused, travelId])
}
