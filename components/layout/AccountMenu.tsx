import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu } from '@/ui/paper';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import ThemeToggle from '@/components/layout/ThemeToggle';
import AccountMenuSection from './AccountMenuSection';
import UserAvatar from './UserAvatar';
import {
  createAnchorStyles,
  createAvatarStyles,
  createCtaLoginStyles,
  createMenuStyles,
} from './headerStyles';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useDeferredUnreadCount } from '@/hooks/useDeferredUnreadCount';
import { useAvatarUri } from '@/hooks/useAvatarUri';
import { PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

type AccountMenuProps = {
  initialOpenKey?: number
}

type MenuLinkItem = {
  key: string
  title: string
  path?: string
  icon: string
  onPress?: () => void
  strong?: boolean
  iconColor?: string
  leadingNode?: React.ReactNode
}

const renderMenuItem = (
  item: MenuLinkItem,
  menuStyles: ReturnType<typeof createMenuStyles>,
  defaultIconColor: string,
  onNavigate?: (path: string) => void,
) => (
  <Menu.Item
    key={item.key}
    onPress={item.onPress ?? (item.path && onNavigate ? () => onNavigate(item.path!) : undefined)}
    title={item.title}
    leadingIcon={({ size }) =>
      item.leadingNode ?? (
        <Feather name={item.icon as any} size={size} color={item.iconColor ?? defaultIconColor} />
      )
    }
    style={menuStyles.menuItem}
    titleStyle={item.strong ? menuStyles.menuItemTitleStrong : menuStyles.menuItemTitle}
  />
)

function AccountMenu({ initialOpenKey = 0 }: AccountMenuProps) {
  const { isAuthenticated, username, logout, userId, userAvatar, profileRefreshToken } = useAuth();
  const { favorites } = useFavorites();
  const colors = useThemedColors();
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { avatarUri, setAvatarLoadError } = useAvatarUri({ userAvatar, profileRefreshToken });
  const { count: unreadCount } = useDeferredUnreadCount(isAuthenticated && visible, visible);
  const lastHandledInitialOpenKeyRef = useRef(0);
  const [expandedSections, setExpandedSections] = useState({
    navigation: true,
    travels: true,
    account: true,
    theme: false,
    documents: false,
  });

  // Use shared styles from headerStyles.ts
  const anchorStyles = useMemo(() => createAnchorStyles(colors), [colors]);
  const avatarStyles = useMemo(() => createAvatarStyles(colors), [colors]);
  const ctaStyles = useMemo(() => createCtaLoginStyles(colors), [colors]);
  const menuStyles = useMemo(() => createMenuStyles(colors), [colors]);

  // Local styles for wrapper and icon colors
  const localStyles = useMemo(
    () =>
      StyleSheet.create({
        ctaWrapper: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        iconMuted: {
          color: colors.textMuted,
        },
        iconPrimary: {
          color: colors.primaryText,
        },
      }),
    [colors]
  );

  const openMenu = useCallback(() => setVisible(true), []);
  const closeMenu = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (initialOpenKey <= 0) return
    if (lastHandledInitialOpenKeyRef.current === initialOpenKey) return
    lastHandledInitialOpenKeyRef.current = initialOpenKey
    setVisible(true)
  }, [initialOpenKey])

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleNavigate = useCallback(
    (path: string, extraAction?: () => void) => {
      extraAction?.();
      closeMenu();
      
      // На вебе открываем все ссылки в новой вкладке
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        void openExternalUrlInNewTab(path, {
          allowRelative: true,
          baseUrl: window.location.origin,
          windowFeatures: 'noopener',
        });
      } else {
        // На мобильных используем роутер
        router.push(path as any);
      }
    },
    [closeMenu]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    closeMenu();
    router.push('/' as any);
  }, [logout, closeMenu]);

  const handleOpenPublicProfile = useCallback(() => {
    if (!userId) return;
    router.push(`/user/${userId}` as any);
  }, [userId]);

  const displayName = isAuthenticated && username ? username : 'Гость';
  const anchorLabel = `Открыть меню аккаунта ${displayName}`;

  const navLinks = useMemo(
    () => [
      ...(PRIMARY_HEADER_NAV_ITEMS ?? []).map((item) => ({
        key: `nav-${item.path}`,
        title: item.label,
        path: item.path,
        icon: item.icon,
      })),
      { key: 'nav-favorites', title: 'Избранное', path: '/favorites', icon: 'heart' },
      { key: 'nav-about', title: 'О сайте', path: '/about', icon: 'info' },
    ],
    []
  );

  const guestItems = useMemo<MenuLinkItem[]>(
    () => [
      {
        key: 'login',
        title: 'Войти',
        icon: 'log-in',
        onPress: () => handleNavigate(buildLoginHref({ intent: 'menu' })),
      },
      {
        key: 'registration',
        title: 'Зарегистрироваться',
        icon: 'user-plus',
        path: '/registration',
      },
    ],
    [handleNavigate]
  )

  const travelItems = useMemo<MenuLinkItem[]>(
    () => [
      {
        key: 'travel-new',
        title: 'Добавить путешествие',
        icon: 'plus-circle',
        path: '/travel/new',
      },
      {
        key: 'my-travels',
        title: 'Мои путешествия',
        icon: 'map',
        path: '/metravel',
      },
      {
        key: 'user-points',
        title: 'Мои точки',
        icon: 'map-pin',
        path: '/userpoints',
      },
    ],
    []
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
          <View style={{ position: 'relative' }}>
            <Feather
              name="mail"
              size={20}
              color={unreadCount > 0 ? colors.primary : localStyles.iconMuted.color}
            />
            {unreadCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: colors.textOnPrimary, fontSize: 10, fontWeight: '700' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        ),
      },
      {
        key: 'subscriptions',
        title: 'Подписки',
        icon: 'users',
        path: '/subscriptions',
      },
      {
        key: 'export',
        title: 'Экспорт в PDF',
        icon: 'file-text',
        path: '/export',
      },
      {
        key: 'public-profile',
        title: 'Публичный профиль',
        icon: 'users',
        onPress: handleOpenPublicProfile,
      },
      {
        key: 'logout',
        title: 'Выход',
        icon: 'log-out',
        onPress: handleLogout,
      },
    ],
    [colors.primary, colors.textOnPrimary, handleLogout, handleOpenPublicProfile, localStyles.iconMuted.color, unreadCount]
  )

  const documentItems = useMemo<MenuLinkItem[]>(
    () => [
      {
        key: 'privacy',
        title: 'Политика конфиденциальности',
        icon: 'shield',
        path: '/privacy',
      },
      {
        key: 'cookies',
        title: 'Настройки cookies',
        icon: 'settings',
        path: '/cookies',
      },
    ],
    []
  )

  const navigateTo = useCallback((path: string) => handleNavigate(path), [handleNavigate])

  return (
    <View style={localStyles.ctaWrapper}>
      {/* NAV-12: Отдельная CTA кнопка «Войти» для гостей — видна сразу, без открытия меню */}
      {!isAuthenticated && (
        <Pressable
          onPress={() => handleNavigate(buildLoginHref({ intent: 'menu' }))}
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
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
      ]}
      anchor={
        <Pressable
          onPress={openMenu}
          onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
          onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
          accessibilityRole="button"
          accessibilityLabel={anchorLabel}
          accessibilityHint="Открыть меню аккаунта"
          accessibilityState={{ expanded: visible }}
          style={({ pressed }) => [
            anchorStyles.anchor,
            (hovered || pressed || visible) && anchorStyles.anchorHover,
          ]}
          testID="account-menu-anchor"
          {...(Platform.OS === 'web'
            ? ({
                'aria-haspopup': 'menu',
                'aria-expanded': visible,
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
          {guestItems.map((item) =>
            renderMenuItem(item, menuStyles, localStyles.iconMuted.color, navigateTo)
          )}

          <View style={menuStyles.sectionDivider} />
          <Text style={menuStyles.sectionTitle}>Навигация</Text>

          {navLinks.map((item) =>
            renderMenuItem(item, menuStyles, localStyles.iconMuted.color, navigateTo)
          )}

          <View style={menuStyles.sectionDivider} />
          <Text style={menuStyles.sectionTitle}>Тема оформления</Text>

          <View style={menuStyles.themeSection}>
            <ThemeToggle compact />
          </View>

          <View style={menuStyles.sectionDivider} />
          <Text style={menuStyles.sectionTitle}>Документы</Text>

          {documentItems.map((item) =>
            renderMenuItem(item, menuStyles, localStyles.iconMuted.color, navigateTo)
          )}
        </>
      ) : (
        <>
          {renderMenuItem(
            {
              key: 'profile',
              title: `Личный кабинет${favorites.length > 0 ? ` (${favorites.length})` : ''}`,
              icon: 'user',
              path: '/profile',
              strong: true,
              iconColor: localStyles.iconPrimary.color,
            },
            menuStyles,
            localStyles.iconMuted.color,
            navigateTo
          )}

          <AccountMenuSection
            title="Путешествия"
            expanded={expandedSections.travels}
            onToggle={() => toggleSection('travels')}
            colors={colors}
            styles={menuStyles}
          >
            {travelItems.map((item) =>
              renderMenuItem(item, menuStyles, localStyles.iconMuted.color, navigateTo)
            )}
          </AccountMenuSection>

          <AccountMenuSection
            title="Аккаунт"
            expanded={expandedSections.account}
            onToggle={() => toggleSection('account')}
            colors={colors}
            styles={menuStyles}
          >
            {accountItems.map((item) =>
              renderMenuItem(item, menuStyles, localStyles.iconMuted.color, navigateTo)
            )}
          </AccountMenuSection>

          <AccountMenuSection
            title="Навигация"
            expanded={expandedSections.navigation}
            onToggle={() => toggleSection('navigation')}
            colors={colors}
            styles={menuStyles}
          >
            {navLinks.map((item) =>
              renderMenuItem(item, menuStyles, localStyles.iconMuted.color, navigateTo)
            )}
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
            {documentItems.map((item) =>
              renderMenuItem(item, menuStyles, localStyles.iconMuted.color, navigateTo)
            )}
          </AccountMenuSection>
        </>
      )}
    </Menu>
    </View>
  );
}

export default React.memo(AccountMenu);
