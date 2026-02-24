// Error Boundary для обработки ошибок React
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ThemeContext, getThemedColors, type ThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import {
  clearRecoverySessionState,
  isRecoveryLoopUrl,
  isRecoveryExhausted,
  RECOVERY_SESSION_KEYS,
} from '@/utils/recovery/sessionRecovery';
import { evaluateRecoveryAttempt, shouldAllowRecoveryAttempt } from '@/utils/recovery/recoveryThrottle';
import { STALE_ERROR_REGEX } from '@/utils/recovery/staleErrorPattern';
import { runStaleChunkRecovery } from '@/utils/recovery/runtimeRecovery';
import { RECOVERY_COOLDOWNS, RECOVERY_RETRY_LIMITS, RECOVERY_TIMEOUTS } from '@/utils/recovery/recoveryConfig';
import { hasFreshHtmlBundleMismatch } from '@/utils/recovery/bundleScriptMismatch';
import { openWebWindow } from '@/utils/externalLinks';

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

const _EMERGENCY_RECOVERY_KEY = RECOVERY_SESSION_KEYS.emergencyRecoveryTs;
const _EMERGENCY_RECOVERY_COOLDOWN = RECOVERY_COOLDOWNS.emergencyMs;
const EXHAUSTED_AUTORETRY_DELAY_MS = RECOVERY_TIMEOUTS.staleAutoRetryDelayMs;
const REACT_130_RECOVERY_TS_KEY = RECOVERY_SESSION_KEYS.react130RecoveryTs;
const REACT_130_RECOVERY_COUNT_KEY = RECOVERY_SESSION_KEYS.react130RecoveryCount;
const REACT_130_RECOVERY_COOLDOWN = RECOVERY_COOLDOWNS.react130Ms;
const REACT_130_RECOVERY_MAX = RECOVERY_RETRY_LIMITS.react130;

function isReact130LikeError(msg: string): boolean {
  return /Minified React error #130/i.test(msg) || /Element type is invalid/i.test(msg);
}

function isReact130UndefinedArgsError(msg: string): boolean {
  return /args\[\]=undefined/i.test(msg);
}

