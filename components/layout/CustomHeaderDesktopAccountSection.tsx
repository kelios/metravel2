import React, { useCallback, useMemo, useState } from 'react'
import { Platform, View } from 'react-native'

import { useAuth } from '@/context/AuthContext'
import { useThemedColors } from '@/hooks/useTheme'
import { useAvatarUri } from '@/hooks/useAvatarUri'
import { buildLoginHref } from '@/utils/authNavigation'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import AccountMenu from './AccountMenu'
import CustomHeaderDesktopAccountShell from './CustomHeaderDesktopAccountShell'
import { createAnchorStyles, createAvatarStyles, createCtaLoginStyles } from './headerStyles'

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

  const preloadMenu = useCallback(() => {
    // Account menu is rendered on demand; keep this as a stable no-op for shell hover/focus.
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
        <AccountMenu initialOpenKey={openOnLoadKey} />
      </View>
    )
  }

  return (
    <View style={styles.rightSection}>
      <CustomHeaderDesktopAccountShell
        anchorStyles={anchorStyles}
        avatarStyles={avatarStyles}
        colors={colors}
        ctaStyles={ctaStyles}
        displayName={displayName}
        isAuthenticated={isAuthenticated}
        onAnchorPress={requestMenuOpen}
        onAvatarError={() => setAvatarLoadError(true)}
        onLoginPress={handleLoginPress}
        onPreloadMenu={preloadMenu}
        userAvatarUri={avatarUri}
      />
    </View>
  )
}
