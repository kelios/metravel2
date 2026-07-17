import Feather from '@expo/vector-icons/Feather'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import FacebookSignInButton from '@/components/auth/FacebookSignInButton'
import type {
  FacebookAuthFlowProps,
  FacebookCredential,
} from '@/components/auth/facebookLoginTypes'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import type { FacebookAuthResult } from '@/api/auth'
import { useAuth } from '@/context/AuthContext'

type CompletionState = Extract<
  FacebookAuthResult,
  { status: 'email_completion_required' }
> & {
  expiresAt: number
}

const isEmailAddress = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export default function FacebookAuthFlow({
  disabled = false,
  onAttempt,
  onAuthenticated,
  onFailure,
  onBusyChange,
}: FacebookAuthFlowProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const {
    loginWithFacebook,
    startFacebookEmailCompletion,
    confirmFacebookEmailCompletion,
  } = useAuth()
  const [busy, setBusy] = useState(false)
  const [permissionMissing, setPermissionMissing] = useState(false)
  const [completion, setCompletion] = useState<CompletionState | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [message, setMessage] = useState('')

  const blocksOtherAuth = busy || permissionMissing || completion !== null

  useEffect(() => {
    onBusyChange?.(blocksOtherAuth)
    return () => onBusyChange?.(false)
  }, [blocksOtherAuth, onBusyChange])

  useEffect(() => {
    if (!completion) return
    const remaining = completion.expiresAt - Date.now()
    if (remaining <= 0) {
      setCompletion(null)
      setVerificationSent(false)
      setMessage(i18nT('errorsStatic:api.auth.facebookCompletionInvalid'))
      return
    }
    const timeout = globalThis.setTimeout(() => {
      setCompletion(null)
      setVerificationSent(false)
      setMessage(i18nT('errorsStatic:api.auth.facebookCompletionInvalid'))
    }, remaining)
    return () => globalThis.clearTimeout(timeout)
  }, [completion])

  const resetCompletion = () => {
    setPermissionMissing(false)
    setCompletion(null)
    setEmail('')
    setCode('')
    setVerificationSent(false)
    setMessage('')
  }

  const handleResult = (result: FacebookAuthResult) => {
    if (result.status === 'authenticated') {
      resetCompletion()
      onAuthenticated()
      return
    }
    if (result.status === 'email_completion_required') {
      setPermissionMissing(false)
      setCompletion({
        ...result,
        expiresAt: Date.now() + result.expiresIn * 1000,
      })
      setVerificationSent(false)
      setCode('')
      setMessage('')
      return
    }
    setMessage(result.message)
    onFailure?.(result.errorCode || 'api')
  }

  const submitCredential = async (
    credential: FacebookCredential,
    allowCompletionWithoutPermission: boolean,
  ) => {
    if (!allowCompletionWithoutPermission) onAttempt?.()
    setMessage('')
    if (
      !credential.emailPermissionGranted &&
      !allowCompletionWithoutPermission
    ) {
      setPermissionMissing(true)
      return
    }

    setBusy(true)
    try {
      const result = await loginWithFacebook(credential.accessToken)
      handleResult(result)
    } finally {
      setBusy(false)
    }
  }

  const startCompletion = async () => {
    if (!completion || busy) return
    if (!isEmailAddress(email)) {
      setMessage(i18nT('errorsStatic:api.auth.facebookCompletionEmailInvalid'))
      return
    }
    if (Date.now() >= completion.expiresAt) {
      resetCompletion()
      setMessage(i18nT('errorsStatic:api.auth.facebookCompletionInvalid'))
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const result = await startFacebookEmailCompletion(
        completion.completionHandle,
        email.trim(),
      )
      if (result.status === 'verification_sent') {
        setVerificationSent(true)
        return
      }
      setMessage(result.message)
      onFailure?.(result.errorCode || 'completion_start')
      if (result.errorCode === 'facebook_completion_invalid') {
        resetCompletion()
        setMessage(result.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmCompletion = async () => {
    if (!completion || busy) return
    if (!code.trim()) {
      setMessage(i18nT('errorsStatic:api.auth.facebookCompletionCodeRequired'))
      return
    }
    if (Date.now() >= completion.expiresAt) {
      resetCompletion()
      setMessage(i18nT('errorsStatic:api.auth.facebookCompletionInvalid'))
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const result = await confirmFacebookEmailCompletion(
        completion.completionHandle,
        code.trim(),
      )
      handleResult(result)
      if (
        result.status === 'error' &&
        result.errorCode === 'facebook_completion_invalid'
      ) {
        resetCompletion()
        setMessage(result.message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (permissionMissing) {
    return (
      <View style={styles.panel} testID="facebook-permission-panel">
        <View style={styles.headingRow}>
          <Feather name="mail" size={20} color={colors.info} />
          <Text style={styles.title}>
            {i18nT('authStatic:facebook.emailPermissionTitle')}
          </Text>
        </View>
        <Text style={styles.description}>
          {i18nT('authStatic:facebook.emailPermissionMissing')}
        </Text>
        {message ? (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="facebook-auth-error"
          >
            {message}
          </Text>
        ) : null}
        <FacebookSignInButton
          mode="rerequest_email"
          onSuccess={(credential) => submitCredential(credential, true)}
          onError={setMessage}
          disabled={disabled || busy}
        />
        <Button
          label={i18nT('authStatic:facebook.cancelCompletion')}
          onPress={resetCompletion}
          variant="ghost"
          disabled={busy}
          fullWidth
          testID="facebook-permission-cancel"
        />
      </View>
    )
  }

  if (completion) {
    const reasonText =
      completion.reasonCode === 'facebook_email_permission_missing'
        ? i18nT('authStatic:facebook.emailPermissionCompletion')
        : i18nT('authStatic:facebook.primaryEmailUnavailable')
    return (
      <View style={styles.panel} testID="facebook-email-completion-panel">
        <View style={styles.headingRow}>
          <Feather name="mail" size={20} color={colors.info} />
          <Text style={styles.title}>
            {i18nT('authStatic:facebook.completeEmailTitle')}
          </Text>
        </View>
        <Text style={styles.description}>{reasonText}</Text>
        {message ? (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="facebook-auth-error"
          >
            {message}
          </Text>
        ) : null}
        {!verificationSent ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              editable={!busy && !disabled}
              placeholder={i18nT('authStatic:facebook.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              accessibilityLabel={i18nT('authStatic:facebook.emailA11y')}
              style={styles.input}
              testID="facebook-completion-email"
              onSubmitEditing={startCompletion}
            />
            <Button
              label={i18nT('authStatic:facebook.sendCode')}
              onPress={startCompletion}
              loading={busy}
              disabled={disabled || busy}
              fullWidth
              testID="facebook-completion-send-code"
            />
          </>
        ) : (
          <>
            <Text style={styles.sentText} accessibilityLiveRegion="polite">
              {i18nT('authStatic:facebook.codeSent')}
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              editable={!busy && !disabled}
              placeholder={i18nT('authStatic:facebook.codePlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              keyboardType="number-pad"
              accessibilityLabel={i18nT('authStatic:facebook.codeA11y')}
              style={styles.input}
              testID="facebook-completion-code"
              onSubmitEditing={confirmCompletion}
            />
            <Button
              label={i18nT('authStatic:facebook.confirmCode')}
              onPress={confirmCompletion}
              loading={busy}
              disabled={disabled || busy}
              fullWidth
              testID="facebook-completion-confirm"
            />
          </>
        )}
        <Button
          label={i18nT('authStatic:facebook.cancelCompletion')}
          onPress={resetCompletion}
          variant="ghost"
          disabled={busy}
          fullWidth
          testID="facebook-completion-cancel"
        />
      </View>
    )
  }

  return (
    <View>
      {message ? (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="facebook-auth-error"
        >
          {message}
        </Text>
      ) : null}
      <FacebookSignInButton
        onSuccess={(credential) => submitCredential(credential, false)}
        onError={(error) => {
          setMessage(error)
          onFailure?.('provider')
        }}
        onCancel={() => setMessage('')}
        disabled={disabled || busy}
      />
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    panel: {
      gap: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.infoSoft,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '700',
    },
    description: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 20,
    },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
    sentText: {
      color: colors.success,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
    },
    error: {
      color: colors.dangerDark,
      backgroundColor: colors.dangerSoft,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.sm,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
  })
