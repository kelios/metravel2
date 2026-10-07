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
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';

// ── Real imports (no jest.mock for these) ──────────────────────────
// `context/FiltersProvider` (the module whose broken `useFilters` export
// motivated this test) had no app consumer left and was removed in the
// 2026-10 architecture audit; the regression coverage stays on the live
// context modules below.
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

// ────────────────────────────────────────────────────────────────────

describe('Context module exports (prod-build regression)', () => {
  describe('AuthContext exports', () => {
    it('exports useAuth as a function', () => {
      expect(typeof useAuth).toBe('function');
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

      // #2239: дети монтируются, когда LocaleProvider применил сохранённый язык.
      await waitFor(() => expect(rendered).toBe(true));
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

      // #2239: дети монтируются, когда LocaleProvider применил сохранённый язык.
      await waitFor(() => expect(result.current).toBeTruthy());
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