function shouldAttemptReact130Recovery(): boolean {
  return shouldAllowRecoveryAttempt({
    timestampKey: REACT_130_RECOVERY_TS_KEY,
    countKey: REACT_130_RECOVERY_COUNT_KEY,
    cooldownMs: REACT_130_RECOVERY_COOLDOWN,
    maxRetries: REACT_130_RECOVERY_MAX,
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
function _isAlreadyInRecoveryLoop(): boolean {
  try {
    return isRecoveryLoopUrl(window.location.href);
  } catch { return false; }
}

/** Check if recovery attempts are exhausted (set by inline script or ErrorBoundary) */
function checkRecoveryExhausted(): boolean {
  try {
    // Only check the sessionStorage flag - _cb in URL alone doesn't mean exhausted,
    // it just means we tried recovery. User might have cleared cache and reloaded.
    return isRecoveryExhausted();
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

    // When recovery is exhausted, do a clean URL reload after a short delay.
    // Clear ALL recovery state and strip _cb so the browser starts completely fresh.
    // This avoids the dead-end "Не удалось загрузить обновление" screen.
    this._exhaustedAutoRetryTimer = setTimeout(() => {
      this._exhaustedAutoRetryTimer = null;
      clearRecoverySessionKeys(true, true);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('_cb');
        window.location.replace(url.toString());
      } catch {
        window.location.reload();
      }
    }, EXHAUSTED_AUTORETRY_DELAY_MS);
  };

  static getDerivedStateFromError(error: Error): State {
    const msg = String(error?.message ?? '');
    // Check for stale module errors OR React #130 with undefined args (stale chunk symptom)
    const isStale = isStaleModuleError(msg, error?.name) ||
      (isReact130LikeError(msg) && isReact130UndefinedArgsError(msg));
    // Check if recovery is already exhausted (from inline script or previous attempts)
    const exhausted = isStale && checkRecoveryExhausted();
    return {
      hasError: true,
      error,
      isStaleChunk: isStale,
      recoveryExhausted: exhausted,
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

    // Auto-recover from stale-bundle module mismatch errors.
    // When the SW serves cached JS chunks from a previous build, module IDs can
    // shift and named exports resolve to undefined (e.g. "useFilters is not a function").
    // Unregister the SW, purge JS caches, and hard-navigate with cache-busting.
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      if (isStaleModuleError(msg, error?.name)) {
        // Mark as stale chunk error so we show the cache clearing instructions
        this.setState({ isStaleChunk: true });
        
        // If recovery is already exhausted (from inline script or _cb param),
        // show cache clearing instructions instead of trying again.
        if (checkRecoveryExhausted()) {
          this.setState({ isStaleChunk: true, recoveryExhausted: true });
          return;
        }
        const reloadDecision = getReloadDecision();
        if (!reloadDecision.allowed) {
          // If we're already in recovery loop (_cb in URL) and recovery is blocked,
          // mark as exhausted so the UI can show cache clear instructions or auto-retry.
          const inRecoveryLoop = _isAlreadyInRecoveryLoop();
          if (reloadDecision.reason === 'max_retries' || inRecoveryLoop) {
            this.setState({ isStaleChunk: true, recoveryExhausted: true });
          }
          return;
        }
        doStaleChunkRecovery();
        return; // skip further recovery attempts
      }

      // Safe one-shot auto-recovery for React #130 only when we can confirm
      // a stale HTML ↔ bundle script mismatch in the freshly fetched document.
      if (isReact130LikeError(msg)) {
        const isUndefinedArgs130 = isReact130UndefinedArgsError(msg);

        // If recovery is already exhausted (sessionStorage flag set), show cache clear instructions
        if (isUndefinedArgs130 && checkRecoveryExhausted()) {
          this.setState({ isStaleChunk: true, recoveryExhausted: true });
          return;
        }

        // Note: We don't block on isAlreadyInRecoveryLoop() here anymore.
        // If _cb is in URL but sessionStorage is clear (user cleared cache),
        // we should try recovery again. The retry budget will prevent infinite loops.

        if (isUndefinedArgs130) {
          if ((window as any).__metravelModuleReloadTriggered) return;
          if (!shouldAttemptReact130Recovery()) {
            // Max retries reached - show cache clear instructions
            this.setState({ isStaleChunk: true, recoveryExhausted: true });
            return;
          }
          (window as any).__metravelModuleReloadTriggered = true;
          this.setState({ isStaleChunk: true });
          clearRecoverySessionState({ clearEmergencyKey: true, clearExhaustedAutoRetryKeys: true });
          doStaleChunkRecovery({ purgeAllCaches: true });
          return;
        }

        const hasSwController =
          !!(
            (typeof window !== 'undefined' && (window as any)?.navigator?.serviceWorker?.controller) ||
            (typeof globalThis !== 'undefined' && (globalThis as any)?.navigator?.serviceWorker?.controller)
          );

        void hasFreshHtmlBundleMismatch()
          .then((hasMismatch) => {
            if (!hasMismatch && !(isUndefinedArgs130 && hasSwController)) return;
            if ((window as any).__metravelModuleReloadTriggered) return;
            if (!shouldAttemptReact130Recovery()) return;
            (window as any).__metravelModuleReloadTriggered = true;
            this.setState({ isStaleChunk: true });
            clearRecoverySessionState({ clearEmergencyKey: true, clearExhaustedAutoRetryKeys: true });
            doStaleChunkRecovery({ purgeAllCaches: true });
          })
          .catch(() => {
            if (!isUndefinedArgs130 || !hasSwController) return;
            if ((window as any).__metravelModuleReloadTriggered) return;
            if (!shouldAttemptReact130Recovery()) return;
            (window as any).__metravelModuleReloadTriggered = true;
            this.setState({ isStaleChunk: true });
            clearRecoverySessionState({ clearEmergencyKey: true, clearExhaustedAutoRetryKeys: true });
            doStaleChunkRecovery({ purgeAllCaches: true });
          });
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
        // If auto-recovery exhausted retries (from inline script flag or _cb param),
        // show an actionable error with cache clearing instructions
        if (this.state.recoveryExhausted || checkRecoveryExhausted()) {
          // Schedule auto-recovery after a short delay to break the dead-end state
          this.scheduleExhaustedAutoRecovery();
          return (
            <View style={styles.container}>
              <View style={styles.content}>
                <Text style={styles.title}>Требуется очистка кэша браузера</Text>
                <Text style={styles.message}>
                  Ваш браузер сохранил устаревшую версию сайта. Для продолжения работы необходимо очистить кэш:
                </Text>
                <Text style={styles.instructions}>
                  <Text style={styles.instructionsBold}>Компьютер:{'\n'}</Text>
                  • Chrome/Edge: Ctrl+Shift+Delete → Кэш → Удалить{'\n'}
                  • Firefox: Ctrl+Shift+Delete → Кэш → Очистить{'\n'}
                  • Safari: Cmd+Option+E{'\n\n'}
                  <Text style={styles.instructionsBold}>Телефон:{'\n'}</Text>
                  • iPhone Safari: Настройки → Safari → Очистить историю и данные{'\n'}
                  • Android Chrome: ⋮ → История → Очистить данные браузера{'\n\n'}
                  <Text style={styles.instructionsBold}>Или:</Text> Откройте сайт в режиме инкогнито
                </Text>
                <Button
                  label="Открыть в инкогнито"
                  onPress={() => {
                    // Can't open incognito programmatically, but we can suggest it
                    openWebWindow('https://metravel.by', { target: '_blank' });
                  }}
                  style={[styles.button, styles.primaryButton]}
                  accessibilityLabel="Открыть в новой вкладке"
                />
                <Button
                  label="Связаться с поддержкой"
                  onPress={() => {
                    window.location.href = 'mailto:support@metravel.by?subject=Проблема с кэшем браузера';
                  }}
                  variant="ghost"
                  style={[styles.button, styles.secondaryButton]}
                  accessibilityLabel="Связаться с поддержкой"
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
  instructions: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
    textAlign: 'left',
    lineHeight: 22,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: DESIGN_TOKENS.radii.md,
    width: '100%',
  },
  instructionsBold: {
    fontWeight: '600',
    color: colors.text,
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
