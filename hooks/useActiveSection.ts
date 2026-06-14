/**
 * Кастомный хук для отслеживания активной секции при скролле
 * Использует Intersection Observer для web и scroll events для native
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Platform, View } from 'react-native';
import type { RefObject } from 'react';

const isTestEnv =
  (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined) ||
  (typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver));

const scheduleObserverCallback = (cb: () => void) => {
  if (isTestEnv) {
    cb();
    return;
  }

  const raf =
    (typeof window !== 'undefined' && window.requestAnimationFrame) ||
    (typeof globalThis !== 'undefined' &&
      (globalThis as typeof globalThis & { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame);

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
  const observedElementsRef = useRef<WeakSet<Element>>(new WeakSet());
  const elCacheRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // ✅ АРХИТЕКТУРА: Intersection Observer для отслеживания активной секции (web)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const globalObj = (typeof globalThis !== 'undefined' ? globalThis : global) as typeof globalThis & {
      IntersectionObserver?: typeof IntersectionObserver;
    };
    const doc: Document | undefined =
      (typeof window !== 'undefined' && window.document) ||
      (typeof document !== 'undefined' ? document : undefined);
    const IntersectionObserverCtor: typeof IntersectionObserver | undefined =
      (typeof window !== 'undefined' && window.IntersectionObserver) || globalObj?.IntersectionObserver;

    if (!doc) {
      return;
    }

    const isUsableScrollRoot = (node: unknown): node is HTMLElement => {
      if (!node || typeof window === 'undefined') return false;
      if (node === window || node === doc || node === doc.body || node === doc.documentElement || node === doc.scrollingElement) {
        return false;
      }
      if (typeof (node as HTMLElement).getBoundingClientRect !== 'function') return false;

      try {
        const el = node as HTMLElement;
        const style = window.getComputedStyle(el);
        const overflowY = String(style?.overflowY ?? '').toLowerCase();
        const canScrollByStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
        const canScrollBySize = (el.scrollHeight || 0) > (el.clientHeight || 0) + 1;
        return canScrollByStyle && canScrollBySize;
      } catch {
        return false;
      }
    };

    const effectiveScrollRoot = isUsableScrollRoot(scrollRoot) ? scrollRoot : null;
    const eventScrollRoot =
      scrollRoot &&
      typeof (scrollRoot as HTMLElement).addEventListener === 'function' &&
      typeof (scrollRoot as HTMLElement).getBoundingClientRect === 'function'
        ? scrollRoot
        : null;

    const isDocumentRoot = (node: unknown): boolean => {
      if (!node) return true;
      const scrollingEl = (doc.scrollingElement || doc.documentElement || doc.body) as unknown;
      return node === window || node === doc || node === doc.body || node === doc.documentElement || node === scrollingEl;
    };

    const safeHeaderOffsetRaw = typeof headerOffset === 'number' && !isNaN(headerOffset) ? headerOffset : 0;
    const safeHeaderOffset = (() => {
      // If we are observing the document scroll, header always overlaps viewport.
      if (isDocumentRoot(effectiveScrollRoot)) return safeHeaderOffsetRaw;

      // For nested scroll containers, apply header offset only when container is under the sticky header.
      try {
        if (effectiveScrollRoot && typeof effectiveScrollRoot.getBoundingClientRect === 'function') {
          const rect = effectiveScrollRoot.getBoundingClientRect();
          const top = Number(rect?.top ?? 0);
          if (top < safeHeaderOffsetRaw - 4) return safeHeaderOffsetRaw;
        }
      } catch {
        // noop
      }
      return 0;
    })();

    const computeAndSetActive = () => {
      // Single-metric scrollspy: the active section is the one whose vertical
      // range [top, bottom] crosses a fixed reading line near the top of the
      // viewport. Hysteresis keeps the current section active while it still
      // crosses the line, preventing flicker between adjacent sections.
      const viewportTop = safeHeaderOffset;
      const TOP_BUFFER_PX = 24;

      const rootRect =
        effectiveScrollRoot &&
        !isDocumentRoot(effectiveScrollRoot) &&
        typeof effectiveScrollRoot.getBoundingClientRect === 'function'
          ? effectiveScrollRoot.getBoundingClientRect()
          : null;

      const keys = Object.keys(anchors);
      const measured: Array<{ key: string; top: number; bottom: number }> = [];
      const cache = elCacheRef.current;

      keys.forEach((key) => {
        let el = cache.get(key) ?? null;
        if (!el || !doc.contains(el)) {
          const stale = cache.get(key);
          if (stale) observedElementsRef.current.delete(stale);
          el = doc.querySelector(`[data-section-key="${key}"]`) as HTMLElement | null;
          if (el) cache.set(key, el); else { cache.delete(key); return; }
        }
        if (typeof el.getBoundingClientRect !== 'function') return;
        if (!observedElementsRef.current.has(el)) {
          try {
            observerRef.current?.observe?.(el);
          } catch {
            // noop
          }
          observedElementsRef.current.add(el);
        }
        const rect = el.getBoundingClientRect();
        const relativeTop = rootRect ? rect.top - rootRect.top : rect.top;
        const relativeBottom = rootRect ? rect.bottom - rootRect.top : rect.bottom;
        if (relativeBottom - relativeTop < 8) return;
        measured.push({ key, top: relativeTop, bottom: relativeBottom });
      });

      if (!measured.length) return;

      // Reading line: a horizontal line under the sticky header used as the
      // single source of truth for "what the user is currently reading".
      const headerLine = viewportTop + TOP_BUFFER_PX;

      // Sort by top position (document order in viewport).
      measured.sort((a, b) => a.top - b.top);

      const crosses = (s: { top: number; bottom: number }) =>
        s.top <= headerLine && s.bottom > headerLine;

      // Hysteresis: if the current section still crosses the reading line, keep it.
      const current = measured.find((s) => s.key === activeSectionRef.current);
      if (current && crosses(current)) {
        return;
      }

      // Otherwise pick the section that crosses the reading line. When multiple
      // cross (overlapping/nested), prefer the one whose top is closest to the line.
      const crossing = measured.filter(crosses);

      let nextActive: string | null = null;
      if (crossing.length) {
        crossing.sort((a, b) => b.top - a.top);
        nextActive = crossing[0].key;
      } else {
        // No section crosses the line (e.g. between sections or at the very top).
        // Prefer the last section that starts above the line but is still partially
        // on screen; if everything above has scrolled off the top, fall back to the
        // first section that is below the line.
        const above = measured.filter((s) => s.top <= headerLine && s.bottom > 0);
        if (above.length) {
          nextActive = above[above.length - 1].key;
        } else {
          const below = measured.filter((s) => s.bottom > 0);
          nextActive = below.length ? below[0].key : measured[0].key;
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
              root: effectiveScrollRoot,
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
        const element = doc.querySelector(`[data-section-key="${key}"]`);
        if (element && element instanceof Element) {
          if (!observedElementsRef.current.has(element)) {
            observer?.observe(element);
            observedElementsRef.current.add(element);
          }
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

    const scrollTarget: Window | HTMLElement =
      eventScrollRoot && !isDocumentRoot(eventScrollRoot) ? eventScrollRoot : window;
    const passiveOptions: AddEventListenerOptions = { passive: true };
    const captureOptions: AddEventListenerOptions = { passive: true, capture: true };
    const removeCaptureOptions: EventListenerOptions = { capture: true };
    // Throttle scroll handler to reduce expensive DOM queries (getBoundingClientRect + sort)
    // from 60fps to ~10fps — sufficient for scrollspy accuracy.
    let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;
    const SCROLL_THROTTLE_MS = 100;
    const onScroll = () => {
      if (scrollThrottleTimer) return;
      scrollThrottleTimer = setTimeout(() => {
        scrollThrottleTimer = null;
        scheduleObserverCallback(computeAndSetActive);
      }, SCROLL_THROTTLE_MS);
    };
    try {
      scrollTarget.addEventListener('scroll', onScroll, passiveOptions);
      window.addEventListener('resize', onScroll, passiveOptions);
      // Capture scroll events from any element (scroll doesn't bubble) to avoid missing container scrolls.
      doc.addEventListener('scroll', onScroll, captureOptions);
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
    const elCache = elCacheRef.current;

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (scrollThrottleTimer) clearTimeout(scrollThrottleTimer);
      try {
        scrollTarget.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        doc.removeEventListener('scroll', onScroll, removeCaptureOptions);
      } catch {
        // noop
      }
      if (observerInstance) {
        observerInstance.disconnect();
        observerRef.current = null;
      }
      registeredSections.clear();
      observedElementsRef.current = new WeakSet();
      elCache.clear();
    };
  }, [anchors, headerOffset, scrollRoot]);

  const registerSection = useCallback((key: string, _ref: RefObject<View>) => {
    // Для native это будет обрабатываться через scroll events
    // Для web уже обрабатывается через Intersection Observer
    registeredSectionsRef.current.add(key);
  }, []);

  return useMemo(() => ({
    activeSection,
    setActiveSection,
    registerSection,
  }), [activeSection, setActiveSection, registerSection]);
}
