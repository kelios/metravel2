import { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { ResponsiveContainer, ResponsiveStack } from '@/components/layout'
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import Button from '@/components/ui/Button'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { useAuthStore } from '@/stores/authStore'
import { buildRegistrationHref } from '@/utils/authNavigation'
import { trackContentCreateCtaClicked, trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { BECOME_AUTHOR_LAYOUT } from './becomeAuthorLayout'

export default function BecomeAuthorScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const authReady = useAuthStore((state) => state.authReady)
  const { isMobile } = useResponsive()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const actionStyle = [styles.action, breakpointStyle(BECOME_AUTHOR_LAYOUT, 'action', !isMobile)]
  const bottomPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl)
  const benefits = [
    { icon: 'map-pin' as const, title: t('homeStatic:becomeAuthor.map.title'), description: t('homeStatic:becomeAuthor.map.description') },
    { icon: 'book-open' as const, title: t('homeStatic:becomeAuthor.book.title'), description: t('homeStatic:becomeAuthor.book.description') },
    { icon: 'award' as const, title: t('homeStatic:becomeAuthor.achievements.title'), description: t('homeStatic:becomeAuthor.achievements.description') },
    { icon: 'users' as const, title: t('homeStatic:becomeAuthor.readers.title'), description: t('homeStatic:becomeAuthor.readers.description') },
  ]

  const handleCreate = () => {
    if (!authReady) return
    const authState = isAuthenticated ? 'authenticated' : 'guest'
    const source = 'become_author_page'
    trackContentCreateCtaClicked({
      contentType: 'route', source, authState, intent: 'create-travel',
      action: isAuthenticated ? 'create' : 'register',
    })
    if (!isAuthenticated) {
      trackRegisterCtaClicked({ source, intent: 'create-travel', authState })
    }
    router.push((isAuthenticated
      ? '/travel/new'
      : buildRegistrationHref({ redirect: '/travel/new', intent: 'create-travel' })) as Href)
  }

  const createAction = (
    <Button
      label={t('homeStatic:becomeAuthor.cta')}
      onPress={handleCreate}
      labelNumberOfLines={0}
      disabled={!authReady}
      icon={<Feather name="edit-3" size={18} color={colors.textOnPrimary} />}
      iconPosition="left"
    />
  )

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.scrollContent, { paddingBottom: asBottomDimension(bottomPadding) }]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <ResponsiveStack direction="vertical" gap={DESIGN_TOKENS.spacing.xl}>
          <View style={styles.intro}>
            <Heading level={1}>{t('homeStatic:becomeAuthor.title')}</Heading>
            <Body variant="large" muted>{t('homeStatic:becomeAuthor.intro')}</Body>
            <View testID="author-create-action" style={actionStyle} {...breakpointLayoutProps(BECOME_AUTHOR_LAYOUT, 'action')}>
              {createAction}
              <Body variant="small" muted>{t('homeStatic:becomeAuthor.startHint')}</Body>
            </View>
          </View>
          <View style={styles.benefits} {...SCREEN_CONTENT_FIRST_PROPS}>
            <Heading level={2}>{t('homeStatic:becomeAuthor.benefitsTitle')}</Heading>
            <View style={styles.grid}>
              {benefits.map((benefit) => (
                <View key={benefit.icon} testID="author-benefit-card" style={[styles.card, breakpointStyle(BECOME_AUTHOR_LAYOUT, 'card', !isMobile)]} {...breakpointLayoutProps(BECOME_AUTHOR_LAYOUT, 'card')}>
                  <Feather name={benefit.icon} size={24} color={colors.primaryText} />
                  <Heading level={3}>{benefit.title}</Heading>
                  <Body muted>{benefit.description}</Body>
                </View>
              ))}
            </View>
          </View>
          <View testID="author-create-action" style={actionStyle} {...breakpointLayoutProps(BECOME_AUTHOR_LAYOUT, 'action')}>{createAction}</View>
        </ResponsiveStack>
      </ResponsiveContainer>
    </ScrollView>
  )
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingVertical: DESIGN_TOKENS.spacing.lg },
  intro: { gap: DESIGN_TOKENS.spacing.md, maxWidth: 820 },
  action: { gap: DESIGN_TOKENS.spacing.sm },
  benefits: { gap: DESIGN_TOKENS.spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.lg },
  card: {
    flexGrow: 1, minWidth: 0,
    padding: DESIGN_TOKENS.spacing.lg, gap: DESIGN_TOKENS.spacing.sm,
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.surface,
  },
})
