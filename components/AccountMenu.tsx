import React, { useCallback, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Divider, Menu } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useFilters } from '@/providers/FiltersProvider';
import { METRICS } from '@/constants/layout';

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
              <Image source={{ uri: avatarUri }} style={styles.avatar} onError={() => setAvatarLoadError(true)} />
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
          <Menu.Item onPress={() => handleNavigate('/login')} title="Войти" leadingIcon="login" />
          <Menu.Item onPress={() => handleNavigate('/registration')} title="Зарегистрироваться" leadingIcon="account-plus" />
          <Divider />
          <Menu.Item onPress={() => handleNavigate('/privacy')} title="Политика конфиденциальности" leadingIcon="shield" />
          <Menu.Item onPress={() => handleNavigate('/cookies')} title="Настройки cookies" leadingIcon="cookie" />
        </>
      ) : (
        <>
          <Menu.Item
            onPress={() => handleNavigate('/profile')}
            title={`Личный кабинет${favorites.length > 0 ? ` (${favorites.length})` : ''}`}
            leadingIcon={({ size }) => <Icon name="account-circle" size={size} color="#6b8e7f" />}
          />
          <Divider />
          <Menu.Item
            onPress={() =>
              handleNavigate('/metravel', () => {
                const numericUserId = userId ? Number(userId) : undefined;
                updateFilters({ user_id: numericUserId });
              })
            }
            title="Мои путешествия"
            leadingIcon={({ size }) => <Icon name="earth" size={size} color="#6aaaaa" />}
          />
          <Divider />
          <Menu.Item
            onPress={() => handleNavigate('/travel/new')}
            title="Добавить путешествие"
            leadingIcon={({ size }) => <Icon name="map-plus" size={size} color="#6aaaaa" />}
          />
          <Divider />
          <Menu.Item
            onPress={() => handleNavigate('/export')}
            title="Экспорт в PDF"
            leadingIcon={({ size }) => <Icon name="file-pdf-box" size={size} color="#b83a3a" />}
          />
          <Divider />
          <Menu.Item
            onPress={handleOpenPublicProfile}
            title="Публичный профиль"
            leadingIcon={({ size }) => <Icon name="account" size={size} color="#667085" />}
          />
          <Divider />
          <Menu.Item
            onPress={handleLogout}
            title="Выход"
            leadingIcon={({ size }) => <Icon name="logout" size={size} color="#6aaaaa" />}
          />
          <Divider />
          <Menu.Item
            onPress={() => handleNavigate('/privacy')}
            title="Политика конфиденциальности"
            leadingIcon={({ size }) => <Icon name="shield" size={size} color="#667085" />}
          />
          <Menu.Item
            onPress={() => handleNavigate('/cookies')}
            title="Настройки cookies"
            leadingIcon={({ size }) => <Icon name="cookie" size={size} color="#667085" />}
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
    borderRadius: 12,
    paddingVertical: 4,
    elevation: 5,
    minWidth: 220,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    ...(Platform.OS === 'web' ? { marginTop: METRICS.spacing.xs } : null),
  },
});

export default React.memo(AccountMenu);
