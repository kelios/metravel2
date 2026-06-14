import { useCallback, useEffect, useRef, useState } from 'react'
import { findNodeHandle, Platform, ScrollView, UIManager, View } from 'react-native'

import {
  EMPTY_MANUAL_POINT,
  parseCoordsPair,
  revokeManualPreview,
  ROUTE_COUNTRIES_ANCHOR_ID,
  ROUTE_MARKERS_ANCHOR_ID,
} from './helpers'
import {
  isRouteCoachmarkDismissed,
  persistRouteCoachmarkDismissed,
} from './coachmarkStorage'
import type { ManualPointState } from './types'

export function useLatestRef<T>(value: T) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}

export function useRouteAnchorScroll({
  focusAnchorId,
  onAnchorHandled,
}: {
  focusAnchorId?: string | null;
  onAnchorHandled?: () => void;
}) {
  const scrollRef = useRef<ScrollView | null>(null)
  const markersListAnchorRef = useRef<View | null>(null)
  const countriesAnchorRef = useRef<View | null>(null)

  useEffect(() => {
    if (!focusAnchorId) return
    if (focusAnchorId !== ROUTE_MARKERS_ANCHOR_ID && focusAnchorId !== ROUTE_COUNTRIES_ANCHOR_ID) return

    if (Platform.OS === 'web') {
      onAnchorHandled?.()
      return
    }

    const scrollNode = scrollRef.current
    const anchorNode = focusAnchorId === ROUTE_COUNTRIES_ANCHOR_ID
      ? countriesAnchorRef.current
      : markersListAnchorRef.current

    if (!scrollNode || !anchorNode) {
      onAnchorHandled?.()
      return
    }

    const scrollHandle = findNodeHandle(scrollNode)
    const anchorHandle = findNodeHandle(anchorNode)
    if (!scrollHandle || !anchorHandle) {
      onAnchorHandled?.()
      return
    }

    const timeoutId = setTimeout(() => {
      UIManager.measureLayout(
        anchorHandle,
        scrollHandle,
        () => onAnchorHandled?.(),
        (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true })
          onAnchorHandled?.()
        },
      )
    }, 50)

    return () => clearTimeout(timeoutId)
  }, [focusAnchorId, onAnchorHandled])

  return { scrollRef, markersListAnchorRef, countriesAnchorRef }
}

export function useRouteCoachmark(hasPoints: boolean) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let isActive = true

    if (hasPoints) {
      setIsVisible(false)
      return () => {
        isActive = false
      }
    }

    void isRouteCoachmarkDismissed()
      .then((isDismissed) => {
        if (isActive) setIsVisible(!isDismissed)
      })
      .catch(() => {
        if (isActive) setIsVisible(true)
      })

    return () => {
      isActive = false
    }
  }, [hasPoints])

  const dismiss = useCallback(() => {
    setIsVisible(false)
    void persistRouteCoachmarkDismissed().catch(() => undefined)
  }, [])

  return { isVisible, dismiss }
}

export function useManualPointForm() {
  const [isPanelVisible, setPanelVisible] = useState(false)
  const [state, setState] = useState<ManualPointState>(EMPTY_MANUAL_POINT)
  const fileInputRef = useRef<any>(null)
  const latestPreviewRef = useLatestRef(state.photoPreviewUrl)

  const clearPhoto = useCallback(() => {
    setState((current) => {
      revokeManualPreview(current.photoPreviewUrl)
      return { ...current, photoPreviewUrl: null }
    })
  }, [])

  const reset = useCallback((options?: { preservePendingPhoto?: boolean }) => {
    setState((current) => {
      if (!options?.preservePendingPhoto) {
        revokeManualPreview(current.photoPreviewUrl)
      }
      return EMPTY_MANUAL_POINT
    })
  }, [])

  const hidePanel = useCallback(() => {
    reset()
    setPanelVisible(false)
  }, [reset])

  const togglePanel = useCallback(() => {
    setPanelVisible((current) => {
      if (current) reset()
      return !current
    })
  }, [reset])

  const setCoords = useCallback((coords: string) => {
    const parsed = parseCoordsPair(coords)
    setState((current) => ({
      ...current,
      coords,
      lat: parsed ? String(parsed.lat) : current.lat,
      lng: parsed ? String(parsed.lng) : current.lng,
    }))
  }, [])

  const setLat = useCallback((lat: string) => {
    setState((current) => ({ ...current, lat }))
  }, [])

  const setLng = useCallback((lng: string) => {
    setState((current) => ({ ...current, lng }))
  }, [])

  const setPhotoPreview = useCallback((photoPreviewUrl: string | null) => {
    setState((current) => {
      revokeManualPreview(current.photoPreviewUrl)
      return { ...current, photoPreviewUrl }
    })
  }, [])

  const setPhotoCoordinates = useCallback((lat: number, lng: number) => {
    setState((current) => ({
      ...current,
      lat: String(lat),
      lng: String(lng),
      coords: `${lat}, ${lng}`,
    }))
  }, [])

  useEffect(() => () => {
    revokeManualPreview(latestPreviewRef.current)
  }, [latestPreviewRef])

  return {
    fileInputRef,
    isPanelVisible,
    state,
    clearPhoto,
    hidePanel,
    reset,
    setCoords,
    setLat,
    setLng,
    setPanelVisible,
    setPhotoCoordinates,
    setPhotoPreview,
    togglePanel,
  }
}
