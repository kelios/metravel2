// components/travel/sliderParts/useWebScrollInteraction.ts
// Shared web gesture/pointer utility functions used by slider hooks.

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

export function shouldHandlePointerDragStart(
  pointerType: string | undefined,
  isMobile: boolean,
  rawTouchPathActive = isMobile,
): boolean {
  if (pointerType === 'mouse') return true;
  if (pointerType === 'touch') return !rawTouchPathActive;
  if (pointerType === 'pen') return true;
  return false;
}

export function getTouchGestureAxis(deltaX: number, deltaY: number): 'x' | 'y' | null {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < TOUCH_AXIS_THRESHOLD_PX && absY < TOUCH_AXIS_THRESHOLD_PX) return null;
  if (absX > absY + TOUCH_AXIS_DOMINANCE_PX) return 'x';
  if (absY > absX + TOUCH_AXIS_DOMINANCE_PX) return 'y';
  return null;
}
