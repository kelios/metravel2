/**
 * Advanced Performance Hooks for travels/[slug]
 * Handles lazy loading, prioritization, and optimization
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Priority levels for lazy loading
 */
export enum LoadPriority {
  CRITICAL = 'critical',      // Load immediately (LCP)
  HIGH = 'high',              // Load early, visible in viewport
  MEDIUM = 'medium',          // Load when viewport is near
  LOW = 'low',                // Load on idle
}

/**
 * Intersection Observer hook with priority handling
 *
 * @example
 * const { isVisible, ref } = useIntersectionObserver({
 *   priority: LoadPriority.HIGH,
 *   rootMargin: '100px'
 * });
 *
 * return <div ref={ref}>{isVisible && <HeavyComponent />}</div>;
 */
export function useIntersectionObserver(options: {
  priority?: LoadPriority;
  rootMargin?: string;
  threshold?: number | number[];
  onVisible?: () => void;
} = {}) {
  const ref = useRef<any>(null);
  const { priority, rootMargin, threshold, onVisible } = options;
  const [isVisible, setIsVisible] = useState(priority === LoadPriority.CRITICAL);

  useEffect(() => {
    // Skip on non-web platforms
    if (Platform.OS !== 'web') {
      setIsVisible(true);
      return;
    }

    // Skip if no IntersectionObserver support
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    // Calculate root margin based on priority
    const rootMarginValue = rootMargin || (() => {
      switch (priority) {
        case LoadPriority.CRITICAL:
          return '0px'; // Load immediately
        case LoadPriority.HIGH:
          return '200px'; // Load before becoming visible
        case LoadPriority.MEDIUM:
          return '500px'; // Load when approaching viewport
        case LoadPriority.LOW:
        default:
          return '1000px'; // Load when page is idle
      }
    })();

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          onVisible?.();
          observer.unobserve(element);
        }
      },
      {
        rootMargin: rootMarginValue,
        threshold: threshold ?? 0.1,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [priority, rootMargin, threshold, onVisible]);

  return { isVisible, ref };
}

/**
 * Hook to detect if an element is in the viewport
 * Useful for tracking engagement metrics
 */
export function useViewportVisibility(onVisible?: () => void) {
  const ref = useRef<any>(null);
  const hasBeenVisible = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasBeenVisible.current) {
          hasBeenVisible.current = true;
          onVisible?.();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [onVisible]);

  return ref;
}

/**
 * Hook to measure component render time
 *
 * @example
 * const renderTime = useRenderTime('MyComponent');
 * useEffect(() => {
 *   console.log('Render took:', renderTime.duration, 'ms');
 * }, [renderTime.duration]);
 */
export function useRenderTime(componentName: string) {
  const startTime = useRef(performance.now());
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const endTime = performance.now();
    const renderDuration = endTime - startTime.current;
    setDuration(renderDuration);

    // Log slow renders
    if (renderDuration > 100) {
      console.warn(
        `[Performance] ${componentName} render took ${renderDuration.toFixed(2)}ms`
      );
    }
  }, [componentName]);

  return { duration, startTime };
}

/**
 * Hook for tracking image loading performance
 *
 * @example
 * const { isLoaded, error, onLoad } = useImageLoadTracking('image.jpg');
 */
export function useImageLoadTracking(imageUrl: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadStartTime = useRef(performance.now());

  const onLoad = useCallback(() => {
    const loadDuration = performance.now() - loadStartTime.current;
    setIsLoaded(true);

    if (loadDuration > 1000) {
      console.warn(`[Image Loading] ${imageUrl} took ${loadDuration.toFixed(0)}ms`);
    }
  }, [imageUrl]);

  const onError = useCallback((err: Error) => {
    setError(err);
    console.error(`[Image Loading] Error loading ${imageUrl}:`, err);
  }, [imageUrl]);

  // Reset tracking when URL changes
  useEffect(() => {
    setIsLoaded(false);
    setError(null);
    loadStartTime.current = performance.now();
  }, [imageUrl]);

  return { isLoaded, error, onLoad, onError };
}

