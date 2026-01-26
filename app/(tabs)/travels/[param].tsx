import { Suspense, lazy } from 'react'
import { Platform, Text, View } from 'react-native'
import { useThemedColors } from '@/hooks/useTheme'
import { useLocalSearchParams } from 'expo-router'

const TravelDetailsWebLazy = lazy(() => import('@/components/travel/details/TravelDetailsContainer'))

export default function TravelDetailsScreen() {
  const colors = useThemedColors()
  const { param } = useLocalSearchParams()
  const raw = Array.isArray(param) ? param[0] : (param ?? '')
  const safeParam = String(raw ?? '').trim().split('#')[0].split('%23')[0]
  const fallbackTitle = safeParam.length > 0 ? safeParam.replace(/[-_]+/g, ' ') : 'Путешествие'

  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              height: 260,
              margin: 16,
              borderRadius: 12,
              backgroundColor: colors.backgroundSecondary,
            }}
          />
          <Text
            numberOfLines={2}
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              color: colors.text,
              fontSize: 18,
              fontWeight: '600',
            }}
          >
            {fallbackTitle}
          </Text>
        </View>
      }
    >
      <TravelDetailsWebLazy />
    </Suspense>
  )
}
