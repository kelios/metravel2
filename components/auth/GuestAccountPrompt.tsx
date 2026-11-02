import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import AuthBenefits from '@/components/auth/AuthBenefits'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { buildExplicitLoginHref, buildRegistrationHref } from '@/utils/authNavigation'
import { trackRegisterCtaClicked, trackRegisterCtaImpression } from '@/utils/growthFunnelAnalytics'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'

type Props = {
  /** Страница, куда вернуть после входа, и намерение для аналитики/экрана входа. */
  redirect: string
  intent: 'profile' | 'favorites'
  title: string
  testID?: string
}

/**
 * #2898: гостевое состояние `/profile` и `/favorites` (web + native) по макету
 * `docs/features/ux-audit-2026-11-mocks.md` §1 — вместо «Войдите в аккаунт» и
 * одной кнопки: зачем аккаунт (три выгоды) и две кнопки — «Создать аккаунт»
 * первичная, «Войти» вторичная.
 */
export default function GuestAccountPrompt({ redirect, intent, title, testID = 'guest-account-prompt' }: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const source = `guest_${intent}`
  const impression = useTrackedImpression(`guest-account:${intent}`, () => {
    trackRegisterCtaImpression({ source, intent, authState: 'guest' })
  })

  return (
    <View
      ref={impression.ref as never}
      onLayout={impression.onLayout}
      style={styles.wrap}
      testID={testID}
    >
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.subtitle}>{i18nT('authStatic:authScreen.guest.subtitle')}</Text>
      <AuthBenefits />
      <View style={styles.actions}>
        <Button
          label={i18nT('authStatic:authScreen.guest.createAccount')}
          onPress={() => {
            trackRegisterCtaClicked({ source, intent, authState: 'guest' })
            router.push(buildRegistrationHref({ redirect, intent }) as never)
          }}
          variant="primary"
          size="lg"
          fullWidth
          testID={`${testID}-register`}
        />
        <Button
          label={i18nT('authStatic:authScreen.guest.signIn')}
          onPress={() => router.push(buildExplicitLoginHref({ redirect, intent }) as never)}
          variant="secondary"
          size="lg"
          fullWidth
          testID={`${testID}-login`}
        />
      </View>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.xl,
      gap: DESIGN_TOKENS.spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    actions: {
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
  })
