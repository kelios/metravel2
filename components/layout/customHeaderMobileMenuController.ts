import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'

import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'

const isUnitTestEnv = () =>
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test'

type UseCustomHeaderMobileMenuControllerParams = {
  logout: () => Promise<void> | void
}

export const useCustomHeaderMobileMenuController = ({
  logout,
}: UseCustomHeaderMobileMenuControllerParams) => {
  const router = useRouter()
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
  const mobileMenuOpenedAtRef = useRef(0)

  useEffect(() => {
    if (Platform.OS !== 'web' || !mobileMenuVisible) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuVisible(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [mobileMenuVisible])

  const closeMenu = useCallback(() => {
    setMobileMenuVisible(false)
  }, [])

  const closeMenuSafely = useCallback(() => {
    const sinceOpen = Date.now() - mobileMenuOpenedAtRef.current
    if (!isUnitTestEnv() && sinceOpen < 250) return
    setMobileMenuVisible(false)
  }, [])

  const openMobileMenu = useCallback(() => {
    mobileMenuOpenedAtRef.current = Date.now()
    setMobileMenuVisible(true)
  }, [])

  const handleUserAction = useCallback(
    (path: string, extraAction?: () => void) => {
      extraAction?.()
      router.push(path as any)
      setMobileMenuVisible(false)
    },
    [router],
  )

  const handleNavPress = useCallback(
    (path: string, external?: boolean) => {
      if (external) {
        if (Platform.OS === 'web') {
          openExternalUrlInNewTab(path)
        } else {
          openExternalUrl(path)
        }
        setMobileMenuVisible(false)
        return
      }

      router.push(path as any)
      setMobileMenuVisible(false)
    },
    [router],
  )

  const handleMyTravels = useCallback(() => {
    handleUserAction('/metravel')
  }, [handleUserAction])

  const handleLogout = useCallback(async () => {
    await logout()
    setMobileMenuVisible(false)
    router.push('/')
  }, [logout, router])

  return {
    closeMenu,
    closeMenuSafely,
    handleLogout,
    handleMyTravels,
    handleNavPress,
    handleUserAction,
    mobileMenuVisible,
    openMobileMenu,
  }
}
