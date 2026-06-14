import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { MAP_COACHMARK_STORAGE_KEY } from './helpers'

function getWebLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export async function isRouteCoachmarkDismissed() {
  if (Platform.OS === 'web') {
    return getWebLocalStorage()?.getItem(MAP_COACHMARK_STORAGE_KEY) === '1'
  }

  return (await AsyncStorage.getItem(MAP_COACHMARK_STORAGE_KEY)) === '1'
}

export async function persistRouteCoachmarkDismissed() {
  if (Platform.OS === 'web') {
    getWebLocalStorage()?.setItem(MAP_COACHMARK_STORAGE_KEY, '1')
    return
  }

  await AsyncStorage.setItem(MAP_COACHMARK_STORAGE_KEY, '1')
}
