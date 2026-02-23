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
  isStaleChunk?: boolean;
  recoveryExhausted?: boolean;
}

const EMERGENCY_RECOVERY_KEY = '__metravel_emergency_recovery_ts';
const EMERGENCY_RECOVERY_COOLDOWN = 60 * 1000;
const EXHAUSTED_AUTORETRY_TS_KEY = '__metravel_exhausted_autoretry_ts';
const EXHAUSTED_AUTORETRY_COUNT_KEY = '__metravel_exhausted_autoretry_count';
const EXHAUSTED_AUTORETRY_COOLDOWN = 30 * 1000;
const EXHAUSTED_AUTORETRY_MAX = 3;
const EXHAUSTED_AUTORETRY_DELAY_MS = 2500;

function shouldScheduleExhaustedAutoRetry(): boolean {
  try {
    const now = Date.now();
    let count = parseInt(sessionStorage.getItem(EXHAUSTED_AUTORETRY_COUNT_KEY) || '0', 10);
    const prevRaw = sessionStorage.getItem(EXHAUSTED_AUTORETRY_TS_KEY);
    const prev = prevRaw ? Number(prevRaw) : 0;
    const elapsed = (prev && Number.isFinite(prev)) ? now - prev : Infinity;

    if (count >= EXHAUSTED_AUTORETRY_MAX) {
      if (elapsed >= EXHAUSTED_AUTORETRY_COOLDOWN) {
        count = 0;
        sessionStorage.setItem(EXHAUSTED_AUTORETRY_COUNT_KEY, '0');
      } else {
        return false;
      }
    }

    sessionStorage.setItem(EXHAUSTED_AUTORETRY_TS_KEY, String(now));
    sessionStorage.setItem(EXHAUSTED_AUTORETRY_COUNT_KEY, String(count + 1));
  } catch {
    // If sessionStorage is unavailable, allow one attempt for this runtime.
  }

  return true;
}

function clearRecoverySessionKeys(
  clearEmergencyKey = false,
  clearExhaustedAutoRetryKeys = false,
): void {
  try {
    sessionStorage.removeItem('metravel:eb:reload_ts');
    sessionStorage.removeItem('metravel:eb:reload_count');
    sessionStorage.removeItem('__metravel_chunk_reload');
    sessionStorage.removeItem('__metravel_chunk_reload_count');
    sessionStorage.removeItem('__metravel_sw_stale_reload');
    sessionStorage.removeItem('__metravel_sw_stale_reload_count');
    if (clearExhaustedAutoRetryKeys) {
      sessionStorage.removeItem(EXHAUSTED_AUTORETRY_TS_KEY);
      sessionStorage.removeItem(EXHAUSTED_AUTORETRY_COUNT_KEY);
    }
    if (clearEmergencyKey) {
      sessionStorage.removeItem(EMERGENCY_RECOVERY_KEY);
    }
  } catch { /* noop */ }
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
    /loading module.*failed/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    name === 'AsyncRequireError'
  );
}

/** Conservative one-shot heuristic for stale bundles that surface as React #130 in prod. */
function isLikelyReact130ModuleMismatch(msg: string): boolean {
  return (
    /Minified React error #130/i.test(msg) &&
    /args\[\]=undefined/i.test(msg)
  );
}

/** Check if the current page already went through stale-chunk recovery
 *  (indicated by the _cb cache-busting param in the URL). */
function isAlreadyInRecoveryLoop(): boolean {
  try {
    return new URL(window.location.href).searchParams.has('_cb');
  } catch { return false; }
}

