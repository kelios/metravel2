import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'

import { Menu } from '@/ui/paper'
import ThemeToggle from '@/components/layout/ThemeToggle'
import AccountMenuSection from './AccountMenuSection'
import UserAvatar from './UserAvatar'
import {
  createAnchorStyles,
  createAvatarStyles,
  createCtaLoginStyles,
  createMenuStyles,
} from './headerStyles'
import NavigationIcon from './NavigationIcon'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useDeferredUnreadCount } from '@/hooks/useDeferredUnreadCount'
import { useAvatarUri } from '@/hooks/useAvatarUri'
import { PRIMARY_HEADER_NAV_ITEMS, SECONDARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation'
import { routes } from '@/utils/routes'
import { useThemedColors } from '@/hooks/useTheme'
import { buildLoginHref } from '@/utils/authNavigation'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import type { NavigationIconName } from '@/constants/navigationIcons'

const IS_WEB = Platform.OS === 'web'

const TASK_BOARD_URL = 'https://metravel.by/board'

type AccountMenuProps = {
  initialOpenKey?: number
}

type MenuLinkItem = {
  key: string
  title: string
  path?: string
  icon: NavigationIconName
  onPress?: () => void
  strong?: boolean
  iconColor?: string
  leadingNode?: React.ReactNode
}

type MenuStyles = ReturnType<typeof createMenuStyles>
type ThemedColors = ReturnType<typeof useThemedColors>

const STATIC_NAV_LINKS: MenuLinkItem[] = [
  ...PRIMARY_HEADER_NAV_ITEMS.map((item) => ({
    key: `nav-${item.path}`,
    title: item.label,
    path: item.path,
    icon: item.icon,
  })),
  { key: 'nav-favorites', title: 'Избранное', path: '/favorites', icon: 'heart' },
  { key: 'nav-history', title: 'История просмотров', path: '/history', icon: 'clock' },
  { key: 'nav-about', title: 'О сайте', path: '/about', icon: 'info' },
  ...SECONDARY_HEADER_NAV_ITEMS.map((item) => ({
    key: `nav-${item.path}`,
    title: item.label,
    path: item.path,
    icon: item.icon,
  })),
]

const TRAVEL_ITEMS: MenuLinkItem[] = [
  { key: 'travel-new', title: 'Добавить путешествие', icon: 'plus-circle', path: '/travel/new' },
  { key: 'my-travels', title: 'Мои путешествия', icon: 'map', path: '/metravel' },
  { key: 'user-points', title: 'Мои точки', icon: 'map-pin', path: '/userpoints' },
]

const DOCUMENT_ITEMS: MenuLinkItem[] = [
  { key: 'privacy', title: 'Политика конфиденциальности', icon: 'shield', path: '/privacy' },
  { key: 'cookies', title: 'Настройки cookies', icon: 'settings', path: '/cookies' },
]

const wrapperStyles = StyleSheet.create({
  ctaWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeAnchor: { position: 'relative' },
})

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
})

function UnreadBadge({ count, colors }: { count: number; colors: ThemedColors }) {
  if (count <= 0) return null
  return (
    <View style={[badgeStyles.badge, { backgroundColor: colors.primary }]}>
      <Text style={[badgeStyles.badgeText, { color: colors.textOnPrimary }]}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  )
}

function MessageMenuIcon({
  count,
  colors,
  defaultColor,
}: {
  count: number
  colors: ThemedColors
  defaultColor: string
}) {
  return (
    <View style={wrapperStyles.badgeAnchor}>
      <Feather name="mail" size={20} color={count > 0 ? colors.primary : defaultColor} />
      <UnreadBadge count={count} colors={colors} />
    </View>
  )
}

function MenuLink({
  item,
  styles,
  defaultIconColor,
  onNavigate,
}: {
  item: MenuLinkItem
  styles: MenuStyles
  defaultIconColor: string
  onNavigate: (path: string) => void
}) {
  const onPress =
    item.onPress ?? (item.path ? () => onNavigate(item.path!) : undefined)
  return (
    <Menu.Item
      onPress={onPress}
      title={item.title}
      leadingIcon={({ size }) =>
        item.leadingNode ??
        (
          <NavigationIcon
            name={item.icon}
            size={size}
            color={item.iconColor ?? defaultIconColor}
          />
        )
      }
      style={styles.menuItem}
      titleStyle={item.strong ? styles.menuItemTitleStrong : styles.menuItemTitle}
    />
  )
}

