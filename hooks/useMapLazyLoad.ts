/**
 * Simplified map lazy loading hook
 * Combines multiple lazy loading states into one
 * @module hooks/useMapLazyLoad
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

interface UseMapLazyLoadOptions {
  /**
   * Enable lazy loading
   */
  enabled?: boolean;

  /**
   * Has map data to render
   */
  hasData?: boolean;

  /**
   * Can render heavy components
   */
  canRenderHeavy?: boolean;

  /**
   * Root margin for IntersectionObserver
   */
  rootMargin?: string;

  /**
   * Threshold for IntersectionObserver
   */
  threshold?: number;
}

interface UseMapLazyLoadResult {
  /**
   * Should render map now
   */
  shouldRender: boolean;

  /**
   * Element ref for IntersectionObserver
   */
  elementRef: (node: any) => void;

  /**
   * Has map been mounted at least once
   */
  hasMounted: boolean;

  /**
   * Is currently loading
   */
  isLoading: boolean;
}

/**
 * Simplified hook for lazy loading maps
 *
 * Replaces complex multi-state logic with single hook:
 * - mapLazyEnabled
 * - shouldLoadMap
 * - hasMountedMap
 *
 * @example
 * ```typescript
 * // Before (30+ lines):
 * const [mapLazyEnabled, setMapLazyEnabled] = useState(...)
 * const { shouldLoad, setElementRef } = useLazyMap(...)
 * const [hasMountedMap, setHasMountedMap] = useState(false)
 * const shouldRenderMap = canRenderHeavy && shouldLoad && hasMapData
 * const shouldMountMap = hasMapData && (hasMountedMap || shouldRenderMap)
 *
 * // After (5 lines):
 * const { shouldRender, elementRef } = useMapLazyLoad({
 *   enabled: canRenderHeavy,
 *   hasData: hasMapData,
 * });
 * ```
 */
export function useMapLazyLoad(options: UseMapLazyLoadOptions = {}): UseMapLazyLoadResult {
  const {
    enabled = true,
    hasData = true,
    canRenderHeavy = true,
    rootMargin = '0px',
    threshold = 0.2,
  } = options;

  const [isVisible, setIsVisible] = useState(Platform.OS !== 'web');
  const [hasMounted, setHasMounted] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<Element | null>(null);

  // Set element ref callback
  const setElementRef = useCallback((node: any) => {
    if (Platform.OS !== 'web') return;

    // Get actual DOM node
    const target = node?._nativeNode || node?._domNode || node || null;
    elementRef.current = target;

    // If not enabled, don't observe
    if (!enabled || !canRenderHeavy) return;

    // If already visible, don't need to observe
    if (isVisible) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Create new observer
    if (target && typeof IntersectionObserver !== 'undefined') {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry && entry.isIntersecting) {
            setIsVisible(true);
            if (observerRef.current) {
              observerRef.current.disconnect();
              observerRef.current = null;
            }
          }
        },
        {
          root: null,
          rootMargin,
          threshold,
        }
      );

      observerRef.current.observe(target);
    }
  }, [enabled, canRenderHeavy, isVisible, rootMargin, threshold]);

  // Enable lazy loading when canRenderHeavy becomes true
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!canRenderHeavy) return;
    if (isVisible) return;

    // Re-observe if we have element ref
    if (elementRef.current) {
      setElementRef(elementRef.current);
    }
  }, [canRenderHeavy, isVisible, setElementRef]);

  // Track if map has been mounted
  const shouldRender = enabled && canRenderHeavy && hasData && isVisible;

  useEffect(() => {
    if (shouldRender && !hasMounted) {
      setHasMounted(true);
    }
  }, [shouldRender, hasMounted]);

  // Cleanup observer
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  const isLoading = enabled && hasData && !isVisible;

  return {
    shouldRender: hasData && (hasMounted || shouldRender),
    elementRef: setElementRef,
    hasMounted,
    isLoading,
  };
}
