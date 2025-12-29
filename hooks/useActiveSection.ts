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
  headerOffset: number,
  scrollRoot?: HTMLElement | null
): UseActiveSectionReturn {
  const [activeSection, setActiveSection] = useState<string>('');
  const activeSectionRef = useRef<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const registeredSectionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

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

    const isDocumentRoot = (node: any): boolean => {
      if (!node) return true;
      const docAny = doc as any;
      const scrollingEl = (doc.scrollingElement || docAny.documentElement || docAny.body) as any;
      return node === window || node === doc || node === docAny.body || node === docAny.documentElement || node === scrollingEl;
    };

    const safeHeaderOffsetRaw = typeof headerOffset === 'number' && !isNaN(headerOffset) ? headerOffset : 0;
    const safeHeaderOffset = isDocumentRoot(scrollRoot) ? safeHeaderOffsetRaw : 0;

    const observer = new IntersectionObserverCtor(
      () => {
        // Debounce Intersection Observer callbacks to improve performance
        scheduleObserverCallback(() => {
          // Robust scrollspy for long sections:
          // Determine active section by comparing each section's top edge to the header offset.
          // Pick the last section whose top is above (or near) the header.
          const viewportTop = safeHeaderOffset;
          const TOP_BUFFER_PX = 24;

          const keys = Array.from(registeredSectionsRef.current);
          const measured: Array<{ key: string; top: number }> = [];

          keys.forEach((key) => {
            const el = doc.querySelector(`[data-section-key="${key}"]`) as HTMLElement | null;
            if (!el || typeof el.getBoundingClientRect !== 'function') return;
            const rect = el.getBoundingClientRect();
            measured.push({ key, top: rect.top });
          });

          if (!measured.length) return;

          // Sort by top position (document order in viewport)
          measured.sort((a, b) => a.top - b.top);

          // Find last section above the header line
          const passed = measured.filter((s) => s.top <= viewportTop + TOP_BUFFER_PX);
          let nextActive: string | null = null;

          if (passed.length) {
            nextActive = passed[passed.length - 1].key;
          } else {
            // If none passed yet, choose the first section below header
            nextActive = measured[0].key;
          }

          // Small priority: prefer video over description when both are near the top.
          if (nextActive === 'description') {
            const video = measured.find((s) => s.key === 'video');
            const desc = measured.find((s) => s.key === 'description');
            if (video && desc && Math.abs(video.top - desc.top) < 150 && video.top <= viewportTop + 150) {
              nextActive = 'video';
            }
          }

          if (nextActive && nextActive !== activeSectionRef.current) {
            setActiveSection(nextActive);
          }
        });
      },
      {
        root: scrollRoot ?? null,
        rootMargin: `-${safeHeaderOffset}px 0px -60% 0px`,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );

    observerRef.current = observer;

    // Регистрируем все секции для наблюдения.
    // Важно: секции могут монтироваться лениво (defer/lazy), поэтому делаем повторные попытки.
    const sectionKeys = Object.keys(anchors);
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryRegister = () => {
      if (cancelled) return;

      let registeredThisTick = 0;

      sectionKeys.forEach((key) => {
        if (registeredSectionsRef.current.has(key)) return;
        const element = doc.querySelector(`[data-section-key="${key}"]`);
        if (element && element instanceof Element) {
          observer.observe(element);
          registeredSectionsRef.current.add(key);
          registeredThisTick += 1;
        }
      });

      // Если мы уже зарегистрировали всё — останавливаемся раньше.
      if (registeredSectionsRef.current.size >= sectionKeys.length) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      }

      // Опционально: если долго не появляется ничего нового, всё равно оставляем interval до таймаута.
      void registeredThisTick;
    };

    // Первая попытка — сразу.
    tryRegister();

    // Дальше несколько секунд пере-сканируем DOM, чтобы подхватить ленивые секции.
    intervalId = setInterval(tryRegister, 250);
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    }, 8000);

    const registeredSections = registeredSectionsRef.current;
    const observerInstance = observerRef.current;

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (observerInstance) {
        observerInstance.disconnect();
        observerRef.current = null;
      }
      registeredSections.clear();
    };
  }, [anchors, headerOffset, scrollRoot]);

  const registerSection = useCallback((key: string, _ref: RefObject<View>) => {
    // Для native это будет обрабатываться через scroll events
    // Для web уже обрабатывается через Intersection Observer
    registeredSectionsRef.current.add(key);
  }, []);

  return {
    activeSection,
    setActiveSection,
    registerSection,
  };
}
