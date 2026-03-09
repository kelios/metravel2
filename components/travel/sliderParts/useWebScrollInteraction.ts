// components/travel/sliderParts/useWebScrollInteraction.ts
// E6.2: Extracted shared web scroll/drag/keyboard/touch interaction logic
import { useCallback, useEffect, useRef } from 'react';
import { clamp } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseWebScrollInteractionOptions {
  /** Total number of slides */
  slideCount: number;
  /** Current container width ref */
  containerWRef: React.MutableRefObject<number>;
  /** Current index ref */
  indexRef: React.MutableRefObject<number>;
  /** Scroll DOM node ref */
  scrollNodeRef: React.MutableRefObject<HTMLElement | null>;
  /** Wrapper DOM node ref (for keyboard events) */
  wrapperNodeRef: React.MutableRefObject<HTMLElement | null>;
  /** Resolve cached DOM nodes */
  resolveNodes: () => void;
  /** Programmatic scroll-to function */
  scrollTo: (idx: number, animated?: boolean) => void;
  /** Sync active index from scroll offset */
  setActiveIndexFromOffset?: (offsetX: number) => void;
  /** Cancel active programmatic scroll animation */
  cancelScrollAnimation?: () => void;
  /** Prefetch can be enabled after first interaction */
  enablePrefetch?: () => void;
  /** Dismiss swipe hint after first interaction */
  dismissSwipeHint?: () => void;
  /** Pause autoplay */
  pauseAutoplay?: () => void;
  /** Resume autoplay */
  resumeAutoplay?: () => void;
  /** Whether the device is a mobile phone — skips manual touch drag in favor of native scroll-snap */
  isMobile?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages web-specific slider interactions:
 * - Keyboard navigation (ArrowLeft/Right)
 * - Mouse drag
 * - Pointer/touch swipe (mobile web)
 * - scrollend snap
 * - Idle timer for scroll position settling
 */
export function useWebScrollInteraction(options: UseWebScrollInteractionOptions): void {
  const {
    slideCount,
    containerWRef,
    indexRef,
    scrollNodeRef,
    wrapperNodeRef,
    resolveNodes,
    scrollTo,
    setActiveIndexFromOffset,
    cancelScrollAnimation,
    enablePrefetch,
    dismissSwipeHint,
    pauseAutoplay,
    resumeAutoplay,
    isMobile = false,
  } = options;

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const dragLastXRef = useRef(0);
  const dragLastTsRef = useRef(0);
  const dragVelocityRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollWriteFrameRef = useRef<number | null>(null);
  const pendingScrollLeftRef = useRef(0);

  const clearScrollIdleTimer = useCallback(() => {
    if (scrollIdleTimerRef.current) {
      clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = null;
    }
  }, []);

  const getMaxScrollLeft = useCallback(() => {
    const cw = containerWRef.current || 1;
    return Math.max(0, (slideCount - 1) * cw);
  }, [containerWRef, slideCount]);

  const clampScrollLeft = useCallback(
    (value: number) => clamp(value, 0, getMaxScrollLeft()),
    [getMaxScrollLeft],
  );

  const writeScrollLeft = useCallback(
    (value: number) => {
      pendingScrollLeftRef.current = clampScrollLeft(value);
      if (scrollWriteFrameRef.current != null) return;
      scrollWriteFrameRef.current = window.requestAnimationFrame(() => {
        scrollWriteFrameRef.current = null;
        const node = scrollNodeRef.current;
        if (!node) return;
        node.scrollLeft = pendingScrollLeftRef.current;
      });
    },
    [clampScrollLeft, scrollNodeRef],
  );

  const scheduleScrollSync = useCallback(
    (delay: number) => {
      clearScrollIdleTimer();
      scrollIdleTimerRef.current = setTimeout(() => {
        const node = scrollNodeRef.current;
        if (!node || isDraggingRef.current) return;
        setActiveIndexFromOffset?.(node.scrollLeft);
      }, delay);
    },
    [clearScrollIdleTimer, scrollNodeRef, setActiveIndexFromOffset],
  );

  const beginDrag = useCallback(
    (pageX: number, pointerId?: number) => {
      const node = scrollNodeRef.current;
      if (!node) return;
      cancelScrollAnimation?.();
      clearScrollIdleTimer();
      dismissSwipeHint?.();
      enablePrefetch?.();
      pauseAutoplay?.();
      isDraggingRef.current = true;
      activePointerIdRef.current = pointerId ?? null;
      dragStartXRef.current = pageX;
      dragLastXRef.current = pageX;
      dragLastTsRef.current = performance.now();
      dragVelocityRef.current = 0;
      dragScrollLeftRef.current = node.scrollLeft;
      pendingScrollLeftRef.current = node.scrollLeft;
      node.classList.add('slider-snap-disabled');
      node.style.cursor = 'grabbing';
      node.style.userSelect = 'none';
      if (pointerId != null) {
        try {
          node.setPointerCapture(pointerId);
        } catch {
          activePointerIdRef.current = null;
        }
      }
    },
    [cancelScrollAnimation, clearScrollIdleTimer, dismissSwipeHint, enablePrefetch, pauseAutoplay, scrollNodeRef],
  );

  const moveDrag = useCallback(
    (pageX: number) => {
      if (!isDraggingRef.current) return;
      const dx = pageX - dragStartXRef.current;
      const nextLeft = dragScrollLeftRef.current - dx;
      writeScrollLeft(nextLeft);
      const now = performance.now();
      const dt = Math.max(1, now - dragLastTsRef.current);
      dragVelocityRef.current = (pageX - dragLastXRef.current) / dt;
      dragLastXRef.current = pageX;
      dragLastTsRef.current = now;
    },
    [writeScrollLeft],
  );

  const endDrag = useCallback(() => {
    const node = scrollNodeRef.current;
    if (!node || !isDraggingRef.current) return;
    isDraggingRef.current = false;
    node.style.cursor = '';
    node.style.userSelect = '';
    if (activePointerIdRef.current != null) {
      try {
        node.releasePointerCapture(activePointerIdRef.current);
      } catch {
        // noop
      }
    }
    activePointerIdRef.current = null;
    const cw = containerWRef.current || 1;
    const baseLeft = Number.isFinite(node.scrollLeft) ? node.scrollLeft : pendingScrollLeftRef.current;
    const projectedLeft = clampScrollLeft(baseLeft - dragVelocityRef.current * Math.min(320, Math.max(160, cw * 0.35)));
    const target = clamp(Math.round(projectedLeft / cw), 0, Math.max(0, slideCount - 1));
    scrollTo(target, true);
    scheduleScrollSync(isMobile ? 140 : 80);
    resumeAutoplay?.();
  }, [clampScrollLeft, containerWRef, isMobile, resumeAutoplay, scheduleScrollSync, scrollNodeRef, scrollTo, slideCount]);

  // Consolidated effect: keyboard + mouse drag + pointer/touch swipe + scrollend
  useEffect(() => {
    if (typeof window === 'undefined') return;
    resolveNodes();
    const node = scrollNodeRef.current;
    if (!node) return;

    // Keyboard navigation
    const parent = (
      node.closest?.('[data-testid="slider-wrapper"]') ||
      wrapperNodeRef.current ||
      node.parentElement?.parentElement
    ) as HTMLElement | null;
    if (parent) parent.setAttribute('tabindex', '0');

    const handleKeyDown = (e: KeyboardEvent) => {
      dismissSwipeHint?.();
      enablePrefetch?.();
      if (e.key === 'ArrowLeft') {
        const target = Math.max(0, indexRef.current - 1);
        if (target === indexRef.current) return;
        scrollTo(target);
      } else if (e.key === 'ArrowRight') {
        const target = Math.min(Math.max(0, slideCount - 1), indexRef.current + 1);
        if (target === indexRef.current) return;
        scrollTo(target);
      }
    };

    // Mouse drag (desktop/tablet only). On mobile browsers synthesized mouse events
    // can interfere with native touch scroll-snap.
    const onMouseDown = !isMobile ? (e: MouseEvent) => {
      if (e.button !== 0) return;
      beginDrag(e.pageX);
    } : null;

    const onMouseMove = !isMobile ? (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      moveDrag(e.pageX);
    } : null;

    const onMouseUp = !isMobile ? (_e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      endDrag();
    } : null;

    const onMouseLeave = !isMobile ? () => {
      if (!isDraggingRef.current) return;
      endDrag();
    } : null;

    // Touch / pointer swipe — only on non-mobile (desktop/tablet).
    // On mobile phones, native CSS scroll-snap provides GPU-accelerated swiping
    // that is far smoother than JS-based manual scrollLeft management.
    // A lightweight passive touchstart listener still fires prefetch/dismiss.
    const isTouchPointerEvent = (e: PointerEvent) => {
      return (e as any).pointerType === 'touch' || (e as any).pointerType === 'pen';
    };

    const onPointerDown = !isMobile ? (e: PointerEvent) => {
      if (!isTouchPointerEvent(e) && e.pointerType !== 'mouse') return;
      beginDrag(e.pageX, e.pointerId);
      try { e.preventDefault(); } catch { /* noop */ }
    } : null;

    const onPointerMove = !isMobile ? (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
      try { e.preventDefault(); } catch { /* noop */ }
      moveDrag(e.pageX);
    } : null;

    const onPointerUp = !isMobile ? (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
      endDrag();
    } : null;

    const onPointerCancel = !isMobile ? (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
      endDrag();
    } : null;

    // On mobile: lightweight passive touch listener for prefetch/dismiss only
    // On non-mobile: full manual touch drag (iOS Safari fallback for PointerEvent)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      dismissSwipeHint?.();
      enablePrefetch?.();
      if (isMobile) return; // let native scroll-snap handle the rest
      beginDrag(e.touches[0].pageX);
    };

    const onTouchMove = !isMobile ? (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      if (e.touches.length !== 1) return;
      moveDrag(e.touches[0].pageX);
    } : null;

    const onTouchEnd = !isMobile ? () => {
      if (!isDraggingRef.current) return;
      endDrag();
    } : null;

    const onScroll = () => {
      if (isDraggingRef.current) return;
      scheduleScrollSync(isMobile ? 140 : 72);
    };

    const onScrollEnd = () => {
      clearScrollIdleTimer();
      setActiveIndexFromOffset?.(node.scrollLeft);
    };

    // Attach listeners
    parent?.addEventListener('keydown', handleKeyDown as EventListener);
    if (onMouseDown) node.addEventListener('mousedown', onMouseDown);
    if (onMouseMove) window.addEventListener('mousemove', onMouseMove);
    if (onMouseUp) window.addEventListener('mouseup', onMouseUp);
    if (onMouseLeave) node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('scroll', onScroll, { passive: true } as any);
    node.addEventListener('scrollend', onScrollEnd);

    if (onPointerDown) node.addEventListener('pointerdown', onPointerDown as EventListener, { passive: false } as any);
    if (onPointerMove) node.addEventListener('pointermove', onPointerMove as EventListener, { passive: false } as any);
    if (onPointerUp) node.addEventListener('pointerup', onPointerUp as EventListener, { passive: true } as any);
    if (onPointerCancel) node.addEventListener('pointercancel', onPointerCancel as EventListener, { passive: true } as any);

    node.addEventListener('touchstart', onTouchStart as EventListener, { passive: true } as any);
    if (onTouchMove) node.addEventListener('touchmove', onTouchMove as EventListener, { passive: true } as any);
    if (onTouchEnd) node.addEventListener('touchend', onTouchEnd as EventListener, { passive: true } as any);

    return () => {
      parent?.removeEventListener('keydown', handleKeyDown as EventListener);
      if (onMouseDown) node.removeEventListener('mousedown', onMouseDown);
      if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
      if (onMouseUp) window.removeEventListener('mouseup', onMouseUp);
      if (onMouseLeave) node.removeEventListener('mouseleave', onMouseLeave);
      node.removeEventListener('scroll', onScroll as EventListener);
      node.removeEventListener('scrollend', onScrollEnd);

      if (onPointerDown) node.removeEventListener('pointerdown', onPointerDown as EventListener);
      if (onPointerMove) node.removeEventListener('pointermove', onPointerMove as EventListener);
      if (onPointerUp) node.removeEventListener('pointerup', onPointerUp as EventListener);
      if (onPointerCancel) node.removeEventListener('pointercancel', onPointerCancel as EventListener);

      node.removeEventListener('touchstart', onTouchStart as EventListener);
      if (onTouchMove) node.removeEventListener('touchmove', onTouchMove as EventListener);
      if (onTouchEnd) node.removeEventListener('touchend', onTouchEnd as EventListener);

      if (scrollWriteFrameRef.current != null) {
        window.cancelAnimationFrame(scrollWriteFrameRef.current);
        scrollWriteFrameRef.current = null;
      }
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginDrag, cancelScrollAnimation, clearScrollIdleTimer, dismissSwipeHint, enablePrefetch, endDrag, indexRef, isMobile, moveDrag, pauseAutoplay, resolveNodes, resumeAutoplay, scheduleScrollSync, scrollTo, setActiveIndexFromOffset, slideCount, wrapperNodeRef]);
}
