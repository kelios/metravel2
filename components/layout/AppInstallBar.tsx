import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { usePathname } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { GOOGLE_PLAY_APP_URL } from '@/constants/appStore'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useFooterOverlayOpen } from '@/hooks/useFooterOverlayOpen'
import { useResponsive } from '@/hooks/useResponsive'
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'
import {
  isStandaloneDisplayMode,
  markAppInstallHintConverted,
  markAppInstallHintDismissed,
  readAppInstallHintState,
  shouldOfferAppInstall,
} from '@/utils/appInstallHint'
import { releaseBottomChromeReserve, setBottomChromeReserve } from '@/utils/bottomChromeReserve'
import { readConsent } from '@/utils/consent'
import { openExternalUrl } from '@/utils/externalLinks'
import { webViewStyle } from '@/utils/webProps'

const IS_WEB = Platform.OS === 'web'
const RESERVE_OWNER = 'app-install-bar'

// Появляемся не сразу: сначала человек должен увидеть контент, за которым пришёл.
const REVEAL_DELAY_MS = 12000
// ...либо раньше, если он уже пролистал больше полутора экранов — это интерес.
const REVEAL_SCROLL_RATIO = 1.5
// Пока не решён вопрос про cookies, второй плашки внизу не показываем.
const CONSENT_RECHECK_MS = 4000

const BAR_HEIGHT = 68
// 320×320 WebP (3,6 КБ). Мастер иконки 1024×1024 PNG здесь не нужен: рисуем 40 px.
const APP_ICON = require('@/assets/images/app-icon.webp')

/**
 * Ненавязчивое предложение установить Android-приложение для посетителей
 * mobile web. Узкая плашка над нижним доком: контент не перекрывает, закрывается
 * крестиком и после закрытия молчит месяц (`utils/appInstallHint`).
 *
 * Модалок и интерстишиалов здесь сознательно нет: перекрытие контента на
 * мобильном — это и плохой UX, и риск по Google mobile interstitial penalty.
 */
