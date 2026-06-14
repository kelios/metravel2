import React, { Suspense } from 'react'
import { View, ActivityIndicator } from 'react-native'

import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'

// Keep the route module tiny to avoid pulling UserPoints + location deps into the entry bundle.
const UserPointsScreenImpl = React.lazy(() => import('@/screens/tabs/UserPointsScreen'))

export default function UserPointsScreen() {
  // Android: hardware Back возвращает на предыдущий экран (Профиль), а не
  // сбрасывает Tab-навигатор на главную. Хук гейтит по Platform.OS === 'android'.
  useAndroidBackHandler()
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <UserPointsScreenImpl />
    </Suspense>
  )
}
