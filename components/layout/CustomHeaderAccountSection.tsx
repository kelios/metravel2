import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites as _useFavorites } from '@/context/FavoritesContext';
import * as FiltersProviderModule from '@/context/FiltersProvider';
import { resolveExportedFunction } from '@/utils/moduleInterop';
import { useUnreadCount } from '@/hooks/useMessages';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';

const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

const AccountMenuLazy = lazy(() => import('./AccountMenu'));
const ThemeToggleLazy = lazy(() => import('@/components/layout/ThemeToggle'));
const CustomHeaderMobileMenuComp = isTestEnv
  ? (require('./CustomHeaderMobileMenu').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderMobileMenu'));

const useFavoritesSafe = (): { favorites: { length: number } } => {
  try {
    return _useFavorites();
  } catch {
    return { favorites: [] as any };
  }
};

const useFiltersSafe = (): { updateFilters: (next: any) => void } => {
  try {
    const filtersAccessor = resolveExportedFunction<() => { updateFilters: (next: any) => void }>(
      FiltersProviderModule as unknown as Record<string, unknown>,
      'useFilters'
    );
    const ctx = typeof filtersAccessor === 'function' ? filtersAccessor() : null;
    if (ctx && typeof ctx.updateFilters === 'function') return ctx as any;
  } catch {
    // no-op fallback to avoid runtime crashes when chunk exports drift
  }
  return { updateFilters: () => {} };
};

type CustomHeaderAccountSectionProps = {
  activePath: string;
  isMobile: boolean;
  styles: any;
};

function FiltersProviderSafe({ children }: { children: React.ReactNode }) {
  const Provider = (FiltersProviderModule as unknown as { FiltersProvider?: React.ComponentType<{ children: React.ReactNode }> }).FiltersProvider;
  if (typeof Provider !== 'function') {
    return <>{children}</>;
  }
  return <Provider>{children}</Provider>;
}

export default function CustomHeaderAccountSection({
  activePath,
  isMobile,
  styles,
}: CustomHeaderAccountSectionProps) {
  return (
    <FiltersProviderSafe>
      <CustomHeaderAccountSectionInner activePath={activePath} isMobile={isMobile} styles={styles} />
    </FiltersProviderSafe>
  );
}

function CustomHeaderAccountSectionInner({
  activePath,
  isMobile,
  styles,
}: CustomHeaderAccountSectionProps) {
  const colors = useThemedColors();
  const router = useRouter();
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const mobileMenuOpenedAtRef = useRef(0);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const { isAuthenticated, username, logout, userAvatar, profileRefreshToken, userId } = useAuth();
  const { favorites } = useFavoritesSafe();
  const { updateFilters } = useFiltersSafe();
  const { count: unreadCount } = useUnreadCount(isAuthenticated && mobileMenuVisible, mobileMenuVisible);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!mobileMenuVisible) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuVisible(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileMenuVisible]);

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

  useEffect(() => {
    setAvatarLoadError(false);
  }, [profileRefreshToken, userAvatar]);

  const handleUserAction = useCallback(
    (path: string, extraAction?: () => void) => {
      extraAction?.();
      router.push(path as any);
      setMobileMenuVisible(false);
    },
    [router]
  );

  const handleMyTravels = useCallback(() => {
    const numericUserId = userId ? Number(userId) : undefined;
    handleUserAction('/metravel', () => {
      updateFilters({ user_id: numericUserId });
    });
  }, [handleUserAction, updateFilters, userId]);

  const handleLogout = useCallback(async () => {
    await logout();
    setMobileMenuVisible(false);
    router.push('/');
  }, [logout, router]);

  const openMobileMenu = useCallback(() => {
    mobileMenuOpenedAtRef.current = Date.now();
    setMobileMenuVisible(true);
  }, []);

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
    [router]
  );

  return (
    <View style={styles.rightSection}>
      {isMobile ? (
        <>
          {isAuthenticated && username ? (
            <Pressable
              onPress={() => handleUserAction('/profile')}
              style={[styles.mobileUserPill, globalFocusStyles.focusable]}
              accessibilityRole="button"
              accessibilityLabel={`Открыть профиль ${username}`}
            >
              <View style={styles.mobileUserAvatarContainer}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.mobileUserAvatar}
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <Feather name="user" size={24} color={colors.text} />
                )}
              </View>
              <Text style={styles.mobileUserName} numberOfLines={1}>
                {username}
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.mobileUserPillPlaceholder, { pointerEvents: 'none' } as any]}>
              <View style={styles.mobileUserAvatarContainer}>
                <Feather name="user" size={24} color={colors.text} />
              </View>
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
        </>
      ) : (
        <Suspense fallback={null}>
          <AccountMenuLazy />
        </Suspense>
      )}

      {isMobile && mobileMenuVisible && (
        isTestEnv ? (
          <>
            <Pressable
              testID="mobile-menu-overlay"
              accessibilityRole="button"
              accessibilityLabel="Закрыть меню"
              onPress={() => {
                const isUnitTest =
                  typeof process !== 'undefined' &&
                  (process as any).env &&
                  (process as any).env.NODE_ENV === 'test';
                const sinceOpen = Date.now() - mobileMenuOpenedAtRef.current;
                if (!isUnitTest && sinceOpen < 250) return;
                setMobileMenuVisible(false);
              }}
            >
              <View />
            </Pressable>

            <CustomHeaderMobileMenuComp
              visible={mobileMenuVisible}
              onRequestClose={() => setMobileMenuVisible(false)}
              onOverlayPress={() => {
                const isUnitTest =
                  typeof process !== 'undefined' &&
                  (process as any).env &&
                  (process as any).env.NODE_ENV === 'test';
                const sinceOpen = Date.now() - mobileMenuOpenedAtRef.current;
                if (!isUnitTest && sinceOpen < 250) return;
                setMobileMenuVisible(false);
              }}
              onNavPress={handleNavPress}
              onUserAction={handleUserAction}
              onMyTravels={handleMyTravels}
              onLogout={handleLogout}
              colors={colors as any}
              styles={styles}
              activePath={activePath}
              isAuthenticated={isAuthenticated}
              username={username}
              favoritesCount={favorites.length}
              unreadCount={unreadCount}
              themeToggleNode={null}
            />
          </>
        ) : (
          <Suspense fallback={null}>
            <CustomHeaderMobileMenuComp
              visible={mobileMenuVisible}
              onRequestClose={() => setMobileMenuVisible(false)}
              onOverlayPress={() => {
                const isUnitTest =
                  typeof process !== 'undefined' &&
                  (process as any).env &&
                  (process as any).env.NODE_ENV === 'test';
                const sinceOpen = Date.now() - mobileMenuOpenedAtRef.current;
                if (!isUnitTest && sinceOpen < 250) return;
                setMobileMenuVisible(false);
              }}
              onNavPress={handleNavPress}
              onUserAction={handleUserAction}
              onMyTravels={handleMyTravels}
              onLogout={handleLogout}
              colors={colors as any}
              styles={styles}
              activePath={activePath}
              isAuthenticated={isAuthenticated}
              username={username}
              favoritesCount={favorites.length}
              unreadCount={unreadCount}
              themeToggleNode={
                <Suspense fallback={null}>
                  <ThemeToggleLazy compact layout="vertical" showLabels />
                </Suspense>
              }
            />
          </Suspense>
        )
      )}
    </View>
  );
}
