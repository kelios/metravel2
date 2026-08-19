import { memo, useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import Feather from '@expo/vector-icons/Feather'
import { Link } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import ConsentCheckbox from '@/components/legal/ConsentCheckbox'
import { subscribeEmail, type SubscribeSource } from '@/api/misc'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { useActionConsent } from '@/hooks/useActionConsent'
import { CONSENT_TYPES } from '@/utils/actionConsent'
import { translate as i18nT } from '@/i18n'


interface EmailSubscriptionFormProps {
  source: SubscribeSource
  title?: string
  subtitle?: string
}

// Быстрый клиентский гейт: ловит основную массу опечаток без запроса. Он
// заведомо слабее валидатора Django (например `a@b..c` проходит), поэтому 400 от
// бэкенда достижим. Сообщения бэкенда приходят по-английски — на локаль их
// переводит localizeBackendFieldError в api/backendErrors.ts.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Минимальная ширина колонки с текстом обещания. Блок встраивается и в узкие
// колонки (сценарий квеста, деталь маршрута), где вьюпорт desktop, а места в
// строку нет: без минимума заголовок схлопывается до нечитаемых ~140dp. Вместе
// с flexWrap на карточке это уводит форму на вторую строку вместо сжатия текста.
const TEXT_MIN_WIDTH = 260

function EmailSubscriptionForm({ source, title, subtitle }: EmailSubscriptionFormProps) {
  const { isMobile } = useResponsive()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  // Согласие спрашиваем на каждой отправке и не подставляем ранее данное:
  // предотмеченный чекбокс не является действительным согласием.
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentMissing, setConsentMissing] = useState(false)
  const { grant: grantConsent } = useActionConsent(CONSENT_TYPES.EMAIL_SUBSCRIBE)

  const mutation = useMutation({
    mutationFn: () => {
      const pageUrl =
        Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.href : undefined
      return subscribeEmail(email, source, pageUrl)
    },
    onSuccess: (result) => {
      queueAnalyticsEvent('email_subscribe', { source, status: result.status })
    },
  })

  const succeeded = mutation.isSuccess
  const alreadyExists = mutation.data?.status === 'exists'

  const handleSubmit = () => {
    if (!consentChecked) {
      // Submit по Enter приходит из поля ввода, где disabled-кнопка вне поля
      // зрения: без явного текста отправка выглядит как молчаливый отказ.
      // Причина относится к чекбоксу, поэтому не идёт в ошибку поля email —
      // иначе валидный адрес подсвечивается красным без причины.
      setConsentMissing(true)
      return
    }
    setConsentMissing(false)
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setLocalError(i18nT('shared:components.common.EmailSubscriptionForm.vvedite_korrektnyy_email_03c63cf4'))
      return
    }
    setLocalError(null)
    // Фиксируем факт согласия до отправки: обрабатывать email мы начинаем
    // именно с этого момента. Запись сейчас device-local: серверный аудит
    // POST /user/consents/ требует логина и не знает типа email_subscribe,
    // поэтому для гостя (основная аудитория формы) не создаётся — см. BE-задачу.
    // Доказательство согласия на сервере — сама запись лида с source/page_url.
    void grantConsent()
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

          <View style={[styles.textBlock, isMobile ? styles.textBlockStacked : styles.textBlockRow]}>
            <Text style={styles.title}>{title ?? i18nT('sharedStatic:subscription.defaultTitle')}</Text>
            <Text style={styles.subtitle}>{subtitle ?? i18nT('sharedStatic:subscription.defaultSubtitle')}</Text>
          </View>

          {succeeded ? (
            <View style={[styles.successRow, isMobile ? styles.fieldsStacked : styles.fieldsRow]}>
              <Feather name="check-circle" size={18} color={colors.primaryDark} />
              <Text style={styles.successText}>
                {alreadyExists
                  ? i18nT('shared:components.common.EmailSubscriptionForm.vy_uzhe_podpisany_spasibo_chto_s_nami_6014714e')
                  : i18nT('shared:components.common.EmailSubscriptionForm.gotovo_pismo_s_novymi_marshrutami_skoro_prid_a7046d88')}
              </Text>
            </View>
          ) : (
            <View style={[styles.formCol, isMobile ? styles.formColStacked : styles.formColRow]}>
              <View style={[styles.fields, isMobile ? styles.fieldsStacked : styles.fieldsRow]}>
                <View style={styles.inputCol}>
                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t)
                      if (localError) setLocalError(null)
                    }}
                    onSubmitEditing={handleSubmit}
                    placeholder={i18nT('shared:components.common.EmailSubscriptionForm.vash_email_com_3f97bbae')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!mutation.isPending}
                    returnKeyType="go"
                    style={[styles.input, !!errorText && styles.inputError]}
                    accessibilityLabel={i18nT('shared:components.common.EmailSubscriptionForm.email_dlya_podpiski_na_novye_marshruty_54ea0434')}
                  />
                  {!!errorText && (
                    <Text style={styles.errorText} accessibilityLiveRegion="polite">
                      {errorText}
                    </Text>
                  )}
                </View>
                <Button
                  label={i18nT('shared:components.common.EmailSubscriptionForm.podpisatsya_593e3a3e')}
                  onPress={handleSubmit}
                  variant="primary"
                  size={isMobile ? 'md' : 'md'}
                  fullWidth={isMobile}
                  loading={mutation.isPending}
                  disabled={mutation.isPending || !consentChecked}
                  style={styles.submitBtn}
                  accessibilityLabel={i18nT('shared:components.common.EmailSubscriptionForm.podpisatsya_na_rassylku_novyh_marshrutov_1ccbe1b4')}
                />
              </View>

              <ConsentCheckbox
                checked={consentChecked}
                onToggle={(next) => {
                  setConsentChecked(next)
                  if (next) setConsentMissing(false)
                }}
                testID="email-subscribe-consent"
                accessibilityLabel={i18nT('sharedStatic:subscription.consentA11y')}
              >
                {i18nT('sharedStatic:subscription.consentLabel')}
              </ConsentCheckbox>
              {consentMissing && (
                <Text style={styles.consentErrorText} accessibilityLiveRegion="polite">
                  {i18nT('sharedStatic:subscription.consentRequired')}
                </Text>
              )}

              <Link href="/privacy" style={styles.privacyLink}>
                {i18nT('sharedStatic:subscription.privacyLink')}
              </Link>
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
      // Узкий контейнер на desktop-вьюпорте: форма переносится на вторую строку,
      // а не сжимает колонку обещания до нечитаемой ширины.
      flexWrap: 'wrap',
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
    textBlockStacked: { width: '100%' },
    textBlockRow: { flex: 1, minWidth: TEXT_MIN_WIDTH },
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
    formCol: {
      gap: 10,
    },
    formColStacked: { width: '100%' },
    // Ширина колонки формы в строку: input 240 + кнопка. Ограничение нужно,
    // чтобы строка согласия переносилась внутри колонки, а не растягивала карточку.
    formColRow: { flexShrink: 0, flexGrow: 1, maxWidth: 420, minWidth: 260 },
    fields: {
      flexShrink: 0,
      gap: 10,
      alignItems: 'flex-start',
    },
    fieldsStacked: { width: '100%', flexDirection: 'column' },
    fieldsRow: { flexDirection: 'row', alignItems: 'flex-start' },
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
    // Ошибка согласия живёт рядом с чекбоксом: отступ выравнивает её по метке,
    // а не по краю карточки.
    consentErrorText: {
      fontSize: 12,
      color: colors.danger,
      paddingLeft: 34,
    },
    submitBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    // paddingVertical доводит строку 18dp до 44dp tap-таргета: guard-touch-targets
    // проверяет только явные размеры и такую строку-ссылку не ловит.
    privacyLink: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      color: colors.primaryText,
      paddingVertical: 13,
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
