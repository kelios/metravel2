/**
 * Кастомный хук для отслеживания активной секции при скролле
 * Использует Intersection Observer для web и scroll events для native
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, View } from 'react-native';
import type { RefObject } from 'react';

const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

const scheduleObserverCallback = (cb: () => void) => {
  if (isTestEnv) {
    cb();
    return;
  }

  const raf =
    (typeof window !== 'undefined' && window.requestAnimationFrame) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).requestAnimationFrame);

  if (typeof raf === 'function') {
    raf(cb);
  } else {
    setTimeout(cb, 16);
  }
};

export interface UseActiveSectionReturn {
  activeSection: string;
  setActiveSection: (section: string) => void;
  registerSection: (key: string, ref: RefObject<View>) => void;
}

export function useActiveSection(
  anchors: Record<string, RefObject<View>>,
  headerOffset: number
): UseActiveSectionReturn {
  const [activeSection, setActiveSection] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const registeredSectionsRef = useRef<Set<string>>(new Set());

  // ✅ АРХИТЕКТУРА: Intersection Observer для отслеживания активной секции (web)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const globalObj: any = typeof globalThis !== 'undefined' ? globalThis : global;
    const doc: Document | undefined =
      (typeof window !== 'undefined' && (window as any).document) ||
      (typeof document !== 'undefined' ? document : undefined);
    const IntersectionObserverCtor: typeof IntersectionObserver | undefined =
      (typeof window !== 'undefined' && window.IntersectionObserver) || globalObj?.IntersectionObserver;

    if (!doc || !IntersectionObserverCtor) {
      return;
    }

    const safeHeaderOffset = typeof headerOffset === 'number' && !isNaN(headerOffset) ? headerOffset : 0;

    const observer = new IntersectionObserverCtor(
      (entries) => {
        // Debounce Intersection Observer callbacks to improve performance
        scheduleObserverCallback(() => {
          const visibleSections: Array<{ key: string; ratio: number; top: number }> = [];

          entries.forEach((entry) => {
            const sectionKey = (entry.target as HTMLElement).getAttribute('data-section-key');
            if (!sectionKey || !entry.isIntersecting) return;

            const rect = entry.boundingClientRect;
            const viewportTop = safeHeaderOffset;

            if (rect.top <= viewportTop + 100 && rect.bottom >= viewportTop) {
              const ratio = entry.intersectionRatio;
              const distanceFromTop = Math.abs(rect.top - viewportTop);
              visibleSections.push({
                key: sectionKey,
                ratio,
                top: distanceFromTop,
              });
            }
          });

          if (visibleSections.length > 0) {
            visibleSections.sort((a, b) => {
              if (Math.abs(a.top - b.top) < 50) {
                return b.ratio - a.ratio;
              }
              return a.top - b.top;
            });

            let mostVisible = visibleSections[0];

            // Небольшой приоритет: если одновременно видны описание и видео,
            // и секция видео находится недалеко от верха, считаем активным именно видео.
            if (mostVisible.key === 'description') {
              const videoCandidate = visibleSections.find((s) => s.key === 'video');
              if (videoCandidate && videoCandidate.top - mostVisible.top < 150) {
                mostVisible = videoCandidate;
              }
            }

            if (mostVisible && mostVisible.key !== activeSection) {
              setActiveSection(mostVisible.key);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: `-${safeHeaderOffset}px 0px -60% 0px`,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );

    observerRef.current = observer;

    // Регистрируем все секции для наблюдения
    const sectionKeys = Object.keys(anchors);
    sectionKeys.forEach((key) => {
      if (registeredSectionsRef.current.has(key)) return;

      setTimeout(() => {
        const element = doc.querySelector(`[data-section-key="${key}"]`);
        if (element && element instanceof Element) {
          observer.observe(element);
          registeredSectionsRef.current.add(key);
        }
      }, 200);
    });

    return () => {
      const observerInstance = observerRef.current;
      const registeredSections = registeredSectionsRef.current;
      if (observerRef.current) {
        observerInstance.disconnect();
        observerRef.current = null;
      }
      registeredSections.clear();
    };
  }, [anchors, headerOffset, activeSection]);

  const registerSection = useCallback((_key: string, _ref: RefObject<View>) => {
    // Для native это будет обрабатываться через scroll events
    // Для web уже обрабатывается через Intersection Observer
  }, []);

  return {
    activeSection,
    setActiveSection,
    registerSection,
  };
}
