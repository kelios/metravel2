// Error Boundary для обработки ошибок React
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ThemeContext, getThemedColors, type ThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Shared detection for stale-chunk / module-mismatch errors after deploy. */
function isStaleModuleError(msg: string, name?: string): boolean {
  return (
    msg.includes('is not a function') ||
    msg.includes('is undefined') ||
    msg.includes('Requiring unknown module') ||
    msg.includes('iterable') ||
    msg.includes('is not iterable') ||
    msg.includes('spread') ||
    /Minified React error #130/i.test(msg) ||
    /Minified React error #423/i.test(msg) ||
    /Element type is invalid.*expected a string.*but got.*undefined/i.test(msg) ||
    /loading module.*failed/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    name === 'AsyncRequireError'
  );
}

/** Unregister SW, purge metravel caches, then hard-navigate with cache-busting. */
function doStaleChunkRecovery(): void {
  const cleanup = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch { /* noop */ }
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('metravel-')).map((k) => caches.delete(k)),
      );
    } catch { /* noop */ }
  };
  cleanup().catch(() => {}).finally(() => {
    // Navigate with cache-busting param to bypass browser HTTP cache.
    // This ensures the server returns fresh HTML with new chunk hashes.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_cb', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  });
}

export default class ErrorBoundary extends Component<Props, State> {
  static contextType = ThemeContext;
  override context: React.ContextType<typeof ThemeContext> | null = null;
  private _leafletAutoRetryCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ✅ УЛУЧШЕНИЕ: Используем новый logger с поддержкой мониторинга
    const { logError } = require('@/utils/logger');
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
    this.props.onError?.(error, errorInfo);

    const msg = String(error?.message ?? '');

    const shouldReload = () => {
      if ((window as any).__metravelModuleReloadTriggered) return false;
      (window as any).__metravelModuleReloadTriggered = true;
      try {
        const EB_KEY = 'metravel:eb:reload_ts';
        const EB_COUNT_KEY = 'metravel:eb:reload_count';
        const EB_COOLDOWN = 30000;
        const MAX_EB_RETRIES = 3;
        const now = Date.now();

        // Check retry counter — give up after MAX_EB_RETRIES to prevent infinite loops
        const count = parseInt(sessionStorage.getItem(EB_COUNT_KEY) || '0', 10);
        if (count >= MAX_EB_RETRIES) return false;

        // Check cooldown — don't reload more than once per 30s
        const prevRaw = sessionStorage.getItem(EB_KEY);
        const prev = prevRaw ? Number(prevRaw) : 0;
        if (prev && Number.isFinite(prev) && now - prev < EB_COOLDOWN) return false;

        sessionStorage.setItem(EB_KEY, String(now));
        sessionStorage.setItem(EB_COUNT_KEY, String(count + 1));
      } catch { /* noop */ }
      return true;
    };

    // Auto-recover from stale-bundle module mismatch errors.
    // When the SW serves cached JS chunks from a previous build, module IDs can
    // shift and named exports resolve to undefined (e.g. "useFilters is not a function").
    // Unregister the SW, purge JS caches, and hard-navigate with cache-busting.
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      if (isStaleModuleError(msg, error?.name)) {
        if (!shouldReload()) return;
        doStaleChunkRecovery();
        return; // skip further recovery attempts
      }
    }

    // Auto-recover from Leaflet "Map container is being reused by another instance"
    // by cleaning all map containers and resetting (max 2 retries to avoid loops).
    if (
      msg.includes('reused by another instance') &&
      this._leafletAutoRetryCount < 2 &&
      typeof document !== 'undefined'
    ) {
      this._leafletAutoRetryCount += 1;
      try {
        const containers = document.querySelectorAll('[id^="metravel-leaflet-map"]');
        containers.forEach((el: any) => {
          try { delete el._leaflet_map; } catch { /* noop */ }
          try { delete el._leaflet_id; } catch { /* noop */ }
          try { if (typeof el.innerHTML === 'string') el.innerHTML = ''; } catch { /* noop */ }
        });
      } catch { /* noop */ }
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const colors = getThemedColors(this.context?.isDark ?? false);
      const styles = getStyles(colors);
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Что-то пошло не так</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'Произошла непредвиденная ошибка'}
            </Text>
            <Button
              label="Попробовать снова"
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  const errMsg = String(this.state.error?.message ?? '');
                  if (isStaleModuleError(errMsg, this.state.error?.name)) {
                    // Reset retry counters so the manual retry always works
                    try {
                      sessionStorage.removeItem('metravel:eb:reload_ts');
                      sessionStorage.removeItem('metravel:eb:reload_count');
                      sessionStorage.removeItem('__metravel_chunk_reload');
                      sessionStorage.removeItem('__metravel_chunk_reload_count');
                    } catch { /* noop */ }
                    doStaleChunkRecovery();
                    return;
                  }
                }
                this.handleReset();
              }}
              style={[styles.button, styles.primaryButton]}
              accessibilityLabel="Попробовать снова"
            />
            {Platform.OS === 'web' && (
              <Button
                label="Перезагрузить страницу"
                onPress={() => {
                  // Reset ALL retry counters and do full cleanup + cache-busting reload
                  try {
                    sessionStorage.removeItem('metravel:eb:reload_ts');
                    sessionStorage.removeItem('metravel:eb:reload_count');
                    sessionStorage.removeItem('__metravel_chunk_reload');
                    sessionStorage.removeItem('__metravel_chunk_reload_count');
                    sessionStorage.removeItem('__metravel_sw_stale_reload');
                    sessionStorage.removeItem('__metravel_sw_stale_reload_count');
                  } catch { /* noop */ }
                  doStaleChunkRecovery();
                }}
                variant="ghost"
                style={[styles.button, styles.secondaryButton]}
                accessibilityLabel="Перезагрузить страницу"
              />
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: 12,
    minWidth: 200,
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: colors.boxShadows.light,
        // @ts-ignore
        ':hover': {
          backgroundColor: colors.primaryDark,
          transform: 'translateY(-1px)',
          boxShadow: colors.boxShadows.medium,
        },
      },
    }),
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только цвет текста
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        // @ts-ignore
        ':hover': {
          backgroundColor: colors.primarySoft,
        },
      },
    }),
  },
});
