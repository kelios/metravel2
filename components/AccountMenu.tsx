import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import ThemeToggle from '@/components/ThemeToggle';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useFilters } from '@/providers/FiltersProvider';
import { PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation';

function AccountMenu() {
  const { isAuthenticated, username, logout, userId, userAvatar, profileRefreshToken } = useAuth();
  const { favorites } = useFavorites();
  const { updateFilters } = useFilters();

  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const avatarUri = useMemo(() => {
    if (avatarLoadError) return null;
    const raw = String(userAvatar ?? '').trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;

    let normalized = raw;

    if (raw.startsWith('/')) {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '');
      if (base) {
        normalized = `${base}${raw}`;
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        normalized = `${window.location.origin}${raw}`;
      }
    }

    if (normalized.includes('X-Amz-') || normalized.includes('x-amz-')) {
      return normalized;
    }

    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}v=${profileRefreshToken}`;
  }, [avatarLoadError, userAvatar, profileRefreshToken]);

  React.useEffect(() => {
    setAvatarLoadError(false);
  }, [profileRefreshToken, userAvatar]);

  const openMenu = useCallback(() => setVisible(true), []);
  const closeMenu = useCallback(() => setVisible(false), []);

  const handleNavigate = useCallback(
    (path: string, extraAction?: () => void) => {
      extraAction?.();
      router.push(path as any);
      closeMenu();
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

  const anchorLabel = isAuthenticated && username ? username : 'Аккаунт';

  const navLinks = useMemo(
    () => [
      ...PRIMARY_HEADER_NAV_ITEMS.map((item) => ({
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
    <Menu
      visible={visible}
      onDismiss={closeMenu}
      contentStyle={styles.menuContent}
      anchor={
        <Pressable
          onPress={openMenu}
          onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
          onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Открыть меню аккаунта ${anchorLabel}`}
          accessibilityState={{ expanded: visible }}
          style={({ pressed }) => [
            styles.anchor,
            (hovered || pressed || visible) && styles.anchorHover,
          ]}
          testID="account-menu-anchor"
          {...(Platform.OS === 'web'
            ? ({
                // @ts-ignore
                'aria-haspopup': 'menu',
                // @ts-ignore
                'aria-expanded': visible,
              } as any)
            : {})}
        >
          <View style={styles.avatarSlot}>
            {isAuthenticated && avatarUri ? (
              <ImageCardMedia
                src={avatarUri}
                fit="cover"
                blurBackground={false}
                borderRadius={12}
                style={styles.avatar}
                loading="lazy"
                priority="low"
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <Icon name="account-circle" size={24} color="#333" />
            )}
          </View>

          <Text style={styles.anchorText} numberOfLines={1}>
            {isAuthenticated && username ? username : 'Гость'}
          </Text>

          <View style={styles.chevronSlot}>
            <Icon
              name={visible ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={visible ? '#2f5e50' : hovered ? '#2f5e50' : '#667085'}
            />
          </View>
        </Pressable>
      }
    >
      {!isAuthenticated ? (
        <>
          <Menu.Item
            onPress={() => handleNavigate('/login')}
            title="Войти"
            leadingIcon={({ size }) => <Icon name="login" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
          <Menu.Item
            onPress={() => handleNavigate('/registration')}
            title="Зарегистрироваться"
            leadingIcon={({ size }) => <Icon name="account-plus" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Навигация</Text>

          {navLinks.map((item) => (
            <Menu.Item
              key={item.key}
              onPress={() => handleNavigate(item.path)}
              title={item.title}
              leadingIcon={({ size }) => <Feather name={item.icon as any} size={size} color={styles.iconMuted.color} />}
              style={styles.menuItem}
              titleStyle={styles.menuItemTitle}
            />
          ))}

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Тема оформления</Text>

          <View style={styles.themeSection}>
            <ThemeToggle compact />
          </View>

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Документы</Text>

          <Menu.Item
            onPress={() => handleNavigate('/privacy')}
            title="Политика конфиденциальности"
            leadingIcon={({ size }) => <Icon name="shield" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
          <Menu.Item
            onPress={() => handleNavigate('/cookies')}
            title="Настройки cookies"
            leadingIcon={({ size }) => <Icon name="cookie" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
        </>
      ) : (
        <>
          <Menu.Item
            onPress={() => handleNavigate('/profile')}
            title={`Личный кабинет${favorites.length > 0 ? ` (${favorites.length})` : ''}`}
            leadingIcon={({ size }) => <Icon name="account-circle" size={size} color={styles.iconPrimary.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitleStrong}
          />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Навигация</Text>

          {navLinks.map((item) => (
            <Menu.Item
              key={item.key}
              onPress={() => handleNavigate(item.path)}
              title={item.title}
              leadingIcon={({ size }) => <Feather name={item.icon as any} size={size} color={styles.iconMuted.color} />}
              style={styles.menuItem}
              titleStyle={styles.menuItemTitle}
            />
          ))}

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Путешествия</Text>

          <Menu.Item
            onPress={() =>
              handleNavigate('/metravel', () => {
                const numericUserId = userId ? Number(userId) : undefined;
                updateFilters({ user_id: numericUserId });
              })
            }
            title="Мои путешествия"
            leadingIcon={({ size }) => <Icon name="earth" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
          <Menu.Item
            onPress={() => handleNavigate('/travel/new')}
            title="Поделиться путешествием"
            leadingIcon={({ size }) => <Icon name="share-variant" size={size} color={styles.iconPrimary.color} />}
            style={styles.menuItemPrimary}
            titleStyle={styles.menuItemTitlePrimary}
          />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Аккаунт</Text>

          <Menu.Item
            onPress={() => handleNavigate('/export')}
            title="Экспорт в PDF"
            leadingIcon={({ size }) => <Icon name="file-pdf-box" size={size} color="#b83a3a" />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
          <Menu.Item
            onPress={handleOpenPublicProfile}
            title="Публичный профиль"
            leadingIcon={({ size }) => <Icon name="account" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
          <Menu.Item
            onPress={handleLogout}
            title="Выход"
            leadingIcon={({ size }) => <Icon name="logout" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Тема оформления</Text>

          <View style={styles.themeSection}>
            <ThemeToggle compact />
          </View>

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Документы</Text>

          <Menu.Item
            onPress={() => handleNavigate('/privacy')}
            title="Политика конфиденциальности"
            leadingIcon={({ size }) => <Icon name="shield" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
          <Menu.Item
            onPress={() => handleNavigate('/cookies')}
            title="Настройки cookies"
            leadingIcon={({ size }) => <Icon name="cookie" size={size} color={styles.iconMuted.color} />}
            style={styles.menuItem}
            titleStyle={styles.menuItemTitle}
          />
        </>
      )}
    </Menu>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBFAF8',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    maxWidth: 220,
    minHeight: 44,
    // Keep a sane touch target, but do not force a wide pill on web.
    minWidth: 44,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.12)',
    ...(Platform.OS === 'web'
      ? ({
          // @ts-ignore
          cursor: 'pointer',
          // @ts-ignore
          transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease' as any,
        } as any)
      : null),
  },
  anchorHover: {
    backgroundColor: 'rgba(93, 140, 124, 0.10)',
    borderColor: 'rgba(93, 140, 124, 0.28)',
    ...(Platform.OS === 'web'
      ? ({
          // @ts-ignore
          boxShadow: '0 8px 16px rgba(17, 24, 39, 0.08)' as any,
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
    borderColor: 'rgba(17, 24, 39, 0.10)',
  },
  anchorText: {
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
  },
  chevronSlot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 280,
    borderColor: 'rgba(17, 24, 39, 0.10)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? ({
          marginTop: 4,
          // @ts-ignore
          boxShadow: '0 18px 40px rgba(17, 24, 39, 0.16), 0 6px 14px rgba(17, 24, 39, 0.10)' as any,
        } as any)
      : null),
  },
  sectionTitle: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#667085',
    fontWeight: '600',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
    marginVertical: 6,
    marginHorizontal: 12,
  },
  themeSection: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  menuItem: {
    borderRadius: 12,
    marginHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  menuItemPrimary: {
    borderRadius: 12,
    marginHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: 'rgba(93, 140, 124, 0.14)',
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#101828',
    fontWeight: '500',
  },
  menuItemTitleStrong: {
    fontSize: 16,
    color: '#101828',
    fontWeight: '600',
  },
  menuItemTitlePrimary: {
    fontSize: 16,
    color: '#2f5e50',
    fontWeight: '700',
  },
  iconMuted: {
    color: '#667085',
  },
  iconPrimary: {
    color: '#2f5e50',
  },
});

export default React.memo(AccountMenu);
