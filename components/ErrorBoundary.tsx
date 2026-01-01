// Error Boundary для обработки ошибок React
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ThemeContext, getThemedColors, type ThemedColors } from '@/hooks/useTheme';

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
  declare context: React.ContextType<typeof ThemeContext>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ✅ УЛУЧШЕНИЕ: Используем новый logger с поддержкой мониторинга
    const { logError } = require('@/src/utils/logger');
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
    this.props.onError?.(error, errorInfo);
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
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Попробовать снова</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => window.location.reload()}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  Перезагрузить страницу
                </Text>
              </TouchableOpacity>
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
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: 12,
    minWidth: 200,
    minHeight: 44,
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
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
  secondaryButtonText: {
    color: colors.primary,
  },
});
