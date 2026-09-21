/**
 * Visibility-first loading of below-the-fold sections on web, with an optional
 * fallback timer. Every caller is a named place in docs/RULES.md → «Web loading
 * and hydration policy»; `npm run guard:web-deferred-loading` fails on a call
 * outside that registry (#2012). Native loads every enabled section at once.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

export interface ProgressiveLoadConfig {
  priority: 'immediate' | 'high' | 'normal' | 'low';
  threshold?: number;   // Intersection threshold
  rootMargin?: string;  // Widens the viewport root only, not an inner scroller
  // Web: load after this many ms even if the section is never scrolled to
  // (default 1000). Not used with `disableFallbackOnWeb`.
  fallbackDelay?: number;
  enabled?: boolean;
  // Visibility only, no timer. A browser without IntersectionObserver still
  // loads at once, so the section is never stranded.
  disableFallbackOnWeb?: boolean;
}

// Hook for progressive component loading.
// On web deferred content waits for viewport proximity or a short fallback timer.
export function useProgressiveLoad(config: ProgressiveLoadConfig) {
  const enabled = config.enabled !== false;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [element, setElement] = useState<Element | null>(null);
  const [shouldLoad, setShouldLoad] = useState(
    Platform.OS !== 'web'
      ? enabled
      : enabled && config.priority === 'immediate',
  );

  const setElementRef = useCallback((node: unknown) => {
    if (node && typeof node === 'object' && 'nodeType' in (node as Record<string, unknown>)) {
      setElement(node as Element);
      return;
    }

    setElement(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setShouldLoad(false);
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    if (Platform.OS !== 'web') {
      setShouldLoad(true);
      return;
    }

    if (config.priority === 'immediate') {
      setShouldLoad(true);
      return;
    }

    setShouldLoad(false);
  }, [enabled, config.priority]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || shouldLoad) return;

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const fallbackDelay = config.disableFallbackOnWeb ? null : config.fallbackDelay ?? 1000;

    if (fallbackDelay !== null) {
      fallbackTimer = setTimeout(() => {
        setShouldLoad(true);
      }, Math.max(0, fallbackDelay));
    }

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      // `disableFallbackOnWeb` means "visibility-only" in capable browsers,
      // not "strand the section forever" in an older/embedded browser.
      if (config.disableFallbackOnWeb) setShouldLoad(true);
      return () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }

    if (!element) {
      return () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          setShouldLoad(true);
        }
      },
      {
        root: null,
        rootMargin: config.rootMargin ?? '0px',
        threshold: config.threshold ?? 0,
      },
    );

    observer.observe(element);
    observerRef.current = observer;

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      observer.disconnect();
      if (observerRef.current === observer) {
        observerRef.current = null;
      }
    };
  }, [
    config.disableFallbackOnWeb,
    config.fallbackDelay,
    config.rootMargin,
    config.threshold,
    element,
    enabled,
    shouldLoad,
  ]);

  useEffect(() => {
    if (!shouldLoad) return;
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, [shouldLoad]);

  return {
    shouldLoad,
    elementRef: { current: element },
    setElementRef,
  };
}
