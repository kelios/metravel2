// Error Boundary для обработки ошибок React
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ThemeContext, getThemedColors, type ThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import {
  clearRecoverySessionState,
} from '@/utils/recovery/sessionRecovery';
import { STALE_ERROR_REGEX } from '@/utils/recovery/staleErrorPattern';
import { runStaleChunkRecovery } from '@/utils/recovery/runtimeRecovery';
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

function isReact130LikeError(msg: string): boolean {
  return /Minified React error #130/i.test(msg) || /Element type is invalid/i.test(msg);
}

function isReact130UndefinedArgsError(msg: string): boolean {
  return /args\[\]=undefined/i.test(msg);
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

/** Unregister SW, purge caches, then hard-navigate with cache-busting. */
function doStaleChunkRecovery(options: { purgeAllCaches?: boolean } = { purgeAllCaches: true }): void {
  runStaleChunkRecovery({ purgeAllCaches: options.purgeAllCaches });
}

export default class ErrorBoundary extends Component<Props, State> {
  static contextType = ThemeContext;
  override context: React.ContextType<typeof ThemeContext> | null = null;
  private _leafletAutoRetryCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isStaleChunk: false, recoveryExhausted: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const msg = String(error?.message ?? '');
    // Check for stale module errors OR React #130 with undefined args (stale chunk symptom)
    const isStale = isStaleModuleError(msg, error?.name) ||
      (isReact130LikeError(msg) && isReact130UndefinedArgsError(msg));
    return {
      hasError: true,
      error,
      isStaleChunk: isStale,
      recoveryExhausted: false,
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
    // Auto-recover from stale-bundle module mismatch errors.
    // When the SW serves cached JS chunks from a previous build, module IDs can
    // shift and named exports resolve to undefined (e.g. "useFilters is not a function").
    // Unregister the SW, purge JS caches, and hard-navigate with cache-busting.
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      if (isStaleModuleError(msg, error?.name)) {
        // Simplified behavior: show stable UI; user can trigger a single hard reload.
        this.setState({ isStaleChunk: true, recoveryExhausted: true });
        return;
      }

      // Safe one-shot auto-recovery for React #130 only when we can confirm
      // a stale HTML ↔ bundle script mismatch in the freshly fetched document.
      if (isReact130LikeError(msg)) {
        const isUndefinedArgs130 = isReact130UndefinedArgsError(msg);

        const hasSwController =
          !!(
            (typeof window !== 'undefined' && (window as any)?.navigator?.serviceWorker?.controller) ||
            (typeof globalThis !== 'undefined' && (globalThis as any)?.navigator?.serviceWorker?.controller)
          );

        void hasFreshHtmlBundleMismatch()
          .then((hasMismatch) => {
            if (!hasMismatch && !(isUndefinedArgs130 && hasSwController)) return;
            this.setState({ isStaleChunk: true, recoveryExhausted: true });
          })
          .catch(() => {
            if (!isUndefinedArgs130 || !hasSwController) return;
            this.setState({ isStaleChunk: true, recoveryExhausted: true });
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
        return (
          <View style={styles.container}>
            <View style={styles.content}>
              <Text style={styles.title}>Обновление приложения…</Text>
              <Text style={styles.message}>
                Требуется перезагрузка, чтобы применить новую версию.
              </Text>
              <Button
                label="Перезагрузить и очистить кеш"
                onPress={() => {
                  clearRecoverySessionKeys(true, true);
                  doStaleChunkRecovery({ purgeAllCaches: true });
                }}
                style={[styles.button, styles.primaryButton]}
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
