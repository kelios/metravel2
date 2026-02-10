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
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Real imports (no jest.mock for these) ──────────────────────────
import {
  FiltersProvider,
  useFilters,
} from '@/context/FiltersProvider';

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
  useFavoritesStore: (selector?: any) => {
    const s = { favorites: [], setFavorites: jest.fn(), addFavorite: jest.fn(), removeFavorite: jest.fn() };
    return selector ? selector(s) : s;
  },
}));

jest.mock('@/stores/viewHistoryStore', () => ({
  useViewHistoryStore: (selector?: any) => {
    const s = { viewHistory: [], addToHistory: jest.fn(), clearHistory: jest.fn() };
    return selector ? selector(s) : s;
  },
}));

jest.mock('@/stores/recommendationsStore', () => ({
  useRecommendationsStore: (selector?: any) => {
    const s = { recommended: [], getRecommendations: jest.fn(() => []) };
    return selector ? selector(s) : s;
  },
}));

// ────────────────────────────────────────────────────────────────────

describe('Context module exports (prod-build regression)', () => {
  describe('FiltersProvider exports', () => {
    it('exports useFilters as a function', () => {
      expect(typeof useFilters).toBe('function');
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

  describe('AppProviders composes all contexts', () => {
    it('renders children with all providers without crashing', async () => {
      // Dynamic import to avoid hoisting issues with mocks
      const { default: AppProviders } = await import(
        '@/components/layout/AppProviders'
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      let hookResult: ReturnType<typeof useFilters> | null = null;

      function ProbeComponent() {
        hookResult = useFilters();
        return null;
      }

      const { renderHook: _unused, ...rtl } = require('@testing-library/react-native');
      const { render } = rtl;

      render(
        <AppProviders queryClient={queryClient}>
          <ProbeComponent />
        </AppProviders>
      );

      expect(hookResult).not.toBeNull();
      expect(typeof hookResult!.updateFilters).toBe('function');
      expect(hookResult!.filters).toBeDefined();
    });
  });
});
