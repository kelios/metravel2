import Feather from '@expo/vector-icons/Feather'
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/context/AuthContext'
import { useThemedColors } from '@/hooks/useTheme'
import { buildLoginHref } from '@/utils/authNavigation'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'

const AccountMenuLazy = lazy(() => import('./AccountMenu'))

type CustomHeaderDesktopAccountSectionProps = {
  styles: any
}

export default function CustomHeaderDesktopAccountSection({
  styles,
}: CustomHeaderDesktopAccountSectionProps) {
  const colors = useThemedColors()
  const { isAuthenticated, username, userAvatar, profileRefreshToken } = useAuth()
  const [avatarLoadError, setAvatarLoadError] = useState(false)
  const [menuRequested, setMenuRequested] = useState(false)
  const [openOnLoadKey, setOpenOnLoadKey] = useState(0)
  const displayName = isAuthenticated && username ? username : 'Гость'

  const shellStyles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        ctaLoginButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 20,
          backgroundColor: colors.primary,
          minHeight: 36,
          ...(Platform.OS === 'web'
            ? ({
                cursor: 'pointer',
                transition: 'background-color 160ms ease, transform 120ms ease',
              } as any)
            : null),
        },
        ctaLoginIconSlot: {
          width: 16,
          height: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        ctaLoginButtonHover: {
          backgroundColor: colors.primaryDark,
          ...(Platform.OS === 'web' ? ({ transform: 'translateY(-1px)' } as any) : null),
        },
        ctaLoginText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.textOnPrimary,
        },
        anchor: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 20,
          maxWidth: 220,
          minHeight: 44,
          minWidth: 44,
          gap: 6,
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...(Platform.OS === 'web'
            ? ({
                cursor: 'pointer',
                transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
              } as any)
            : null),
        },
        anchorPressed: {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: (colors.boxShadows as any)?.hover ?? '0 8px 16px rgba(17, 24, 39, 0.12)',
              } as any)
            : null),
        },
        avatarSlot: {
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        avatar: {
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        anchorText: {
          fontSize: 16,
          color: colors.text,
          flexShrink: 1,
        },
        chevronSlot: {
          width: 18,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
      }),
    [colors]
  )

  const avatarUri = useMemo(() => {
    if (avatarLoadError) return null
    const raw = String(userAvatar ?? '').trim()
    if (!raw) return null
    const lower = raw.toLowerCase()
    if (lower === 'null' || lower === 'undefined') return null

    let normalized = raw
    if (raw.startsWith('/')) {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '')
      if (base) {
        normalized = `${base}${raw}`
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        normalized = `${window.location.origin}${raw}`
      }
    }

    if (normalized.includes('X-Amz-') || normalized.includes('x-amz-')) {
      return normalized
    }

    const separator = normalized.includes('?') ? '&' : '?'
    return `${normalized}${separator}v=${profileRefreshToken}`
  }, [avatarLoadError, profileRefreshToken, userAvatar])

  useEffect(() => {
    setAvatarLoadError(false)
  }, [profileRefreshToken, userAvatar])

  const preloadMenu = useCallback(() => {
    setMenuRequested(true)
  }, [])

  const requestMenuOpen = useCallback(() => {
    setMenuRequested(true)
    setOpenOnLoadKey((current) => current + 1)
  }, [])

  const handleLoginPress = useCallback(() => {
    const href = buildLoginHref({ intent: 'menu' })
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      void openExternalUrlInNewTab(href, {
        allowRelative: true,
        baseUrl: window.location.origin,
        windowFeatures: 'noopener',
      })
    }
  }, [])

  if (menuRequested) {
    return (
      <View style={styles.rightSection}>
        <Suspense fallback={null}>
          <AccountMenuLazy initialOpenKey={openOnLoadKey} />
        </Suspense>
      </View>
    )
  }

  return (
    <View style={styles.rightSection}>
      <View style={shellStyles.wrapper}>
        {!isAuthenticated && (
          <Pressable
            onPress={handleLoginPress}
            accessibilityRole="link"
            accessibilityLabel="Войти в аккаунт"
            style={({ pressed }) => [
              shellStyles.ctaLoginButton,
              pressed && shellStyles.ctaLoginButtonHover,
            ]}
            testID="header-login-cta"
          >
            <View style={shellStyles.ctaLoginIconSlot}>
              <Feather name="log-in" size={14} color={colors.textOnPrimary} />
            </View>
            <Text style={shellStyles.ctaLoginText}>Войти</Text>
          </Pressable>
        )}

        <Pressable
          onPress={requestMenuOpen}
          onHoverIn={Platform.OS === 'web' ? preloadMenu : undefined}
          onFocus={preloadMenu}
          accessibilityRole="button"
          accessibilityLabel={`Открыть меню аккаунта ${displayName}`}
          accessibilityHint="Открыть меню аккаунта"
          style={({ pressed }) => [shellStyles.anchor, pressed && shellStyles.anchorPressed]}
          testID="account-menu-anchor"
          {...(Platform.OS === 'web'
            ? ({
                'aria-haspopup': 'menu',
                'aria-expanded': false,
              } as any)
            : {})}
        >
          <View style={shellStyles.avatarSlot}>
            {isAuthenticated && avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={shellStyles.avatar}
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <Feather name="user" size={24} color={colors.text} />
            )}
          </View>

          <Text style={shellStyles.anchorText} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={shellStyles.chevronSlot}>
            <Feather name="chevron-down" size={18} color={colors.textMuted} />
          </View>
        </Pressable>
      </View>
    </View>
  )
}
