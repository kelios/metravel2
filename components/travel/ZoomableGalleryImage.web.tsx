import React, { useCallback, useEffect, useRef, useState } from 'react';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { translate as i18nT } from '@/i18n'


type ZoomableGalleryImageProps = {
  src: string;
  alt: string;
  width: number | string;
  height: number | string;
  priority?: 'low' | 'normal' | 'high';
  resetKey?: string | number | boolean;
  onInteractionChange?: (active: boolean) => void;
};

type Point = { x: number; y: number };
type Transform = { scale: number; x: number; y: number };
type GestureStart = {
  distance: number;
  center: Point;
  transform: Transform;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const INITIAL_TRANSFORM: Transform = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getPairMetrics = (points: Point[]) => {
  const [first, second] = points;
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    center: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
  };
};

export default function ZoomableGalleryImage({
  src,
  alt,
  width,
  height,
  priority = 'normal',
  resetKey,
  onInteractionChange,
}: ZoomableGalleryImageProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const gestureStart = useRef<GestureStart | null>(null);
  const panStart = useRef<{ point: Point; transform: Transform } | null>(null);
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);
  const transformRef = useRef<Transform>(INITIAL_TRANSFORM);
  const interactionChangeRef = useRef(onInteractionChange);
  interactionChangeRef.current = onInteractionChange;

  const commitTransform = useCallback((next: Transform) => {
    const viewport = viewportRef.current;
    const viewportWidth = viewport?.clientWidth || 0;
    const viewportHeight = viewport?.clientHeight || 0;
    const maxX = Math.max(0, (viewportWidth * (next.scale - 1)) / 2);
    const maxY = Math.max(0, (viewportHeight * (next.scale - 1)) / 2);
    const normalized = {
      scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
    transformRef.current = normalized;
    setTransform(normalized);
  }, []);

  const reset = useCallback(() => {
    pointers.current.clear();
    gestureStart.current = null;
    panStart.current = null;
    transformRef.current = INITIAL_TRANSFORM;
    setTransform(INITIAL_TRANSFORM);
    interactionChangeRef.current?.(false);
  }, []);

  useEffect(() => {
    reset();
  }, [height, reset, resetKey, src, width]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size >= 2) {
      event.preventDefault();
      const metrics = getPairMetrics(Array.from(pointers.current.values()).slice(0, 2));
      gestureStart.current = { ...metrics, transform: transformRef.current };
      panStart.current = null;
      interactionChangeRef.current?.(true);
      pointers.current.forEach((_value, pointerId) => {
        try {
          event.currentTarget.setPointerCapture?.(pointerId);
        } catch {
          // Pointer capture is best-effort on older mobile browsers.
        }
      });
      return;
    }

    if (transformRef.current.scale > MIN_SCALE + 0.01) {
      event.preventDefault();
      panStart.current = { point, transform: transformRef.current };
      interactionChangeRef.current?.(true);
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // noop
      }
    }
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      event.preventDefault();
      const metrics = getPairMetrics(Array.from(pointers.current.values()).slice(0, 2));
      const start = gestureStart.current;
      if (!start) {
        gestureStart.current = { ...metrics, transform: transformRef.current };
        return;
      }
      const nextScale = clamp(
        start.transform.scale * (metrics.distance / start.distance),
        MIN_SCALE,
        MAX_SCALE,
      );
      commitTransform({
        scale: nextScale,
        x: start.transform.x + metrics.center.x - start.center.x,
        y: start.transform.y + metrics.center.y - start.center.y,
      });
      return;
    }

    if (transformRef.current.scale <= MIN_SCALE + 0.01) return;
    event.preventDefault();
    const start = panStart.current;
    if (!start) {
      panStart.current = {
        point: { x: event.clientX, y: event.clientY },
        transform: transformRef.current,
      };
      return;
    }
    commitTransform({
      scale: start.transform.scale,
      x: start.transform.x + event.clientX - start.point.x,
      y: start.transform.y + event.clientY - start.point.y,
    });
  }, [commitTransform]);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    gestureStart.current = null;

    const remaining = Array.from(pointers.current.values());
    if (remaining.length === 1 && transformRef.current.scale > MIN_SCALE + 0.01) {
      panStart.current = { point: remaining[0], transform: transformRef.current };
      return;
    }
    panStart.current = null;

    if (remaining.length === 0) {
      if (transformRef.current.scale <= MIN_SCALE + 0.02) {
        reset();
      } else {
        interactionChangeRef.current?.(true);
      }
    }
  }, [reset]);

  return (
    <div
      ref={viewportRef}
      data-testid="travel-zoomable-image"
      data-zoom-scale={transform.scale.toFixed(3)}
      aria-label={i18nT('travel:components.travel.ZoomableGalleryImage.value1_uvelichenie_dvumya_paltsami_1ef063e7', { value1: alt })}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onDoubleClick={reset}
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
        touchAction: transform.scale > MIN_SCALE + 0.01 ? 'none' : 'pan-x',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transformOrigin: 'center center',
          transition: pointers.current.size === 0 ? 'transform 160ms ease-out' : 'none',
          pointerEvents: 'none',
        }}
      >
        <ImageCardMedia
          src={src}
          style={{ width: '100%', height: '100%' }}
          fit="contain"
          blurBackground
          allowCriticalWebBlur
          blurRadius={18}
          loading="eager"
          priority={priority}
          transition={200}
          alt={alt}
        />
      </div>
    </div>
  );
}
