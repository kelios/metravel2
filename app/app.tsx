import { memo, useCallback, useMemo, type ComponentProps } from 'react'
import { Image, Platform, ScrollView, StatusBar, StyleSheet, View, type ViewStyle } from 'react-native'
import { useIsFocused } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import CustomHeader from '@/components/layout/CustomHeader'
import Button from '@/components/ui/Button'
import { Heading, Body, Caption, Eyebrow } from '@/components/ui/Typography'
import { useResponsive } from '@/hooks/useResponsive'
import { useTheme, useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { openExternalUrl } from '@/utils/externalLinks'
import { webTouchScrollStyle } from '@/utils'
import { translate as i18nT } from '@/i18n'


// Android-приложение MeTravel сейчас доступно через закрытый Alpha-тест.
// Open testing в Play Console заблокирован до получения production access.
// Поменять при переходе на прод-релиз на: https://play.google.com/store/apps/details?id=by.metravel.app
export const PLAY_TESTING_URL = 'https://play.google.com/apps/testing/by.metravel.app'

const APP_ICON = require('@/assets/images/icon.png')

type FeatherName = ComponentProps<typeof Feather>['name']

const FEATURES: { icon: FeatherName; title: string; text: string }[] = [
  { icon: 'map', get title() { return i18nT('sharedStatic:app.app.karta_mest_ca36ea2c') }, get text() { return i18nT('sharedStatic:app.app.tysyachi_tochek_i_marshrutov_belarusi_i_ne_t_16972faa') } },
  { icon: 'flag', get title() { return i18nT('sharedStatic:app.app.gorodskie_kvesty_bedf74f9') }, get text() { return i18nT('sharedStatic:app.app.prohodite_kvest_marshruty_po_gorodam_pryamo__09504292') } },
  { icon: 'book-open', get title() { return i18nT('sharedStatic:app.app.putevoditeli_f648086c') }, get text() { return i18nT('sharedStatic:app.app.stati_puteshestviya_s_foto_tochkami_na_karte_6ee82ed6') } },
  { icon: 'heart', get title() { return i18nT('sharedStatic:app.app.svoe_izbrannoe_46c5fb28') }, get text() { return i18nT('sharedStatic:app.app.sohranyayte_marshruty_i_mesta_stroyte_sobstv_239eb2e6') } },
]

const STEPS: { title: string; text: string }[] = [
  { get title() { return i18nT('sharedStatic:app.app.nazhmite_skachat_1073ac19') }, get text() { return i18nT('sharedStatic:app.app.knopka_otkroet_stranitsu_zakrytogo_alpha_tes_08367c82') } },
  { get title() { return i18nT('sharedStatic:app.app.prisoedinites_k_testu_147930be') }, get text() { return i18nT('sharedStatic:app.app.esli_vash_akkaunt_dobavlen_v_spisok_testirov_c484118b') } },
  { get title() { return i18nT('sharedStatic:app.app.ustanovite_prilozhenie_468f0c89') }, get text() { return i18nT('sharedStatic:app.app.posle_prisoedineniya_poyavitsya_knopka_ustan_0c176249') } },
]

function AppDownloadScreen() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { width } = useResponsive()
  const isFocused = useIsFocused()
  const isWide = width >= 900
  const styles = useMemo(() => createStyles(colors, isWide), [colors, isWide])

  const title = i18nT('shared:app.app.prilozhenie_metravel_dlya_android_skachat_f1964a43')
  const description =
    i18nT('shared:app.app.skachayte_mobilnoe_prilozhenie_metravel_dlya_37f1b2df')
  const canonical = buildCanonicalUrl('/app')

  const handleDownload = useCallback(() => {
    void openExternalUrl(PLAY_TESTING_URL, {
      onError: (error) => {
        if (__DEV__) console.warn('[app] Ошибка открытия Google Play:', error)
      },
    })
  }, [])

  return (
    <>
      {isFocused && (
        <InstantSEO
          headKey="app"
          title={title}
          description={description}
          canonical={canonical}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <CustomHeader />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
        {Platform.OS === 'web' && (
          <h1 style={SR_ONLY}>{title}</h1>
        )}

        {/* Hero */}
        <View style={styles.hero}>
          <Image source={APP_ICON} style={styles.appIcon} resizeMode="contain" accessibilityLabel={i18nT('shared:app.app.ikonka_prilozheniya_metravel_e4871974')} />
          <Eyebrow color={colors.primaryText} style={styles.eyebrow}>
            {i18nT('shared:app.app.mobilnoe_prilozhenie_462563b9')}</Eyebrow>
          <Heading level={1} align="center" color={colors.text}>
            {i18nT('shared:app.app.metravel_puteshestviya_v_karmane_7ec352c1')}</Heading>
          <Body align="center" color={colors.textMuted} style={styles.heroSubtitle}>
            {i18nT('shared:app.app.karta_mest_gorodskie_kvesty_i_putevoditeli_o_0c74fdbb')}</Body>

          <View style={styles.ctaWrap}>
            <Button
              label={i18nT('shared:app.app.skachat_iz_google_play_ede112c1')}
              onPress={handleDownload}
              variant="primary"
              size="lg"
              icon={<Feather name="download" size={18} color={colors.textOnPrimary} />}
              accessibilityLabel={i18nT('shared:app.app.skachat_prilozhenie_metravel_iz_google_play_833df22c')}
            />
            <Caption align="center" color={colors.textMuted} style={styles.platformNote}>
              {i18nT('shared:app.app.android_8_0_besplatno_versiya_dlya_ios_gotov_5102537e')}</Caption>
          </View>

          <View style={styles.badge}>
            <Feather name="award" size={14} color={colors.primaryText} />
            <Caption color={colors.primaryText}>{i18nT('shared:app.app.zakrytyy_alpha_test_vy_odni_iz_pervyh_90569b3d')}</Caption>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Heading level={2} align="center" color={colors.text}>
            {i18nT('shared:app.app.chto_vnutri_89e8167a')}</Heading>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <Feather name={f.icon} size={28} color={colors.primary} style={styles.featureIcon} />
                <Heading level={4} color={colors.text}>
                  {f.title}
                </Heading>
                <Body color={colors.textMuted} style={styles.featureText}>
                  {f.text}
                </Body>
              </View>
            ))}
          </View>
        </View>

        {/* How to install */}
        <View style={styles.section}>
          <Heading level={2} align="center" color={colors.text}>
            {i18nT('shared:app.app.kak_ustanovit_f9a49c93')}</Heading>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Body color={colors.textOnPrimary} style={styles.stepNumberText}>
                    {i + 1}
                  </Body>
                </View>
                <View style={styles.stepBody}>
                  <Heading level={4} color={colors.text}>
                    {s.title}
                  </Heading>
                  <Body color={colors.textMuted}>{s.text}</Body>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.ctaWrap}>
            <Button
              label={i18nT('shared:app.app.otkryt_v_google_play_9d0a47cd')}
              onPress={handleDownload}
              variant="primary"
              size="lg"
              accessibilityLabel={i18nT('shared:app.app.otkryt_prilozhenie_metravel_v_google_play_8566ec38')}
            />
          </View>
        </View>
      </ScrollView>
    </>
  )
}

