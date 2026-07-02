import { memo, useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import { subscribeEmail, type SubscribeSource } from '@/api/misc'
import { queueAnalyticsEvent } from '@/utils/analytics'

interface EmailSubscriptionFormProps {
  source: SubscribeSource
  title?: string
  subtitle?: string
}

const DEFAULT_TITLE = 'Подпишитесь на новые маршруты'
const DEFAULT_SUBTITLE =
  'Раз в пару недель — лучшие путешествия, идеи на выходные и квесты по городам. Без спама, отписаться можно в один клик.'

// Lightweight client-side gate; the backend is the source of truth and returns
// a localized 400 for anything it rejects.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function EmailSubscriptionForm({ source, title, subtitle }: EmailSubscriptionFormProps) {
  const { isMobile } = useResponsive()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const pageUrl =
        Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.href : undefined
      return subscribeEmail(email, source, pageUrl)
    },
    onSuccess: (result) => {
      queueAnalyticsEvent('email_subscribe_success', { source, status: result.status })
    },
  })

  const succeeded = mutation.isSuccess
  const alreadyExists = mutation.data?.status === 'exists'

  const handleSubmit = () => {
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setLocalError('Введите корректный email')
      return
    }
    setLocalError(null)
    mutation.mutate()
  }

  const errorText = localError ?? (mutation.isError ? (mutation.error as Error)?.message : null)

  return (
    <View style={styles.wrapper}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <Feather name="mail" size={isMobile ? 20 : 22} color={colors.primaryDark} />
            </View>
          </View>

          <View style={[styles.textBlock, isMobile ? styles.textBlockMobile : styles.textBlockDesktop]}>
            <Text style={styles.title}>{title ?? DEFAULT_TITLE}</Text>
            <Text style={styles.subtitle}>{subtitle ?? DEFAULT_SUBTITLE}</Text>
          </View>

          {succeeded ? (
            <View style={[styles.successRow, isMobile ? styles.fieldsMobile : styles.fieldsDesktop]}>
              <Feather name="check-circle" size={18} color={colors.primaryDark} />
              <Text style={styles.successText}>
                {alreadyExists
                  ? 'Вы уже подписаны — спасибо, что с нами!'
                  : 'Готово! Письмо с новыми маршрутами скоро придёт.'}
              </Text>
            </View>
          ) : (
            <View style={[styles.fields, isMobile ? styles.fieldsMobile : styles.fieldsDesktop]}>
              <View style={styles.inputCol}>
                <TextInput
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t)
                    if (localError) setLocalError(null)
                  }}
                  onSubmitEditing={handleSubmit}
                  placeholder="ваш@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!mutation.isPending}
                  returnKeyType="go"
                  style={[styles.input, !!errorText && styles.inputError]}
                  accessibilityLabel="Email для подписки на новые маршруты"
                />
                {!!errorText && (
                  <Text style={styles.errorText} accessibilityLiveRegion="polite">
                    {errorText}
                  </Text>
                )}
              </View>
              <Button
                label="Подписаться"
                onPress={handleSubmit}
                variant="primary"
                size={isMobile ? 'md' : 'md'}
                fullWidth={isMobile}
                loading={mutation.isPending}
                disabled={mutation.isPending}
                style={styles.submitBtn}
                accessibilityLabel="Подписаться на рассылку новых маршрутов"
              />
            </View>
          )}
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      paddingVertical: isMobile ? 12 : 20,
    },
    card: {
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 16 : 28,
      paddingVertical: isMobile ? 18 : 24,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? 14 : 20,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)`,
          backgroundImage: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primarySoft}66 100%)`,
        },
      }),
    },
    iconRow: { flexShrink: 0 },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: { gap: 4 },
    textBlockMobile: { width: '100%' },
    textBlockDesktop: { flex: 1 },
    title: {
      fontSize: isMobile ? 15 : 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: isMobile ? 13 : 14,
      color: colors.textMuted,
      lineHeight: isMobile ? 19 : 21,
      fontWeight: '400',
    },
    fields: {
      flexShrink: 0,
      gap: 10,
      alignItems: 'flex-start',
    },
    fieldsMobile: { width: '100%', flexDirection: 'column' },
    fieldsDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
    inputCol: {
      gap: 4,
      width: isMobile ? '100%' : 240,
    },
    input: {
      width: '100%',
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      fontSize: 14,
      color: colors.text,
      ...Platform.select({ web: { outlineStyle: 'none' } as any }),
    },
    inputError: { borderColor: colors.danger },
    errorText: {
      fontSize: 12,
      color: colors.danger,
      paddingHorizontal: 4,
    },
    submitBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    successRow: {
      gap: 8,
      alignItems: 'center',
    },
    successText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
      flexShrink: 1,
    },
  })

export default memo(EmailSubscriptionForm)
