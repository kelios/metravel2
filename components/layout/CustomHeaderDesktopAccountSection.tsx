import Feather from '@expo/vector-icons/Feather'
import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '@/context/AuthContext'
import { useThemedColors } from '@/hooks/useTheme'
import { useAvatarUri } from '@/hooks/useAvatarUri'
import { buildLoginHref } from '@/utils/authNavigation'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import UserAvatar from './UserAvatar'
import { createAnchorStyles, createAvatarStyles, createCtaLoginStyles } from './headerStyles'

const AccountMenuLazy = lazy(() => import('./AccountMenu'))

type CustomHeaderDesktopAccountSectionProps = {
  styles: any
}

export default function CustomHeaderDesktopAccountSection({
  styles,
}: CustomHeaderDesktopAccountSectionProps) {
  const colors = useThemedColors()
  const { isAuthenticated, username, userAvatar, profileRefreshToken } = useAuth()
  const { avatarUri, setAvatarLoadError } = useAvatarUri({ userAvatar, profileRefreshToken })
  const [menuRequested, setMenuRequested] = useState(false)
  const [openOnLoadKey, setOpenOnLoadKey] = useState(0)
  const displayName = isAuthenticated && username ? username : 'Гость'

  const anchorStyles = useMemo(() => createAnchorStyles(colors), [colors])
  const avatarStyles = useMemo(() => createAvatarStyles(colors), [colors])
  const ctaStyles = useMemo(() => createCtaLoginStyles(colors), [colors])
  const shellStyles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
      }),
    []
  )

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
              ctaStyles.ctaLoginButton,
              pressed && ctaStyles.ctaLoginButtonHover,
            ]}
            testID="header-login-cta"
          >
            <View style={ctaStyles.ctaLoginIconSlot}>
              <Feather name="log-in" size={14} color={colors.textOnPrimary} />
            </View>
            <Text style={ctaStyles.ctaLoginText}>Войти</Text>
          </Pressable>
        )}

        <Pressable
          onPress={requestMenuOpen}
          onHoverIn={Platform.OS === 'web' ? preloadMenu : undefined}
          onFocus={preloadMenu}
          accessibilityRole="button"
          accessibilityLabel={`Открыть меню аккаунта ${displayName}`}
          accessibilityHint="Открыть меню аккаунта"
          style={({ pressed }) => [anchorStyles.anchor, pressed && anchorStyles.anchorHover]}
          testID="account-menu-anchor"
          {...(Platform.OS === 'web'
            ? ({
                'aria-haspopup': 'menu',
                'aria-expanded': false,
              } as any)
            : {})}
        >
          <UserAvatar
            uri={isAuthenticated ? avatarUri : null}
            size="md"
            onError={() => setAvatarLoadError(true)}
          />

          <Text style={avatarStyles.anchorText} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={avatarStyles.chevronSlot}>
            <Feather name="chevron-down" size={18} color={colors.textMuted} />
          </View>
        </Pressable>
      </View>
    </View>
  )
}
