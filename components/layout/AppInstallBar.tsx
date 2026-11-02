import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Image, Platform, StyleSheet, Text, View } from 'react-native'
import { useGlobalSearchParams, usePathname } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import type { AppStorePlatform } from '@/constants/appStore'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { asBottomDimension, useFloatingAnchorPx, webFloatingAnchor } from '@/components/layout/bottomChromeInset'
import { useFooterOverlayOpen } from '@/hooks/useFooterOverlayOpen'
import { useWebKeyboardInset } from '@/hooks/useWebKeyboardInset'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { TranslationKey } from '@/i18n/resources'
import { sendAnalyticsEvent } from '@/utils/analytics'
import {
  getPhoneStorePlatform,
  isStandaloneDisplayMode,
  markAppInstallHintDismissed,
  readAppInstallHintState,
  shouldOfferAppInstall,
} from '@/utils/appInstallHint'
import {
  getLowerBottomChromeReserve,
  getCriticalBottomChromeOwner,
  releaseBottomChromeReserve,
  setBottomChromeReserve,
  subscribeBottomChromeReserve,
} from '@/utils/bottomChromeReserve'
import { getAppInstallSignal, subscribeAppInstallSignal, type AppInstallSignal } from '@/utils/appInstallSignal'
import { readConsent } from '@/utils/consent'
import { getSmartAppBannerContent } from '@/utils/mobileAppHandoff'
import { openAppStoreListing } from '@/utils/openAppStoreListing'
import { webViewStyle } from '@/utils/webProps'

const IS_WEB = Platform.OS === 'web'
const RESERVE_OWNER = 'app-install-bar'
const APP_ICON = require('@/assets/images/app-icon.webp')
const getLowerReserve = () => getLowerBottomChromeReserve(RESERVE_OWNER)
const getServerReserve = () => 0
const getServerSignal = () => null

// Literal keys only: the web inliner compiles string literals, while a template
// key reaches the runtime as a raw string and renders «Перевод недоступен».
const SIGNAL_COPY_KEYS = {
  quest_start: {
    title: 'sharedStatic:appHandoff.signal.quest_start.title',
    description: 'sharedStatic:appHandoff.signal.quest_start.description',
  },
  offline_save: {
    title: 'sharedStatic:appHandoff.signal.offline_save.title',
    description: 'sharedStatic:appHandoff.signal.offline_save.description',
  },
  second_travel: {
    title: 'sharedStatic:appHandoff.signal.second_travel.title',
    description: 'sharedStatic:appHandoff.signal.second_travel.description',
  },
  article_scroll_50: {
    title: 'sharedStatic:appHandoff.signal.article_scroll_50.title',
    description: 'sharedStatic:appHandoff.signal.article_scroll_50.description',
  },
} satisfies Record<AppInstallSignal, { title: TranslationKey; description: TranslationKey }>

/**
 * One phone-only offer after an intent signal (#2907): the text names why the
 * app helps right now, and a single store button leads to the platform store
 * (the store itself offers «Open» when the app is already installed).
 */
function AppInstallBar() {
  const colors = useThemedColors()
  const { t } = useTranslation()
  const pathname = usePathname()
  const searchParams = useGlobalSearchParams()
  const { isMobile, width } = useResponsive()
  const footerOverlayOpen = useFooterOverlayOpen()
  const keyboardInset = useWebKeyboardInset()
  const criticalOwner = useSyncExternalStore(subscribeBottomChromeReserve, getCriticalBottomChromeOwner, () => null)
  const signal = useSyncExternalStore(subscribeAppInstallSignal, getAppInstallSignal, getServerSignal)
  const [storePlatform, setStorePlatform] = useState<AppStorePlatform | null>(null)
  const [closed, setClosed] = useState(false)
  const shownRecorded = useRef(false)
  const [barHeight, setBarHeight] = useState(112)
  const styles = useMemo(() => createStyles(colors), [colors])
  const anchorPx = useFloatingAnchorPx()
  const lowerReserve = useSyncExternalStore(subscribeBottomChromeReserve, getLowerReserve, getServerReserve)
  const bottomOffset = Math.max(anchorPx, lowerReserve) + DESIGN_TOKENS.spacing.xs
  const bottomPosition = webFloatingAnchor(DESIGN_TOKENS.spacing.xs, lowerReserve)
  // The home first screen stays clean even after a signal elsewhere (#2907).
  const shown = IS_WEB && isMobile && signal !== null && storePlatform !== null && !closed && !footerOverlayOpen &&
    keyboardInset === 0 && !criticalOwner && pathname !== '/app' && pathname !== '/'

  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined' || !signal) return
    // #2782: an undecided visitor already sees the consent banner at the bottom.
    // Two stacked offers covered ~40% of a phone map, so the app offer waits for
    // a later page once the consent answer exists.
    if (!readConsent()) return
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
  }, [isMobile, pathname, signal])

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
    void sendAnalyticsEvent('AppInstallBar_Shown', { platform: storePlatform, signal })
  }, [shown, signal, storePlatform])

  const handleInstall = useCallback(() => {
    if (!storePlatform) return
    void sendAnalyticsEvent('AppInstallBar_Click', { platform: storePlatform, signal })
    void openAppStoreListing({ platform: storePlatform, source: 'install_bar' })
  }, [signal, storePlatform])

  const handleDismiss = useCallback(() => {
    if (!storePlatform) return
    markAppInstallHintDismissed()
    void sendAnalyticsEvent('AppInstallBar_Dismiss', { platform: storePlatform, signal })
    setClosed(true)
  }, [signal, storePlatform])

  if (!shown || !signal) return null

  return (
    <View
      testID="app-install-bar"
      onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
      style={[styles.wrapper, { bottom: asBottomDimension(bottomPosition) }]}
    >
      <View style={styles.heading}>
        {width >= 360 && <Image source={APP_ICON} style={styles.icon} resizeMode="contain" accessible={false} />}
        <View style={styles.texts}>
          <Text style={styles.title}>{t(SIGNAL_COPY_KEYS[signal].title)}</Text>
          <Text style={styles.subtitle}>{t(SIGNAL_COPY_KEYS[signal].description)}</Text>
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
          label={t('sharedStatic:appHandoff.install')}
          accessibilityLabel={storePlatform === 'ios'
            ? t('sharedStatic:appDownload.appStore.a11y')
            : t('sharedStatic:appDownload.googlePlay.a11y')}
          onPress={handleInstall}
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
