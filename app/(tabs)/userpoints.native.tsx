import React from 'react'
import { router, useLocalSearchParams } from 'expo-router'

import UserPointsScreenImpl from '@/screens/tabs/UserPointsScreen'
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'

export default function UserPointsScreen() {
  const params = useLocalSearchParams<{ from?: string }>()
  const cameFromProfile = params.from === 'profile'

  // #548: между tab-роутами router.back() уводит на предыдущую вкладку (Главную),
  // а не на Профиль. Когда экран открыт из профиля — аппаратный Back ведёт туда же,
  // куда и UI-кнопка «В профиль».
  useAndroidBackHandler(undefined, {
    resolveBack: () => {
      if (!cameFromProfile) return false
      router.replace('/profile')
      return true
    },
  })

  return <UserPointsScreenImpl />
}
