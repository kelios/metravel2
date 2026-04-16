import { useCallback, useEffect, useRef } from 'react';
import { clamp } from './utils';
import { getTouchGestureAxis } from './useWebScrollInteraction';
import { getDomNode } from './useSliderTrack';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GestureAxis = 'x' | 'y' | null;

interface DragState {
  pointerId: number | null;
  pointerType: string | null;
  startX: number;
  startY: number;
  baseOffset: number;
  lastX: number;
  lastTs: number;
  velocity: number;
  axis: GestureAxis;
  hasMoved: boolean;
}

const initialDragState = (): DragState => ({
  pointerId: null,
  pointerType: null,
  startX: 0,
  startY: 0,
  baseOffset: 0,
  lastX: 0,
  lastTs: 0,
  velocity: 0,
  axis: null,
  hasMoved: false,
});

export interface UseSliderPointerDragOptions {
  viewportRef: React.RefObject<any>;
  wrapperRef: React.RefObject<any>;
  imagesLen: number;
  isMobile: boolean;
  maxIndex: number;
  indexRef: React.MutableRefObject<number>;
  containerWRef: React.MutableRefObject<number>;
  renderedSlideWidth: number;
  visualOffsetRef?: React.MutableRefObject<number>;
  applyOffset: (offset: number, withTransition: boolean, durationMs?: number) => void;
  snapOffsetForIndex: (idx: number, widthOverride?: number) => number;
  stopAnimation: () => void;
  scrollTo: (idx: number, animated?: boolean) => void;
  pauseAutoplay: () => void;
  resumeAutoplay: () => void;
  dismissSwipeHint: () => void;
  enablePrefetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSliderPointerDrag(options: UseSliderPointerDragOptions): void {
  const {
    viewportRef,
    wrapperRef,
    imagesLen,
    isMobile: _isMobile,
    maxIndex,
    indexRef,
    containerWRef,
    renderedSlideWidth,
    applyOffset,
    snapOffsetForIndex,
    stopAnimation,
    scrollTo,
    pauseAutoplay,
    resumeAutoplay,
    dismissSwipeHint,
    enablePrefetch,
  } = options;

  const dragStateRef = useRef<DragState>(initialDragState());
  const visualOffsetRef = useRef(0);

  // Keep visualOffsetRef in sync with applyOffset calls
  const applyOffsetTracked = useCallback(
    (offset: number, withTransition: boolean, durationMs?: number) => {
      visualOffsetRef.current = offset;
      applyOffset(offset, withTransition, durationMs);
    },
    [applyOffset],
  );

  // Keyboard navigation
  const onWrapperKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (imagesLen < 2) return;
      dismissSwipeHint();
      enablePrefetch();

      const key = event.key;
      if (key === 'ArrowLeft') {
        event.preventDefault();
        scrollTo(Math.max(0, indexRef.current - 1));
      } else if (key === 'ArrowRight') {
        event.preventDefault();
        scrollTo(Math.min(maxIndex, indexRef.current + 1));
      } else if (key === 'Home') {
        event.preventDefault();
        scrollTo(0);
      } else if (key === 'End') {
        event.preventDefault();
        scrollTo(maxIndex);
      }
    },
    [dismissSwipeHint, enablePrefetch, imagesLen, indexRef, maxIndex, scrollTo],
  );

  // Pointer events effect
  useEffect(() => {
    const viewportNode = getDomNode(viewportRef.current);
    const wrapperNode = getDomNode(wrapperRef.current);
    if (!viewportNode || !wrapperNode || typeof window === 'undefined') return;

    wrapperNode.setAttribute('tabindex', '0');

    const resetDrag = () => {
      const activePointerId = dragStateRef.current.pointerId;
      dragStateRef.current = initialDragState();
      viewportNode.style.cursor = '';
      viewportNode.style.userSelect = '';
      try {
        if (activePointerId != null) {
          viewportNode.releasePointerCapture(activePointerId);
        }
      } catch {
        // noop
      }
    };

    const beginPointer = (event: PointerEvent) => {
      if (imagesLen < 2) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      stopAnimation();
      pauseAutoplay();
      dismissSwipeHint();
      enablePrefetch();

      const baseOffset = snapOffsetForIndex(indexRef.current);
      dragStateRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType || null,
        startX: event.clientX,
        startY: event.clientY,
        baseOffset,
        lastX: event.clientX,
        lastTs: performance.now(),
        velocity: 0,
        axis: event.pointerType === 'mouse' ? 'x' : null,
        hasMoved: false,
      };

      applyOffsetTracked(baseOffset, false);

      // For mouse, capture immediately; for touch, defer capture until
      // horizontal axis is confirmed — iOS Safari cancels native scroll
      // if pointer is captured before the gesture direction is known.
      if (event.pointerType === 'mouse') {
        viewportNode.style.cursor = 'grabbing';
        viewportNode.style.userSelect = 'none';
        try {
          viewportNode.setPointerCapture(event.pointerId);
        } catch {
          // noop
        }
      }
    };

    const movePointer = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId == null || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;

      if (drag.axis == null) {
        drag.axis = getTouchGestureAxis(deltaX, deltaY);
        if (drag.axis === 'y') {
          resumeAutoplay();
          resetDrag();
          return;
        }
        if (drag.axis == null) return;

        // Axis just resolved to 'x' for a touch gesture — now safe to capture
        if (drag.pointerType !== 'mouse' && drag.pointerId != null) {
          viewportNode.style.userSelect = 'none';
          try {
            viewportNode.setPointerCapture(drag.pointerId);
          } catch {
            // noop
          }
        }
      }

      if (drag.axis !== 'x') return;

      drag.hasMoved = true;
      event.preventDefault();
      const nextOffset = clamp(
        drag.baseOffset + deltaX,
        snapOffsetForIndex(maxIndex) - 36,
        36,
      );
      applyOffsetTracked(nextOffset, false);

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTs);
      drag.velocity = (event.clientX - drag.lastX) / dt;
      drag.lastX = event.clientX;
      drag.lastTs = now;
    };

    const endPointer = (event?: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId == null) return;
      if (event && drag.pointerId !== event.pointerId) return;

      const width = containerWRef.current || renderedSlideWidth || 1;
      const projectedOffset =
        visualOffsetRef.current +
        drag.velocity * Math.min(220, Math.max(120, width * 0.28));
      const targetIndex = clamp(Math.round(-projectedOffset / width), 0, maxIndex);
      const draggedHorizontally = drag.axis === 'x' && drag.hasMoved;

      resetDrag();
      if (draggedHorizontally) {
        scrollTo(targetIndex, true);
      } else {
        applyOffsetTracked(snapOffsetForIndex(indexRef.current), true, 200);
      }
      resumeAutoplay();
    };

    const handleLostPointerCapture = () => {
      if (dragStateRef.current.pointerId == null) return;
      resetDrag();
      applyOffsetTracked(snapOffsetForIndex(indexRef.current), true, 200);
      resumeAutoplay();
    };

    viewportNode.addEventListener('pointerdown', beginPointer, { passive: true });
    viewportNode.addEventListener('pointermove', movePointer, { passive: false });
    viewportNode.addEventListener('pointerup', endPointer, { passive: true });
    viewportNode.addEventListener('pointercancel', endPointer, { passive: true });
    viewportNode.addEventListener('lostpointercapture', handleLostPointerCapture, {
      passive: true,
    } as any);
    wrapperNode.addEventListener('keydown', onWrapperKeyDown as EventListener);

    return () => {
      viewportNode.removeEventListener('pointerdown', beginPointer as EventListener);
      viewportNode.removeEventListener('pointermove', movePointer as EventListener);
      viewportNode.removeEventListener('pointerup', endPointer as EventListener);
      viewportNode.removeEventListener('pointercancel', endPointer as EventListener);
      viewportNode.removeEventListener(
        'lostpointercapture',
        handleLostPointerCapture as EventListener,
      );
      wrapperNode.removeEventListener('keydown', onWrapperKeyDown as EventListener);
      resetDrag();
    };
  }, [
    applyOffsetTracked,
    containerWRef,
    dismissSwipeHint,
    enablePrefetch,
    imagesLen,
    indexRef,
    maxIndex,
    onWrapperKeyDown,
    pauseAutoplay,
    renderedSlideWidth,
    resumeAutoplay,
    scrollTo,
    snapOffsetForIndex,
    stopAnimation,
    viewportRef,
    wrapperRef,
  ]);
}
