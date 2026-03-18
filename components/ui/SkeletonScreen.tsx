/**
 * SkeletonScreen - Complete YouTube-style skeleton loading screen pattern
 * 
 * This component demonstrates the full pattern for instant skeleton → content
 * transitions with progressive hydration.
 * 
 * Usage:
 * ```tsx
 * <SkeletonScreen
 *   isLoading={isLoading}
 *   skeleton={<MyPageSkeleton />}
 *   error={error}
 *   onRetry={refetch}
 * >
 *   <MyPageContent data={data} />
 * </SkeletonScreen>
 * ```
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type ScreenState = 'skeleton' | 'transitioning' | 'content' | 'error';

interface SkeletonScreenProps {
  /** Is data still loading? */
  isLoading: boolean;
  /** Skeleton placeholder component */
  skeleton: React.ReactNode;
  /** Main content to show when loaded */
  children: React.ReactNode;
  /** Error object if loading failed */
  error?: Error | null;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Custom error message */
  errorMessage?: string;
  /** Transition duration in ms */
  transitionDuration?: number;
  /** Container style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
  /** Callback when content is visible */
  onContentVisible?: () => void;
}

const TRANSITION_DURATION = 250;

export const SkeletonScreen: React.FC<SkeletonScreenProps> = ({
  isLoading,
  skeleton,
  children,
  error,
  onRetry,
  errorMessage = 'Не удалось загрузить данные',
  transitionDuration = TRANSITION_DURATION,
  style,
  testID,
  onContentVisible,
}) => {
  const colors = useThemedColors();
  const [state, setState] = useState<ScreenState>('skeleton');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasShownContent = useRef(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (error) {
      setState('error');
      return;
    }

    if (isLoading) {
      setState('skeleton');
      fadeAnim.setValue(0);
      hasShownContent.current = false;
      return;
    }

    // Data is ready - transition to content
    setState('transitioning');

    if (Platform.OS === 'web') {
      // Use rAF for smooth CSS transition on web
      requestAnimationFrame(() => {
        setState('content');
        if (!hasShownContent.current) {
          hasShownContent.current = true;
          onContentVisible?.();
        }
      });
    } else {
      // Use Animated API on native
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: transitionDuration,
        useNativeDriver: true,
      }).start(() => {
        setState('content');
        if (!hasShownContent.current) {
          hasShownContent.current = true;
          onContentVisible?.();
        }
      });
    }
  }, [isLoading, error, fadeAnim, transitionDuration, onContentVisible]);

  const handleRetry = useCallback(() => {
    setState('skeleton');
    onRetry?.();
  }, [onRetry]);

  const containerStyle = useMemo(
    () => [styles.container, style],
    [styles.container, style]
  );

  // Error state
  if (state === 'error') {
    return (
      <View testID={testID} style={containerStyle}>
        <View style={styles.errorContainer} role="alert">
          <Text style={styles.errorTitle}>Ошибка</Text>
          <Text style={styles.errorMessage}>
            {error?.message || errorMessage}
          </Text>
          {onRetry && (
            <TouchableOpacity
              onPress={handleRetry}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Повторить загрузку"
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Web implementation with CSS transitions
  if (Platform.OS === 'web') {
    const showSkeleton = state === 'skeleton';
    const showContent = state === 'transitioning' || state === 'content';

    return (
      <View testID={testID} style={containerStyle}>
        {/* Skeleton layer - always rendered first for instant display */}
        <View
          testID={testID ? `${testID}-skeleton` : 'skeleton-layer'}
          style={[
            styles.layer,
            {
              opacity: showSkeleton ? 1 : 0,
              zIndex: showSkeleton ? 2 : 1,
              pointerEvents: showSkeleton ? 'auto' : 'none',
              transition: `opacity ${transitionDuration}ms ease-out`,
            } as any,
          ]}
          aria-hidden={!showSkeleton}
        >
          {skeleton}
        </View>

        {/* Content layer - rendered when data is ready */}
        <View
          testID={testID ? `${testID}-content` : 'content-layer'}
          style={[
            styles.layer,
            {
              opacity: showContent ? 1 : 0,
              zIndex: showContent ? 2 : 1,
              pointerEvents: state === 'content' ? 'auto' : 'none',
              transition: `opacity ${transitionDuration}ms ease-out`,
            } as any,
          ]}
          aria-hidden={showSkeleton}
        >
          {showContent && children}
        </View>
      </View>
    );
  }

  // Native implementation with Animated
  return (
    <View testID={testID} style={containerStyle}>
      {state === 'skeleton' && (
        <View style={styles.layer}>{skeleton}</View>
      )}
      {(state === 'transitioning' || state === 'content') && (
        <Animated.View style={[styles.layer, { opacity: fadeAnim }]}>
          {children}
        </Animated.View>
      )}
    </View>
  );
};

/**
 * useSkeletonState - Hook for managing skeleton loading states
 */
export function useSkeletonState<T>(
  data: T | undefined | null,
  isLoading: boolean,
  error?: Error | null
): {
  state: 'skeleton' | 'content' | 'error';
  isReady: boolean;
  shouldShowSkeleton: boolean;
} {
  if (error) {
    return { state: 'error', isReady: false, shouldShowSkeleton: false };
  }

  if (isLoading || !data) {
    return { state: 'skeleton', isReady: false, shouldShowSkeleton: true };
  }

  return { state: 'content', isReady: true, shouldShowSkeleton: false };
}

/**
 * withSkeleton - HOC for adding skeleton loading to any component
 */
export function withSkeleton<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  SkeletonComponent: React.ComponentType
) {
  const WithSkeleton: React.FC<P & { isLoading?: boolean; error?: Error | null; onRetry?: () => void }> = ({
    isLoading = false,
    error,
    onRetry,
    ...props
  }) => {
    return (
      <SkeletonScreen
        isLoading={isLoading}
        skeleton={<SkeletonComponent />}
        error={error}
        onRetry={onRetry}
      >
        <WrappedComponent {...(props as P)} />
      </SkeletonScreen>
    );
  };

  WithSkeleton.displayName = `withSkeleton(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithSkeleton;
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      position: 'relative',
      backgroundColor: colors.background,
    },
    layer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: DESIGN_TOKENS.spacing.xl,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    errorMessage: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
    },
    retryButtonText: {
      color: colors.textOnDark,
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default React.memo(SkeletonScreen);
