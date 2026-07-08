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

// Android-приложение MeTravel сейчас доступно через internal testing.
// Open testing в Play Console заблокирован до получения production access.
// Поменять при переходе на прод-релиз на: https://play.google.com/store/apps/details?id=by.metravel.app
const PLAY_TESTING_URL = 'https://play.google.com/apps/internaltest/4700787969738130132'

const APP_ICON = require('@/assets/images/icon.png')

type FeatherName = ComponentProps<typeof Feather>['name']

const FEATURES: { icon: FeatherName; title: string; text: string }[] = [
  { icon: 'map', title: 'Карта мест', text: 'Тысячи точек и маршрутов Беларуси и не только — офлайн-доступ к сохранённым местам.' },
  { icon: 'flag', title: 'Городские квесты', text: 'Проходите квест-маршруты по городам прямо в приложении, с подсказками и ответами.' },
  { icon: 'book-open', title: 'Путеводители', text: 'Статьи-путешествия с фото, точками на карте и практической информацией.' },
  { icon: 'heart', title: 'Своё избранное', text: 'Сохраняйте маршруты и места, стройте собственные поездки и берите их с собой.' },
]

const STEPS: { title: string; text: string }[] = [
  { title: 'Нажмите «Скачать»', text: 'Кнопка откроет страницу внутреннего тестирования MeTravel в Google Play.' },
  { title: 'Присоединитесь к тесту', text: 'Если ваш аккаунт добавлен в список тестировщиков, нажмите «Стать тестировщиком» — это бесплатно.' },
  { title: 'Установите приложение', text: 'После присоединения появится кнопка «Установить». Обновления приходят автоматически.' },
]

function AppDownloadScreen() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { width } = useResponsive()
  const isFocused = useIsFocused()
  const isWide = width >= 900
  const styles = useMemo(() => createStyles(colors, isWide), [colors, isWide])

  const title = 'Приложение MeTravel для Android | Скачать'
  const description =
    'Скачайте мобильное приложение MeTravel для Android: карта мест и маршрутов, городские квесты и путеводители офлайн. Доступно в Google Play на тест-треке.'
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
          <Image source={APP_ICON} style={styles.appIcon} resizeMode="contain" accessibilityLabel="Иконка приложения MeTravel" />
          <Eyebrow color={colors.primary} style={styles.eyebrow}>
            МОБИЛЬНОЕ ПРИЛОЖЕНИЕ
          </Eyebrow>
          <Heading level={1} align="center" color={colors.text}>
            MeTravel — путешествия в кармане
          </Heading>
          <Body align="center" color={colors.textMuted} style={styles.heroSubtitle}>
            Карта мест, городские квесты и путеводители — офлайн, с сохранением избранного. Сейчас
            приложение доступно для Android на этапе внутреннего тестирования.
          </Body>

          <View style={styles.ctaWrap}>
            <Button
              label="Скачать из Google Play"
              onPress={handleDownload}
              variant="primary"
              size="lg"
              icon={<Feather name="download" size={18} color={colors.textOnPrimary} />}
              accessibilityLabel="Скачать приложение MeTravel из Google Play"
            />
            <Caption align="center" color={colors.textMuted} style={styles.platformNote}>
              Android 8.0+ · бесплатно · версия для iOS готовится
            </Caption>
          </View>

          <View style={styles.badge}>
            <Feather name="award" size={14} color={colors.primary} />
            <Caption color={colors.primary}>Внутреннее тестирование — вы одни из первых</Caption>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Heading level={2} align="center" color={colors.text}>
            Что внутри
          </Heading>
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
            Как установить
          </Heading>
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
              label="Открыть в Google Play"
              onPress={handleDownload}
              variant="primary"
              size="lg"
              accessibilityLabel="Открыть приложение MeTravel в Google Play"
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
