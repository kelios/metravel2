import { memo, lazy } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

import { SkeletonLoader, TravelCardSkeleton } from '@/components/ui/SkeletonLoader'
import { RECOMMENDATIONS_TOTAL_HEIGHT } from '@/components/listTravel/rightColumnModel'
import { devError } from '@/utils/logger'

// Retry a dynamic import a few times before giving up. In dev, Metro can
// transiently drop an async module fetch ("unexpected end of stream"); without
// a retry, React.lazy caches that single rejection and the section stays stuck
// on the error fallback until a full app reload. Retrying lets a transient
// hiccup self-heal. Production bundles resolve from the single bundle, so the
// happy path returns on the first attempt and this adds no cost there.
async function importWithRetry<T>(factory: () => Promise<T>, attempts = 3, delayMs = 400): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await factory()
    } catch (e) {
      lastError = e
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)))
      }
    }
  }
  throw lastError
}

// Lazy load RecommendationsTabs; retry transient import failures, fall back gracefully.
export const RecommendationsTabs = lazy(async () => {
  try {
    return await importWithRetry(() => import('./RecommendationsTabs'))
  } catch (e) {
    devError('[RecommendationsTabs] failed to load after retries:', e)
    return {
      default: memo((_props: { forceVisible?: boolean; onVisibilityChange?: (visible: boolean) => void }) => (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text>Не удалось загрузить рекомендации</Text>
        </View>
      )),
    } as unknown as typeof import('./RecommendationsTabs')
  }
})

// Simple placeholder for loading state (must match the reserved header height)
export const RecommendationsPlaceholder = () => (
  <View
    style={{
      height: RECOMMENDATIONS_TOTAL_HEIGHT,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <ActivityIndicator size="small" />
  </View>
)

const FallbackTravelCardSkeleton = () => (
  <SkeletonLoader width="100%" height={320} borderRadius={16} />
)

export const TravelCardSkeletonComponent = TravelCardSkeleton ?? FallbackTravelCardSkeleton
