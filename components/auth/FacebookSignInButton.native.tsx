import Feather from '@expo/vector-icons/Feather'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type {
  FacebookCredential,
  FacebookSignInButtonProps,
} from '@/components/auth/facebookLoginTypes'
import { SOCIAL_AUTH_BUTTON_GEOMETRY } from '@/components/auth/socialAuthButtonGeometry'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

type FacebookNativeSdk = typeof import('react-native-fbsdk-next')

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
  const [sdkUnavailable, setSdkUnavailable] = useState(false)
  const sdkRef = useRef<FacebookNativeSdk | null>(null)
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
    let active = true

    Promise.resolve(import('react-native-fbsdk-next'))
      .then((sdk) => {
        if (!active) return
        sdk.Settings.initializeSDK()
        sdk.LoginManager.setLoginBehavior('native_with_fallback')
        sdkRef.current = sdk
        setReady(true)
      })
      .catch(() => {
        if (!active) return
        sdkRef.current = null
        setSdkUnavailable(true)
        onErrorRef.current?.(i18nT('authStatic:facebook.sdkLoadFailed'))
      })

    return () => {
      active = false
      sdkRef.current = null
    }
  }, [appId, enabled])

  if (!enabled) return null

  const unavailable = !appId || sdkUnavailable
  const handlePress = async () => {
    const sdk = sdkRef.current
    if (disabled || loading || unavailable || !ready || !sdk) return
    setLoading(true)
    try {
      const result = await sdk.LoginManager.logInWithPermissions(
        getFacebookNativePermissions(mode),
      )
      if (result.isCancelled) {
        onCancelRef.current?.()
        return
      }
      const currentAccessToken = await sdk.AccessToken.getCurrentAccessToken()
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
      minHeight: SOCIAL_AUTH_BUTTON_GEOMETRY.minHeight,
      borderRadius: SOCIAL_AUTH_BUTTON_GEOMETRY.borderRadius,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.info,
    },
    buttonDisabled: {
      opacity: SOCIAL_AUTH_BUTTON_GEOMETRY.disabledOpacity,
    },
    buttonPressed: {
      opacity: SOCIAL_AUTH_BUTTON_GEOMETRY.pressedOpacity,
      transform: [{ scale: SOCIAL_AUTH_BUTTON_GEOMETRY.pressedScale }],
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SOCIAL_AUTH_BUTTON_GEOMETRY.contentGap,
      paddingHorizontal: SOCIAL_AUTH_BUTTON_GEOMETRY.paddingHorizontal,
    },
    text: {
      color: colors.textOnPrimary,
      fontSize: SOCIAL_AUTH_BUTTON_GEOMETRY.fontSize,
      fontWeight: '600',
      flexShrink: 1,
      textAlign: 'center',
    },
  })
