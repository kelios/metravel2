import { useMemo } from 'react'
import { Platform } from 'react-native'

import type { AppStorePlatform } from '@/constants/appStore'
import { useHydrationReady } from '@/hooks/useHydrationReady'
import { detectStorePlatform } from '@/utils/appInstallHint'

/**
 * Витрина текущего устройства. На web до гидратации — `null` (как в статическом
 * HTML, где UA неизвестен), после — App Store для iPhone/iPad, Google Play для
 * Android, `null` для десктопа: там показываем обе витрины.
 */
export function useDeviceStorePlatform(): AppStorePlatform | null {
  const hydrationReady = useHydrationReady()
  return useMemo(() => {
    if (Platform.OS === 'ios') return 'ios'
    if (Platform.OS === 'android') return 'android'
    if (!hydrationReady || typeof navigator === 'undefined') return null
    return detectStorePlatform(navigator)
  }, [hydrationReady])
}