const SR_ONLY = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden' as const,
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
} as any

const createStyles = (colors: ThemedColors, isWide: boolean) => {
  const spacing = DESIGN_TOKENS.spacing
  const radii = DESIGN_TOKENS.radii
  const card: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  }
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      backgroundColor: colors.background,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    hero: {
      width: '100%' as const,
      maxWidth: 720,
      alignItems: 'center' as const,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    appIcon: {
      width: 96,
      height: 96,
      borderRadius: radii.lg,
    },
    eyebrow: {
      letterSpacing: 1.5,
    },
    heroSubtitle: {
      maxWidth: 560,
      marginTop: spacing.xs,
    },
    ctaWrap: {
      alignItems: 'center' as const,
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    platformNote: {
      marginTop: spacing.xxs,
    },
    badge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.xl,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    section: {
      width: '100%' as const,
      maxWidth: 960,
      paddingVertical: spacing.xl,
      gap: spacing.lg,
    },
    featureGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      justifyContent: 'center' as const,
      gap: spacing.md,
    },
    featureCard: {
      ...card,
      width: isWide ? '46%' : '100%',
      gap: spacing.xs,
    },
    featureIcon: {
      marginBottom: spacing.xxs,
    },
    featureText: {
      marginTop: spacing.xxs,
    },
    steps: {
      gap: spacing.md,
      alignSelf: 'stretch' as const,
    },
    step: {
      ...card,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: spacing.md,
    },
    stepNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    stepNumberText: {
      fontWeight: '700' as const,
    },
    stepBody: {
      flex: 1,
      gap: spacing.xxs,
    },
  })
}

export default memo(AppDownloadScreen)
