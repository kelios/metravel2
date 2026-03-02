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
  /** Whether autoplay is paused */
  pausedByTouchRef: React.MutableRefObject<boolean>;
  /** Pause autoplay */
  pauseAutoplay?: () => void;
  /** Resume autoplay */
  resumeAutoplay?: () => void;
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
      if (e.key === 'ArrowLeft') {
        const target = (indexRef.current - 1 + slideCount) % Math.max(1, slideCount);
        scrollTo(target);
      } else if (e.key === 'ArrowRight') {
        const target = (indexRef.current + 1) % slideCount;
        scrollTo(target);
      }
    };

    // Mouse drag
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      dragStartIndexRef.current = indexRef.current;
      node.style.cursor = 'grabbing';
      node.style.scrollSnapType = 'none';
      node.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const dx = e.pageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    };

    const onMouseUp = (e: MouseEvent) => {
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
    };

    const onMouseLeave = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      node.style.cursor = '';
      node.style.userSelect = '';
      settleToNearestSlide();
    };

    // Touch / pointer swipe (mobile web)
    const isTouchPointerEvent = (e: PointerEvent) => {
      return (e as any).pointerType === 'touch' || (e as any).pointerType === 'pen';
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!isTouchPointerEvent(e)) return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      dragStartIndexRef.current = indexRef.current;
      node.style.scrollSnapType = 'none';
      try { e.preventDefault(); } catch { /* noop */ }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!isTouchPointerEvent(e)) return;
      try { e.preventDefault(); } catch { /* noop */ }
      const dx = e.pageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!isTouchPointerEvent(e)) return;
      isDraggingRef.current = false;
      settleToNearestSlide();
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!isTouchPointerEvent(e)) return;
      isDraggingRef.current = false;
      settleToNearestSlide();
    };

    // iOS Safari fallback (no PointerEvent)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.touches[0].pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      dragStartIndexRef.current = indexRef.current;
      node.style.scrollSnapType = 'none';
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].pageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    };

    const onTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      settleToNearestSlide();
    };

    const onScrollEnd = () => {
      const cw = containerWRef.current || 1;
      const idx = Math.round(node.scrollLeft / cw);
      const target = clamp(idx, 0, Math.max(0, slideCount - 1));
      setActiveIndex(target);
    };

    // Attach listeners
    parent?.addEventListener('keydown', handleKeyDown as EventListener);
    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('scrollend', onScrollEnd);

    node.addEventListener('pointerdown', onPointerDown as EventListener, { passive: false } as any);
    node.addEventListener('pointermove', onPointerMove as EventListener, { passive: false } as any);
    node.addEventListener('pointerup', onPointerUp as EventListener, { passive: true } as any);
    node.addEventListener('pointercancel', onPointerCancel as EventListener, { passive: true } as any);

    node.addEventListener('touchstart', onTouchStart as EventListener, { passive: true } as any);
    node.addEventListener('touchmove', onTouchMove as EventListener, { passive: true } as any);
    node.addEventListener('touchend', onTouchEnd as EventListener, { passive: true } as any);

    return () => {
      parent?.removeEventListener('keydown', handleKeyDown as EventListener);
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      node.removeEventListener('mouseleave', onMouseLeave);
      node.removeEventListener('scrollend', onScrollEnd);

      node.removeEventListener('pointerdown', onPointerDown as EventListener);
      node.removeEventListener('pointermove', onPointerMove as EventListener);
      node.removeEventListener('pointerup', onPointerUp as EventListener);
      node.removeEventListener('pointercancel', onPointerCancel as EventListener);

      node.removeEventListener('touchstart', onTouchStart as EventListener);
      node.removeEventListener('touchmove', onTouchMove as EventListener);
      node.removeEventListener('touchend', onTouchEnd as EventListener);

      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideCount, setActiveIndex, scrollTo, resolveNodes]);
}

