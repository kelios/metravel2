import { memo, useCallback, useMemo, useState } from 'react'
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { ResponsiveContainer } from '@/components/layout'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { translate as i18nT } from '@/i18n'


const IS_WEB = Platform.OS === 'web'
const APP_ICON = require('@/assets/images/icon.png')

const HIGHLIGHTS: { icon: 'map-pin' | 'flag' | 'download'; text: string }[] = [
  { icon: 'map-pin', get text() { return i18nT('homeStatic:components.home.HomeAppPromoSection.karta_mest_i_marshrutov_2231a0a5') } },
  { icon: 'flag', get text() { return i18nT('homeStatic:components.home.HomeAppPromoSection.gorodskie_kvesty_be30b0e9') } },
  { icon: 'download', get text() { return i18nT('homeStatic:components.home.HomeAppPromoSection.oflayn_dostup_ef721dee') } },
]

// Промо установки Android-приложения — только на web (в самом приложении не показываем).
function HomeAppPromoSection() {
  const router = useRouter()
  const colors = useThemedColors()
  const { isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const [hovered, setHovered] = useState(false)

  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const handleInstall = useCallback(() => {
    sendAnalyticsEvent('HomeClick_InstallApp', { platform: 'android' })
    router.push('/app' as any)
  }, [router])

  if (!IS_WEB) return null

  return (
    <View style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <Pressable
          onPress={handleInstall}
          accessibilityRole={'link' as any}
          accessibilityLabel={i18nT('home:components.home.HomeAppPromoSection.skachat_prilozhenie_metravel_dlya_android_25ce3837')}
          style={[styles.card, isMobile && styles.cardMobile, hovered && styles.cardHover]}
          {...({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as any)}
        >
          <Image
            source={APP_ICON}
            style={styles.icon}
            resizeMode="contain"
            accessibilityLabel={i18nT('home:components.home.HomeAppPromoSection.ikonka_prilozheniya_metravel_99bf95cf')}
          />

          <View style={styles.body}>
            <View style={styles.badge}>
              <Feather name="smartphone" size={12} color={colors.primary} />
              <Text style={styles.badgeText}>{i18nT('home:components.home.HomeAppPromoSection.uzhe_na_android_0f096743')}</Text>
            </View>
            <Text
              style={styles.title}
              accessibilityRole="header"
              {...({ 'aria-level': 2 } as any)}
            >
              {i18nT('home:components.home.HomeAppPromoSection.prilozhenie_metravel_v_karmane_f8221845')}</Text>
            <Text style={styles.subtitle}>
              {i18nT('home:components.home.HomeAppPromoSection.karta_kvesty_i_putevoditeli_oflayn_s_sohrane_a9ae3b9e')}</Text>

            {!isMobile && (
              <View style={styles.highlights}>
                {HIGHLIGHTS.map((h) => (
                  <View key={h.text} style={styles.highlight}>
                    <Feather name={h.icon} size={15} color={colors.primary} />
                    <Text style={styles.highlightText}>{h.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.cta, hovered && styles.ctaHover]}>
            <Feather name="download" size={18} color={colors.textOnPrimary} />
            <Text style={styles.ctaText}>{i18nT('home:components.home.HomeAppPromoSection.skachat_4cce0fbd')}</Text>
          </View>
        </Pressable>
      </ResponsiveContainer>
    </View>
  )
}

function createStyles(colors: ThemedColors, isMobile: boolean) {
  return StyleSheet.create({
    band: {
      paddingVertical: 24,
    },
    bandMobile: {
      paddingVertical: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      padding: 24,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      ...(IS_WEB ? { cursor: 'pointer', transitionProperty: 'transform, box-shadow', transitionDuration: '160ms' } as any : null),
    },
    cardMobile: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 14,
      padding: 16,
      borderRadius: 16,
    },
    cardHover: {
      borderColor: colors.primary,
      ...(IS_WEB ? { transform: [{ translateY: -2 }] } : null),
    },
    icon: {
      width: isMobile ? 56 : 72,
      height: isMobile ? 56 : 72,
      borderRadius: 16,
    },
    body: {
      flex: 1,
      gap: 8,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
    },
    title: {
      fontSize: isMobile ? 20 : 26,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 20 : 22,
      color: colors.textMuted,
      maxWidth: 520,
    },
    highlights: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginTop: 4,
    },
    highlight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    highlightText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignSelf: isMobile ? 'stretch' : 'auto',
    },
    ctaHover: {
      backgroundColor: colors.primaryDark,
    },
    ctaText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textOnPrimary,
    },
  })
}

export default memo(HomeAppPromoSection)