function AppInstallBar() {
  const colors = useThemedColors()
  const pathname = usePathname()
  const { isMobile, width } = useResponsive()
  // На узких экранах (360 px и меньше) иконка съедает столько ширины, что
  // заголовок уходит в многоточие — там она уступает место тексту.
  const showIcon = width >= 390
  const insets = useSafeAreaInsets()
  const footerOverlayOpen = useFooterOverlayOpen()

  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)
  const appear = useRef(new Animated.Value(0)).current

  // На самой странице /app предложение дублировало бы содержимое страницы.
  const isAppLandingRoute = pathname === '/app'

  const styles = useMemo(() => createStyles(colors), [colors])

  const bottomOffset = useMemo(
    () => (insets?.bottom || 0) + (LAYOUT?.tabBarHeight ?? 56) + 8,
    [insets?.bottom]
  )

  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') return
    if (closed || visible || isAppLandingRoute || !isMobile) return

    const eligible = shouldOfferAppInstall({
      userAgent: String(window.navigator?.userAgent || ''),
      isMobileViewport: isMobile,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      isStandalone: isStandaloneDisplayMode(),
      state: readAppInstallHintState(),
      now: Date.now(),
    })
    if (!eligible) return

    let revealTimer: ReturnType<typeof setTimeout> | null = null
    let consentTimer: ReturnType<typeof setTimeout> | null = null
    let done = false

    const reveal = () => {
      if (done) return
      // Cookie-баннер занимает то же место внизу — ждём, пока с ним разберутся.
      if (!readConsent()) {
        consentTimer = setTimeout(reveal, CONSENT_RECHECK_MS)
        return
      }
      done = true
      cleanupTriggers()
      setVisible(true)
    }

    // Страницы приложения скроллятся внутри RN Web ScrollView, а не окном,
    // поэтому слушаем в фазе захвата и берём смещение у самого скроллера.
    const onScroll = (event: Event) => {
      const target = event.target
      const element =
        typeof HTMLElement !== 'undefined' && target instanceof HTMLElement ? target : null
      const scrolled = Math.max(window.scrollY || 0, element?.scrollTop ?? 0)
      const viewport = element?.clientHeight || window.innerHeight || 0
      if (viewport > 0 && scrolled > viewport * REVEAL_SCROLL_RATIO) reveal()
    }

    const cleanupTriggers = () => {
      if (revealTimer) {
        clearTimeout(revealTimer)
        revealTimer = null
      }
      window.removeEventListener('scroll', onScroll, true)
    }

    revealTimer = setTimeout(reveal, REVEAL_DELAY_MS)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })

    return () => {
      done = true
      cleanupTriggers()
      if (consentTimer) clearTimeout(consentTimer)
    }
  }, [closed, isAppLandingRoute, isMobile, visible])

  const shown = visible && !closed && !footerOverlayOpen && !isAppLandingRoute

  useEffect(() => {
    if (!IS_WEB || !shown) return
    Animated.timing(appear, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [appear, shown])

  useEffect(() => {
    if (!IS_WEB) return
    if (!shown) {
      releaseBottomChromeReserve(RESERVE_OWNER)
      return
    }
    setBottomChromeReserve(RESERVE_OWNER, bottomOffset + BAR_HEIGHT + 8)
    return () => releaseBottomChromeReserve(RESERVE_OWNER)
  }, [bottomOffset, shown])

  useEffect(() => {
    if (!visible) return
    void sendAnalyticsEvent('AppInstallBar_Shown', { platform: 'android' })
  }, [visible])

  const handleInstall = useCallback(() => {
    markAppInstallHintConverted()
    void sendAnalyticsEvent('AppInstallBar_Click', { platform: 'android' })
    setClosed(true)
    void openExternalUrl(GOOGLE_PLAY_APP_URL, {
      onError: (error) => {
        if (__DEV__) console.warn('[app-install-bar] Ошибка открытия Google Play:', error)
      },
    })
  }, [])

  const handleDismiss = useCallback(() => {
    markAppInstallHintDismissed()
    void sendAnalyticsEvent('AppInstallBar_Dismiss', { platform: 'android' })
    setClosed(true)
  }, [])

  if (!IS_WEB || !shown) return null

  return (
    <Animated.View
      testID="app-install-bar"
      style={[
        styles.wrapper,
        { bottom: bottomOffset },
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            },
          ],
        },
      ]}
    >
      <View style={styles.bar}>
        {showIcon && (
          <Image source={APP_ICON} style={styles.icon} resizeMode="contain" accessible={false} />
        )}

        <View style={styles.texts}>
          <Text numberOfLines={1} style={styles.title}>
            {i18nT('navigation:components.layout.AppInstallBar.metravel_v_prilozhenii_4b1dff87')}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {i18nT('navigation:components.layout.AppInstallBar.karta_i_kvesty_oflayn_8d65d13f')}
          </Text>
        </View>

        <Button
          label={i18nT('navigation:components.layout.AppInstallBar.ustanovit_824265b0')}
          onPress={handleInstall}
          variant="primary"
          size="sm"
          accessibilityLabel={i18nT(
            'navigation:components.layout.AppInstallBar.ustanovit_prilozhenie_metravel_dlya_android_e22de6ce'
          )}
          style={styles.cta}
          labelStyle={styles.ctaLabel}
          testID="app-install-bar-cta"
        />

        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={i18nT(
            'navigation:components.layout.AppInstallBar.skryt_predlozhenie_ustanovit_prilozhenie_e15e4a3f'
          )}
          testID="app-install-bar-dismiss"
          hitSlop={10}
          style={styles.dismiss}
        >
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: DESIGN_TOKENS.spacing.sm,
      right: DESIGN_TOKENS.spacing.sm,
      zIndex: 900,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      // На 360–412 px ширины плашке нужно уместить иконку, две строки, CTA и
      // крестик: зазоры тут узкие сознательно, иначе текст уходит в многоточие.
      gap: DESIGN_TOKENS.spacing.xs,
      minHeight: BAR_HEIGHT,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingLeft: DESIGN_TOKENS.spacing.xs,
      paddingRight: 4,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...(IS_WEB
        ? webViewStyle({ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)' })
        : null),
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    texts: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.textMuted,
    },
    cta: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    ctaLabel: {
      fontSize: 13,
    },
    dismiss: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
  })
}

export default React.memo(AppInstallBar)
