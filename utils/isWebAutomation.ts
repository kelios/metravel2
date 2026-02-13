import { Platform } from 'react-native'

export const isWebAutomation =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  Boolean((navigator as any).webdriver)
