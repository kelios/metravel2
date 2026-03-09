// components/travel/sliderParts/useWebScrollInteraction.ts
// E6.2: Extracted shared web scroll/drag/keyboard/touch interaction logic
import { useCallback, useEffect, useRef } from 'react';
import { clamp } from './utils';

const TOUCH_AXIS_THRESHOLD_PX = 8;
const TOUCH_AXIS_DOMINANCE_PX = 4;

export function shouldHandleMouseDragStart(event: {
  button: number;
  sourceCapabilities?: { firesTouchEvents?: boolean } | null;
}): boolean {
  if (event.button !== 0) return false;
  if (event.sourceCapabilities?.firesTouchEvents) return false;
  return true;
}

export function shouldHandlePointerDragStart(pointerType: string | undefined, isMobile: boolean): boolean {
  if (pointerType === 'mouse') return true;
  if (isMobile) return false;
  return pointerType === 'touch' || pointerType === 'pen';
}

export function getTouchGestureAxis(deltaX: number, deltaY: number): 'x' | 'y' | null {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < TOUCH_AXIS_THRESHOLD_PX && absY < TOUCH_AXIS_THRESHOLD_PX) return null;
  if (absX > absY + TOUCH_AXIS_DOMINANCE_PX) return 'x';
  if (absY > absX + TOUCH_AXIS_DOMINANCE_PX) return 'y';
  return null;
}

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
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchAxisLockRef = useRef<'x' | 'y' | null>(null);

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
        const offsetX = node.scrollLeft;
        const cw = containerWRef.current || 1;
        const targetIndex = clamp(Math.round(offsetX / cw), 0, Math.max(0, slideCount - 1));
        const targetLeft = targetIndex * cw;
        setActiveIndexFromOffset?.(offsetX);
        const correctionThreshold = isMobile ? 8 : 1;
        if (Math.abs(offsetX - targetLeft) > correctionThreshold) {
          scrollTo(targetIndex, false);
        }
      }, delay);
    },
    [clearScrollIdleTimer, containerWRef, isMobile, scrollNodeRef, scrollTo, setActiveIndexFromOffset, slideCount],
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

  const resetTouchGesture = useCallback(() => {
    touchAxisLockRef.current = null;
    touchStartXRef.current = 0;
    touchStartYRef.current = 0;
  }, []);

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
    const onMouseDown = (e: MouseEvent) => {
      if (!shouldHandleMouseDragStart({
        button: e.button,
        sourceCapabilities: (e as any).sourceCapabilities ?? null,
      })) return;
      beginDrag(e.pageX);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      moveDrag(e.pageX);
    };

    const onMouseUp = (_e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      endDrag();
    };

    const onMouseLeave = () => {
      if (!isDraggingRef.current) return;
      endDrag();
    };

    // Touch / pointer swipe — only on non-mobile (desktop/tablet).
    // On mobile phones, native CSS scroll-snap provides GPU-accelerated swiping
    // that is far smoother than JS-based manual scrollLeft management.
    // A lightweight passive touchstart listener still fires prefetch/dismiss.
    const onPointerDown = (e: PointerEvent) => {
      if (!shouldHandlePointerDragStart(e.pointerType, isMobile)) return;
      if (e.pointerType === 'mouse') {
        beginDrag(e.pageX, e.pointerId);
        try { e.preventDefault(); } catch { /* noop */ }
        return;
      }
      beginDrag(e.pageX, e.pointerId);
      try { e.preventDefault(); } catch { /* noop */ }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
      try { e.preventDefault(); } catch { /* noop */ }
      moveDrag(e.pageX);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
      endDrag();
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
      endDrag();
    };

    // On mobile: lightweight passive touch listener for prefetch/dismiss only
    // On non-mobile: full manual touch drag (iOS Safari fallback for PointerEvent)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      dismissSwipeHint?.();
      enablePrefetch?.();
      touchStartXRef.current = e.touches[0].pageX;
      touchStartYRef.current = e.touches[0].pageY;
      touchAxisLockRef.current = null;
      if (isMobile) return;
      beginDrag(e.touches[0].pageX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      if (isMobile) {
        const touch = e.touches[0];
        const deltaX = touch.pageX - touchStartXRef.current;
        const deltaY = touch.pageY - touchStartYRef.current;
        const lockedAxis = touchAxisLockRef.current ?? getTouchGestureAxis(deltaX, deltaY);

        if (!lockedAxis) return;
        touchAxisLockRef.current = lockedAxis;

        if (lockedAxis === 'y') {
          if (isDraggingRef.current) endDrag();
          return;
        }

        if (!isDraggingRef.current) {
          beginDrag(touchStartXRef.current);
        }

        try { e.preventDefault(); } catch { /* noop */ }
        moveDrag(touch.pageX);
        return;
      }

      if (!isDraggingRef.current) return;
      moveDrag(e.touches[0].pageX);
    };

    const onTouchEnd = () => {
      const lockedAxis = touchAxisLockRef.current;
      resetTouchGesture();
      if (!isDraggingRef.current) return;
      if (isMobile && lockedAxis !== 'x') {
        return;
      }
      endDrag();
    };

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
    node.addEventListener('touchmove', onTouchMove as EventListener, { passive: false } as any);
    node.addEventListener('touchend', onTouchEnd as EventListener, { passive: true } as any);
    node.addEventListener('touchcancel', onTouchEnd as EventListener, { passive: true } as any);

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
      node.removeEventListener('touchmove', onTouchMove as EventListener);
      node.removeEventListener('touchend', onTouchEnd as EventListener);
      node.removeEventListener('touchcancel', onTouchEnd as EventListener);

      if (scrollWriteFrameRef.current != null) {
        window.cancelAnimationFrame(scrollWriteFrameRef.current);
        scrollWriteFrameRef.current = null;
      }
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
      resetTouchGesture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginDrag, cancelScrollAnimation, clearScrollIdleTimer, dismissSwipeHint, enablePrefetch, endDrag, indexRef, isMobile, moveDrag, pauseAutoplay, resetTouchGesture, resolveNodes, resumeAutoplay, scheduleScrollSync, scrollTo, setActiveIndexFromOffset, slideCount, wrapperNodeRef]);
}
