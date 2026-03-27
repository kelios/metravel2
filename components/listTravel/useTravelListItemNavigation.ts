import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'

import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries'
import { queryKeys } from '@/queryKeys'
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation'

const ENABLE_TRAVEL_DETAILS_PREFETCH = false
const ENABLE_HOVER_PREFETCH = false

type Props = {
  id: number | string
  slug: string | undefined
  travelUrl: string
  isMetravel: boolean
  selectable: boolean
  onToggle?: () => void
}

export function useTravelListItemNavigation({
  id,
  slug,
  travelUrl,
  isMetravel,
  selectable,
  onToggle,
}: Props) {
  const queryClient = useQueryClient()
  const anchorRef = useRef<any>(null)
  const hasPrefetchedRef = useRef(false)
  const hasHoverPrefetchedRef = useRef(false)

  const returnToPath = useMemo(() => {
    if (isMetravel) return '/metravel'
    if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

    const normalizedPathname = window.location.pathname || ''
    const navItem = HEADER_NAV_ITEMS.find((item) => !item.external && item.path === normalizedPathname)
    return navItem?.path || ''
  }, [isMetravel])

  const navigationUrl = useMemo(() => {
    if (!travelUrl) return ''
    if (!returnToPath) return travelUrl
    const separator = travelUrl.includes('?') ? '&' : '?'
    return `${travelUrl}${separator}returnTo=${encodeURIComponent(returnToPath)}`
  }, [returnToPath, travelUrl])

  const prefetchTravelDetails = useCallback(() => {
    if (!ENABLE_TRAVEL_DETAILS_PREFETCH) return
    const travelId = slug ?? id
    const isId = !isNaN(Number(travelId))
    const cachedData = queryClient.getQueryData(queryKeys.travel(travelId))
    if (cachedData) return

    queryClient.prefetchQuery({
      queryKey: queryKeys.travel(travelId),
      queryFn: ({ signal }) =>
        isId
          ? fetchTravel(Number(travelId), { signal })
          : fetchTravelBySlug(travelId as string, { signal }),
      staleTime: 5 * 60 * 1000,
    })
  }, [id, queryClient, slug])

  const handlePointerEnter = useCallback(() => {
    if (!ENABLE_HOVER_PREFETCH) return
    if (hasHoverPrefetchedRef.current) return

    const travelId = slug ?? id
    if (!travelId) return
    const isId = !isNaN(Number(travelId))
    const cachedData = queryClient.getQueryData(queryKeys.travel(travelId))
    if (cachedData) {
      hasHoverPrefetchedRef.current = true
      return
    }

    hasHoverPrefetchedRef.current = true
    queryClient.prefetchQuery({
      queryKey: queryKeys.travel(travelId),
      queryFn: ({ signal }) =>
        isId
          ? fetchTravel(Number(travelId), { signal })
          : fetchTravelBySlug(travelId as string, { signal }),
      staleTime: 5 * 60 * 1000,
    })
  }, [id, queryClient, slug])

  useEffect(() => {
    if (!ENABLE_TRAVEL_DETAILS_PREFETCH) return
    if (Platform.OS !== 'web') return
    if (hasPrefetchedRef.current) return

    const el = anchorRef.current
    if (!el) return
    if (typeof window === 'undefined') return
    if (typeof (window as any).IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        if (hasPrefetchedRef.current) return
        hasPrefetchedRef.current = true
        prefetchTravelDetails()
        observer.disconnect()
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.01,
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [prefetchTravelDetails])

  const handlePress = useCallback(() => {
    if (selectable) {
      onToggle?.()
      return
    }

    if (!navigationUrl) {
      return
    }

    const travelId = (typeof slug === 'string' && slug.trim()) ? slug.trim() : id
    const isId = !isNaN(Number(travelId))
    const shouldPrefetchDetails = typeof navigationUrl === 'string' && navigationUrl.startsWith('/travels/')
    if (shouldPrefetchDetails && ENABLE_TRAVEL_DETAILS_PREFETCH && Platform.OS === 'web') {
      const cachedData = queryClient.getQueryData(queryKeys.travel(travelId))
      if (!cachedData) {
        setTimeout(() => {
          queryClient.prefetchQuery({
            queryKey: queryKeys.travel(travelId),
            queryFn: ({ signal }) =>
              isId
                ? fetchTravel(Number(travelId), { signal })
                : fetchTravelBySlug(travelId as string, { signal }),
            staleTime: 5 * 60 * 1000,
          })
        }, 100)
      }
    }

    router.push(navigationUrl as any)
  }, [id, navigationUrl, onToggle, queryClient, selectable, slug])

  return {
    anchorRef,
    navigationUrl,
    handlePress,
    handlePointerEnter,
    isNavigable: Boolean(navigationUrl),
  }
}
