import React, { Suspense, useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router'

import { useWebHydrationGate } from '@/hooks/useWebHydrationGate'
import { useAuthStore } from '@/stores/authStore'

const UpsertTravelRoute = React.lazy(() =>
  import('@/components/travel/upsert/UpsertTravelRoute')
)

function UpsertTravelRouteFallback() {
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator />
    </View>
  )
}

export default function LazyUpsertTravelRoute() {
  const hydrationReady = useWebHydrationGate()
  const pathname = usePathname()
  const params = useLocalSearchParams<{ previewTravel?: string | string[] }>()
  const router = useRouter()
  const authReady = useAuthStore((state) => state.authReady)
  const rawId = params.previewTravel
  const candidate = (Array.isArray(rawId) ? rawId[0] : rawId)?.trim() ?? ''
  const previewId = pathname === '/travel/new' && /^[1-9][0-9]*$/.test(candidate) ? candidate : null

  useEffect(() => {
    // Keep the exported /travel/new tree through hydration. Only then may the
    // router open details, with auth resolved before private data reaches caches.
    if (previewId && authReady) router.replace(`/travels/${previewId}`)
  }, [authReady, previewId, router])

  if (!hydrationReady || previewId) return <UpsertTravelRouteFallback />

  return (
    <Suspense fallback={<UpsertTravelRouteFallback />}>
      <UpsertTravelRoute />
    </Suspense>
  )
}
