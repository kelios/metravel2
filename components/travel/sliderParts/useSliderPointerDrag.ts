import { useCallback, useEffect, useRef } from 'react';
import { clamp, resolveSwipeTargetIndex } from './utils';
import { getTouchGestureAxis } from './useWebScrollInteraction';
import { getDomNode } from './useSliderTrack';
import { isIOSWebKit } from '@/components/ui/ImageCardMediaWebHelpers';

// iOS Safari resolves the scroll/gesture arbitration within the first one or two
// `touchmove` events based on `touch-action` and whether `preventDefault` was
// called synchronously on a NON-passive `touchmove`. A late `preventDefault` on a
// `pointermove` (which is what the generic path does, only after 8px of travel)
// is ignored by WebKit — it has already committed the gesture and stops
// delivering further moves (or fires `pointercancel`). So on iOS Safari we drive
// the touch drag from raw touch events with `{ passive: false }` and claim the
// horizontal gesture on the very first dominant move.
const IOS_AXIS_THRESHOLD_PX = 4;

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

    // On iOS Safari the touch gesture is driven by raw touch events (below),
    // so the pointer path must handle mouse only — otherwise the touch-derived
    // pointer events would race the touch handlers over the shared drag state.
    const useTouchPath = isIOSWebKit();

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
      if (useTouchPath && event.pointerType !== 'mouse') return;
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
      const instant = (event.clientX - drag.lastX) / dt;
      // EMA-smooth velocity so a stale/missing final touchmove before release
      // (common on iOS Safari) still preserves the flick momentum.
      drag.velocity =
        drag.velocity === 0 ? instant : drag.velocity * 0.6 + instant * 0.4;
      drag.lastX = event.clientX;
      drag.lastTs = now;
    };

    const endPointer = (event?: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId == null) return;
      if (event && drag.pointerId !== event.pointerId) return;

      const width = containerWRef.current || renderedSlideWidth || 1;
      const targetIndex = resolveSwipeTargetIndex({
        currentIndex: indexRef.current,
        visualOffset: visualOffsetRef.current,
        velocity: drag.velocity,
        width,
        maxIndex,
      });
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

    // ---- iOS Safari touch path (passive:false touchmove, early preventDefault) ----
    const TOUCH_POINTER_ID = -100;

    const beginTouch = (event: TouchEvent) => {
      if (imagesLen < 2) return;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];

      stopAnimation();
      pauseAutoplay();
      dismissSwipeHint();
      enablePrefetch();

      const baseOffset = snapOffsetForIndex(indexRef.current);
      dragStateRef.current = {
        pointerId: TOUCH_POINTER_ID,
        pointerType: 'touch',
        startX: touch.clientX,
        startY: touch.clientY,
        baseOffset,
        lastX: touch.clientX,
        lastTs: performance.now(),
        velocity: 0,
        axis: null,
        hasMoved: false,
      };
      applyOffsetTracked(baseOffset, false);
    };

    const moveTouch = (event: TouchEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId !== TOUCH_POINTER_ID) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - drag.startX;
      const deltaY = touch.clientY - drag.startY;

      if (drag.axis == null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX < IOS_AXIS_THRESHOLD_PX && absY < IOS_AXIS_THRESHOLD_PX) return;
        if (absY > absX) {
          // Vertical intent — hand the gesture back to native page scroll.
          dragStateRef.current = initialDragState();
          viewportNode.style.userSelect = '';
          resumeAutoplay();
          return;
        }
        drag.axis = 'x';
        viewportNode.style.userSelect = 'none';
      }

      if (drag.axis !== 'x') return;

      // Claim the gesture synchronously on every horizontal move. This MUST run
      // on a non-passive listener or WebKit ignores it and scrolls the page.
      if (event.cancelable) event.preventDefault();

      drag.hasMoved = true;
      const nextOffset = clamp(
        drag.baseOffset + deltaX,
        snapOffsetForIndex(maxIndex) - 36,
        36,
      );
      applyOffsetTracked(nextOffset, false);

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTs);
      const instant = (touch.clientX - drag.lastX) / dt;
      // EMA-smooth velocity so a stale/missing final touchmove before release
      // (common on iOS Safari) still preserves the flick momentum.
      drag.velocity =
        drag.velocity === 0 ? instant : drag.velocity * 0.6 + instant * 0.4;
      drag.lastX = touch.clientX;
      drag.lastTs = now;
    };

    const endTouch = () => {
      const drag = dragStateRef.current;
      if (drag.pointerId !== TOUCH_POINTER_ID) return;

      const width = containerWRef.current || renderedSlideWidth || 1;
      const targetIndex = resolveSwipeTargetIndex({
        currentIndex: indexRef.current,
        visualOffset: visualOffsetRef.current,
        velocity: drag.velocity,
        width,
        maxIndex,
      });
      const draggedHorizontally = drag.axis === 'x' && drag.hasMoved;

      dragStateRef.current = initialDragState();
      viewportNode.style.userSelect = '';
      if (draggedHorizontally) {
        scrollTo(targetIndex, true);
      } else {
        applyOffsetTracked(snapOffsetForIndex(indexRef.current), true, 200);
      }
      resumeAutoplay();
    };

    if (useTouchPath) {
      // On iOS Safari, pointer events are a shim over touch events; using them
      // for the touch gesture loses the synchronous preventDefault that WebKit
      // requires. Drive touch from raw touch events and keep pointer events for
      // mouse only (where pointer capture + late preventDefault work fine).
      viewportNode.addEventListener('pointerdown', beginPointer, { passive: true });
      viewportNode.addEventListener('pointermove', movePointer, { passive: false });
      viewportNode.addEventListener('pointerup', endPointer, { passive: true });
      viewportNode.addEventListener('lostpointercapture', handleLostPointerCapture, {
        passive: true,
      } as any);
      viewportNode.addEventListener('touchstart', beginTouch, { passive: true, capture: true });
      viewportNode.addEventListener('touchmove', moveTouch, { passive: false, capture: true });
      viewportNode.addEventListener('touchend', endTouch, { passive: true });
      viewportNode.addEventListener('touchcancel', endTouch, { passive: true });
    } else {
      viewportNode.addEventListener('pointerdown', beginPointer, { passive: true });
      viewportNode.addEventListener('pointermove', movePointer, { passive: false });
      viewportNode.addEventListener('pointerup', endPointer, { passive: true });
      viewportNode.addEventListener('pointercancel', endPointer, { passive: true });
      viewportNode.addEventListener('lostpointercapture', handleLostPointerCapture, {
        passive: true,
      } as any);
    }
    wrapperNode.addEventListener('keydown', onWrapperKeyDown as EventListener);

    return () => {
      viewportNode.removeEventListener('pointerdown', beginPointer as EventListener);
      viewportNode.removeEventListener('pointermove', movePointer as EventListener);
      viewportNode.removeEventListener('pointerup', endPointer as EventListener);
      viewportNode.removeEventListener('pointercancel', endPointer as EventListener);
      viewportNode.removeEventListener('touchstart', beginTouch as EventListener, {
        capture: true,
      });
      viewportNode.removeEventListener('touchmove', moveTouch as EventListener, {
        capture: true,
      });
      viewportNode.removeEventListener('touchend', endTouch as EventListener);
      viewportNode.removeEventListener('touchcancel', endTouch as EventListener);
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
