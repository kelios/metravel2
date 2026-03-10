import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { FavoritesContext, createFavoritesFallbackValue } from '@/context/FavoritesContext';
import ThemedPaperProvider from '@/components/ui/ThemedPaperProvider';

interface AppProvidersProps {
  queryClient: any;
  children: React.ReactNode;
  deferFavoritesProvider?: boolean;
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

export default function AppProviders({
  queryClient,
  children,
  deferFavoritesProvider = false,
}: AppProvidersProps) {
  const [favoritesReady, setFavoritesReady] = useState(!deferFavoritesProvider);
  const fallbackFavorites = useMemo(() => createFavoritesFallbackValue(), []);

  useEffect(() => {
    if (!deferFavoritesProvider || Platform.OS !== 'web' || typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setFavoritesReady(true);
    }, 1800);
    let idleId: number | null = null;

    const enable = () => {
      setFavoritesReady(true);
    };

    if ('requestIdleCallback' in window) {
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
  }, [deferFavoritesProvider]);

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

  return (
    <ThemedPaperProvider>
      <AuthProvider>{favoritesContent}</AuthProvider>
    </ThemedPaperProvider>
  );
}
