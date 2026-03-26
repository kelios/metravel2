import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { clamp } from './utils';

// ---------------------------------------------------------------------------
// DOM node resolution helper
// ---------------------------------------------------------------------------

export function getDomNode(target: unknown): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  const anyTarget = target as Record<string, unknown>;
  if (anyTarget._nativeNode instanceof HTMLElement) return anyTarget._nativeNode;
  if (anyTarget._domNode instanceof HTMLElement) return anyTarget._domNode;
  if (typeof anyTarget.getNode === 'function') {
    const node = (anyTarget.getNode as () => unknown)();
    if (node instanceof HTMLElement) return node;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSliderTrackOptions {
  containerWRef: React.MutableRefObject<number>;
  indexRef: React.MutableRefObject<number>;
  maxIndex: number;
  renderedSlideWidth: number;
  setContainerWidth: (w: number) => void;
  /** Called when animateToIndex navigates. Return overlay decision externally. */
  onBeforeNavigate?: (fromIdx: number, toIdx: number) => void;
}

export interface UseSliderTrackResult {
  wrapperRef: React.RefObject<any>;
  viewportRef: React.RefObject<any>;
  trackRef: React.RefObject<any>;
  layoutMeasured: boolean;
  measuredSlideWidth: number | null;
  /** Current rendered slide width (measured ?? containerW) */
  effectiveSlideWidth: number;
  applyOffset: (offset: number, withTransition: boolean, durationMs?: number) => void;
  snapOffsetForIndex: (idx: number, widthOverride?: number) => number;
  animateToIndex: (idx: number, animated?: boolean) => void;
  stopAnimation: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSliderTrack(options: UseSliderTrackOptions): UseSliderTrackResult {
  const {
    containerWRef,
    indexRef,
    maxIndex,
    renderedSlideWidth: renderedSlideWidthProp,
    setContainerWidth,
    onBeforeNavigate,
  } = options;

  const [layoutMeasured, setLayoutMeasured] = useState(false);
  const [measuredSlideWidth, setMeasuredSlideWidth] = useState<number | null>(null);

  const wrapperRef = useRef<any>(null);
  const viewportRef = useRef<any>(null);
  const trackRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualOffsetRef = useRef(0);
  const measuredWidthRef = useRef<number | null>(null);

  const renderedSlideWidth = measuredSlideWidth ?? renderedSlideWidthProp;

  // ----- Core helpers -----

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const applyOffset = useCallback(
    (offset: number, withTransition: boolean, durationMs = 280) => {
      const roundedOffset = Math.round(offset);
      const previousRoundedOffset = Math.round(visualOffsetRef.current);
      const trackNode = getDomNode(trackRef.current);
      if (!trackNode) {
        visualOffsetRef.current = offset;
        return;
      }
      if (!withTransition && previousRoundedOffset === roundedOffset) {
        return;
      }
      visualOffsetRef.current = offset;
      trackNode.style.transition = withTransition
        ? `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : 'none';
      trackNode.style.transform = `translate3d(${roundedOffset}px, 0, 0)`;
    },
    [],
  );

  const snapOffsetForIndex = useCallback(
    (idx: number, widthOverride?: number) => {
      const width = widthOverride ?? containerWRef.current ?? renderedSlideWidth;
      return -clamp(idx, 0, maxIndex) * width;
    },
    [containerWRef, maxIndex, renderedSlideWidth],
  );

  const animateToIndex = useCallback(
    (idx: number, animated = true) => {
      const clampedIndex = clamp(idx, 0, maxIndex);
      const currentSlideIndex = indexRef.current;

      if (clampedIndex !== currentSlideIndex) {
        onBeforeNavigate?.(currentSlideIndex, clampedIndex);
      }

      const targetOffset = snapOffsetForIndex(clampedIndex);
      stopAnimation();
      applyOffset(targetOffset, animated);
    },
    [applyOffset, indexRef, maxIndex, onBeforeNavigate, snapOffsetForIndex, stopAnimation],
  );

  // ----- Width measurement -----

  const syncWidthFromDom = useCallback(() => {
    const wrapperNode = getDomNode(wrapperRef.current);
    if (!wrapperNode) return;

    const width = wrapperNode?.getBoundingClientRect?.().width ?? 0;
    if (!Number.isFinite(width) || width <= 0) {
      // Retry after a short delay if width is not available yet
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          const retryWidth = wrapperNode?.getBoundingClientRect?.().width ?? 0;
          if (Number.isFinite(retryWidth) && retryWidth > 0) {
            const roundedWidth = Math.round(retryWidth);
            if (
              measuredWidthRef.current !== null &&
              Math.abs(measuredWidthRef.current - roundedWidth) <= 1
            ) {
              return;
            }
            measuredWidthRef.current = roundedWidth;
            setMeasuredSlideWidth(roundedWidth);
            setLayoutMeasured(true);
            setContainerWidth(roundedWidth);
            applyOffset(snapOffsetForIndex(indexRef.current, roundedWidth), false);
          }
        });
      }
      return;
    }
    const roundedWidth = Math.round(width);
    if (
      measuredWidthRef.current !== null &&
      Math.abs(measuredWidthRef.current - roundedWidth) <= 1
    ) {
      return;
    }
    measuredWidthRef.current = roundedWidth;
    setMeasuredSlideWidth(roundedWidth);
    setLayoutMeasured(true);
    setContainerWidth(roundedWidth);
    applyOffset(snapOffsetForIndex(indexRef.current, roundedWidth), false);
  }, [applyOffset, indexRef, setContainerWidth, snapOffsetForIndex]);

  useEffect(() => {
    syncWidthFromDom();
    const wrapperNode = getDomNode(wrapperRef.current);
    if (!wrapperNode) return;

    const canUseResizeObserver =
      typeof (globalThis as any).ResizeObserver !== 'undefined' &&
      typeof wrapperNode === 'object' &&
      wrapperNode.nodeType === 1;

    let observer: ResizeObserver | null = null;
    if (canUseResizeObserver) {
      observer = new ResizeObserver(() => syncWidthFromDom());
      observer.observe(wrapperNode);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncWidthFromDom);
    }

    return () => {
      observer?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncWidthFromDom);
      }
    };
  }, [syncWidthFromDom]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const width = e.nativeEvent.layout.width;
      if (!Number.isFinite(width) || width <= 0) return;
      const roundedWidth = Math.round(width);
      if (
        measuredWidthRef.current !== null &&
        Math.abs(measuredWidthRef.current - roundedWidth) <= 1
      ) {
        return;
      }
      measuredWidthRef.current = roundedWidth;
      setMeasuredSlideWidth(roundedWidth);
      setContainerWidth(roundedWidth);
      setLayoutMeasured(true);
      applyOffset(snapOffsetForIndex(indexRef.current, roundedWidth), false);
    },
    [applyOffset, indexRef, setContainerWidth, snapOffsetForIndex],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  return {
    wrapperRef,
    viewportRef,
    trackRef,
    layoutMeasured,
    measuredSlideWidth,
    effectiveSlideWidth: renderedSlideWidth,
    applyOffset,
    snapOffsetForIndex,
    animateToIndex,
    stopAnimation,
    onLayout,
  };
}