/** Unregister SW, purge caches, then hard-navigate with cache-busting. */
function doStaleChunkRecovery(options: { purgeAllCaches?: boolean } = {}): void {
  const cleanup = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch { /* noop */ }
    try {
      const keys = await caches.keys();
      const keysToDelete = options.purgeAllCaches
        ? keys
        : keys.filter((k) => k.startsWith('metravel-'));
      await Promise.all(keysToDelete.map((k) => caches.delete(k)));
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
  private _exhaustedAutoRetryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isStaleChunk: false, recoveryExhausted: false };
  }

  componentWillUnmount(): void {
    if (this._exhaustedAutoRetryTimer != null) {
      clearTimeout(this._exhaustedAutoRetryTimer);
      this._exhaustedAutoRetryTimer = null;
    }
  }

  private scheduleExhaustedAutoRecovery = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (this._exhaustedAutoRetryTimer != null) return;
    if (!shouldScheduleExhaustedAutoRetry()) return;

    this._exhaustedAutoRetryTimer = setTimeout(() => {
      this._exhaustedAutoRetryTimer = null;
      clearRecoverySessionKeys(true);
      doStaleChunkRecovery({ purgeAllCaches: true });
    }, EXHAUSTED_AUTORETRY_DELAY_MS);
  };

  static getDerivedStateFromError(error: Error): State {
    const msg = String(error?.message ?? '');
    return {
      hasError: true,
      error,
      isStaleChunk: isStaleModuleError(msg, error?.name) || isLikelyReact130ModuleMismatch(msg),
    };
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
    const EB_KEY = 'metravel:eb:reload_ts';
    const EB_COUNT_KEY = 'metravel:eb:reload_count';
    const EB_COOLDOWN = 30000;
    const MAX_EB_RETRIES = 3;

    const shouldReload = () => {
      if ((window as any).__metravelModuleReloadTriggered) return false;
      (window as any).__metravelModuleReloadTriggered = true;
      try {
        const now = Date.now();

        // Check retry counter — give up after MAX_EB_RETRIES to prevent infinite loops
        let count = parseInt(sessionStorage.getItem(EB_COUNT_KEY) || '0', 10);
        const prevRaw = sessionStorage.getItem(EB_KEY);
        const prev = prevRaw ? Number(prevRaw) : 0;
        const elapsed = (prev && Number.isFinite(prev)) ? now - prev : Infinity;

        // Reset counters after cooldown so users aren't permanently stuck
        if (count >= MAX_EB_RETRIES) {
          if (elapsed >= EB_COOLDOWN) {
            count = 0;
            sessionStorage.setItem(EB_COUNT_KEY, '0');
          } else {
            return false;
          }
        }

        // Check cooldown — don't reload more than once per 30s
        if (elapsed < EB_COOLDOWN) return false;

        sessionStorage.setItem(EB_KEY, String(now));
        sessionStorage.setItem(EB_COUNT_KEY, String(count + 1));
      } catch { /* noop */ }
      return true;
    };

    const tryEmergencyRecovery = () => {
      try {
        const now = Date.now();
        const prevRaw = sessionStorage.getItem(EMERGENCY_RECOVERY_KEY);
        const prev = prevRaw ? Number(prevRaw) : 0;
        const elapsed = (prev && Number.isFinite(prev)) ? now - prev : Infinity;
        if (elapsed < EMERGENCY_RECOVERY_COOLDOWN) return false;
        sessionStorage.setItem(EMERGENCY_RECOVERY_KEY, String(now));
      } catch {
        // If sessionStorage is unavailable, still try one deep cleanup.
      }
      clearRecoverySessionKeys();
      doStaleChunkRecovery({ purgeAllCaches: true });
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
        // If the URL already has _cb, a previous recovery cycle didn't help.
        // Don't auto-retry — let the user see an actionable error instead.
        if (isAlreadyInRecoveryLoop()) {
          this.setState({ recoveryExhausted: true });
          return;
        }
        if (!shouldReload()) {
          if (tryEmergencyRecovery()) {
            return;
          }
          this.setState({ recoveryExhausted: true }, this.scheduleExhaustedAutoRecovery);
          return;
        }
        doStaleChunkRecovery();
        return; // skip further recovery attempts
      }

      // #130 with undefined args can be a stale module/chunk mismatch on production.
      // Run one deep auto-recovery attempt with long cooldown to avoid loops.
      if (isLikelyReact130ModuleMismatch(msg) && tryEmergencyRecovery()) {
        return;
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

      // Show a friendly updating UI for stale chunk errors while auto-recovery runs
      if (this.state.isStaleChunk && Platform.OS === 'web') {
        // If auto-recovery exhausted retries (or we're already in a recovery loop
        // indicated by _cb param), show an actionable error with manual reload button
        if (this.state.recoveryExhausted) {
          const inLoop = isAlreadyInRecoveryLoop();
          return (
            <View style={styles.container}>
              <View style={styles.content}>
                <Text style={styles.title}>Не удалось загрузить обновление</Text>
                <Text style={styles.message}>
                  {inLoop
                    ? 'Автоматическое восстановление не помогло. Нажмите кнопку ниже или очистите кеш браузера вручную.'
                    : 'Запускаем повторное автоматическое восстановление. Если через несколько секунд экран не обновится, нажмите кнопку ниже.'}
                </Text>
                <Button
                  label="Перезагрузить страницу"
                  onPress={() => {
                    clearRecoverySessionKeys(true, true);
                    // Strip _cb param and navigate to clean URL to break the loop
                    try {
                      const url = new URL(window.location.href);
                      url.searchParams.delete('_cb');
                      window.location.replace(url.toString());
                    } catch {
                      window.location.reload();
                    }
                  }}
                  style={[styles.button, styles.primaryButton]}
                  accessibilityLabel="Перезагрузить страницу"
                />
              </View>
            </View>
          );
        }
        return (
          <View style={styles.container}>
            <View style={styles.content}>
              <Text style={styles.title}>Обновление приложения…</Text>
              <Text style={styles.message}>
                Загружается новая версия. Пожалуйста, подождите.
              </Text>
              <Button
                label="Перезагрузить"
                onPress={() => {
                  clearRecoverySessionKeys(true, true);
                  doStaleChunkRecovery();
                }}
                variant="ghost"
                style={[styles.button, styles.secondaryButton]}
                accessibilityLabel="Перезагрузить страницу"
              />
            </View>
          </View>
        );
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
                    clearRecoverySessionKeys(true, true);
                    doStaleChunkRecovery({ purgeAllCaches: true });
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
                  clearRecoverySessionKeys(true, true);
                  doStaleChunkRecovery({ purgeAllCaches: true });
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
