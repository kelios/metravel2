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
        }, 1200);
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
      }, { timeout: 1200 });
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
