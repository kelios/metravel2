/**
 * Simplified map lazy loading hook
 * Combines multiple lazy loading states into one
 * @module hooks/useMapLazyLoad
 */

import { useCallback, useMemo } from 'react';

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
  elementRef: (node: unknown) => void;

  /**
   * Has map been mounted at least once
   */
  hasMounted: boolean;

  /**
   * Is currently loading
   */
  isLoading: boolean;
  isVisible: boolean;
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
  } = options;

  // All sections load immediately — no delays, no IntersectionObserver
  const isVisible = true;
  const isLoading = false;
  const hasMounted = enabled && canRenderHeavy && hasData;
  const shouldRender = enabled && canRenderHeavy && hasData;

  const setElementRef = useCallback((_node: unknown) => {
    // No-op: immediate loading, no observer needed
  }, []);

  return useMemo(() => ({
    shouldRender,
    elementRef: setElementRef,
    hasMounted,
    isLoading,
    isVisible,
  }), [shouldRender, setElementRef, hasMounted, isLoading, isVisible]);
}
