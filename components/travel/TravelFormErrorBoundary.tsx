import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ThemeContext, getThemedColors, type ThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { runStaleChunkRecovery } from '@/utils/recovery/runtimeRecovery';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class TravelFormErrorBoundary extends Component<Props, State> {
  static contextType = ThemeContext;
  override context: React.ContextType<typeof ThemeContext> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (__DEV__) {
      console.error('TravelForm Error Boundary caught an error:', error, errorInfo);
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const colors = getThemedColors(this.context?.isDark ?? false);
      const styles = getStyles(colors);
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Что-то пошло не так</Text>
            <Text style={styles.message}>
              При создании путешествия произошла ошибка. Попробуйте обновить страницу или начать заново.
            </Text>
            
            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Детали ошибки (для разработки):</Text>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.actions}>
              <Button
                label="Попробовать снова"
                onPress={this.handleRetry}
                variant="primary"
                size="md"
                style={[styles.button, styles.retryButton]}
                accessibilityLabel="Попробовать снова"
              />
              
              <Button
                label="Обновить страницу"
                onPress={() => {
                  runStaleChunkRecovery({ purgeAllCaches: true });
                }}
                variant="primary"
                size="md"
                style={[styles.button, styles.refreshButton]}
                accessibilityLabel="Обновить страницу"
              />
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  message: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: DESIGN_TOKENS.spacing.xl,
  },
  errorDetails: {
    backgroundColor: colors.mutedBackground,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.xl,
    width: '100%',
    maxHeight: 200,
  },
  errorTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
  },
  button: {
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    borderRadius: DESIGN_TOKENS.radii.md,
    minWidth: 120,
  },
  retryButton: {
    backgroundColor: colors.primary,
  },
  refreshButton: {
    backgroundColor: colors.success,
  },
});

export default TravelFormErrorBoundary;
