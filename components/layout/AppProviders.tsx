import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, createAuthFallbackValue } from '@/context/authContextBase';
import { FavoritesContext, createFavoritesFallbackValue } from '@/context/FavoritesContext';
import ThemedPaperProvider from '@/components/ui/ThemedPaperProvider';

interface AppProvidersProps {
  queryClient: any;
  children: React.ReactNode;
  deferAuthProvider?: boolean;
  authDeferMode?: 'idle' | 'interaction';
  deferFavoritesProvider?: boolean;
  favoritesDeferMode?: 'idle' | 'interaction';
}

const EmptyFallback = () => null;
const safeLazy = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default?: T; FavoritesProvider?: T }>,
  name?: string
) =>
  React.lazy(() =>
    loader()
      .then((mod) => ({ default: (mod.default ?? mod.FavoritesProvider ?? EmptyFallback) as T }))
      .catch((err) => {
        if (__DEV__) console.error(`[safeLazy] Failed to load ${name || 'component'}:`, err);
        return { default: EmptyFallback as T };
      })
  );

const FavoritesProviderLazy = safeLazy(
  () => import('@/context/FavoritesProvider'),
  'FavoritesProvider'
);
const AuthProviderLazy = safeLazy(
  () =>
    import('@/context/AuthContext').then((mod) => ({
      default: (mod.AuthProvider ?? mod.default ?? EmptyFallback) as React.ComponentType<any>,
    })),
  'AuthProvider'
);

export default function AppProviders({
  queryClient,
  children,
  deferAuthProvider = false,
  authDeferMode = 'idle',
  deferFavoritesProvider = false,
  favoritesDeferMode = 'idle',
}: AppProvidersProps) {
  const [authProviderReady, setAuthProviderReady] = useState(!deferAuthProvider);
  const [favoritesReady, setFavoritesReady] = useState(!deferFavoritesProvider);
  const fallbackAuth = useMemo(() => createAuthFallbackValue(), []);
  const fallbackFavorites = useMemo(() => createFavoritesFallbackValue(), []);

  useEffect(() => {
    if (!deferAuthProvider || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const fallbackDelay = authDeferMode === 'interaction' ? 5200 : 1400;
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setAuthProviderReady(true);
    }, fallbackDelay);
    let idleId: number | null = null;

    const enable = () => {
      setAuthProviderReady(true);
    };

    if (authDeferMode === 'idle' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(enable, { timeout: 1000 });
    }

    const onInteraction = () => enable();
    window.addEventListener('pointerdown', onInteraction, { passive: true, once: true });
    window.addEventListener('keydown', onInteraction, { passive: true, once: true });
    window.addEventListener('scroll', onInteraction, { passive: true, once: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      if (idleId !== null) {
        try {
          (window as any).cancelIdleCallback(idleId);
        } catch {
          // noop
        }
      }
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('scroll', onInteraction);
    };
  }, [authDeferMode, deferAuthProvider]);

  useEffect(() => {
    if (!deferFavoritesProvider || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const fallbackDelay = favoritesDeferMode === 'interaction' ? 6500 : 1800;
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setFavoritesReady(true);
    }, fallbackDelay);
    let idleId: number | null = null;

    const enable = () => {
      setFavoritesReady(true);
    };

    if (favoritesDeferMode === 'idle' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(enable, { timeout: 1200 });
    }

    const onInteraction = () => enable();
    window.addEventListener('pointerdown', onInteraction, { passive: true, once: true });
    window.addEventListener('keydown', onInteraction, { passive: true, once: true });
    window.addEventListener('scroll', onInteraction, { passive: true, once: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      if (idleId !== null) {
        try {
          (window as any).cancelIdleCallback(idleId);
        } catch {
          // noop
        }
      }
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('scroll', onInteraction);
    };
  }, [deferFavoritesProvider, favoritesDeferMode]);

  const content = (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const favoritesContent = favoritesReady ? (
    <React.Suspense fallback={<FavoritesContext.Provider value={fallbackFavorites}>{content}</FavoritesContext.Provider>}>
      <FavoritesProviderLazy>{content}</FavoritesProviderLazy>
    </React.Suspense>
  ) : (
    <FavoritesContext.Provider value={fallbackFavorites}>{content}</FavoritesContext.Provider>
  );

  const authContent = authProviderReady ? (
    <React.Suspense fallback={<AuthContext.Provider value={fallbackAuth}>{favoritesContent}</AuthContext.Provider>}>
      <AuthProviderLazy>{favoritesContent}</AuthProviderLazy>
    </React.Suspense>
  ) : (
    <AuthContext.Provider value={fallbackAuth}>{favoritesContent}</AuthContext.Provider>
  );

  return (
    <ThemedPaperProvider>
      {authContent}
    </ThemedPaperProvider>
  );
}
