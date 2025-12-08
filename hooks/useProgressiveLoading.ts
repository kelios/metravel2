/**
 * Progressive loading utilities for above-the-fold content optimization
 * Implements critical rendering path optimization
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

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
}

// Hook for progressive component loading
export function useProgressiveLoad(config: ProgressiveLoadConfig) {
  const [shouldLoad, setShouldLoad] = useState(
    config.priority === 'immediate' || config.priority === 'high'
  );
  const elementRef = useRef<any>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (config.priority === 'immediate') {
      setShouldLoad(true);
      return;
    }

    if (config.priority === 'high' && Platform.OS !== 'web') {
      // On native, high priority loads immediately
      setShouldLoad(true);
      return;
    }

    if (Platform.OS !== 'web') {
      // Fallback for native - load after interaction
      const timer = setTimeout(() => {
        setShouldLoad(true);
      }, config.fallbackDelay || 1000);
      return () => clearTimeout(timer);
    }

    // Web: Use Intersection Observer
    if (!window.IntersectionObserver) {
      // Fallback for browsers without Intersection Observer
      const timer = setTimeout(() => {
        setShouldLoad(true);
      }, config.fallbackDelay || 2000);
      return () => clearTimeout(timer);
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setShouldLoad(true);
          if (observerRef.current) {
            observerRef.current.disconnect();
          }
        }
      },
      {
        threshold: config.threshold || 0.1,
        rootMargin: config.rootMargin || '50px',
      }
    );

    const element = elementRef.current;
    if (element) {
      // Handle React Native Web elements
      const domElement = element._nativeNode || element._domNode || element;
      if (domElement) {
        observerRef.current.observe(domElement);
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [config]);

  return { shouldLoad, elementRef };
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
    return React.createElement('div', { 
      ref: elementRef, 
      className: className, 
      style: { minHeight: '100px' } 
    }, fallback);
  }

  return React.createElement(React.Fragment, null, children);
}

// Hook for managing loading priorities
export function useLoadingPriorities() {
  const [priorities, setPriorities] = useState<Record<string, LoadPriority>>({
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

  fonts.forEach(font => {
    const fontFace = new FontFace(
      font.family,
      `url(/fonts/${font.family}-${font.weight || 'regular'}.woff2)`,
      {
        weight: font.weight || '400',
        style: font.style || 'normal',
        display: font.display || 'swap',
      }
    );

    fontFace.load().then(() => {
      document.fonts.add(fontFace);
    }).catch(console.error);
  });
}

// Measure and optimize Core Web Vitals
export function measureWebVitals() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  // Largest Contentful Paint (LCP)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    console.log(`[Web Vitals] LCP: ${lastEntry.startTime}ms`);
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // First Input Delay (FID)
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach((entry: any) => {
      console.log(`[Web Vitals] FID: ${entry.processingStart - entry.startTime}ms`);
    });
  }).observe({ entryTypes: ['first-input'] });

  // Cumulative Layout Shift (CLS)
  let clsValue = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach((entry: any) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
        console.log(`[Web Vitals] CLS: ${clsValue}`);
      }
    });
  }).observe({ entryTypes: ['layout-shift'] });
}
