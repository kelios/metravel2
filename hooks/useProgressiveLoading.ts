/**
 * Progressive loading utilities for above-the-fold content optimization
 * Implements critical rendering path optimization
 */

import React, { useState, useRef, useCallback } from 'react';
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

// Hook for progressive component loading
// All sections load immediately when enabled — no delays.
// Skeleton placeholders are shown while content loads, page is never blocked.
export function useProgressiveLoad(config: ProgressiveLoadConfig) {
  const enabled = config.enabled !== false;
  const elementRef = useRef<unknown>(null);

  const setElementRef = useCallback((node: unknown) => {
    elementRef.current = node;
  }, []);

  // Load immediately when enabled — no intersection observer, no delays
  return { shouldLoad: enabled, elementRef, setElementRef };
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
  const { shouldLoad, elementRef } = useProgressiveLoad(config);

  if (!shouldLoad) {
    if (Platform.OS === 'web') {
      return React.createElement(
        'div',
        {
          ref: elementRef,
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
