import React from 'react'

import UserPointsScreenImpl from '@/screens/tabs/UserPointsScreen'
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'

export default function UserPointsScreen() {
  useAndroidBackHandler()
  return <UserPointsScreenImpl />
}
