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

export default class ErrorBoundary extends Component<Props, State> {
  static contextType = ThemeContext;
  override context: React.ContextType<typeof ThemeContext> | null = null;
  private _leafletAutoRetryCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { logError } = require('@/utils/logger');
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
    this.props.onError?.(error, errorInfo);

    const msg = String(error?.message ?? '');
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

  private reloadPage = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.location.reload();
    } catch {
      // noop
    }
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
              onPress={this.handleReset}
              style={[styles.button, styles.primaryButton]}
              accessibilityLabel="Попробовать снова"
            />
            {Platform.OS === 'web' && (
              <Button
                label="Перезагрузить страницу"
                onPress={this.reloadPage}
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
