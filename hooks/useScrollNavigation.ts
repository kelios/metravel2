/**
 * Кастомный хук для управления навигацией по секциям через скролл
 * Создает anchors и предоставляет функцию скролла к секциям
 */

import { useMemo, useRef, useCallback } from 'react';
import { View, ScrollView, Platform, findNodeHandle } from 'react-native';
import React from 'react';

type RecordUnknown = Record<string, unknown>;

type DOMNodeLike = RecordUnknown & {
  _nativeNode?: unknown;
  _domNode?: unknown;
  getBoundingClientRect?: () => DOMRect;
  setAttribute?: (name: string, value: string) => void;
  getAttribute?: (name: string) => string | null;
  scrollTo?: (options: {
    top?: number;
    left?: number;
    x?: number;
    y?: number;
    behavior?: ScrollBehavior;
    animated?: boolean;
  }) => void;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
  parentElement?: HTMLElement | null;
};

type ScrollViewRefLike = RecordUnknown & {
  getScrollableNode?: () => unknown;
  _scrollNode?: unknown;
  _innerViewNode?: unknown;
  _nativeNode?: unknown;
  _domNode?: unknown;
};

type DocumentLike = Document & {
  body?: HTMLElement | null;
  documentElement?: HTMLElement | null;
};

const isRecord = (value: unknown): value is RecordUnknown =>
  typeof value === 'object' && value !== null;

const asDOMNodeLike = (value: unknown): DOMNodeLike | null =>
  isRecord(value) ? (value as DOMNodeLike) : null;

const asScrollViewRefLike = (value: unknown): ScrollViewRefLike | null =>
  isRecord(value) ? (value as ScrollViewRefLike) : null;

export interface UseScrollNavigationReturn {
  anchors: Record<string, React.RefObject<View | null>>;
  scrollTo: (key: string) => void;
  scrollRef: React.RefObject<ScrollView | null>;
}

const SECTION_KEYS = [
  'gallery',
  'video',
  'description',
  'recommendation',
  'plus',
  'minus',
  'map',
  'points',
  'near',
  'popular',
  'excursions',
  'comments',
] as const;

