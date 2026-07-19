import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { AuthContext, createAuthFallbackValue } from '@/context/authContextBase';
import { FavoritesContext, createFavoritesFallbackValue } from '@/context/FavoritesContext';
import { FavoritesProvider } from '@/context/FavoritesProvider';
import ThemedPaperProvider from '@/components/ui/ThemedPaperProvider';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { setupQueryPersistence } from '@/utils/queryPersist';

interface AppProvidersProps {
  queryClient: any;
  children: React.ReactNode;
  deferAuthProvider?: boolean;
  authDeferMode?: 'idle' | 'interaction';
  deferFavoritesProvider?: boolean;
  favoritesDeferMode?: 'idle' | 'interaction';
}

const EmptyFallback = () => null;
const safeLazy = (
  loader: () => Promise<{ default?: React.ComponentType<any>; FavoritesProvider?: React.ComponentType<any> }>,
  name?: string
) =>
  React.lazy(() =>
    // Metro async-require may return a bare thenable (no .catch) for sync-available modules
    Promise.resolve(loader())
      .then((mod) => ({ default: mod.default ?? mod.FavoritesProvider ?? EmptyFallback }))
      .catch((err) => {
        if (__DEV__) console.error(`[safeLazy] Failed to load ${name || 'component'}:`, err);
        return { default: EmptyFallback };
      })
  );

const AppProvidersDeferredRuntimeLazy = safeLazy(
  () => import('@/components/layout/AppProvidersDeferredRuntime'),
  'AppProvidersDeferredRuntime'
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
  const [deferredRuntimeReady, setDeferredRuntimeReady] = useState(
    Platform.OS !== 'web' || (!deferAuthProvider && !deferFavoritesProvider)
  );
  const [deferredRuntimeActivationReason, setDeferredRuntimeActivationReason] = useState<'interaction' | 'fallback'>('fallback');
  const fallbackAuth = useMemo(() => createAuthFallbackValue(), []);
  const fallbackFavorites = useMemo(() => createFavoritesFallbackValue(), []);

  // #1015: подключаем persist офлайн-доменов RQ поверх смонтированного клиента.
  // Идемпотентно (WeakSet-гвард внутри), restore асинхронный и не блокирует boot.
  useEffect(() => {
    if (queryClient) setupQueryPersistence(queryClient);
  }, [queryClient]);
  const shouldLoadDeferredRuntime =
    Platform.OS === 'web' && (deferAuthProvider || deferFavoritesProvider);

  useEffect(() => {
    if (!shouldLoadDeferredRuntime || typeof window === 'undefined') {
      setDeferredRuntimeReady(true);
      return;
    }

    setDeferredRuntimeReady(false);
    setDeferredRuntimeActivationReason('fallback');

    const interactionOnlyMode =
      authDeferMode === 'interaction' || favoritesDeferMode === 'interaction';
    let revealed = false;
    let revealTimer: ReturnType<typeof setTimeout> | null = interactionOnlyMode
      ? null
      : setTimeout(() => {
          if (revealed) return;
          revealed = true;
          setDeferredRuntimeActivationReason('fallback');
          setDeferredRuntimeReady(true);
        }, 1000);
    let idleId: number | null = null;

    const revealFromInteraction = () => {
      if (revealed) return;
      revealed = true;
      if (revealTimer) {
        clearTimeout(revealTimer);
        revealTimer = null;
      }
      if (idleId !== null) {
        try {
          (window as any).cancelIdleCallback(idleId);
        } catch {
          // noop
        }
        idleId = null;
      }
      setDeferredRuntimeActivationReason('interaction');
      setDeferredRuntimeReady(true);
    };

    if (!interactionOnlyMode && authDeferMode === 'idle' && favoritesDeferMode === 'idle' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(() => {
        if (revealed) return;
        revealed = true;
        if (revealTimer) {
          clearTimeout(revealTimer);
          revealTimer = null;
        }
        setDeferredRuntimeActivationReason('fallback');
        setDeferredRuntimeReady(true);
      }, { timeout: 1000 });
    }

    window.addEventListener('pointerdown', revealFromInteraction, { passive: true, once: true });
    window.addEventListener('keydown', revealFromInteraction, { once: true });
    window.addEventListener('wheel', revealFromInteraction, { passive: true, once: true });

    return () => {
      revealed = true;
      if (revealTimer) clearTimeout(revealTimer);
      if (idleId !== null) {
        try {
          (window as any).cancelIdleCallback(idleId);
        } catch {
          // noop
        }
      }
      window.removeEventListener('pointerdown', revealFromInteraction);
      window.removeEventListener('keydown', revealFromInteraction);
      window.removeEventListener('wheel', revealFromInteraction);
    };
  }, [authDeferMode, favoritesDeferMode, shouldLoadDeferredRuntime]);

  const content = (
    <QueryClientProvider client={queryClient}>
      {shouldLoadDeferredRuntime && deferredRuntimeReady && (
        <React.Suspense fallback={null}>
          <AppProvidersDeferredRuntimeLazy
            deferAuthProvider={deferAuthProvider}
            authDeferMode={authDeferMode}
            deferFavoritesProvider={deferFavoritesProvider}
            favoritesDeferMode={favoritesDeferMode}
            activationReason={deferredRuntimeActivationReason}
            setAuthProviderReady={setAuthProviderReady}
            setFavoritesReady={setFavoritesReady}
          />
        </React.Suspense>
      )}
      {children}
    </QueryClientProvider>
  );

  const favoritesContent = favoritesReady ? (
    <FavoritesProvider>{content}</FavoritesProvider>
  ) : (
    <FavoritesContext.Provider value={fallbackFavorites}>{content}</FavoritesContext.Provider>
  );

  const authContent = authProviderReady ? (
    <AuthProvider>{favoritesContent}</AuthProvider>
  ) : (
    <AuthContext.Provider value={fallbackAuth}>{favoritesContent}</AuthContext.Provider>
  );

  return (
    <LocaleProvider>
      <ThemedPaperProvider>
        {authContent}
      </ThemedPaperProvider>
    </LocaleProvider>
  );
}
