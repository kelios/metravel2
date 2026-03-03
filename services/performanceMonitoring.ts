// services/performanceMonitoring.ts
// AND-25: Performance monitoring service.
// Integrates with Sentry (if DSN configured) for crash reporting and performance tracing.
// Gracefully degrades to no-op if Sentry DSN is not set or module not available.

import { Platform } from 'react-native';
import { devWarn } from '@/utils/logger';

let SentryModule: any = null;
let isInitialized = false;

/**
 * Initialize Sentry performance monitoring.
 * Must be called once at app startup. No-op if SENTRY_DSN is not configured.
 */
export function initPerformanceMonitoring(): void {
  if (isInitialized) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) {
      devWarn('[Performance] EXPO_PUBLIC_SENTRY_DSN not set — monitoring disabled');
    }
    isInitialized = true;
    return;
  }

  try {
    if (Platform.OS === 'web') {
      // On web, use @sentry/react (lighter weight)
      SentryModule = require('@sentry/react');
    } else {
      // On native, use @sentry/react-native
      SentryModule = require('@sentry/react-native');
    }

    SentryModule.init({
      dsn,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 20% in production
      profilesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% profiling in production
      environment: __DEV__ ? 'development' : 'production',
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      // Reduce noise in production
      beforeSend(event: any) {
        // Don't send events in dev
        if (__DEV__) return null;
        return event;
      },
    });

    isInitialized = true;
  } catch (error: unknown) {
    // Sentry not installed — graceful no-op
    if (__DEV__) {
      devWarn('[Performance] Sentry not available:', error);
    }
    isInitialized = true;
  }
}

/**
 * Capture a custom performance transaction.
 * Useful for measuring screen render times, API call durations, etc.
 */
export function startTransaction(name: string, op: string): PerformanceTransaction {
  if (!SentryModule) {
    return { finish: () => {}, setTag: () => {}, setData: () => {} };
  }

  try {
    const transaction = SentryModule.startTransaction({ name, op });
    return {
      finish: () => {
        try { transaction.finish(); } catch { /* noop */ }
      },
      setTag: (key: string, value: string) => {
        try { transaction.setTag(key, value); } catch { /* noop */ }
      },
      setData: (key: string, value: unknown) => {
        try { transaction.setData(key, value); } catch { /* noop */ }
      },
    };
  } catch {
    return { finish: () => {}, setTag: () => {}, setData: () => {} };
  }
}

/**
 * Capture an exception in Sentry.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!SentryModule) return;

  try {
    if (context) {
      SentryModule.withScope((scope: any) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        SentryModule.captureException(error);
      });
    } else {
      SentryModule.captureException(error);
    }
  } catch {
    // noop
  }
}

/**
 * Set user context for Sentry (after login).
 */
export function setUser(user: { id: string | number; email?: string; name?: string } | null): void {
  if (!SentryModule) return;

  try {
    SentryModule.setUser(
      user
        ? { id: String(user.id), email: user.email, username: user.name }
        : null,
    );
  } catch {
    // noop
  }
}

/**
 * Add a breadcrumb (navigation, user action, etc.).
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!SentryModule) return;

  try {
    SentryModule.addBreadcrumb({ category, message, data, level: 'info' });
  } catch {
    // noop
  }
}

/** Lightweight transaction handle */
export interface PerformanceTransaction {
  finish: () => void;
  setTag: (key: string, value: string) => void;
  setData: (key: string, value: unknown) => void;
}

