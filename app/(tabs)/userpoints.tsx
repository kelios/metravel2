import { router, useLocalSearchParams } from 'expo-router'

import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'
import UserPointsScreenImpl from '@/screens/tabs/UserPointsScreen'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

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
  return <UserPointsScreenImpl />
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/userpoints')
}
