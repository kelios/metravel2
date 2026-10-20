import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Image, Platform, StyleSheet, Text, View } from 'react-native'
import { useGlobalSearchParams, usePathname } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import type { AppStorePlatform } from '@/constants/appStore'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { asBottomDimension, useDockReservePx, webDockReserve } from '@/components/layout/bottomChromeInset'
import { useFooterOverlayOpen } from '@/hooks/useFooterOverlayOpen'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { sendAnalyticsEvent } from '@/utils/analytics'
import {
  getPhoneStorePlatform,
  isStandaloneDisplayMode,
  markAppInstallHintDismissed,
  readAppInstallHintState,
  shouldOfferAppInstall,
} from '@/utils/appInstallHint'
import {
  getBottomChromeReserve,
  releaseBottomChromeReserve,
  setBottomChromeReserve,
  subscribeBottomChromeReserve,
} from '@/utils/bottomChromeReserve'
import { openExternalUrl } from '@/utils/externalLinks'
import { getMobileAppOpenUrl, getSmartAppBannerContent } from '@/utils/mobileAppHandoff'
import { openAppStoreListing } from '@/utils/openAppStoreListing'
import { webViewStyle } from '@/utils/webProps'

const IS_WEB = Platform.OS === 'web'
const RESERVE_OWNER = 'app-install-bar'
const APP_ICON = require('@/assets/images/app-icon.webp')
const getOtherReserve = () => getBottomChromeReserve(RESERVE_OWNER)
const getServerReserve = () => 0

/** One phone-only offer; the OS handles app availability after an explicit tap. */
function AppInstallBar() {
  const colors = useThemedColors()
  const { t } = useTranslation()
  const pathname = usePathname()
  const searchParams = useGlobalSearchParams()
  const { isMobile, width } = useResponsive()
  const footerOverlayOpen = useFooterOverlayOpen()
  const [storePlatform, setStorePlatform] = useState<AppStorePlatform | null>(null)
  const [closed, setClosed] = useState(false)
  const shownRecorded = useRef(false)
  const [barHeight, setBarHeight] = useState(112)
  const styles = useMemo(() => createStyles(colors), [colors])
  const dockReservePx = useDockReservePx()
  const otherReserve = useSyncExternalStore(subscribeBottomChromeReserve, getOtherReserve, getServerReserve)
  const bottomOffset = Math.max(dockReservePx, otherReserve) + DESIGN_TOKENS.spacing.xs
  const bottomPosition = webDockReserve(DESIGN_TOKENS.spacing.xs, otherReserve)
  const shown = IS_WEB && isMobile && storePlatform !== null && !closed && !footerOverlayOpen && pathname !== '/app'

  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') return
    const userAgent = String(window.navigator?.userAgent || '')
    if (!shouldOfferAppInstall({
      userAgent,
      isMobileViewport: isMobile,
      referrer: document.referrer,
      isStandalone: isStandaloneDisplayMode(),
      state: readAppInstallHintState(),
      now: Date.now(),
    })) return
    setStorePlatform(getPhoneStorePlatform(userAgent))
  }, [isMobile])

  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="apple-itunes-app"]')
    if (meta) meta.content = getSmartAppBannerContent(window.location.href)
  }, [pathname, searchParams])

  useEffect(() => {
    if (!shown) return
    setBottomChromeReserve(RESERVE_OWNER, bottomOffset + barHeight + DESIGN_TOKENS.spacing.xs)
    return () => releaseBottomChromeReserve(RESERVE_OWNER)
  }, [barHeight, bottomOffset, shown])

  useEffect(() => {
    if (!shown || shownRecorded.current) return
    shownRecorded.current = true
    void sendAnalyticsEvent('AppInstallBar_Shown', { platform: storePlatform })
  }, [shown, storePlatform])

  const handleOpen = useCallback(() => {
    if (!storePlatform) return
    void sendAnalyticsEvent('AppInstallBar_Open', { platform: storePlatform })
    void openExternalUrl(getMobileAppOpenUrl(storePlatform, window.location.href), {
      allowedProtocols: ['metravel:', 'intent:'],
    })
  }, [storePlatform])

  const handleInstall = useCallback(() => {
    if (!storePlatform) return
    void sendAnalyticsEvent('AppInstallBar_Click', { platform: storePlatform })
    void openAppStoreListing({ platform: storePlatform, source: 'install_bar' })
  }, [storePlatform])

  const handleDismiss = useCallback(() => {
    if (!storePlatform) return
    markAppInstallHintDismissed()
    void sendAnalyticsEvent('AppInstallBar_Dismiss', { platform: storePlatform })
    setClosed(true)
  }, [storePlatform])

  if (!shown) return null

  return (
    <View
      testID="app-install-bar"
      onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
      style={[styles.wrapper, { bottom: asBottomDimension(bottomPosition) }]}
    >
      <View style={styles.heading}>
        {width >= 360 && <Image source={APP_ICON} style={styles.icon} resizeMode="contain" accessible={false} />}
        <View style={styles.texts}>
          <Text style={styles.title}>{t('sharedStatic:appHandoff.title')}</Text>
          <Text style={styles.subtitle}>{t('sharedStatic:appHandoff.description')}</Text>
        </View>
        <IconButton
          icon={<Feather name="x" size={18} color={colors.textMuted} />}
          label={t('sharedStatic:appHandoff.dismiss')}
          onPress={handleDismiss}
          size="sm"
          showTooltip={false}
          testID="app-install-bar-dismiss"
        />
      </View>
      <View style={styles.actions}>
        <Button
          label={t('sharedStatic:appHandoff.open')}
          accessibilityLabel={t('sharedStatic:appHandoff.openA11y')}
          onPress={handleOpen}
          style={styles.cta}
          testID="app-install-bar-open"
        />
        <Button
          label={t('sharedStatic:appHandoff.install')}
          accessibilityLabel={storePlatform === 'ios'
            ? t('sharedStatic:appDownload.appStore.a11y')
            : t('sharedStatic:appDownload.googlePlay.a11y')}
          onPress={handleInstall}
          variant="outline"
          style={styles.cta}
          testID="app-install-bar-cta"
        />
      </View>
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    wrapper: {
      left: DESIGN_TOKENS.spacing.sm,
      right: DESIGN_TOKENS.spacing.sm,
      zIndex: 900,
      padding: DESIGN_TOKENS.spacing.xs,
      gap: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...webViewStyle({ position: 'fixed', boxShadow: DESIGN_TOKENS.shadows.medium }),
    },
    heading: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    icon: { width: 36, height: 36, borderRadius: DESIGN_TOKENS.radii.sm },
    texts: { flex: 1, minWidth: 0, gap: 1 },
    title: { fontSize: 13, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 11, color: colors.textMuted },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    cta: { flexGrow: 1, minHeight: 44 },
  })
}

export default React.memo(AppInstallBar)
