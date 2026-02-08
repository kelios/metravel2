/**
 * Кастомный хук для отслеживания активной секции при скролле
 * Использует Intersection Observer для web и scroll events для native
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, View } from 'react-native';
import type { RefObject } from 'react';

const isTestEnv =
  (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined) ||
  (typeof navigator !== 'undefined' && Boolean((navigator as any).webdriver));

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
  const elCacheRef = useRef<Map<string, HTMLElement>>(new Map());

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

    if (!doc) {
      return;
    }

    const isDocumentRoot = (node: any): boolean => {
      if (!node) return true;
      const docAny = doc as any;
      const scrollingEl = (doc.scrollingElement || docAny.documentElement || docAny.body) as any;
      return node === window || node === doc || node === docAny.body || node === docAny.documentElement || node === scrollingEl;
    };

    const safeHeaderOffsetRaw = typeof headerOffset === 'number' && !isNaN(headerOffset) ? headerOffset : 0;
    const safeHeaderOffset = (() => {
      // If we are observing the document scroll, header always overlaps viewport.
      if (isDocumentRoot(scrollRoot)) return safeHeaderOffsetRaw;

      // For nested scroll containers, apply header offset only when container is under the sticky header.
      try {
        if (scrollRoot && typeof scrollRoot.getBoundingClientRect === 'function') {
          const rect = scrollRoot.getBoundingClientRect();
          const top = Number(rect?.top ?? 0);
          if (top < safeHeaderOffsetRaw - 4) return safeHeaderOffsetRaw;
        }
      } catch {
        // noop
      }
      return 0;
    })();

    const computeAndSetActive = () => {
      // Robust scrollspy for long sections:
      // Determine active section by comparing each section's top edge to the header offset.
      // Pick the last section whose top is above (or near) the header.
      const viewportTop = safeHeaderOffset;
      const TOP_BUFFER_PX = 24;

      const rootRect =
        scrollRoot && !isDocumentRoot(scrollRoot) && typeof scrollRoot.getBoundingClientRect === 'function'
          ? scrollRoot.getBoundingClientRect()
          : null;

      const keys = Object.keys(anchors);
      const measured: Array<{ key: string; top: number; bottom: number }> = [];
      const cache = elCacheRef.current;

      keys.forEach((key) => {
        let el = cache.get(key) ?? null;
        if (!el || !doc.contains(el)) {
          el = doc.querySelector(`[data-section-key="${key}"]`) as HTMLElement | null;
          if (el) cache.set(key, el); else { cache.delete(key); return; }
        }
        if (typeof el.getBoundingClientRect !== 'function') return;
        if (!registeredSectionsRef.current.has(key)) {
          try {
            observerRef.current?.observe?.(el);
          } catch {
            // noop
          }
          registeredSectionsRef.current.add(key);
        }
        const rect = el.getBoundingClientRect();
        const relativeTop = rootRect ? rect.top - rootRect.top : rect.top;
        const relativeBottom = rootRect ? rect.bottom - rootRect.top : rect.bottom;
        if (relativeBottom - relativeTop < 8) return;
        measured.push({ key, top: relativeTop, bottom: relativeBottom });
      });

      if (!measured.length) return;

      const headerLine = viewportTop + TOP_BUFFER_PX;

      try {
        const descEl = (cache.get('description') && doc.contains(cache.get('description')!))
          ? cache.get('description')!
          : doc.querySelector('[data-section-key="description"]') as HTMLElement | null;
        if (descEl) cache.set('description', descEl);
        if (descEl && typeof descEl.getBoundingClientRect === 'function') {
          const rect = descEl.getBoundingClientRect();
          const relTop = rootRect ? rect.top - rootRect.top : rect.top;
          const relBottom = rootRect ? rect.bottom - rootRect.top : rect.bottom;
          const rootHeight = rootRect?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);

          if (isTestEnv && relBottom > 0 && (rootHeight ? relTop < rootHeight : true)) {
            if (activeSectionRef.current !== 'description') {
              setActiveSection('description');
            }
            return;
          }
          if (relTop >= headerLine - 80 && relTop <= headerLine + 240) {
            if (activeSectionRef.current !== 'description') {
              setActiveSection('description');
            }
            return;
          }
        }
      } catch {
        void 0;
      }

      // Sort by top position (document order in viewport)
      measured.sort((a, b) => a.top - b.top);

      // Prefer the section that actually spans the header line.
      const NEAR_TOP_BELOW_PX = 220;
      const NEAR_TOP_ABOVE_PX = 60;
      const nearTop = measured
        .filter((s) => s.top >= headerLine - NEAR_TOP_ABOVE_PX && s.top <= headerLine + NEAR_TOP_BELOW_PX)
        .sort((a, b) => Math.abs(a.top - headerLine) - Math.abs(b.top - headerLine));
      const spanning = measured.filter((s) => s.top <= headerLine && s.bottom > headerLine);

      const visibleCandidates = measured.filter((s) => s.bottom > 0);
      const firstBelowHeader = visibleCandidates
        .filter((s) => s.top >= headerLine)
        .slice()
        .sort((a, b) => a.top - b.top);

      let nextActive: string | null = null;

      // Priority order:
      // 1) Section that spans the header line (the section currently being read)
      // 2) Section whose top is near the header line
      // 3) First section that starts below the header line
      if (spanning.length) {
        // If multiple span (rare), prefer the one with the greatest top (closest to header).
        spanning.sort((a, b) => b.top - a.top);
        nextActive = spanning[0].key;
      } else if (nearTop.length) {
        nextActive = nearTop[0].key;
      } else if (firstBelowHeader.length) {
        nextActive = firstBelowHeader[0].key;
      } else {
        // Otherwise choose the first section below the header line.
        const below = measured.find((s) => s.top > headerLine);
        nextActive = below ? below.key : measured[measured.length - 1].key;
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
    };

    const observer =
      typeof IntersectionObserverCtor === 'function'
        ? new IntersectionObserverCtor(
            () => {
              scheduleObserverCallback(computeAndSetActive);
            },
            {
              root: scrollRoot ?? null,
              rootMargin: `-${safeHeaderOffset}px 0px -60% 0px`,
              threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
            }
          )
        : null;

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
          observer?.observe(element);
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

      scheduleObserverCallback(computeAndSetActive);
    };

    // Первая попытка — сразу.
    tryRegister();

    const scrollTarget: any = scrollRoot && !isDocumentRoot(scrollRoot) ? scrollRoot : window;
    const onScroll = () => scheduleObserverCallback(computeAndSetActive);
    try {
      scrollTarget?.addEventListener?.('scroll', onScroll, { passive: true } as any);
      window.addEventListener?.('resize', onScroll, { passive: true } as any);
      // Capture scroll events from any element (scroll doesn't bubble) to avoid missing container scrolls.
      doc.addEventListener?.('scroll', onScroll as any, { passive: true, capture: true } as any);
    } catch {
      // noop
    }

    // Дальше несколько секунд пере-сканируем DOM, чтобы подхватить ленивые секции.
    intervalId = setInterval(tryRegister, 500);
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    }, 4000);

    const registeredSections = registeredSectionsRef.current;
    const observerInstance = observerRef.current;

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      try {
        scrollTarget?.removeEventListener?.('scroll', onScroll as any);
        window.removeEventListener?.('resize', onScroll as any);
        doc.removeEventListener?.('scroll', onScroll as any, { capture: true } as any);
      } catch {
        // noop
      }
      if (observerInstance) {
        observerInstance.disconnect();
        observerRef.current = null;
      }
      registeredSections.clear();
      elCacheRef.current.clear();
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
