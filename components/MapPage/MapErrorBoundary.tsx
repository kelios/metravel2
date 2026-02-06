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
  }

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
  }

  handleReset = () => {
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

            // Удаляем карту если есть
            if (el._leaflet_map) {
              try {
                el._leaflet_map.remove();
              } catch {
                // Игнорируем ошибки удаления карты
              }
              delete el._leaflet_map;
            }

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
    });
  };

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
              {this.state.error?.message || 'Произошла непредвиденная ошибка'}
            </Text>
            <Button
              label="Попробовать снова"
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
