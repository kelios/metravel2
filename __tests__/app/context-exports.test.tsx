/**
 * Regression test for prod-build runtime crash:
 *   TypeError: (0 , _r(...).useFilters) is not a function
 *
 * The error occurs when the bundler/minifier breaks named exports from
 * context modules (circular deps, tree-shaking, re-export issues).
 *
 * This test imports the REAL modules (no mocks for the modules under test)
 * and verifies:
 *   1. All named exports are functions of the expected type.
 *   2. Providers compose without crashing and hooks return valid values.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Real imports (no jest.mock for these) ──────────────────────────
import useFiltersDefault,
{
  useFilters,
  FiltersProvider,
} from '@/context/FiltersProvider';
import { useAuth } from '@/context/AuthContext';

// ── Mocks for transitive deps that need native/network ─────────────
jest.mock('@/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  setAuthInvalidationHandler: jest.fn(),
}));

jest.mock('@/stores/authStore', () => {
  const state = {
    isAuthenticated: false,
    token: null,
    userId: null,
    username: '',
    email: '',
    userAvatar: null,
    authReady: false,
    profileRefreshToken: 0,
    isSuperuser: false,
    login: jest.fn(),
    logout: jest.fn(),
    checkAuthentication: jest.fn(),
    invalidateAuthState: jest.fn(),
    updateProfile: jest.fn(),
    setUserAvatar: jest.fn(),
    bumpProfileRefreshToken: jest.fn(),
    resetPassword: jest.fn(),
    setNewPassword: jest.fn(),
  };
  return {
    useAuthStore: (selector?: any) => (selector ? selector(state) : state),
  };
});

jest.mock('@/stores/favoritesStore', () => ({
  useFavoritesStore: Object.assign(
    (selector?: any) => {
      const s = {
        favorites: [],
        setFavorites: jest.fn(),
        addFavorite: jest.fn(),
        removeFavorite: jest.fn(),
        resetFetchState: jest.fn(),
        loadServerCached: jest.fn(),
        loadLocal: jest.fn(),
        ensureServerData: jest.fn(async () => {}),
        clearFavorites: jest.fn(async () => {}),
        isFavorite: jest.fn(() => false),
      };
      return selector ? selector(s) : s;
    },
    {
      getState: () => ({
        favorites: [],
        resetFetchState: jest.fn(),
        loadServerCached: jest.fn(),
        loadLocal: jest.fn(),
        ensureServerData: jest.fn(async () => {}),
        clearFavorites: jest.fn(async () => {}),
        isFavorite: jest.fn(() => false),
        addFavorite: jest.fn(async () => {}),
        removeFavorite: jest.fn(async () => {}),
      }),
    }
  ),
}));

jest.mock('@/stores/viewHistoryStore', () => ({
  useViewHistoryStore: Object.assign(
    (selector?: any) => {
      const s = {
        viewHistory: [],
        addToHistory: jest.fn(),
        clearHistory: jest.fn(async () => {}),
        resetFetchState: jest.fn(),
        loadServerCached: jest.fn(),
        loadLocal: jest.fn(),
        ensureServerData: jest.fn(async () => {}),
      };
      return selector ? selector(s) : s;
    },
    {
      getState: () => ({
        viewHistory: [],
        addToHistory: jest.fn(async () => {}),
        clearHistory: jest.fn(async () => {}),
        resetFetchState: jest.fn(),
        loadServerCached: jest.fn(),
        loadLocal: jest.fn(),
        ensureServerData: jest.fn(async () => {}),
      }),
    }
  ),
}));

jest.mock('@/stores/recommendationsStore', () => ({
  useRecommendationsStore: Object.assign(
    (selector?: any) => {
      const s = {
        recommended: [],
        getRecommendations: jest.fn(() => []),
        resetFetchState: jest.fn(),
        loadServerCached: jest.fn(),
        ensureServerData: jest.fn(async () => {}),
      };
      return selector ? selector(s) : s;
    },
    {
      getState: () => ({
        recommended: [],
        getRecommendations: jest.fn(() => []),
        resetFetchState: jest.fn(),
        loadServerCached: jest.fn(),
        ensureServerData: jest.fn(async () => {}),
      }),
    }
  ),
}));

// ────────────────────────────────────────────────────────────────────

describe('Context module exports (prod-build regression)', () => {
  describe('FiltersProvider exports', () => {
    it('exports useFilters as a function', () => {
      expect(typeof useFilters).toBe('function');
    });

    it('keeps default export alias for interop safety', () => {
      expect(useFiltersDefault).toBe(useFilters);
    });

    it('exports FiltersProvider as a function', () => {
      expect(typeof FiltersProvider).toBe('function');
    });
  });

  describe('useFilters returns valid context inside FiltersProvider', () => {
    it('returns filters and updateFilters without crashing', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <FiltersProvider>{children}</FiltersProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useFilters(), { wrapper });

      expect(result.current).toBeDefined();
      expect(typeof result.current.updateFilters).toBe('function');
      expect(result.current.filters).toBeDefined();
      expect(Array.isArray(result.current.filters.countries)).toBe(true);
      expect(Array.isArray(result.current.filters.categories)).toBe(true);
    });
  });

  describe('useFilters throws outside provider', () => {
    it('throws a descriptive error when used without FiltersProvider', () => {
      // Suppress expected console.error from renderHook error boundary
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useFilters());
      }).toThrow('useFilters must be used within a FiltersProvider');

      spy.mockRestore();
    });
  });

  describe('AppProviders composes root providers', () => {
    it('renders children with all providers without crashing', async () => {
      // Dynamic import to avoid hoisting issues with mocks
      const { default: AppProviders } = await import(
        '@/components/layout/AppProviders'
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      let rendered = false;

      function ProbeComponent() {
        rendered = true;
        return null;
      }

      const { renderHook: _unused, ...rtl } = require('@testing-library/react-native');
      const { render } = rtl;

      render(
        <AppProviders queryClient={queryClient}>
          <ProbeComponent />
        </AppProviders>
      );

      expect(rendered).toBe(true);
    });

    it('keeps useAuth callable while AuthProvider is deferred', async () => {
      const { default: AppProviders } = await import(
        '@/components/layout/AppProviders'
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      function wrapper({ children }: { children: React.ReactNode }) {
        return (
          <AppProviders
            queryClient={queryClient}
            deferAuthProvider
            authDeferMode="interaction"
          >
            {children}
          </AppProviders>
        );
      }

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.authReady).toBe(false);
    });

    it('does not use requestIdleCallback for deferred auth in interaction mode', async () => {
      jest.useFakeTimers();

      const { default: AppProviders } = await import(
        '@/components/layout/AppProviders'
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const originalRequestIdleCallback = (window as any).requestIdleCallback;
      const requestIdleCallbackMock = jest.fn(() => 1);
      (window as any).requestIdleCallback = requestIdleCallbackMock;

      try {
        const { render } = require('@testing-library/react-native');

        render(
          <AppProviders
            queryClient={queryClient}
            deferAuthProvider
            authDeferMode="interaction"
          >
            {null}
          </AppProviders>
        );

        expect(requestIdleCallbackMock).not.toHaveBeenCalled();
      } finally {
        (window as any).requestIdleCallback = originalRequestIdleCallback;
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });

    it('does not use requestIdleCallback for deferred favorites in interaction mode', async () => {
      jest.useFakeTimers();

      const { default: AppProviders } = await import(
        '@/components/layout/AppProviders'
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const originalRequestIdleCallback = (window as any).requestIdleCallback;
      const requestIdleCallbackMock = jest.fn(() => 1);
      (window as any).requestIdleCallback = requestIdleCallbackMock;

      try {
        const { render } = require('@testing-library/react-native');

        render(
          <AppProviders
            queryClient={queryClient}
            deferFavoritesProvider
            favoritesDeferMode="interaction"
          >
            {null}
          </AppProviders>
        );

        expect(requestIdleCallbackMock).not.toHaveBeenCalled();
      } finally {
        (window as any).requestIdleCallback = originalRequestIdleCallback;
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });

    it('keeps deferred providers unresolved without interaction in interaction mode even after fallback window', async () => {
      jest.useFakeTimers();

      const { default: AppProviders } = await import(
        '@/components/layout/AppProviders'
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      function wrapper({ children }: { children: React.ReactNode }) {
        return (
          <AppProviders
            queryClient={queryClient}
            deferAuthProvider
            authDeferMode="interaction"
            deferFavoritesProvider
            favoritesDeferMode="interaction"
          >
            {children}
          </AppProviders>
        );
      }

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        jest.advanceTimersByTime(15000);
      });

      expect(result.current.authReady).toBe(false);

      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });
  });
});
