import Feather from '@expo/vector-icons/Feather'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { AccessToken, LoginManager, Settings } from 'react-native-fbsdk-next'

import type {
  FacebookCredential,
  FacebookSignInButtonProps,
} from '@/components/auth/facebookLoginTypes'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

export const isFacebookNativeLoginEnabled = () =>
  String(process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED || '')
    .trim()
    .toLowerCase() === 'true'

export const getFacebookNativePermissions = (
  mode: FacebookSignInButtonProps['mode'],
) => (mode === 'rerequest_email' ? ['email'] : ['public_profile', 'email'])

export const getFacebookNativeCredential = (
  accessToken: string | undefined,
  permissions: string[] | undefined,
): FacebookCredential | null => {
  const normalizedToken = String(accessToken || '').trim()
  if (!normalizedToken) return null
  const grantedScopes = Array.from(
    new Set((permissions || []).map((scope) => scope.trim()).filter(Boolean)),
  )
  return {
    accessToken: normalizedToken,
    grantedScopes,
    emailPermissionGranted: grantedScopes.includes('email'),
  }
}

export default function FacebookSignInButton({
  onSuccess,
  onError,
  onCancel,
  disabled,
  mode = 'sign_in',
}: FacebookSignInButtonProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const onCancelRef = useRef(onCancel)
  const enabled = isFacebookNativeLoginEnabled()
  const appId = String(process.env.EXPO_PUBLIC_META_APP_ID || '').trim()

  useEffect(() => {
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    if (!enabled || !appId) return
    try {
      Settings.initializeSDK()
      LoginManager.setLoginBehavior('native_with_fallback')
      setReady(true)
    } catch {
      onErrorRef.current?.(i18nT('authStatic:facebook.sdkLoadFailed'))
    }
  }, [appId, enabled])

  if (!enabled) return null

  const unavailable = !appId
  const handlePress = async () => {
    if (disabled || loading || unavailable || !ready) return
    setLoading(true)
    try {
      const result = await LoginManager.logInWithPermissions(
        getFacebookNativePermissions(mode),
      )
      if (result.isCancelled) {
        onCancelRef.current?.()
        return
      }
      const currentAccessToken = await AccessToken.getCurrentAccessToken()
      const credential = getFacebookNativeCredential(
        currentAccessToken?.accessToken,
        currentAccessToken?.permissions || result.grantedPermissions,
      )
      if (!credential) {
        onErrorRef.current?.(i18nT('authStatic:facebook.signInFailed'))
        return
      }
      onSuccessRef.current(credential)
    } catch {
      onErrorRef.current?.(i18nT('authStatic:facebook.signInFailed'))
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = Boolean(disabled || loading || unavailable || !ready)
  const idleLabel =
    mode === 'rerequest_email'
      ? i18nT('authStatic:facebook.rerequestEmail')
      : i18nT('authStatic:facebook.signIn')

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={
        unavailable ? i18nT('authStatic:facebook.unavailableA11y') : idleLabel
      }
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID="facebook-sign-in-button"
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Feather name="facebook" size={20} color={colors.textOnPrimary} />
        )}
        <Text style={styles.text}>
          {unavailable
            ? i18nT('authStatic:facebook.unavailable')
            : loading
              ? i18nT('authStatic:facebook.loading')
              : idleLabel}
        </Text>
      </View>
    </Pressable>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    button: {
      width: '100%',
      minHeight: 48,
      borderRadius: DESIGN_TOKENS.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.info,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 16,
    },
    text: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
      flexShrink: 1,
      textAlign: 'center',
    },
  })
