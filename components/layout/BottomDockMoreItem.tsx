import React from 'react'
import { Platform, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { usePathname, useRouter, type Href } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { useThemedColors } from '@/hooks/useTheme'
import NavigationLink from '@/components/ui/NavigationLink'
import { globalFocusStyles } from '@/styles/globalFocus'
import { buildArticlesHrefFromSource } from '@/utils/articleNavigation'
import { runAccountMenuTarget } from './accountMenuModel'
import type { BottomDockMoreMenuItem } from './bottomDockModel'
import { handleHeaderNavPress } from './customHeaderNavModel'
import NavigationIcon from './NavigationIcon'
import UnreadBadge from './UnreadBadge'

type MoreItemStyles = {
  moreItem: StyleProp<ViewStyle>
  moreItemPressed: StyleProp<ViewStyle>
  moreItemIconSlot: StyleProp<ViewStyle>
  moreItemText: StyleProp<TextStyle>
  moreItemTextMuted: StyleProp<TextStyle>
  moreItemTextBlock: StyleProp<ViewStyle>
  moreItemHint: StyleProp<TextStyle>
}

type Props = {
  item: BottomDockMoreMenuItem
  styles: MoreItemStyles
  /** Закрыть лист (Modal/web) или свернуть Gorhom-шит. */
  onClose: () => void
  /** Подэкран листа для пунктов-действий («Язык интерфейса», «Тема оформления»). */
  onOpenView: (view: 'language' | 'theme') => void
}

/**
 * Пункт листа «Ещё» — один исполнитель на три ветки листа (web, native Modal,
 * Gorhom). Переход, внешняя ссылка, цель меню аккаунта (#2152) и подэкран
 * (#2100, #2779) решаются здесь, а не в каждой ветке.
 */
function BottomDockMoreItem({ item, styles, onClose, onOpenView }: Props) {
  const colors = useThemedColors()
  const router = useRouter()
  const pathname = usePathname()
  const { logout } = useAuth()

  const handlePress = () => {
    // #2100/#2779: язык и тема — подэкраны этого же листа, лист не закрываем.
    if (item.action) {
      onOpenView(item.action)
      return
    }
    // #2152: пункт аккаунта — общий исполнитель целей меню шапки.
    if (item.accountTarget) {
      runAccountMenuTarget(item.accountTarget, 'mobile', {
        navigate: (path) => {
          onClose()
          handleHeaderNavPress(router, path)
        },
        // Вкладка открывается в том же тапе, до закрытия листа: отложенный
        // window.open iOS Safari молча блокирует (#2139).
        openExternal: (url) => {
          handleHeaderNavPress(router, url, true)
          onClose()
        },
        // Как на desktop (`AccountMenu`): после выхода — на главную.
        logout: async () => {
          onClose()
          if (await logout()) router.push('/')
        },
      })
      return
    }
    // Внешняя ссылка общего списка навигации — тоже в том же тапе.
    if (item.external) {
      handleHeaderNavPress(router, String(item.route), true)
      onClose()
      return
    }
    onClose()
    const route = Platform.OS !== 'web' && item.route === '/articles'
      ? buildArticlesHrefFromSource(pathname)
      : item.route
    if (typeof route === 'string') {
      handleHeaderNavPress(router, route, false, pathname)
      return
    }
    if (route) router.push(route)
  }

  const testID = `footer-more-item-${item.key}`
  const children = (
    <>
      <View style={styles.moreItemIconSlot}>
        <NavigationIcon
          name={item.iconName}
          size={18}
          color={item.muted ? colors.textMuted : colors.primary}
        />
        {item.unreadCount !== undefined ? <UnreadBadge count={item.unreadCount} /> : null}
      </View>
      {item.hint ? (
        <View style={styles.moreItemTextBlock}>
          <Text style={[styles.moreItemText, item.muted && styles.moreItemTextMuted]}>
            {item.label}
          </Text>
          <Text style={styles.moreItemHint} numberOfLines={1}>
            {item.hint}
          </Text>
        </View>
      ) : (
        <Text style={[styles.moreItemText, item.muted && styles.moreItemTextMuted]}>
          {item.label}
        </Text>
      )}
    </>
  )
  const target = item.accountTarget
  const externalHref = target?.kind === 'external' ? target.url : item.external ? String(item.route) : undefined
  const href = target?.kind === 'route' || target?.kind === 'register'
    ? target.path as Href
    : item.route
  const destination = externalHref ? { external: true as const, href: externalHref } : href ? { href } : undefined

  if (Platform.OS === 'web' && destination && !item.action) {
    return (
      <NavigationLink
        {...destination}
        onNavigate={handlePress}
        style={styles.moreItem}
        accessibilityLabel={item.accessibilityLabel}
        testID={testID}
      >
        {children}
      </NavigationLink>
    )
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ hovered, pressed }) => [
        styles.moreItem,
        (hovered || pressed) && styles.moreItemPressed,
        globalFocusStyles.focusable,
      ]}
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      accessibilityRole={item.action || target?.kind === 'logout' ? 'button' : 'link'}
      accessibilityLabel={item.accessibilityLabel}
      testID={testID}
    >
      {children}
    </Pressable>
  )
}

export default React.memo(BottomDockMoreItem)
