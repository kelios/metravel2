import { useEffect, useRef } from 'react';

interface AppProvidersDeferredRuntimeProps {
  deferAuthProvider: boolean;
  authDeferMode: 'idle' | 'interaction';
  deferFavoritesProvider: boolean;
  favoritesDeferMode: 'idle' | 'interaction';
  activationReason: 'interaction' | 'fallback';
  setAuthProviderReady: (ready: boolean) => void;
  setFavoritesReady: (ready: boolean) => void;
}

export default function AppProvidersDeferredRuntime({
  deferAuthProvider,
  authDeferMode,
  deferFavoritesProvider,
  favoritesDeferMode,
  activationReason,
  setAuthProviderReady,
  setFavoritesReady,
}: AppProvidersDeferredRuntimeProps) {
  const authBootstrapStartedRef = useRef(false);
  const favoritesBootstrapKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deferAuthProvider || typeof window === 'undefined') return;

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

    const bootstrapDelay =
      activationReason === 'interaction' ? 0 : authDeferMode === 'interaction' ? 1000 : 0;
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
    window.addEventListener('wheel', onInteraction, { passive: true, once: true });

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
      window.removeEventListener('wheel', onInteraction);
    };
  }, [activationReason, authDeferMode, deferAuthProvider]);

  useEffect(() => {
    if (!deferAuthProvider || typeof window === 'undefined') return;

    const fallbackDelay = activationReason === 'interaction' ? 0 : 1000;
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
    window.addEventListener('wheel', onInteraction, { passive: true, once: true });

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
      window.removeEventListener('wheel', onInteraction);
    };
  }, [activationReason, authDeferMode, deferAuthProvider, setAuthProviderReady]);

  useEffect(() => {
    if (!deferFavoritesProvider || typeof window === 'undefined') return;

    const fallbackDelay = activationReason === 'interaction' ? 0 : 1000;
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setFavoritesReady(true);
    }, fallbackDelay);
    let idleId: number | null = null;

    const enable = () => {
      setFavoritesReady(true);
    };

    if (favoritesDeferMode === 'idle' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(enable, { timeout: 1000 });
    }

    const onInteraction = () => enable();
    window.addEventListener('pointerdown', onInteraction, { passive: true, once: true });
    window.addEventListener('keydown', onInteraction, { passive: true, once: true });
    window.addEventListener('wheel', onInteraction, { passive: true, once: true });

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
      window.removeEventListener('wheel', onInteraction);
    };
  }, [activationReason, deferFavoritesProvider, favoritesDeferMode, setFavoritesReady]);

  useEffect(() => {
    if (!deferFavoritesProvider || typeof window === 'undefined') return;

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

    const bootstrapDelay =
      activationReason === 'interaction' ? 0 : favoritesDeferMode === 'interaction' ? 1000 : 0;
    timeoutId = setTimeout(() => {
      void bootstrap();
    }, bootstrapDelay);

    if (favoritesDeferMode === 'idle' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(() => {
        void bootstrap();
      }, { timeout: 1000 });
    }

    const onInteraction = () => {
      void bootstrap();
    };
    window.addEventListener('pointerdown', onInteraction, { passive: true, once: true });
    window.addEventListener('keydown', onInteraction, { passive: true, once: true });
    window.addEventListener('wheel', onInteraction, { passive: true, once: true });

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
      window.removeEventListener('wheel', onInteraction);
    };
  }, [activationReason, deferFavoritesProvider, favoritesDeferMode]);

  return null;
}
