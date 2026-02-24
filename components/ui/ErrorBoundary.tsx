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
const REACT_130_RECOVERY_TS_KEY = '__metravel_react130_recovery_ts';
const REACT_130_RECOVERY_COUNT_KEY = '__metravel_react130_recovery_count';
const REACT_130_RECOVERY_COOLDOWN = 30 * 1000;
const REACT_130_RECOVERY_MAX = 1;

const CORE_BUNDLE_SCRIPT_RE =
  /\/(_expo\/static\/js\/web\/(?:__expo-metro-runtime-|__common-|entry-|_layout-|index-)[^"'\s>]+\.js)/i;

function isReact130LikeError(msg: string): boolean {
  return /Minified React error #130/i.test(msg) || /Element type is invalid/i.test(msg);
}

function normalizeBundleScriptSrc(src: string): string {
  if (!src) return '';
  try {
    const url = new URL(src, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}

function getCurrentCoreBundleScripts(): string[] {
  if (typeof document === 'undefined') return [];
  const scripts = Array.from(document.querySelectorAll('script[src]'))
    .map((el) => normalizeBundleScriptSrc(el.getAttribute('src') || ''))
    .filter((src) => CORE_BUNDLE_SCRIPT_RE.test(src));
  return Array.from(new Set(scripts)).sort();
}

function getCoreBundleScriptsFromHtml(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(html)) != null) {
    const src = normalizeBundleScriptSrc(match[1] || '');
    if (src && CORE_BUNDLE_SCRIPT_RE.test(src)) {
      scripts.push(src);
    }
  }
  return Array.from(new Set(scripts)).sort();
}

function shouldAttemptReact130Recovery(): boolean {
  try {
    const now = Date.now();
    let count = parseInt(sessionStorage.getItem(REACT_130_RECOVERY_COUNT_KEY) || '0', 10);
    const prevRaw = sessionStorage.getItem(REACT_130_RECOVERY_TS_KEY);
    const prev = prevRaw ? Number(prevRaw) : 0;
    const elapsed = (prev && Number.isFinite(prev)) ? now - prev : Infinity;

    if (count >= REACT_130_RECOVERY_MAX) {
      if (elapsed >= REACT_130_RECOVERY_COOLDOWN) {
        count = 0;
        sessionStorage.setItem(REACT_130_RECOVERY_COUNT_KEY, '0');
      } else {
        return false;
      }
    }

    sessionStorage.setItem(REACT_130_RECOVERY_TS_KEY, String(now));
    sessionStorage.setItem(REACT_130_RECOVERY_COUNT_KEY, String(count + 1));
  } catch {
    // If sessionStorage is unavailable, allow one best-effort attempt.
  }

  return true;
}

async function hasFreshHtmlBundleMismatch(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;

  const currentScripts = getCurrentCoreBundleScripts();
  if (currentScripts.length === 0) return false;

  const response = await fetch(window.location.href, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'text/html' },
  });

  if (!response.ok) return false;
  const freshHtml = await response.text();
  const freshScripts = getCoreBundleScriptsFromHtml(freshHtml);
  if (freshScripts.length === 0) return false;

  if (currentScripts.length !== freshScripts.length) return true;

  const currentSet = new Set(currentScripts);
  for (const src of freshScripts) {
    if (!currentSet.has(src)) return true;
  }
  return false;
}

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

/** Shared detection for stale-chunk / module-mismatch errors after deploy.
 *  Includes both chunk-loading errors and runtime symptoms of module version
 *  mismatch (e.g. spread on undefined when an export signature changed). */
function isKnownStaleFunctionMismatch(msg: string): boolean {
  if (!/is not a function/i.test(msg)) return false;
  return (
    /(getFiltersPanelStyles|useSingleTravelExport|useSafeAreaInsets)\)\s+is not a function/i.test(msg) ||
    /(getFiltersPanelStyles|useSingleTravelExport|useSafeAreaInsets)\s+is not a function/i.test(msg)
  );
}

function isStaleModuleError(msg: string, name?: string): boolean {
  return (
    // Module / chunk loading errors
    msg.includes('Requiring unknown module') ||
    /loading chunk/i.test(msg) ||
    /loading module.*failed/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Cannot find module/i.test(msg) ||
    name === 'AsyncRequireError' ||
    // Runtime symptoms of stale-module mismatch after deploy:
    // old cached JS tries to spread/iterate a value that changed type in new modules.
    isKnownStaleFunctionMismatch(msg) ||
    /Class constructors?(?:\s+.*)?\s+cannot be invoked without 'new'/i.test(msg) ||
    /iterable/i.test(msg) ||
    /spread/i.test(msg)
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
function doStaleChunkRecovery(options: { purgeAllCaches?: boolean } = { purgeAllCaches: true }): void {
  const navigate = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_cb', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  // Safety timeout: if cleanup hangs (mobile Safari), navigate anyway after 3s.
  const safetyTimer = setTimeout(navigate, 3000);

  const cleanup = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch { /* noop */ }
    try {
      const keys = await caches.keys();
      const keysToDelete = options.purgeAllCaches === false
        ? keys.filter((k) => k.startsWith('metravel-'))
        : keys;
      await Promise.all(keysToDelete.map((k) => caches.delete(k)));
    } catch { /* noop */ }
  };
  cleanup().catch(() => {}).finally(() => {
    clearTimeout(safetyTimer);
    navigate();
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
      isStaleChunk: isStaleModuleError(msg, error?.name),
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
        // Try one deep emergency recovery before surfacing fallback UI.
        if (isAlreadyInRecoveryLoop()) {
          if (tryEmergencyRecovery()) {
            return;
          }
          this.setState({ recoveryExhausted: true }, this.scheduleExhaustedAutoRecovery);
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

      // Safe one-shot auto-recovery for React #130 only when we can confirm
      // a stale HTML ↔ bundle script mismatch in the freshly fetched document.
      if (isReact130LikeError(msg)) {
        if (isAlreadyInRecoveryLoop()) return;
        if (!shouldAttemptReact130Recovery()) return;

        void hasFreshHtmlBundleMismatch()
          .then((hasMismatch) => {
            if (!hasMismatch) return;
            if ((window as any).__metravelModuleReloadTriggered) return;
            (window as any).__metravelModuleReloadTriggered = true;
            clearRecoverySessionKeys(true, true);
            doStaleChunkRecovery({ purgeAllCaches: true });
          })
          .catch(() => {});
      }

      // Intentionally avoid auto-recovery for generic React #130 errors.
      // #130 can represent real runtime regressions (invalid/undefined element type),
      // and treating it as stale-chunk caused false-positive recovery loops.
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
                    ? 'Автоматическое восстановление продолжается. Если экран не обновится, нажмите кнопку ниже.'
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
