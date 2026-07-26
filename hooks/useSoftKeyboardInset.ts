import { useEffect, useMemo, useState } from 'react'
import { Keyboard, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useWebKeyboardInset } from '@/hooks/useWebKeyboardInset'

type ResolveSoftKeyboardInsetsParams = {
  nativeKeyboardHeight: number
  platform: string
  safeAreaBottom: number
  webKeyboardOverlap: number
}

export type SoftKeyboardInsets = {
  /**
   * Amount that a fullscreen content viewport must give back to keep its bottom
   * edge above the keyboard. Android SafeAreaView already excludes the system
   * navigation bar, so this is the raw RN keyboard height there.
   */
  contentViewportInset: number
  /**
   * Full root-window overlap. Scroll containers whose viewport extends behind
   * Android's navigation bar need this value as their reachable bottom spacer.
   */
  rootBottomOverlap: number
}

const finiteNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0

export function resolveSoftKeyboardInsets({
  nativeKeyboardHeight,
  platform,
  safeAreaBottom,
  webKeyboardOverlap,
}: ResolveSoftKeyboardInsetsParams): SoftKeyboardInsets {
  const nativeHeight = finiteNonNegative(nativeKeyboardHeight)
  const webOverlap = finiteNonNegative(webKeyboardOverlap)
  const safeBottom = finiteNonNegative(safeAreaBottom)

  if (platform === 'web') {
    return {
      contentViewportInset: webOverlap,
      rootBottomOverlap: webOverlap,
    }
  }

  if (nativeHeight <= 0) {
    return {
      contentViewportInset: 0,
      rootBottomOverlap: 0,
    }
  }

  if (platform === 'android') {
    return {
      contentViewportInset: nativeHeight,
      rootBottomOverlap: nativeHeight + safeBottom,
    }
  }

  // iOS fullscreen editors already use KeyboardAvoidingView padding, so they
  // must not receive a second manual viewport inset. Root scroll containers
  // can still use the reported overlap when needed.
  return {
    contentViewportInset: 0,
    rootBottomOverlap: nativeHeight,
  }
}

/**
 * Real soft-keyboard overlap for the app's edge-to-edge root.
 *
 * Android's root view does not resize under IME even with adjustResize. RN
 * reports IME height without the navigation-bar inset, while mobile web needs
 * visualViewport overlap. Keep those platform details in one reusable hook.
 */
export function useSoftKeyboardInset(): SoftKeyboardInsets {
  const insets = useSafeAreaInsets()
  const webKeyboardOverlap = useWebKeyboardInset()
  const [nativeKeyboardHeight, setNativeKeyboardHeight] = useState(0)

  useEffect(() => {
    if (Platform.OS === 'web') return

    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setNativeKeyboardHeight(event.endCoordinates?.height ?? 0)
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setNativeKeyboardHeight(0)
    })

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return useMemo(
    () =>
      resolveSoftKeyboardInsets({
        nativeKeyboardHeight,
        platform: Platform.OS,
        safeAreaBottom: insets.bottom,
        webKeyboardOverlap,
      }),
    [insets.bottom, nativeKeyboardHeight, webKeyboardOverlap],
  )
}