export function useScrollNavigation(): UseScrollNavigationReturn {
  const scrollRef = useRef<ScrollView | null>(null);
  const pendingRetriesRef = useRef<Record<string, Array<ReturnType<typeof setTimeout>>>>({});

  // ✅ АРХИТЕКТУРА: Создаем anchors объект из списка ключей
  const anchors = useMemo(() => {
    const result: Record<string, React.RefObject<View | null>> = {};
    SECTION_KEYS.forEach((key) => {
      result[key] = React.createRef<View>();
    });
    return result;
  }, []);

  const scrollTo = useCallback(
    (key: string) => {
      const clearPending = (k: string) => {
        const timers = pendingRetriesRef.current[k];
        if (timers && timers.length) {
          timers.forEach((t) => clearTimeout(t));
        }
        delete pendingRetriesRef.current[k];
      };

      const tryScrollWeb = (k: string): boolean => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return false;

        const resolveElement = (): HTMLElement | null => {
          // Primary: by data attribute (stable across re-renders)
          const byAttr = document.querySelector<HTMLElement>(`[data-section-key="${k}"]`);
          if (byAttr) return byAttr;

          // Fallback: by ref (useful when the section mounted lazily and attribute is not yet assigned)
          try {
            const refAny = anchors[k];
            const current = asDOMNodeLike(refAny?.current);
            const node =
              asDOMNodeLike(current?._nativeNode) ||
              asDOMNodeLike(current?._domNode) ||
              current;
            if (!node) return null;
            if (typeof node.getBoundingClientRect !== 'function') return null;

            if (typeof node.setAttribute === 'function') {
              const existing = typeof node.getAttribute === 'function' ? node.getAttribute('data-section-key') : null;
              if (!existing) {
                node.setAttribute('data-section-key', k);
              }
            }

            return node as unknown as HTMLElement;
          } catch {
            return null;
          }
        };

        const el = resolveElement();
        if (!el) return false;

        const getHeaderOffset = (): number => {
          try {
            const header = document.querySelector('header');
            const h = header?.getBoundingClientRect?.().height;
            if (typeof h === 'number' && isFinite(h)) {
              return Math.max(60, Math.min(160, Math.round(h)));
            }
          } catch {
            // noop
          }
          return 88;
        };

        const isDocumentScrollContainer = (node: unknown): boolean => {
          if (!node) return false;
          const docAny = document as DocumentLike;
          const scrollingEl = document.scrollingElement || docAny.documentElement || docAny.body || null;
          return node === window || node === document || node === docAny.body || node === docAny.documentElement || node === scrollingEl;
        };

        const shouldApplyHeaderOffset = (container: unknown): boolean => {
          try {
            const headerH = getHeaderOffset();
            if (!headerH) return false;

            // If we are scrolling the document/window, the header always overlaps the viewport.
            if (isDocumentScrollContainer(container)) return true;

            // For nested scroll containers, apply offset only when the container is under the header.
            const containerNode = asDOMNodeLike(container);
            if (containerNode && typeof containerNode.getBoundingClientRect === 'function') {
              const rect = containerNode.getBoundingClientRect();
              const top = Number(rect?.top ?? 0);
              // If container starts below the header, don't offset.
              return top < headerH - 4;
            }
          } catch {
            // noop
          }
          return false;
        };

        const canScrollNode = (node: unknown): node is HTMLElement => {
          const domNode = asDOMNodeLike(node);
          if (!domNode) return false;
          if (typeof domNode.getBoundingClientRect !== 'function') return false;
          const sh = Number(domNode.scrollHeight ?? 0);
          const ch = Number(domNode.clientHeight ?? 0);
          const canScrollBySize = sh > ch + 2;
          return canScrollBySize;
        };

        const findScrollableAncestor = (start: HTMLElement | null): HTMLElement | null => {
          if (!start) return null;
          let node: HTMLElement | null = start;
          while (node && node !== document.body) {
            try {
              const style = window.getComputedStyle(node);
              const overflowY = style?.overflowY;
              const isScrollableOverflow = overflowY === 'auto' || overflowY === 'scroll';
              if (isScrollableOverflow && canScrollNode(node)) {
                return node;
              }
            } catch {
              // noop
            }
            node = node.parentElement;
          }
          return null;
        };

        {
          const safeScrollTo = (node: unknown, top: number): boolean => {
            const scrollNode = asDOMNodeLike(node);
            if (!scrollNode) return false;
            const before = Number(scrollNode.scrollTop ?? 0);
            let didCall = false;

            // 1) Standard DOM signature: scrollTo({ top, behavior })
            try {
              if (typeof scrollNode.scrollTo === 'function') {
                scrollNode.scrollTo({ top, behavior: 'smooth' });
                didCall = true;
              }
            } catch {
              // noop
            }

            // If scrollTop didn't change, RNW/webview polyfills may expect x/y/animated object signature
            try {
              const afterObj = Number(scrollNode.scrollTop ?? 0);
              if (typeof scrollNode.scrollTo === 'function' && (!didCall || Math.abs(afterObj - before) < 1)) {
                scrollNode.scrollTo({ x: 0, y: top, animated: true });
                didCall = true;
              }
            } catch {
              // noop
            }

            // Final fallback: assign scrollTop
            try {
              const afterNum = Number(scrollNode.scrollTop ?? 0);
              if (Math.abs(afterNum - before) < 1) {
                scrollNode.scrollTop = top;
                didCall = true;
              }
            } catch {
              // noop
            }

            return didCall;
          };

          const scrollViewAny = asScrollViewRefLike(scrollRef.current);
          const scrollNode: HTMLElement | null =
            (typeof scrollViewAny?.getScrollableNode === 'function' && (asDOMNodeLike(scrollViewAny.getScrollableNode()) as HTMLElement | null)) ||
            (asDOMNodeLike(scrollViewAny?._scrollNode) as HTMLElement | null) ||
            (asDOMNodeLike(scrollViewAny?._innerViewNode) as HTMLElement | null) ||
            (asDOMNodeLike(scrollViewAny?._nativeNode) as HTMLElement | null) ||
            (asDOMNodeLike(scrollViewAny?._domNode) as HTMLElement | null) ||
            null;

          const bestScrollContainer =
            (canScrollNode(scrollNode) ? scrollNode : null) || findScrollableAncestor(el.parentElement);

          // Если у нас есть реальный scroll container (а не window) — скроллим его напрямую
          if (bestScrollContainer && typeof bestScrollContainer.getBoundingClientRect === 'function') {
            const containerRect = bestScrollContainer.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const currentTop = bestScrollContainer.scrollTop ?? 0;
            const HEADER_OFFSET = getHeaderOffset();
            const adjustment = shouldApplyHeaderOffset(bestScrollContainer) ? HEADER_OFFSET : 0;
            const targetTopRaw = currentTop + (elRect.top - containerRect.top) - adjustment;
            const targetTop = Math.max(0, Math.round(targetTopRaw));

            if (safeScrollTo(bestScrollContainer, targetTop)) {
              return true;
            }
          }

          // Fallback: manual scroll calculation using window/document scroll
          {
            const HEADER_OFFSET = getHeaderOffset();
            const elRect = el.getBoundingClientRect();
            const win = typeof window !== 'undefined' ? window : undefined;
            if (win && typeof win.scrollTo === 'function') {
              const currentScrollY = win.pageYOffset ?? win.scrollY ?? 0;
              const targetY = Math.max(0, Math.round(currentScrollY + elRect.top - HEADER_OFFSET));
              win.scrollTo({ top: targetY, behavior: 'smooth' });
              return true;
            }

            // Last resort: scrollIntoView
            if (typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
              return true;
            }
          }
        }

        return false;
      }

      // Веб: пытаемся использовать DOM и data-section-key для более стабильной прокрутки.
      // Если секция рендерится лениво (defer/lazy), делаем ретраи, чтобы дождаться DOM.
      if (Platform.OS === 'web') {
        clearPending(key);
        if (tryScrollWeb(key)) return;

        // Не спамим бесконечными попытками: максимум ~6с ожидания.
        const MAX_ATTEMPTS = 20;
        const INTERVAL_MS = 100;
        pendingRetriesRef.current[key] = [];

        for (let i = 1; i <= MAX_ATTEMPTS; i += 1) {
          const t = setTimeout(() => {
            if (tryScrollWeb(key)) {
              clearPending(key);
            } else if (i === MAX_ATTEMPTS) {
              clearPending(key);
            }
          }, i * INTERVAL_MS);
          pendingRetriesRef.current[key]!.push(t);
        }
        return;
      }

      const anchor = anchors[key];
      const scrollTarget = scrollRef.current;
      let scrollHandle: ReturnType<typeof findNodeHandle> | null = null;
      if (scrollTarget) {
        try {
          scrollHandle = findNodeHandle(scrollTarget);
        } catch {
          scrollHandle = scrollTarget as any;
        }
      }
      if (anchor?.current && scrollHandle != null) {
        anchor.current.measureLayout(
          scrollHandle,
          (_x, y) => {
            scrollRef.current?.scrollTo({ y, animated: true });
          },
          () => {
            // Fallback: если measureLayout не сработал, логируем предупреждение
            console.warn(`Could not measure layout for section: ${key}`);
          }
        );
      }
    },
    [anchors]
  );

  return useMemo(() => ({
    anchors,
    scrollTo,
    scrollRef,
  }), [anchors, scrollTo, scrollRef]);
}
