import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu } from '@/ui/paper';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import ThemeToggle from '@/components/layout/ThemeToggle';
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
          <Menu.Item
            onPress={() => handleNavigate(buildLoginHref({ intent: 'menu' }))}
            title="Войти"
            leadingIcon={({ size }) => <Feather name="log-in" size={size} color={localStyles.iconMuted.color} />}
            style={menuStyles.menuItem}
            titleStyle={menuStyles.menuItemTitle}
          />
          <Menu.Item
            onPress={() => handleNavigate('/registration')}
            title="Зарегистрироваться"
            leadingIcon={({ size }) => <Feather name="user-plus" size={size} color={localStyles.iconMuted.color} />}
            style={menuStyles.menuItem}
            titleStyle={menuStyles.menuItemTitle}
          />

          <View style={menuStyles.sectionDivider} />
          <Text style={menuStyles.sectionTitle}>Навигация</Text>

          {navLinks.map((item) => (
            <Menu.Item
              key={item.key}
              onPress={() => handleNavigate(item.path)}
              title={item.title}
              leadingIcon={({ size }) => <Feather name={item.icon as any} size={size} color={localStyles.iconMuted.color} />}
              style={menuStyles.menuItem}
              titleStyle={menuStyles.menuItemTitle}
            />
          ))}

          <View style={menuStyles.sectionDivider} />
          <Text style={menuStyles.sectionTitle}>Тема оформления</Text>

          <View style={menuStyles.themeSection}>
            <ThemeToggle compact />
          </View>

          <View style={menuStyles.sectionDivider} />
          <Text style={menuStyles.sectionTitle}>Документы</Text>

          <Menu.Item
            onPress={() => handleNavigate('/privacy')}
            title="Политика конфиденциальности"
            leadingIcon={({ size }) => <Feather name="shield" size={size} color={localStyles.iconMuted.color} />}
            style={menuStyles.menuItem}
            titleStyle={menuStyles.menuItemTitle}
          />
          <Menu.Item
            onPress={() => handleNavigate('/cookies')}
            title="Настройки cookies"
            leadingIcon={({ size }) => <Feather name="settings" size={size} color={localStyles.iconMuted.color} />}
            style={menuStyles.menuItem}
            titleStyle={menuStyles.menuItemTitle}
          />
        </>
      ) : (
        <>
          <Menu.Item
            onPress={() => handleNavigate('/profile')}
            title={`Личный кабинет${favorites.length > 0 ? ` (${favorites.length})` : ''}`}
            leadingIcon={({ size }) => <Feather name="user" size={size} color={localStyles.iconPrimary.color} />}
            style={menuStyles.menuItem}
            titleStyle={menuStyles.menuItemTitleStrong}
          />

          <View style={menuStyles.sectionDivider} />
          <Pressable onPress={() => toggleSection('travels')} style={menuStyles.sectionHeader} accessibilityRole="button" accessibilityLabel="Путешествия" accessibilityState={{ expanded: expandedSections.travels }}>
            <Text style={menuStyles.sectionHeaderText}>Путешествия</Text>
            <Feather 
              name={expandedSections.travels ? 'chevron-up' : 'chevron-down'} 
              size={14} 
              color={colors.textMuted} 
            />
          </Pressable>

          {expandedSections.travels && (
            <>
              <Menu.Item
                onPress={() => handleNavigate('/travel/new')}
                title="Добавить путешествие"
                leadingIcon={({ size }) => <Feather name="plus-circle" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
              <Menu.Item
                onPress={() => handleNavigate('/metravel')}
                title="Мои путешествия"
                leadingIcon={({ size }) => <Feather name="map" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
              <Menu.Item
                onPress={() => handleNavigate('/userpoints')}
                title="Мои точки"
                leadingIcon={({ size }) => <Feather name="map-pin" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
            </>
          )}

          <View style={menuStyles.sectionDivider} />
          <Pressable onPress={() => toggleSection('account')} style={menuStyles.sectionHeader} accessibilityRole="button" accessibilityLabel="Аккаунт" accessibilityState={{ expanded: expandedSections.account }}>
            <Text style={menuStyles.sectionHeaderText}>Аккаунт</Text>
            <Feather 
              name={expandedSections.account ? 'chevron-up' : 'chevron-down'} 
              size={14} 
              color={colors.textMuted} 
            />
          </Pressable>

          {expandedSections.account && (
            <>
              <Menu.Item
                onPress={() => handleNavigate('/messages')}
                title={unreadCount > 0 ? `Сообщения (${unreadCount})` : 'Сообщения'}
                leadingIcon={({ size }) => (
                  <View style={{ position: 'relative' }}>
                    <Feather name="mail" size={size} color={unreadCount > 0 ? colors.primary : localStyles.iconMuted.color} />
                    {unreadCount > 0 && (
                      <View style={{
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
                      }}>
                        <Text style={{ color: colors.textOnPrimary, fontSize: 10, fontWeight: '700' }}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                style={menuStyles.menuItem}
                titleStyle={unreadCount > 0 ? menuStyles.menuItemTitleStrong : menuStyles.menuItemTitle}
              />
              <Menu.Item
                onPress={() => handleNavigate('/subscriptions')}
                title="Подписки"
                leadingIcon={({ size }) => <Feather name="users" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
              <Menu.Item
                onPress={() => handleNavigate('/export')}
                title="Экспорт в PDF"
                leadingIcon={({ size }) => <Feather name="file-text" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
              <Menu.Item
                onPress={handleOpenPublicProfile}
                title="Публичный профиль"
                leadingIcon={({ size }) => <Feather name="users" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
              <Menu.Item
                onPress={handleLogout}
                title="Выход"
                leadingIcon={({ size }) => <Feather name="log-out" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
            </>
          )}

          <View style={menuStyles.sectionDivider} />
          <Pressable onPress={() => toggleSection('navigation')} style={menuStyles.sectionHeader} accessibilityRole="button" accessibilityLabel="Навигация" accessibilityState={{ expanded: expandedSections.navigation }}>
            <Text style={menuStyles.sectionHeaderText}>Навигация</Text>
            <Feather 
              name={expandedSections.navigation ? 'chevron-up' : 'chevron-down'} 
              size={14} 
              color={colors.textMuted} 
            />
          </Pressable>

          {expandedSections.navigation && (navLinks ?? []).map((item) => (
            <Menu.Item
              key={item.key}
              onPress={() => handleNavigate(item.path)}
              title={item.title}
              leadingIcon={({ size }) => <Feather name={item.icon as any} size={size} color={localStyles.iconMuted.color} />}
              style={menuStyles.menuItem}
              titleStyle={menuStyles.menuItemTitle}
            />
          ))}

          <View style={menuStyles.sectionDivider} />
          <Pressable onPress={() => toggleSection('theme')} style={menuStyles.sectionHeader} accessibilityRole="button" accessibilityLabel="Тема оформления" accessibilityState={{ expanded: expandedSections.theme }}>
            <Text style={menuStyles.sectionHeaderText}>Тема оформления</Text>
            <Feather 
              name={expandedSections.theme ? 'chevron-up' : 'chevron-down'} 
              size={14} 
              color={colors.textMuted} 
            />
          </Pressable>

          {expandedSections.theme && (
            <View style={menuStyles.themeSection}>
              <ThemeToggle compact />
            </View>
          )}

          <View style={menuStyles.sectionDivider} />
          <Pressable onPress={() => toggleSection('documents')} style={menuStyles.sectionHeader} accessibilityRole="button" accessibilityLabel="Документы" accessibilityState={{ expanded: expandedSections.documents }}>
            <Text style={menuStyles.sectionHeaderText}>Документы</Text>
            <Feather 
              name={expandedSections.documents ? 'chevron-up' : 'chevron-down'} 
              size={14} 
              color={colors.textMuted} 
            />
          </Pressable>

          {expandedSections.documents && (
            <>
              <Menu.Item
                onPress={() => handleNavigate('/privacy')}
                title="Политика конфиденциальности"
                leadingIcon={({ size }) => <Feather name="shield" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
              <Menu.Item
                onPress={() => handleNavigate('/cookies')}
                title="Настройки cookies"
                leadingIcon={({ size }) => <Feather name="settings" size={size} color={localStyles.iconMuted.color} />}
                style={menuStyles.menuItem}
                titleStyle={menuStyles.menuItemTitle}
              />
            </>
          )}
        </>
      )}
    </Menu>
    </View>
  );
}

export default React.memo(AccountMenu);
