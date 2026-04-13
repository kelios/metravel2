import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites as _useFavorites } from '@/context/FavoritesContext';
import { useDeferredUnreadCount } from '@/hooks/useDeferredUnreadCount';
import { useThemedColors } from '@/hooks/useTheme';
import { useAvatarUri } from '@/hooks/useAvatarUri';
import { globalFocusStyles } from '@/styles/globalFocus';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';
import UserAvatar from './UserAvatar';
import {
  CustomHeaderMobileMenuComp,
  isHeaderMobileMenuTestEnv,
  ThemeToggleLazy,
} from './customHeaderMobileLazy';

const useFavoritesSafe = (): { favorites: { length: number } } => {
  try {
    return _useFavorites();
  } catch {
    return { favorites: [] as any };
  }
};

const isUnitTestEnv = () =>
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

const useCustomHeaderMobileMenuController = ({ logout }: { logout: () => Promise<void> | void }) => {
  const router = useRouter();
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const mobileMenuOpenedAtRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || !mobileMenuVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuVisible(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileMenuVisible]);

  const closeMenu = useCallback(() => {
    setMobileMenuVisible(false);
  }, []);

  const closeMenuSafely = useCallback(() => {
    const sinceOpen = Date.now() - mobileMenuOpenedAtRef.current;
    if (!isUnitTestEnv() && sinceOpen < 250) return;
    setMobileMenuVisible(false);
  }, []);

  const openMobileMenu = useCallback(() => {
    mobileMenuOpenedAtRef.current = Date.now();
    setMobileMenuVisible(true);
  }, []);

  const handleUserAction = useCallback(
    (path: string, extraAction?: () => void) => {
      extraAction?.();
      router.push(path as any);
      setMobileMenuVisible(false);
    },
    [router],
  );

  const handleNavPress = useCallback(
    (path: string, external?: boolean) => {
      if (external) {
        if (Platform.OS === 'web') {
          openExternalUrlInNewTab(path);
        } else {
          openExternalUrl(path);
        }
        setMobileMenuVisible(false);
        return;
      }

      router.push(path as any);
      setMobileMenuVisible(false);
    },
    [router],
  );

  const handleMyTravels = useCallback(() => {
    handleUserAction('/metravel');
  }, [handleUserAction]);

  const handleLogout = useCallback(async () => {
    await logout();
    setMobileMenuVisible(false);
    router.push('/');
  }, [logout, router]);

  return {
    closeMenu,
    closeMenuSafely,
    handleLogout,
    handleMyTravels,
    handleNavPress,
    handleUserAction,
    mobileMenuVisible,
    openMobileMenu,
  };
};

type CustomHeaderMobileAccountSectionProps = {
  activePath: string;
  styles: any;
};

export default function CustomHeaderMobileAccountSection({
  activePath,
  styles,
}: CustomHeaderMobileAccountSectionProps) {
  const colors = useThemedColors();
  const { isAuthenticated, username, logout, userAvatar, profileRefreshToken } = useAuth();
  const { avatarUri, setAvatarLoadError } = useAvatarUri({ userAvatar, profileRefreshToken });
  const { favorites } = useFavoritesSafe();
  const {
    closeMenu,
    closeMenuSafely,
    handleLogout,
    handleMyTravels,
    handleNavPress,
    handleUserAction,
    mobileMenuVisible,
    openMobileMenu,
  } = useCustomHeaderMobileMenuController({ logout });
  const { count: unreadCount } = useDeferredUnreadCount(
    isAuthenticated && mobileMenuVisible,
    mobileMenuVisible
  );

  const menuProps = useMemo(
    () => ({
      visible: mobileMenuVisible,
      onRequestClose: closeMenu,
      onOverlayPress: closeMenuSafely,
      onNavPress: handleNavPress,
      onUserAction: handleUserAction,
      onMyTravels: handleMyTravels,
      onLogout: handleLogout,
      colors: colors as any,
      styles,
      activePath,
      isAuthenticated,
      username,
      favoritesCount: favorites.length,
      unreadCount,
    }),
    [
      activePath,
      closeMenu,
      closeMenuSafely,
      colors,
      favorites.length,
      handleLogout,
      handleMyTravels,
      handleNavPress,
      handleUserAction,
      isAuthenticated,
      mobileMenuVisible,
      styles,
      unreadCount,
      username,
    ]
  );

  return (
    <>
      {isAuthenticated && username ? (
        <Pressable
          onPress={() => handleUserAction('/profile')}
          style={[styles.mobileUserPill, globalFocusStyles.focusable]}
          accessibilityRole="button"
          accessibilityLabel={`Открыть профиль ${username}`}
        >
          <UserAvatar
            uri={avatarUri}
            size="md"
            onError={() => setAvatarLoadError(true)}
          />
          <Text style={styles.mobileUserName} numberOfLines={1}>
            {username}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.mobileUserPillPlaceholder, { pointerEvents: 'none' } as any]}>
          <UserAvatar uri={null} size="md" />
          <Text style={styles.mobileUserName} numberOfLines={1}>
            {' '}
          </Text>
        </View>
      )}

      <Pressable
        onPress={openMobileMenu}
        style={[styles.mobileMenuButton, globalFocusStyles.focusable]}
        accessibilityRole="button"
        accessibilityLabel="Открыть меню"
        testID="mobile-menu-open"
      >
        <View style={styles.iconSlot24}>
          <Feather name="menu" size={24} color={colors.text} />
        </View>
      </Pressable>

      {mobileMenuVisible && (
        isHeaderMobileMenuTestEnv ? (
          <>
            <Pressable
              testID="mobile-menu-overlay"
              accessibilityRole="button"
              accessibilityLabel="Закрыть меню"
              onPress={closeMenuSafely}
            >
              <View />
            </Pressable>

            <CustomHeaderMobileMenuComp
              {...menuProps}
              themeToggleNode={null}
            />
          </>
        ) : (
          <Suspense fallback={null}>
            <CustomHeaderMobileMenuComp
              {...menuProps}
              themeToggleNode={
                <Suspense fallback={null}>
                  <ThemeToggleLazy compact layout="vertical" showLabels />
                </Suspense>
              }
            />
          </Suspense>
        )
      )}
    </>
  );
}
