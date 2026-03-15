/**
 * ProgressiveContent - YouTube-style skeleton → content transition
 * 
 * Features:
 * - Instant skeleton rendering (no delays)
 * - Smooth fade transition when content is ready
 * - Progressive hydration support
 * - No layout shifts during transition
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';

type ContentState = 'skeleton' | 'transitioning' | 'content';

interface ProgressiveContentProps {
  /** Is the data loaded and ready to display? */
  isReady: boolean;
  /** Skeleton placeholder to show while loading */
  skeleton: React.ReactNode;
  /** Actual content to render when ready */
  children: React.ReactNode;
  /** Transition duration in ms (default: 200) */
  transitionDuration?: number;
  /** Container style */
  style?: ViewStyle;
  /** Test ID for the container */
  testID?: string;
  /** Callback when transition completes */
  onTransitionComplete?: () => void;
  /** Minimum time to show skeleton (prevents flash for fast loads) */
  minSkeletonTime?: number;
}

const TRANSITION_DURATION = 200;
const MIN_SKELETON_TIME = 100;

export const ProgressiveContent: React.FC<ProgressiveContentProps> = ({
  isReady,
  skeleton,
  children,
  transitionDuration = TRANSITION_DURATION,
  style,
  testID,
  onTransitionComplete,
  minSkeletonTime = MIN_SKELETON_TIME,
}) => {
  const [state, setState] = useState<ContentState>('skeleton');
  const mountTimeRef = useRef(Date.now());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isReady) {
      setState('skeleton');
      fadeAnim.setValue(0);
      return;
    }

    const elapsed = Date.now() - mountTimeRef.current;
    const delay = Math.max(0, minSkeletonTime - elapsed);

    const startTransition = () => {
      setState('transitioning');

      if (Platform.OS === 'web') {
        // Use CSS transition on web for better performance
        requestAnimationFrame(() => {
          setState('content');
          onTransitionComplete?.();
        });
      } else {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: transitionDuration,
          useNativeDriver: true,
        }).start(() => {
          setState('content');
          onTransitionComplete?.();
        });
      }
    };

    if (delay > 0) {
      const timer = setTimeout(startTransition, delay);
      return () => clearTimeout(timer);
    } else {
      startTransition();
    }
  }, [isReady, fadeAnim, transitionDuration, onTransitionComplete, minSkeletonTime]);

  const containerStyle = useMemo(
    () => [styles.container, style],
    [style]
  );

  if (Platform.OS === 'web') {
    return (
      <View testID={testID} style={containerStyle}>
        {/* Skeleton layer */}
        <View
          style={[
            styles.layer,
            {
              opacity: state === 'skeleton' ? 1 : 0,
              zIndex: state === 'skeleton' ? 1 : 0,
              pointerEvents: state === 'skeleton' ? 'auto' : 'none',
              transition: `opacity ${transitionDuration}ms ease-out`,
            } as any,
          ]}
          aria-hidden={state !== 'skeleton'}
        >
          {skeleton}
        </View>

        {/* Content layer */}
        <View
          style={[
            styles.layer,
            {
              opacity: state === 'content' || state === 'transitioning' ? 1 : 0,
              zIndex: state === 'content' || state === 'transitioning' ? 1 : 0,
              pointerEvents: state === 'content' ? 'auto' : 'none',
              transition: `opacity ${transitionDuration}ms ease-out`,
            } as any,
          ]}
          aria-hidden={state === 'skeleton'}
        >
          {(state === 'transitioning' || state === 'content') && children}
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
 * useProgressiveLoad - Hook for managing progressive content loading
 * 
 * Returns state and handlers for skeleton → content transitions
 */
export function useProgressiveLoad<T>(
  data: T | undefined | null,
  options?: {
    /** Consider ready when data is truthy (default: true) */
    readyWhen?: (data: T | undefined | null) => boolean;
    /** Minimum skeleton display time */
    minSkeletonTime?: number;
  }
) {
  const { readyWhen = (d) => Boolean(d), minSkeletonTime = MIN_SKELETON_TIME } = options ?? {};
  
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const mountTimeRef = useRef(Date.now());

  const isReady = readyWhen(data);

  useEffect(() => {
    if (!isReady) {
      setPhase('loading');
      return;
    }

    const elapsed = Date.now() - mountTimeRef.current;
    const delay = Math.max(0, minSkeletonTime - elapsed);

    if (delay > 0) {
      const timer = setTimeout(() => setPhase('ready'), delay);
      return () => clearTimeout(timer);
    } else {
      setPhase('ready');
    }
  }, [isReady, minSkeletonTime]);

  return {
    phase,
    isLoading: phase === 'loading',
    isReady: phase === 'ready',
    data,
  };
}

/**
 * ContentPlaceholder - Renders skeleton or content based on loading state
 */
interface ContentPlaceholderProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}

export const ContentPlaceholder: React.FC<ContentPlaceholderProps> = ({
  isLoading,
  skeleton,
  children,
}) => {
  if (isLoading) {
    return <>{skeleton}</>;
  }
  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default React.memo(ProgressiveContent);
