/**
 * Кастомный хук для отслеживания активной секции при скролле
 * Использует Intersection Observer для web и scroll events для native
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, View } from 'react-native';
import type { RefObject } from 'react';

export interface UseActiveSectionReturn {
  activeSection: string;
  setActiveSection: (section: string) => void;
  registerSection: (key: string, ref: RefObject<View>) => void;
}

interface SectionRef {
  key: string;
  ref: RefObject<View>;
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
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.IntersectionObserver) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections: Array<{ key: string; ratio: number; top: number }> = [];

        entries.forEach((entry) => {
          const sectionKey = (entry.target as HTMLElement).getAttribute('data-section-key');
          if (!sectionKey || !entry.isIntersecting) return;

          const rect = entry.boundingClientRect;
          const viewportTop = headerOffset;

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
      },
      {
        root: null,
        rootMargin: `-${headerOffset}px 0px -60% 0px`,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );

    observerRef.current = observer;

    // Регистрируем все секции для наблюдения
    const sectionKeys = Object.keys(anchors);
    sectionKeys.forEach((key) => {
      if (registeredSectionsRef.current.has(key)) return;

      setTimeout(() => {
        const element = document.querySelector(`[data-section-key="${key}"]`);
        if (element && element instanceof Element) {
          observer.observe(element);
          registeredSectionsRef.current.add(key);
        }
      }, 200);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      registeredSectionsRef.current.clear();
    };
  }, [anchors, headerOffset, activeSection]);

  const registerSection = useCallback((key: string, ref: RefObject<View>) => {
    // Для native это будет обрабатываться через scroll events
    // Для web уже обрабатывается через Intersection Observer
  }, []);

  return {
    activeSection,
    setActiveSection,
    registerSection,
  };
}
