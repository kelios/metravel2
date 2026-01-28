/**
 * Performance optimization utilities for scroll and layout
 * Prevents layout thrashing and optimizes expensive operations
 */

import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

// Debounce utility for scroll events
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  ) as T;
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback;
}

// Throttle utility for high-frequency events
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - (now - lastCallRef.current));
      }
    },
    [callback, delay]
  ) as T;
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return throttledCallback;
}

// Prevent layout thrashing by batching DOM reads/writes
export function useLayoutBatch() {
  const pendingReads = useRef<(() => void)[]>([]);
  const pendingWrites = useRef<(() => void)[]>([]);
  const animationFrameId = useRef<number | null>(null);
  
  const flush = useCallback(() => {
    if (animationFrameId.current) return;

    animationFrameId.current = requestAnimationFrame(() => {
      const reads = pendingReads.current.splice(0);
      reads.forEach((read) => read());

      const writes = pendingWrites.current.splice(0);
      writes.forEach((write) => write());

      animationFrameId.current = null;
    });
  }, []);

  const scheduleRead = useCallback((read: () => void) => {
    pendingReads.current.push(read);
    flush();
  }, [flush]);
  
  const scheduleWrite = useCallback((write: () => void) => {
    pendingWrites.current.push(write);
    flush();
  }, [flush]);
  
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);
  
  return { scheduleRead, scheduleWrite };
}

// Optimized scroll event handler for web
export function useOptimizedScroll(
  handler: (scrollY: number) => void,
  options: {
    throttle?: number;
    debounce?: number;
    threshold?: number;
  } = {}
) {
  const { throttle = 16, debounce = 0, threshold = 0 } = options;
  const lastScrollY = useRef(0);
  
  const throttledHandler = useThrottle(handler, throttle);
  const debouncedHandler = useDebounce(handler, debounce);
  
  return useCallback((event: Event) => {
    const scrollY = (event.target as HTMLElement)?.scrollTop || 0;
    
    // Skip if scroll change is below threshold
    if (Math.abs(scrollY - lastScrollY.current) < threshold) {
      return;
    }
    
    lastScrollY.current = scrollY;
    
    if (debounce > 0) {
      debouncedHandler(scrollY);
    } else {
      throttledHandler(scrollY);
    }
  }, [throttledHandler, debouncedHandler, threshold, debounce]);
}

// Memory-efficient intersection observer
export function useOptimizedIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  const observe = useCallback((element: Element) => {
    if (!observerRef.current && Platform.OS === 'web') {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          // Use requestAnimationFrame to prevent layout thrashing
          requestAnimationFrame(() => callbackRef.current(entries));
        },
        {
          threshold: [0, 0.1, 0.5, 1],
          rootMargin: '50px',
          ...options,
        }
      );
    }
    
    if (observerRef.current && element) {
      observerRef.current.observe(element);
    }
  }, [options]);
  
  const unobserve = useCallback((element: Element) => {
    if (observerRef.current && element) {
      observerRef.current.unobserve(element);
    }
  }, []);
  
  const disconnect = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    return disconnect;
  }, [disconnect]);
  
  return { observe, unobserve, disconnect };
}

// Performance monitoring utilities
export function usePerformanceMonitor(name: string) {
  const startTimeRef = useRef<number>(0);
  
  const start = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);
  
  const end = useCallback(() => {
    const duration = performance.now() - startTimeRef.current;
    if (process.env.NODE_ENV === 'development') {
      console.info(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }
    return duration;
  }, [name]);
  
  return { start, end };
}

// Default export that includes all performance utilities
export default function usePerformanceOptimization() {
  return {
    useDebounce,
    useThrottle,
    useLayoutBatch,
    useOptimizedScroll,
    useOptimizedIntersectionObserver,
    usePerformanceMonitor,
  };
}
