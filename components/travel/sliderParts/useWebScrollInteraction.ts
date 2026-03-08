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
  /** Set active index */
  setActiveIndex: (idx: number) => void;
  /** Programmatic scroll-to function */
  scrollTo: (idx: number, animated?: boolean) => void;
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
    setActiveIndex,
    scrollTo,
    enablePrefetch,
    dismissSwipeHint,
    pauseAutoplay,
    resumeAutoplay,
    isMobile = false,
  } = options;

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snap helper
  const snapToSlide = useCallback(
    (targetIdx: number) => {
      const node = scrollNodeRef.current;
      if (!node) return;
      const cw = containerWRef.current || 1;
      node.classList.add('slider-snap-disabled');
      node.scrollLeft = targetIdx * cw;
      setActiveIndex(targetIdx);
      requestAnimationFrame(() => {
        node.scrollLeft = targetIdx * cw;
        requestAnimationFrame(() => {
          node.classList.remove('slider-snap-disabled');
        });
      });
    },
    [scrollNodeRef, containerWRef, setActiveIndex],
  );

  const settleToNearestSlide = useCallback(() => {
    const node = scrollNodeRef.current;
    if (!node) return;
    const cw = containerWRef.current || 1;
    const idx = Math.round(node.scrollLeft / cw);
    const target = clamp(idx, 0, Math.max(0, slideCount - 1));
    snapToSlide(target);
    node.style.scrollSnapType = '';
  }, [scrollNodeRef, containerWRef, slideCount, snapToSlide]);

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
        const target = (indexRef.current - 1 + slideCount) % Math.max(1, slideCount);
        scrollTo(target);
      } else if (e.key === 'ArrowRight') {
        const target = (indexRef.current + 1) % slideCount;
        scrollTo(target);
      }
    };

    // Mouse drag (desktop/tablet only). On mobile browsers synthesized mouse events
    // can interfere with native touch scroll-snap.
    const onMouseDown = !isMobile ? (e: MouseEvent) => {
      if (e.button !== 0) return;
      dismissSwipeHint?.();
      enablePrefetch?.();
      pauseAutoplay?.();
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      dragStartIndexRef.current = indexRef.current;
      node.style.cursor = 'grabbing';
      node.style.scrollSnapType = 'none';
      node.style.userSelect = 'none';
    } : null;

    const onMouseMove = !isMobile ? (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const dx = e.pageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    } : null;

    const onMouseUp = !isMobile ? (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      node.style.cursor = '';
      node.style.userSelect = '';
      const dx = e.pageX - dragStartXRef.current;
      const cw = containerWRef.current || 1;
      const cur = dragStartIndexRef.current;
      const threshold = cw * 0.15;
      let target = cur;
      if (dx < -threshold) target = cur + 1;
      else if (dx > threshold) target = cur - 1;
      target = clamp(target, 0, Math.max(0, slideCount - 1));
      snapToSlide(target);
      node.style.scrollSnapType = '';
      resumeAutoplay?.();
    } : null;

    const onMouseLeave = !isMobile ? () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      node.style.cursor = '';
      node.style.userSelect = '';
      settleToNearestSlide();
      resumeAutoplay?.();
    } : null;

    // Touch / pointer swipe — only on non-mobile (desktop/tablet).
    // On mobile phones, native CSS scroll-snap provides GPU-accelerated swiping
    // that is far smoother than JS-based manual scrollLeft management.
    // A lightweight passive touchstart listener still fires prefetch/dismiss.
    const isTouchPointerEvent = (e: PointerEvent) => {
      return (e as any).pointerType === 'touch' || (e as any).pointerType === 'pen';
    };

    const onPointerDown = !isMobile ? (e: PointerEvent) => {
      if (!isTouchPointerEvent(e)) return;
      dismissSwipeHint?.();
      enablePrefetch?.();
      pauseAutoplay?.();
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      dragStartIndexRef.current = indexRef.current;
      node.style.scrollSnapType = 'none';
      try { e.preventDefault(); } catch { /* noop */ }
    } : null;

    const onPointerMove = !isMobile ? (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!isTouchPointerEvent(e)) return;
      try { e.preventDefault(); } catch { /* noop */ }
      const dx = e.pageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    } : null;

    const onPointerUp = !isMobile ? (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!isTouchPointerEvent(e)) return;
      isDraggingRef.current = false;
      settleToNearestSlide();
      resumeAutoplay?.();
    } : null;

    const onPointerCancel = !isMobile ? (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!isTouchPointerEvent(e)) return;
      isDraggingRef.current = false;
      settleToNearestSlide();
      resumeAutoplay?.();
    } : null;

    // On mobile: lightweight passive touch listener for prefetch/dismiss only
    // On non-mobile: full manual touch drag (iOS Safari fallback for PointerEvent)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      dismissSwipeHint?.();
      enablePrefetch?.();
      if (isMobile) return; // let native scroll-snap handle the rest
      pauseAutoplay?.();
      isDraggingRef.current = true;
      dragStartXRef.current = e.touches[0].pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      dragStartIndexRef.current = indexRef.current;
      node.style.scrollSnapType = 'none';
    };

    const onTouchMove = !isMobile ? (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].pageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    } : null;

    const onTouchEnd = !isMobile ? () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      settleToNearestSlide();
      resumeAutoplay?.();
    } : null;

    const onScrollEnd = () => {
      const cw = containerWRef.current || 1;
      const idx = Math.round(node.scrollLeft / cw);
      const target = clamp(idx, 0, Math.max(0, slideCount - 1));
      setActiveIndex(target);
    };

    // Attach listeners
    parent?.addEventListener('keydown', handleKeyDown as EventListener);
    if (onMouseDown) node.addEventListener('mousedown', onMouseDown);
    if (onMouseMove) window.addEventListener('mousemove', onMouseMove);
    if (onMouseUp) window.addEventListener('mouseup', onMouseUp);
    if (onMouseLeave) node.addEventListener('mouseleave', onMouseLeave);
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
      node.removeEventListener('scrollend', onScrollEnd);

      if (onPointerDown) node.removeEventListener('pointerdown', onPointerDown as EventListener);
      if (onPointerMove) node.removeEventListener('pointermove', onPointerMove as EventListener);
      if (onPointerUp) node.removeEventListener('pointerup', onPointerUp as EventListener);
      if (onPointerCancel) node.removeEventListener('pointercancel', onPointerCancel as EventListener);

      node.removeEventListener('touchstart', onTouchStart as EventListener);
      if (onTouchMove) node.removeEventListener('touchmove', onTouchMove as EventListener);
      if (onTouchEnd) node.removeEventListener('touchend', onTouchEnd as EventListener);

      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissSwipeHint, enablePrefetch, pauseAutoplay, resumeAutoplay, slideCount, setActiveIndex, scrollTo, resolveNodes, isMobile]);
}
