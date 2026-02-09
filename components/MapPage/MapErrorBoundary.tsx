// MapErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeContext, getThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import Feather from '@expo/vector-icons/Feather';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class MapErrorBoundary extends Component<Props, State> {
  static contextType = ThemeContext;
  // Вместо declare context используем приведение типа при обращении к this.context

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
    this._autoRetryCount = 0;
  }

  private _autoRetryCount: number;

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MapErrorBoundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-recover from "Map container is being reused by another instance"
    // by cleaning all containers and resetting (max 2 retries to avoid loops).
    const msg = String(error?.message ?? '');
    if (msg.includes('reused by another instance') && this._autoRetryCount < 2) {
      this._autoRetryCount += 1;
      this.handleReset();
    }
  }

  /** Check if the error is a Metro module resolution failure (unrecoverable without reload). */
  private isModuleError(error: Error | null): boolean {
    const msg = String(error?.message ?? '');
    return /requiring unknown module|cannot find module/i.test(msg);
  }

  handleReset = () => {
    // Module resolution errors cannot be fixed by resetting React state —
    // the JS bundle is broken. Clear SW caches and reload to fetch fresh chunks.
    if (this.isModuleError(this.state.error)) {
      if (typeof window !== 'undefined') {
        const doReload = () => {
          try { window.location.reload(); } catch { /* noop */ }
        };
        // Purge all SW JS caches so the reload fetches fresh bundles
        if ('caches' in window) {
          caches.keys()
            .then((names) => Promise.all(
              names.filter((n) => n.startsWith('metravel-js') || n.startsWith('metravel-critical'))
                .map((n) => caches.delete(n))
            ))
            .then(doReload)
            .catch(doReload);
        } else {
          doReload();
        }
      }
      return;
    }

    // ✅ ИСПРАВЛЕНИЕ: Очищаем все контейнеры Leaflet перед сбросом ошибки
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      try {
        // Удаляем все контейнеры карты с префиксом metravel-leaflet-map
        const allLeafletContainers = document.querySelectorAll('[id^="metravel-leaflet-map"]');
        allLeafletContainers.forEach((el: any) => {
          try {
            const leafletId = el._leaflet_id;

            // Удаляем из глобального реестра
            if ((window as any).L?.Util?._stamps && leafletId) {
              delete (window as any).L.Util._stamps[leafletId];
            }

            // Удаляем ссылку на карту (не вызываем .remove() — leafletFix.ts
            // патчит Map.prototype.remove для безопасной очистки).
            try { delete el._leaflet_map; } catch { /* noop */ }

            // Очищаем свойства
            delete el._leaflet_id;
            delete el._leaflet;
            delete el._leaflet_pos;
            delete el._leaflet_events;

            console.info('[MapErrorBoundary] Cleaned container:', el.id);
          } catch {
            // Игнорируем ошибки очистки отдельных контейнеров
          }
        });
      } catch (e) {
        console.warn('[MapErrorBoundary] Failed to clean containers:', e);
      }
    }

    this.setState({
      hasError: false,
      error: null,
    } as State);
  };

  /** Return a user-friendly description instead of raw Metro/bundler errors. */
  private getFriendlyMessage(): string {
    const msg = String(this.state.error?.message ?? '');
    if (this.isModuleError(this.state.error)) {
      return 'Модуль карты не загрузился. Попробуйте перезагрузить страницу.';
    }
    if (msg.includes('reused by another instance')) {
      return 'Контейнер карты был переиспользован. Попробуйте снова.';
    }
    if (/network|fetch|load/i.test(msg)) {
      return 'Не удалось загрузить данные карты. Проверьте соединение.';
    }
    return msg || 'Произошла непредвиденная ошибка';
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      // Приводим тип контекста для корректной работы с Babel
      const context = this.context as React.ContextType<typeof ThemeContext>;
      const colors = getThemedColors(context?.isDark ?? false);
      const styles = createStyles(colors);

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Feather name="alert-circle" size={48} color={colors.danger} />
            <Text style={styles.title}>Ошибка загрузки карты</Text>
            <Text style={styles.message}>
              {this.getFriendlyMessage()}
            </Text>
            <Button
              label={this.isModuleError(this.state.error) ? 'Перезагрузить страницу' : 'Попробовать снова'}
              icon={<Feather name="rotate-cw" size={20} color={colors.textOnPrimary} />}
              onPress={this.handleReset}
              variant="primary"
            />
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const createStyles = (colors: ReturnType<typeof getThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});

export default MapErrorBoundary;
