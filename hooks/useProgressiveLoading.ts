/**
 * Progressive loading utilities for below-the-fold content optimization.
 * On web we use visibility-first loading with a short fallback timer so
 * deferred sections don't compete with the first screen forever.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';

// Types for progressive loading
export interface LoadPriority {
  immediate: boolean;    // LCP critical
  high: boolean;        // Above fold
  normal: boolean;      // Normal loading
  low: boolean;         // Below fold
}

export interface ProgressiveLoadConfig {
  priority: 'immediate' | 'high' | 'normal' | 'low';
  threshold?: number;   // Intersection threshold
  rootMargin?: string;  // Root margin for Intersection Observer
  fallbackDelay?: number; // Fallback delay for non-supporting browsers
  enabled?: boolean;
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

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function' || !element) {
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

// Component wrapper for progressive loading
export interface ProgressiveWrapperProps {
  children: React.ReactNode;
  config: ProgressiveLoadConfig;
  fallback?: React.ReactNode;
  className?: string;
}

export function ProgressiveWrapper({
  children,
  config,
  fallback = null,
  className,
}: ProgressiveWrapperProps) {
  const { shouldLoad, setElementRef } = useProgressiveLoad(config);

  if (!shouldLoad) {
    if (Platform.OS === 'web') {
      return React.createElement(
        'div',
        {
          ref: setElementRef,
          className: className,
          style: { minHeight: '100px' },
        },
        fallback
      );
    }

    return React.createElement(
      View,
      { style: { minHeight: 100 } },
      fallback
    );
  }

  return React.createElement(React.Fragment, null, children);
}

// Hook for managing loading priorities
export function useLoadingPriorities() {
  const [priorities] = useState<Record<string, LoadPriority>>({
    immediate: { immediate: true, high: true, normal: true, low: true },
    high: { immediate: false, high: true, normal: true, low: true },
    normal: { immediate: false, high: false, normal: true, low: true },
    low: { immediate: false, high: false, normal: false, low: true },
  });

  const shouldLoad = useCallback((priority: keyof typeof priorities) => {
    return priorities[priority];
  }, [priorities]);

  return { shouldLoad, priorities };
}

// Critical CSS injector for above-the-fold content
export function injectCriticalCSS(css: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  // Check if critical CSS is already injected
  if (document.querySelector('#critical-css')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'critical-css';
  style.textContent = css;
  style.setAttribute('data-critical', 'true');
  
  // Insert as first style to ensure highest priority
  const firstStyle = document.querySelector('style');
  if (firstStyle) {
    firstStyle.parentNode?.insertBefore(style, firstStyle);
  } else {
    document.head.appendChild(style);
  }
}

// Preload critical resources
export function preloadCriticalResources(resources: Array<{
  href: string;
  as: string;
  type?: string;
  crossorigin?: string;
}>) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  resources.forEach(resource => {
    if (!resource.as) return;
    // Check if already preloaded
    const existing = document.querySelector(
      `link[rel="preload"][href="${resource.href}"]`
    );
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.href;
    link.as = resource.as;
    
    if (resource.type) link.type = resource.type;
    if (resource.crossorigin) link.crossOrigin = resource.crossorigin;
    
    document.head.appendChild(link);
  });
}

// Optimize font loading
export function optimizeFontLoading(fonts: Array<{
  family: string;
  weight?: string;
  style?: string;
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
}>) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  // NOTE: This project does not ship web-served .woff2 files under /fonts.
  // Loading FontFace from /fonts/*.woff2 can return HTML (404) and triggers OTS decode errors.
  // Keep this function as a no-op on web unless/until real font assets are added.
  void fonts;
  return;
}
