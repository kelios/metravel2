import React, { Suspense } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'

// Keep the route module tiny to avoid pulling UserPoints + location deps into the entry bundle.
const UserPointsScreenImpl = React.lazy(() => import('@/screens/tabs/UserPointsScreen'))

export default function UserPointsScreen() {
  const params = useLocalSearchParams<{ from?: string }>()
  const cameFromProfile = params.from === 'profile'

  // Android: hardware Back возвращает на предыдущий экран (Профиль), а не
  // сбрасывает Tab-навигатор на главную. Хук гейтит по Platform.OS === 'android'.
  // #548: между tab-роутами router.back() уводит на Главную, поэтому при открытии
  // из профиля аппаратный Back ведёт ровно в профиль.
  useAndroidBackHandler(undefined, {
    resolveBack: () => {
      if (!cameFromProfile) return false
      router.replace('/profile')
      return true
    },
  })
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
