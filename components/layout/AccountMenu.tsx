import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'

import { DialogMenu } from '@/ui/paper'
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
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { translate as i18nT } from '@/i18n'


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
  { key: 'nav-favorites', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.hochu_poehat_fa6b46d5') }, path: '/favorites', icon: 'heart' },
  { key: 'nav-history', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.vy_smotreli_7405801e') }, path: '/history', icon: 'clock' },
  { key: 'nav-about', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.o_sayte_50990f19') }, path: '/about', icon: 'info' },
  ...SECONDARY_HEADER_NAV_ITEMS.map((item) => ({
    key: `nav-${item.path}`,
    title: item.label,
    path: item.path,
    icon: item.icon,
  })),
]

const TRAVEL_ITEMS: MenuLinkItem[] = [
  { key: 'travel-new', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.dobavit_puteshestvie_bebd3820') }, icon: 'plus-circle', path: '/travel/new' },
  { key: 'my-travels', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.moi_puteshestviya_a530e844') }, icon: 'map', path: '/metravel' },
  { key: 'user-points', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.moi_tochki_902be7fb') }, icon: 'map-pin', path: '/userpoints' },
]

const DOCUMENT_ITEMS: MenuLinkItem[] = [
  { key: 'privacy', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.politika_konfidentsialnosti_7622d4e2') }, icon: 'shield', path: '/privacy' },
  { key: 'cookies', get title() { return i18nT('navigationStatic:components.layout.AccountMenu.nastroyki_cookies_a3a9b803') }, icon: 'settings', path: '/cookies' },
]

const wrapperStyles = StyleSheet.create({
  ctaWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeAnchor: { position: 'relative' },
  menuLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  menuLinkPressed: { opacity: 0.72 },
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
    <Pressable
      onPress={onPress}
      accessibilityRole={item.path ? 'link' : 'button'}
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        styles.menuItem,
        wrapperStyles.menuLink,
        pressed && wrapperStyles.menuLinkPressed,
      ]}
    >
      {item.leadingNode ?? (
          <NavigationIcon
            name={item.icon}
            size={20}
            color={item.iconColor ?? defaultIconColor}
          />
      )}
      <Text style={item.strong ? styles.menuItemTitleStrong : styles.menuItemTitle}>
        {item.title}
      </Text>
    </Pressable>
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

  const handleRegister = useCallback(() => {
    trackRegisterCtaClicked({ source: 'account_menu', intent: 'menu', authState: 'guest' })
    navigate('/registration')
  }, [navigate])

  const guestItems = useMemo<MenuLinkItem[]>(
    () => [
      { key: 'login', title: i18nT('navigation:components.layout.AccountMenu.voyti_d3fdfdb5'), icon: 'log-in', onPress: handleLogin },
      { key: 'registration', title: i18nT('navigation:components.layout.AccountMenu.zaregistrirovatsya_36130f31'), icon: 'user-plus', onPress: handleRegister },
    ],
    [handleLogin, handleRegister],
  )

  const accountItems = useMemo<MenuLinkItem[]>(
    () => [
      {
        key: 'messages',
        title: unreadCount > 0 ? i18nT('navigation:components.layout.AccountMenu.soobscheniya_value1_a08d8c49', { value1: unreadCount }) : i18nT('navigation:components.layout.AccountMenu.soobscheniya_644700aa'),
        icon: 'mail',
        path: '/messages',
        strong: unreadCount > 0,
        leadingNode: (
          <MessageMenuIcon count={unreadCount} colors={colors} defaultColor={colors.textMuted} />
        ),
      },
      { key: 'subscriptions', title: i18nT('navigation:components.layout.AccountMenu.podpiski_980979f1'), icon: 'user-check', path: '/subscriptions' },
      // #495: PDF book export is web-only (usePdfExportRuntime blocks native) — hide its entry on native.
      ...(IS_WEB
        ? [{ key: 'export', title: i18nT('navigation:components.layout.AccountMenu.eksport_v_pdf_234b675b'), icon: 'file-text', path: '/export' } as MenuLinkItem]
        : []),
      { key: 'public-profile', title: i18nT('navigation:components.layout.AccountMenu.publichnyy_profil_b0c7fc3b'), icon: 'globe', onPress: handleOpenPublicProfile },
      ...(isSuperuser
        ? [
            {
              key: 'task-board',
              title: i18nT('navigation:components.layout.AccountMenu.bord_zadach_c032c12d'),
              icon: 'trello',
              onPress: handleOpenTaskBoard,
            } as MenuLinkItem,
          ]
        : []),
      { key: 'logout', title: i18nT('navigation:components.layout.AccountMenu.vyhod_fc2f589e'), icon: 'log-out', onPress: handleLogout },
    ],
    [colors, handleLogout, handleOpenPublicProfile, handleOpenTaskBoard, isSuperuser, unreadCount],
  )

  const profileItem = useMemo<MenuLinkItem>(
    () => ({
      key: 'profile',
      title: i18nT('navigation:components.layout.AccountMenu.lichnyy_kabinet_value1_30ade467', { value1: favorites.length > 0 ? ` (${favorites.length})` : '' }),
      icon: 'user',
      path: '/profile',
      strong: true,
      iconColor: colors.primaryText,
    }),
    [favorites.length, colors.primaryText],
  )

  const displayName = isAuthenticated && username ? username : i18nT('navigation:components.layout.AccountMenu.gost_3cdc2ca8')
  const anchorLabel = i18nT('navigation:components.layout.AccountMenu.otkryt_menyu_akkaunta_value1_21f7b65f', { value1: displayName })
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
          accessibilityLabel={i18nT('navigation:components.layout.AccountMenu.voyti_v_akkaunt_db700823')}
          style={({ pressed }) => [
            ctaStyles.ctaLoginButton,
            pressed && ctaStyles.ctaLoginButtonHover,
          ]}
          testID="header-login-cta"
        >
          <Feather name="log-in" size={14} color={colors.textOnPrimary} />
          <Text style={ctaStyles.ctaLoginText}>{i18nT('navigation:components.layout.AccountMenu.voyti_d3fdfdb5')}</Text>
        </Pressable>
      )}

      <DialogMenu
        visible={visible}
        onDismiss={closeMenu}
        accessibilityLabel={anchorLabel}
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
            accessibilityHint={i18nT('navigation:components.layout.AccountMenu.otkryt_menyu_akkaunta_4d1ebb59')}
            accessibilityState={{ expanded: visible }}
            style={({ pressed }) => [
              anchorStyles.anchor,
              (hovered || pressed || visible) && anchorStyles.anchorHover,
            ]}
            testID="account-menu-anchor"
            {...(IS_WEB
              ? ({ 'aria-haspopup': 'dialog', 'aria-expanded': visible } as any)
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
            <Text style={menuStyles.sectionTitle}>{i18nT('navigation:components.layout.AccountMenu.navigatsiya_13ffe5a4')}</Text>
            {renderLinks(STATIC_NAV_LINKS)}
            <View style={menuStyles.sectionDivider} />
            <Text style={menuStyles.sectionTitle}>{i18nT('navigation:components.layout.AccountMenu.tema_oformleniya_06b0d02a')}</Text>
            <View style={menuStyles.themeSection}>
              <ThemeToggle compact />
            </View>
            <View style={menuStyles.sectionDivider} />
            <Text style={menuStyles.sectionTitle}>{i18nT('navigation:components.layout.AccountMenu.dokumenty_9a7a7063')}</Text>
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
              title={i18nT('navigation:components.layout.AccountMenu.puteshestviya_28956c1f')}
              expanded={expandedSections.travels}
              onToggle={() => toggleSection('travels')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(TRAVEL_ITEMS)}
            </AccountMenuSection>

            <AccountMenuSection
              title={i18nT('navigation:components.layout.AccountMenu.akkaunt_1a726b3b')}
              expanded={expandedSections.account}
              onToggle={() => toggleSection('account')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(accountItems)}
            </AccountMenuSection>

            <AccountMenuSection
              title={i18nT('navigation:components.layout.AccountMenu.navigatsiya_13ffe5a4')}
              expanded={expandedSections.navigation}
              onToggle={() => toggleSection('navigation')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(STATIC_NAV_LINKS)}
            </AccountMenuSection>

            <AccountMenuSection
              title={i18nT('navigation:components.layout.AccountMenu.tema_oformleniya_06b0d02a')}
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
              title={i18nT('navigation:components.layout.AccountMenu.dokumenty_9a7a7063')}
              expanded={expandedSections.documents}
              onToggle={() => toggleSection('documents')}
              colors={colors}
              styles={menuStyles}
            >
              {renderLinks(DOCUMENT_ITEMS)}
            </AccountMenuSection>
          </>
        )}
      </DialogMenu>
    </View>
  )
}

export default React.memo(AccountMenu)