/**
 * Hook for request idle callback with fallback
 * Schedules work when browser is idle
 *
 * @example
 * useOnIdle(() => {
 *   // This runs when browser is idle
 *   preloadNonCriticalAssets();
 * });
 */
export function useOnIdle(
  callback: () => void,
  dependencies: React.DependencyList = []
) {
  useEffect(() => {
    if (typeof requestIdleCallback !== 'undefined') {
      // Modern browsers
      const id = requestIdleCallback(callback, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    } else {
      // Fallback: setTimeout with low priority
      const timeoutId = setTimeout(callback, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [callback, dependencies]);
}

/**
 * Hook to debounce a function with performance tracking
 *
 * @example
 * const debouncedSearch = useDebouncedCallback(
 *   (query) => searchTravels(query),
 *   500
 * );
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallTime = useRef(0);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = performance.now();
      lastCallTime.current = now;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const timeSinceLastCall = performance.now() - lastCallTime.current;
        if (timeSinceLastCall >= delay) {
          callback(...args);
        }
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Hook for resource prefetch/preload strategy
 *
 * @example
 * usePrefetchResources([
 *   'https://fonts.googleapis.com/css2?family=...',
 *   'https://api.example.com/data'
 * ], { strategy: 'prefetch' });
 */
export function usePrefetchResources(
  urls: string[],
  options: {
    strategy?: 'prefetch' | 'preload' | 'preconnect';
    as?: string; // Resource type: script, style, image, font, etc
  } = {}
) {
  const { strategy = 'prefetch', as } = options;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    urls.forEach((url) => {
      // Check if link already exists
      const selector = `link[rel="${strategy}"][href="${url}"]`;
      if (document.querySelector(selector)) {
        return; // Already added
      }

      const link = document.createElement('link');
      link.rel = strategy;
      link.href = url;
      if (as) {
        link.as = as;
      }
      link.crossOrigin = 'anonymous';

      document.head.appendChild(link);
    });
  }, [urls, strategy, as]);
}

/**
 * Hook to monitor network status and adjust loading strategy
 *
 * @example
 * const { isOnline, effectiveType } = useNetworkStatus();
 * const imageQuality = effectiveType === '4g' ? 85 : 60;
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [effectiveType, setEffectiveType] = useState<'4g' | '3g' | '2g' | 'slow-2g'>('4g');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Monitor online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Monitor connection type
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      const handleConnectionChange = () => {
        setEffectiveType(connection.effectiveType || '4g');
      };
      connection.addEventListener('change', handleConnectionChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, effectiveType };
}

/**
 * Hook for preventing layout shift during loading
 * Reserves space for content based on expected dimensions
 *
 * @example
 * const spacerProps = useLayoutShiftPrevention({ width: 600, height: 400 });
 * return <div {...spacerProps}><Image /></div>;
 */
export function useLayoutShiftPrevention(dimensions: {
  width?: number;
  height?: number;
  aspectRatio?: number;
}) {
  const aspectRatio = dimensions.aspectRatio ?? (16 / 9);
  const width = dimensions.width || '100%';
  const height = dimensions.height || 'auto';

  return {
    style: {
      width,
      height,
      aspectRatio,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
  };
}

/**
 * Hook for batching DOM updates to prevent jank
 *
 * @example
 * const batch = useBatchedUpdates();
 * batch(() => {
 *   setState1(value1);
 *   setState2(value2);
 *   setState3(value3);
 * });
 */
export function useBatchedUpdates() {
  return useCallback((updates: () => void) => {
    if (typeof React !== 'undefined' && (React as any).unstable_batchedUpdates) {
      (React as any).unstable_batchedUpdates(updates);
    } else {
      updates();
    }
  }, []);
}
