import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native'
import { useRouter } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useFooterOverlayOpen } from '@/hooks/useFooterOverlayOpen'
import { useWebKeyboardInset } from '@/hooks/useWebKeyboardInset'
import { asBottomDimension, useDockReservePx, webDockReserve } from '@/components/layout/bottomChromeInset'
import { translate as i18nT } from '@/i18n'
import { webViewStyle } from '@/utils/webProps'
import { preloadOfflineRoute } from '@/utils/offlineRoutePreload.web'
import {
  releaseBottomChromeReserve,
  setCriticalBottomChromeOwner,
  setBottomChromeReserve,
} from '@/utils/bottomChromeReserve'

const RESERVE_OWNER = 'network-status'
const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

interface NetworkStatusProps {
  showWhenOnline?: boolean
  position?: 'top' | 'bottom'
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showWhenOnline = false,
  position = 'top',
}) => {
  const router = useRouter()
  const colors = useThemedColors()
  const { isConnected } = useNetworkStatus()
  const [wasOffline, setWasOffline] = useState(false)
  const [visible, setVisible] = useState(!isConnected)
  const [offlineRouteReady, setOfflineRouteReady] = useState(false)
  const [bannerHeight, setBannerHeight] = useState(44 + 2 * DESIGN_TOKENS.spacing.xs)
  const footerOverlayOpen = useFooterOverlayOpen()
  const keyboardInset = useWebKeyboardInset()
  const dockReservePx = useDockReservePx()
  const bottomOffset = dockReservePx + DESIGN_TOKENS.spacing.xs
  const bottomPosition = webDockReserve(DESIGN_TOKENS.spacing.xs)
  const suspended = footerOverlayOpen || (position === 'bottom' && keyboardInset > 0)
  const criticalActive = position === 'bottom' && (!isConnected || wasOffline)
  const openingOfflineRouteRef = useRef(false)

  useWebLayoutEffect(() => {
    if (!criticalActive) return
    setCriticalBottomChromeOwner(RESERVE_OWNER)
    return () => {
      releaseBottomChromeReserve(RESERVE_OWNER)
      setCriticalBottomChromeOwner(null)
    }
  }, [criticalActive])

  useEffect(() => {
    if (position !== 'bottom' || !visible || suspended) return
    setBottomChromeReserve(RESERVE_OWNER, bottomOffset + bannerHeight + DESIGN_TOKENS.spacing.xs)
    return () => releaseBottomChromeReserve(RESERVE_OWNER)
  }, [bannerHeight, bottomOffset, suspended, position, visible])

  useEffect(() => {
    if (!isConnected) return undefined
    let active = true
    void preloadOfflineRoute()
      .then(() => {
        if (active) setOfflineRouteReady(true)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [isConnected])

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined
    if (!isConnected) {
      setWasOffline(true)
      setVisible(true)
      return () => undefined
    }

    if (wasOffline) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        exitTimer = setTimeout(() => setWasOffline(false), 300)
      }, 2000)
      return () => {
        clearTimeout(timer)
        clearTimeout(exitTimer)
      }
    }

    setVisible(false)
    return () => undefined
  }, [isConnected, wasOffline])

  const handleOpenSaved = useCallback((event: GestureResponderEvent) => {
    event.preventDefault?.()
    event.stopPropagation()
    if (!offlineRouteReady || openingOfflineRouteRef.current) return
    openingOfflineRouteRef.current = true
    router.push('/offline')
  }, [offlineRouteReady, router])

  const transform = visible ? 'translateY(0)' : position === 'bottom'
    ? `translateY(calc(100% + ${bottomPosition}))`
    : 'translateY(-100%)'

  if (suspended || (isConnected && !wasOffline && !showWhenOnline)) {
    return null
  }

  const message = isConnected ? i18nT('shared:components.ui.NetworkStatus.soedinenie_vosstanovleno_25419314') : i18nT('shared:components.ui.NetworkStatus.net_podklyucheniya_k_internetu_71e8692e')
  const backgroundColor = isConnected ? colors.success : colors.danger

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      aria-hidden={!visible}
      testID="network-status-banner"
      onLayout={(event) => setBannerHeight(event.nativeEvent.layout.height)}
      style={[
        styles.container,
        position === 'top' ? styles.top : { bottom: asBottomDimension(bottomPosition) },
        { backgroundColor, transform },
      ]}
    >
      <View pointerEvents="box-none" style={styles.content}>
        <Text
          numberOfLines={2}
          style={[styles.text, { color: colors.textInverse }]}
        >
          {message}
        </Text>
        {!isConnected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nT('offline:openSaved')}
            accessibilityState={{ busy: !offlineRouteReady, disabled: !offlineRouteReady }}
            disabled={!offlineRouteReady}
            onPress={handleOpenSaved}
            style={[
              styles.action,
              { borderColor: colors.textInverse },
              !offlineRouteReady && styles.actionDisabled,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.actionText, { color: colors.textInverse }]}
            >
              {i18nT('offline:openSaved')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    zIndex: 9999,
    ...Platform.select({
      web: webViewStyle({
        position: 'fixed',
        transitionDuration: '300ms',
        transitionProperty: 'transform',
        transitionTimingFunction: 'ease',
        willChange: 'transform',
      }),
    }),
  },
  top: {
    top: 0,
  },
  text: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'left',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  action: {
    minHeight: 44,
    flexShrink: 0,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.62,
  },
})
