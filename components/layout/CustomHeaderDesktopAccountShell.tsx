import Feather from '@expo/vector-icons/Feather'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import UserAvatar from './UserAvatar'
import { translate as i18nT } from '@/i18n'


type DesktopAccountShellProps = {
  anchorStyles: any
  avatarStyles: any
  colors: {
    textMuted?: string
    textOnPrimary?: string
  }
  ctaStyles: any
  displayName: string
  isAuthenticated: boolean
  onAnchorPress?: () => void
  onAvatarError: () => void
  onLoginPress: () => void
  onPreloadMenu: () => void
  pressedAnchorState?: boolean
  testIdSuffix?: string
  userAvatarUri: string | null
}

const shellStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})

export default function CustomHeaderDesktopAccountShell({
  anchorStyles,
  avatarStyles,
  colors,
  ctaStyles,
  displayName,
  isAuthenticated,
  onAnchorPress,
  onAvatarError,
  onLoginPress,
  onPreloadMenu,
  pressedAnchorState = false,
  testIdSuffix,
  userAvatarUri,
}: DesktopAccountShellProps) {
  return (
    <View style={shellStyles.wrapper}>
      {!isAuthenticated ? (
        <Pressable
          onPress={onLoginPress}
          accessibilityRole="link"
          accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderDesktopAccountShell.voyti_v_akkaunt_aff337b8')}
          style={({ pressed }) => [
            ctaStyles.ctaLoginButton,
            !testIdSuffix && pressed && ctaStyles.ctaLoginButtonHover,
          ]}
          testID={testIdSuffix ? `header-login-cta-${testIdSuffix}` : 'header-login-cta'}
        >
          <View style={ctaStyles.ctaLoginIconSlot}>
            <Feather name="log-in" size={14} color={colors.textOnPrimary} />
          </View>
          <Text style={ctaStyles.ctaLoginText}>{i18nT('navigation:components.layout.CustomHeaderDesktopAccountShell.voyti_77afdc17')}</Text>
        </Pressable>
      ) : null}

      {onAnchorPress ? (
        <Pressable
          onPress={onAnchorPress}
          onHoverIn={Platform.OS === 'web' ? onPreloadMenu : undefined}
          onFocus={onPreloadMenu}
          accessibilityRole="button"
          accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderDesktopAccountShell.otkryt_menyu_akkaunta_value1_fb1179bc', { value1: displayName })}
          accessibilityHint={i18nT('navigation:components.layout.CustomHeaderDesktopAccountShell.otkryt_menyu_akkaunta_b24ca4ee')}
          style={({ pressed }) => [
            anchorStyles.anchor,
            (pressed || pressedAnchorState) && anchorStyles.anchorHover,
          ]}
          testID="account-menu-anchor"
          {...(Platform.OS === 'web'
            ? ({
                'aria-haspopup': 'menu',
                'aria-expanded': false,
              } as any)
            : {})}
        >
          <UserAvatar uri={isAuthenticated ? userAvatarUri : null} size="md" onError={onAvatarError} />
          <Text style={avatarStyles.anchorText} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={avatarStyles.chevronSlot}>
            <Feather name="chevron-down" size={18} color={colors.textMuted} />
          </View>
        </Pressable>
      ) : (
        <View style={anchorStyles.anchor}>
          <UserAvatar uri={isAuthenticated ? userAvatarUri : null} size="md" onError={onAvatarError} />
          <Text style={avatarStyles.anchorText} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={avatarStyles.chevronSlot}>
            <Feather name="chevron-down" size={18} color={colors.textMuted} />
          </View>
        </View>
      )}
    </View>
  )
}
