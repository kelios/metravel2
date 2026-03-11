import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const authBootstrapStartedRef = useRef(false);
  const favoritesBootstrapKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deferAuthProvider || Platform.OS !== 'web' || typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    let cancelled = false;

    const bootstrap = async () => {
      if (authBootstrapStartedRef.current) return;
      authBootstrapStartedRef.current = true;

      try {
        const { useAuthStore } = await import('@/stores/authStore');
        if (cancelled) return;

        const store = useAuthStore.getState();
        if (store.authReady) return;
        await store.checkAuthentication();
      } catch {
        authBootstrapStartedRef.current = false;
      }
    };

    const bootstrapDelay = authDeferMode === 'interaction' ? 4500 : 0;
    timeoutId = setTimeout(() => {
      void bootstrap();
    }, bootstrapDelay);

    if (authDeferMode === 'idle' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(() => {
        void bootstrap();
      }, { timeout: 1000 });
    }

    const onInteraction = () => {
      void bootstrap();
    };
    window.addEventListener('pointerdown', onInteraction, { passive: true, once: true });
    window.addEventListener('keydown', onInteraction, { passive: true, once: true });
    window.addEventListener('scroll', onInteraction, { passive: true, once: true });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
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
    if (!deferAuthProvider || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const fallbackDelay = authDeferMode === 'interaction' ? 9000 : 1400;
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

    const fallbackDelay = favoritesDeferMode === 'interaction' ? 12000 : 1800;
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

  useEffect(() => {
    if (!deferFavoritesProvider || Platform.OS !== 'web' || typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    let cancelled = false;

    const bootstrap = async () => {
      if (cancelled) return;

      try {
        const [
          authStore,
          favoritesStore,
          viewHistoryStore,
          recommendationsStore,
        ] = await Promise.all([
          import('@/stores/authStore'),
          import('@/stores/favoritesStore'),
          import('@/stores/viewHistoryStore'),
          import('@/stores/recommendationsStore'),
        ]);

        if (cancelled) return;

        const authState = authStore.useAuthStore.getState();
        const bootstrapKey = `${authState.isAuthenticated ? 'auth' : 'guest'}:${authState.userId ?? 'anon'}`;
        if (favoritesBootstrapKeyRef.current === bootstrapKey) return;
        favoritesBootstrapKeyRef.current = bootstrapKey;

        const fav = favoritesStore.useFavoritesStore.getState();
        const hist = viewHistoryStore.useViewHistoryStore.getState();
        const rec = recommendationsStore.useRecommendationsStore.getState();

        if (authState.isAuthenticated && authState.userId) {
          fav.resetFetchState(authState.userId);
          hist.resetFetchState(authState.userId);
          rec.resetFetchState(authState.userId);
          void fav.loadServerCached(authState.userId);
          void hist.loadServerCached(authState.userId);
          void rec.loadServerCached(authState.userId);
          return;
        }

        void fav.loadLocal(authState.userId);
        void hist.loadLocal(authState.userId);
      } catch {
        favoritesBootstrapKeyRef.current = null;
      }
    };

    const bootstrapDelay = favoritesDeferMode === 'interaction' ? 6500 : 0;
    timeoutId = setTimeout(() => {
      void bootstrap();
    }, bootstrapDelay);

    if (favoritesDeferMode === 'idle' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(() => {
        void bootstrap();
      }, { timeout: 1200 });
    }

    const onInteraction = () => {
      void bootstrap();
    };
    window.addEventListener('pointerdown', onInteraction, { passive: true, once: true });
    window.addEventListener('keydown', onInteraction, { passive: true, once: true });
    window.addEventListener('scroll', onInteraction, { passive: true, once: true });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
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
