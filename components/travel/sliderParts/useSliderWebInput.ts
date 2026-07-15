import { useEffect, useRef } from 'react';

import { clamp } from './utils';

type NumberRef = { current: number };
type BooleanRef = { current: boolean };
type MouseEventWithSourceCapabilities = MouseEvent & {
  sourceCapabilities?: { firesTouchEvents?: boolean };
};

export const useSliderWebInput = ({
  containerWRef,
  dismissSwipeHint,
  enablePrefetch,
  getScrollNode,
  imagesLength,
  indexRef,
  isDraggingRef,
  nodeReady,
  scrollTo,
  setActiveIndex,
}: {
  containerWRef: NumberRef;
  dismissSwipeHint: () => void;
  enablePrefetch: () => void;
  getScrollNode: () => HTMLElement | null;
  imagesLength: number;
  indexRef: NumberRef;
  isDraggingRef: BooleanRef;
  nodeReady: boolean;
  scrollTo: (index: number) => void;
  setActiveIndex: (index: number) => void;
}) => {
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  // Keyboard navigation (web only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        dismissSwipeHint();
        enablePrefetch();
        const target = (indexRef.current - 1 + imagesLength) % Math.max(1, imagesLength);
        scrollTo(target);
      } else if (e.key === 'ArrowRight') {
        dismissSwipeHint();
        enablePrefetch();
        const target = (indexRef.current + 1) % Math.max(1, imagesLength);
        scrollTo(target);
      }
    };
    const node = getScrollNode();
    if (!node) return;
    const parent = (node.closest?.('[data-testid="slider-wrapper"]') || node.parentElement?.parentElement) as HTMLElement | null;
    if (!parent) return;
    parent.setAttribute('tabindex', '0');
    parent.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      parent.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [getScrollNode, dismissSwipeHint, enablePrefetch, indexRef, imagesLength, scrollTo, nodeReady]);

  // Mouse drag (web only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const node = getScrollNode();
    if (!node) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Skip mouse drag on touch devices — let native scroll-snap handle it
      if ((e as MouseEventWithSourceCapabilities).sourceCapabilities?.firesTouchEvents) return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      node.style.cursor = 'grabbing';
      node.style.scrollSnapType = 'none';
      node.style.userSelect = 'none';
    };

    // Coalesce scrollLeft writes to one per frame: multiple mousemove events
    // can fire within a single frame, and each synchronous scrollLeft write
    // forces layout. rAF batching keeps the drag visually identical (writes
    // are bounded by display refresh anyway) while avoiding layout thrashing.
    let pendingPageX = 0;
    let moveRaf: number | null = null;
    const flushMove = () => {
      moveRaf = null;
      const dx = pendingPageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      pendingPageX = e.pageX;
      if (moveRaf != null) return;
      moveRaf = requestAnimationFrame(flushMove);
    };

    const snapToSlide = (targetIdx: number) => {
      const cw = containerWRef.current || 1;
      node.scrollLeft = targetIdx * cw;
      setActiveIndex(targetIdx);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.style.scrollSnapType = 'x mandatory';
        });
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      node.style.cursor = '';
      node.style.userSelect = '';
      const dx = e.pageX - dragStartXRef.current;
      const cw = containerWRef.current || 1;
      const cur = indexRef.current;
      const threshold = cw * 0.15;
      let target = cur;
      if (dx < -threshold) target = cur + 1;
      else if (dx > threshold) target = cur - 1;
      target = clamp(target, 0, Math.max(0, imagesLength - 1));
      snapToSlide(target);
    };

    const onMouseLeave = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      node.style.cursor = '';
      node.style.userSelect = '';
      const cw = containerWRef.current || 1;
      const idx = Math.round(node.scrollLeft / cw);
      const target = clamp(idx, 0, Math.max(0, imagesLength - 1));
      snapToSlide(target);
    };

    const onScrollEnd = () => {
      const cw = containerWRef.current || 1;
      const idx = Math.round(node.scrollLeft / cw);
      const target = clamp(idx, 0, Math.max(0, imagesLength - 1));
      setActiveIndex(target);
    };

    // Safari doesn't support 'scrollend' — use a scroll-idle fallback
    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
    const supportsScrollEnd = 'onscrollend' in window;

    const onScrollForEnd = () => {
      if (supportsScrollEnd) return;
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(onScrollEnd, 120);
    };

    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    node.addEventListener('mouseleave', onMouseLeave);
    if (supportsScrollEnd) {
      node.addEventListener('scrollend', onScrollEnd);
    }
    node.addEventListener('scroll', onScrollForEnd, { passive: true });
    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      node.removeEventListener('mouseleave', onMouseLeave);
      if (supportsScrollEnd) {
        node.removeEventListener('scrollend', onScrollEnd);
      }
      node.removeEventListener('scroll', onScrollForEnd);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      if (moveRaf != null) cancelAnimationFrame(moveRaf);
    };
  }, [imagesLength, setActiveIndex, getScrollNode, containerWRef, indexRef, isDraggingRef, nodeReady]);
};
