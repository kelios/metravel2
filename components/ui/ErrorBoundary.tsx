// Error Boundary для обработки ошибок React
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ThemeContext, getThemedColors, type ThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import {
  clearRecoverySessionState,
  isRecoveryLoopUrl,
  RECOVERY_SESSION_KEYS,
} from '@/utils/recovery/sessionRecovery';
import { evaluateRecoveryAttempt, shouldAllowRecoveryAttempt } from '@/utils/recovery/recoveryThrottle';
import { STALE_ERROR_REGEX } from '@/utils/recovery/staleErrorPattern';
import { runStaleChunkRecovery } from '@/utils/recovery/runtimeRecovery';
import { RECOVERY_COOLDOWNS, RECOVERY_RETRY_LIMITS, RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';
import { hasFreshHtmlBundleMismatch } from '@/utils/recovery/bundleScriptMismatch';

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

const EMERGENCY_RECOVERY_KEY = RECOVERY_SESSION_KEYS.emergencyRecoveryTs;
const EMERGENCY_RECOVERY_COOLDOWN = RECOVERY_COOLDOWNS.emergencyMs;
const EXHAUSTED_AUTORETRY_TS_KEY = RECOVERY_SESSION_KEYS.exhaustedAutoRetryTs;
const EXHAUSTED_AUTORETRY_COUNT_KEY = RECOVERY_SESSION_KEYS.exhaustedAutoRetryCount;
const EXHAUSTED_AUTORETRY_COOLDOWN = RECOVERY_COOLDOWNS.exhaustedAutoRetryMs;
const EXHAUSTED_AUTORETRY_MAX = RECOVERY_RETRY_LIMITS.exhaustedAutoRetry;
const EXHAUSTED_AUTORETRY_DELAY_MS = RECOVERY_TIMEOUTS.staleAutoRetryDelayMs;
const REACT_130_RECOVERY_TS_KEY = RECOVERY_SESSION_KEYS.react130RecoveryTs;
const REACT_130_RECOVERY_COUNT_KEY = RECOVERY_SESSION_KEYS.react130RecoveryCount;
const REACT_130_RECOVERY_COOLDOWN = RECOVERY_COOLDOWNS.react130Ms;
const REACT_130_RECOVERY_MAX = RECOVERY_RETRY_LIMITS.react130;

function isReact130LikeError(msg: string): boolean {
  return /Minified React error #130/i.test(msg) || /Element type is invalid/i.test(msg);
}

function shouldAttemptReact130Recovery(): boolean {
  return shouldAllowRecoveryAttempt({
    timestampKey: REACT_130_RECOVERY_TS_KEY,
    countKey: REACT_130_RECOVERY_COUNT_KEY,
    cooldownMs: REACT_130_RECOVERY_COOLDOWN,
    maxRetries: REACT_130_RECOVERY_MAX,
  });
}

function shouldScheduleExhaustedAutoRetry(): boolean {
  return shouldAllowRecoveryAttempt({
    timestampKey: EXHAUSTED_AUTORETRY_TS_KEY,
    countKey: EXHAUSTED_AUTORETRY_COUNT_KEY,
    cooldownMs: EXHAUSTED_AUTORETRY_COOLDOWN,
    maxRetries: EXHAUSTED_AUTORETRY_MAX,
  });
}

function clearRecoverySessionKeys(
  clearEmergencyKey = false,
  clearExhaustedAutoRetryKeys = false,
): void {
  clearRecoverySessionState({
    clearEmergencyKey,
    clearExhaustedAutoRetryKeys,
    clearReact130RecoveryKeys: clearExhaustedAutoRetryKeys,
  });
}

/** Shared detection for stale-chunk / module-mismatch errors after deploy.
 *  Includes both chunk-loading errors and runtime symptoms of module version
 *  mismatch (e.g. spread on undefined when an export signature changed). */
function isStaleModuleError(msg: string, name?: string): boolean {
  return (
    STALE_ERROR_REGEX.test(msg) ||
    name === 'AsyncRequireError'
  );
}

/** Check if the current page already went through stale-chunk recovery
 *  (indicated by the _cb cache-busting param in the URL). */
function isAlreadyInRecoveryLoop(): boolean {
  try {
    return isRecoveryLoopUrl(window.location.href);
  } catch { return false; }
}

/** Unregister SW, purge caches, then hard-navigate with cache-busting. */
function doStaleChunkRecovery(options: { purgeAllCaches?: boolean } = { purgeAllCaches: true }): void {
  runStaleChunkRecovery({ purgeAllCaches: options.purgeAllCaches });
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
    const EB_KEY = RECOVERY_SESSION_KEYS.errorBoundaryReloadTs;
    const EB_COUNT_KEY = RECOVERY_SESSION_KEYS.errorBoundaryReloadCount;
    const EB_COOLDOWN = RECOVERY_COOLDOWNS.staleMs;
    const MAX_EB_RETRIES = RECOVERY_RETRY_LIMITS.errorBoundary;

    const getReloadDecision = () => {
      if ((window as any).__metravelModuleReloadTriggered) {
        return { allowed: false, reason: 'cooldown' as const };
      }
      const decision = evaluateRecoveryAttempt({
        timestampKey: EB_KEY,
        countKey: EB_COUNT_KEY,
        cooldownMs: EB_COOLDOWN,
        maxRetries: MAX_EB_RETRIES,
      });
      if (!decision.allowed) return decision;
      (window as any).__metravelModuleReloadTriggered = true;
      return decision;
    };

    const tryEmergencyRecovery = () => {
      if (!shouldAllowRecoveryAttempt({
        timestampKey: EMERGENCY_RECOVERY_KEY,
        cooldownMs: EMERGENCY_RECOVERY_COOLDOWN,
      })) return false;
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
        const reloadDecision = getReloadDecision();
        if (!reloadDecision.allowed) {
          if (reloadDecision.reason === 'max_retries') {
            if (tryEmergencyRecovery()) {
              return;
            }
            this.setState({ recoveryExhausted: true }, this.scheduleExhaustedAutoRecovery);
          }
          return;
        }
        doStaleChunkRecovery();
        return; // skip further recovery attempts
      }

      // Safe one-shot auto-recovery for React #130 only when we can confirm
      // a stale HTML ↔ bundle script mismatch in the freshly fetched document.
      if (isReact130LikeError(msg)) {
        if (isAlreadyInRecoveryLoop()) return;

        void hasFreshHtmlBundleMismatch()
          .then((hasMismatch) => {
            if (!hasMismatch) return;
            if ((window as any).__metravelModuleReloadTriggered) return;
            if (!shouldAttemptReact130Recovery()) return;
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

      // Show a friendly updating UI for stale chunk errors while auto-recovery runs.
      // This MUST be checked BEFORE props.fallback so that pages with custom fallback
      // (e.g. Home, Search) still show the stale recovery UI instead of a generic
      // "Не удалось загрузить..." message that doesn't trigger cache recovery.
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
