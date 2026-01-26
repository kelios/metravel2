import { Suspense, lazy } from 'react'
import { Platform, Text, View } from 'react-native'
import { useThemedColors } from '@/hooks/useTheme'

const TravelDetailsWebLazy = lazy(() => import('@/components/travel/details/TravelDetailsContainer'))

export default function TravelDetailsScreen() {
  const colors = useThemedColors()

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
          <View
            style={{
              height: 22,
              marginHorizontal: 16,
              marginTop: 8,
              borderRadius: 8,
              backgroundColor: colors.backgroundSecondary,
              width: '72%',
            }}
          />
          <Text
            numberOfLines={1}
            style={{
              marginHorizontal: 16,
              marginTop: 10,
              color: colors.textMuted,
              fontSize: 14,
              fontWeight: '500',
            }}
          >
            Загружаем путешествие…
          </Text>
        </View>
      }
    >
      <TravelDetailsWebLazy />
    </Suspense>
  )
}
