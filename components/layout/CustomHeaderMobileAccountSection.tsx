import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { translate as i18nT } from '@/i18n'


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
  const pendingMenuActionRef = useRef<null | (() => void | Promise<void>)>(null);

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

  useEffect(() => {
    if (mobileMenuVisible) return;

    const pendingAction = pendingMenuActionRef.current;
    if (!pendingAction) return;

    pendingMenuActionRef.current = null;
    void pendingAction();
  }, [mobileMenuVisible]);

  const closeMenu = useCallback(() => {
    pendingMenuActionRef.current = null;
    setMobileMenuVisible(false);
  }, []);

  const closeMenuSafely = useCallback(() => {
    const sinceOpen = Date.now() - mobileMenuOpenedAtRef.current;
    if (!isUnitTestEnv() && sinceOpen < 250) return;
    pendingMenuActionRef.current = null;
    setMobileMenuVisible(false);
  }, []);

  const openMobileMenu = useCallback(() => {
    pendingMenuActionRef.current = null;
    mobileMenuOpenedAtRef.current = Date.now();
    setMobileMenuVisible(true);
  }, []);

  const runAfterMenuClose = useCallback(
    (action: () => void | Promise<void>) => {
      if (!mobileMenuVisible) {
        void action();
        return;
      }

      // On Android a React Native Modal owns a separate full-screen window.
      // Navigating first can leave the previous header's invisible window alive
      // above the destination route, where it intercepts every touch. Commit the
      // closed state first; the effect above runs the action after the Modal is gone.
      if (pendingMenuActionRef.current) return;
      pendingMenuActionRef.current = action;
      setMobileMenuVisible(false);
    },
    [mobileMenuVisible],
  );

  const handleUserAction = useCallback(
    (path: string, extraAction?: () => void) => {
      runAfterMenuClose(() => {
        extraAction?.();
        router.push(path as any);
      });
    },
    [router, runAfterMenuClose],
  );

  const handleNavPress = useCallback(
    (path: string, external?: boolean) => {
      runAfterMenuClose(() => {
        if (external) {
          if (Platform.OS === 'web') {
            openExternalUrlInNewTab(path);
          } else {
            openExternalUrl(path);
          }
          return;
        }

        router.push(path as any);
      });
    },
    [router, runAfterMenuClose],
  );

  const handleMyTravels = useCallback(() => {
    handleUserAction('/metravel');
  }, [handleUserAction]);

  const handleLogout = useCallback(() => {
    runAfterMenuClose(async () => {
      await logout();
      router.push('/');
    });
  }, [logout, router, runAfterMenuClose]);

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
          accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderMobileAccountSection.otkryt_profil_value1_4b61a725', { value1: username })}
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
        accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderMobileAccountSection.otkryt_menyu_e43b6ae3')}
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
              accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderMobileAccountSection.zakryt_menyu_b46b8503')}
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
                  <ThemeToggleLazy compact layout="horizontal" showLabels />
                </Suspense>
              }
            />
          </Suspense>
        )
      )}
    </>
  );
}