function AccountMenu({ initialOpenKey = 0 }: AccountMenuProps) {
  const { isAuthenticated, isSuperuser, username, logout, userId, userAvatar, profileRefreshToken } = useAuth()
  const { favorites } = useFavorites()
  const colors = useThemedColors()

  const shouldOpenInitially = initialOpenKey > 0
  const [visible, setVisible] = useState(shouldOpenInitially)
  const [hovered, setHovered] = useState(false)
  const { avatarUri, setAvatarLoadError } = useAvatarUri({ userAvatar, profileRefreshToken })
  const { count: unreadCount } = useDeferredUnreadCount(isAuthenticated && visible, visible)
  const lastHandledInitialOpenKeyRef = useRef(shouldOpenInitially ? initialOpenKey : 0)

  const [expandedSections, setExpandedSections] = useState({
    navigation: true,
    travels: true,
    account: true,
    theme: false,
    documents: false,
  })

  const anchorStyles = useMemo(() => createAnchorStyles(colors), [colors])
  const avatarStyles = useMemo(() => createAvatarStyles(colors), [colors])
  const ctaStyles = useMemo(() => createCtaLoginStyles(colors), [colors])
  const menuStyles = useMemo(() => createMenuStyles(colors), [colors])

  const openMenu = useCallback(() => setVisible(true), [])
  const closeMenu = useCallback(() => setVisible(false), [])

  useEffect(() => {
    if (initialOpenKey <= 0) return
    if (lastHandledInitialOpenKeyRef.current === initialOpenKey) return
    lastHandledInitialOpenKeyRef.current = initialOpenKey
    setVisible(true)
  }, [initialOpenKey])

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const navigate = useCallback(
    (path: string) => {
      closeMenu()
      router.push(path as any)
    },
    [closeMenu],
  )

  const handleLogout = useCallback(async () => {
    // Закрываем меню ДО await: logout() синхронно инвалидирует auth-состояние и
    // ре-рендерит/размонтирует это меню — пост-await closeMenu() был бы setState на
    // размонтированном, а навигация гонилась бы с авто-редиректом смены auth.
    closeMenu()
    await logout()
    router.push('/' as any)
  }, [logout, closeMenu])

  const handleOpenPublicProfile = useCallback(() => {
    if (userId) router.push(routes.user(userId))
  }, [userId])

  const handleOpenTaskBoard = useCallback(() => {
    closeMenu()
    void openExternalUrlInNewTab(TASK_BOARD_URL, { windowFeatures: 'noopener' })
  }, [closeMenu])

  const handleLogin = useCallback(
    () => navigate(buildLoginHref({ intent: 'menu' })),
    [navigate],
  )

  const guestItems = useMemo<MenuLinkItem[]>(
    () => [
      { key: 'login', title: 'Войти', icon: 'log-in', onPress: handleLogin },
      { key: 'registration', title: 'Зарегистрироваться', icon: 'user-plus', path: '/registration' },
    ],
    [handleLogin],
  )

  const accountItems = useMemo<MenuLinkItem[]>(
    () => [
      {
        key: 'messages',
        title: unreadCount > 0 ? `Сообщения (${unreadCount})` : 'Сообщения',
        icon: 'mail',
        path: '/messages',
        strong: unreadCount > 0,
        leadingNode: (
          <MessageMenuIcon count={unreadCount} colors={colors} defaultColor={colors.textMuted} />
        ),
      },
      { key: 'subscriptions', title: 'Подписки', icon: 'users', path: '/subscriptions' },
      // #495: PDF book export is web-only (usePdfExportRuntime blocks native) — hide its entry on native.
      ...(IS_WEB
        ? [{ key: 'export', title: 'Экспорт в PDF', icon: 'file-text', path: '/export' } as MenuLinkItem]
        : []),
      { key: 'public-profile', title: 'Публичный профиль', icon: 'users', onPress: handleOpenPublicProfile },
      ...(isSuperuser
        ? [
            {
              key: 'task-board',
              title: 'Борд задач',
              icon: 'trello',
              onPress: handleOpenTaskBoard,
            } as MenuLinkItem,
          ]
        : []),
      { key: 'logout', title: 'Выход', icon: 'log-out', onPress: handleLogout },
    ],
    [colors, handleLogout, handleOpenPublicProfile, handleOpenTaskBoard, isSuperuser, unreadCount],
  )

  const profileItem = useMemo<MenuLinkItem>(
    () => ({
      key: 'profile',
      title: `Личный кабинет${favorites.length > 0 ? ` (${favorites.length})` : ''}`,
      icon: 'user',
      path: '/profile',
      strong: true,
      iconColor: colors.primaryText,
    }),
    [favorites.length, colors.primaryText],
  )

  const displayName = isAuthenticated && username ? username : 'Гость'
  const anchorLabel = `Открыть меню аккаунта ${displayName}`
  const defaultIconColor = colors.textMuted

  const renderLinks = (items: MenuLinkItem[]) =>
    items.map((item) => (
      <MenuLink
        key={item.key}
        item={item}
        styles={menuStyles}
        defaultIconColor={defaultIconColor}
        onNavigate={navigate}
      />
    ))

  return (
    <View style={wrapperStyles.ctaWrapper}>
      {!isAuthenticated && (
        <Pressable
          onPress={handleLogin}
          accessibilityRole="link"
          accessibilityLabel="Войти в аккаунт"
          style={({ pressed }) => [
            ctaStyles.ctaLoginButton,
            pressed && ctaStyles.ctaLoginButtonHover,
          ]}
          testID="header-login-cta"
        >
          <Feather name="log-in" size={14} color={colors.textOnPrimary} />
          <Text style={ctaStyles.ctaLoginText}>Войти</Text>
        </Pressable>
      )}

      <Menu
        visible={visible}
        onDismiss={closeMenu}
        contentStyle={[
          menuStyles.menuContent,
          { backgroundColor: colors.surface, borderColor: colors.borderLight },
        ]}
        anchor={
          <Pressable
            onPress={openMenu}
            onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
            onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
            accessibilityRole="button"
            accessibilityLabel={anchorLabel}
            accessibilityHint="Открыть меню аккаунта"
            accessibilityState={{ expanded: visible }}
            style={({ pressed }) => [
              anchorStyles.anchor,
              (hovered || pressed || visible) && anchorStyles.anchorHover,
            ]}
            testID="account-menu-anchor"
            {...(IS_WEB
              ? ({ 'aria-haspopup': 'menu', 'aria-expanded': visible } as any)
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
              <Feather
                name={visible ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={visible || hovered ? colors.primary : colors.textMuted}
              />
            </View>
          </Pressable>
        }
      >
        {!isAuthenticated ? (
          <>
            {renderLinks(guestItems)}
            <View style={menuStyles.sectionDivider} />
            <Text style={menuStyles.sectionTitle}>Навигация</Text>
            {renderLinks(STATIC_NAV_LINKS)}
            <View style={menuStyles.sectionDivider} />
            <Text style={menuStyles.sectionTitle}>Тема оформления</Text>
            <View style={menuStyles.themeSection}>
              <ThemeToggle compact />
            </View>
            <View style={menuStyles.sectionDivider} />
            <Text style={menuStyles.sectionTitle}>Документы</Text>
            {renderLinks(DOCUMENT_ITEMS)}
          </>
        ) : (
          <>
            <MenuLink
              item={profileItem}
              styles={menuStyles}
              defaultIconColor={defaultIconColor}
              onNavigate={navigate}
            />

            <AccountMenuSection
              title="Путешествия"
              expanded={expandedSections.travels}
              onToggle={() => toggleSection('travels')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(TRAVEL_ITEMS)}
            </AccountMenuSection>

            <AccountMenuSection
              title="Аккаунт"
              expanded={expandedSections.account}
              onToggle={() => toggleSection('account')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(accountItems)}
            </AccountMenuSection>

            <AccountMenuSection
              title="Навигация"
              expanded={expandedSections.navigation}
              onToggle={() => toggleSection('navigation')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(STATIC_NAV_LINKS)}
            </AccountMenuSection>

            <AccountMenuSection
              title="Тема оформления"
              expanded={expandedSections.theme}
              onToggle={() => toggleSection('theme')}
              colors={colors}
              styles={menuStyles}
            >
              <View style={menuStyles.themeSection}>
                <ThemeToggle compact />
              </View>
            </AccountMenuSection>

            <AccountMenuSection
              title="Документы"
              expanded={expandedSections.documents}
              onToggle={() => toggleSection('documents')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(DOCUMENT_ITEMS)}
            </AccountMenuSection>
          </>
        )}
      </Menu>
    </View>
  )
}

export default React.memo(AccountMenu)
