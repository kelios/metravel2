import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  State,
} from 'react-native-gesture-handler';

import ImageCardMedia from '@/components/ui/ImageCardMedia';

type ZoomableGalleryImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: 'low' | 'normal' | 'high';
  resetKey?: string | number | boolean;
  onInteractionChange?: (active: boolean) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function ZoomableGalleryImage({
  src,
  alt,
  width,
  height,
  priority = 'normal',
  resetKey,
  onInteractionChange,
}: ZoomableGalleryImageProps) {
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseTranslateX = useRef(new Animated.Value(0)).current;
  const baseTranslateY = useRef(new Animated.Value(0)).current;
  const panTranslateX = useRef(new Animated.Value(0)).current;
  const panTranslateY = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(1);
  const translateValue = useRef({ x: 0, y: 0 });
  const interactionChangeRef = useRef(onInteractionChange);
  const [isZoomed, setIsZoomed] = useState(false);
  interactionChangeRef.current = onInteractionChange;

  const animatedScale = useMemo(
    () => Animated.multiply(baseScale, pinchScale),
    [baseScale, pinchScale],
  );
  const animatedTranslateX = useMemo(
    () => Animated.add(baseTranslateX, panTranslateX),
    [baseTranslateX, panTranslateX],
  );
  const animatedTranslateY = useMemo(
    () => Animated.add(baseTranslateY, panTranslateY),
    [baseTranslateY, panTranslateY],
  );

  const setBaseTransform = useCallback(
    (nextScale: number, nextX: number, nextY: number) => {
      const maxX = Math.max(0, (width * (nextScale - 1)) / 2);
      const maxY = Math.max(0, (height * (nextScale - 1)) / 2);
      const clampedX = clamp(nextX, -maxX, maxX);
      const clampedY = clamp(nextY, -maxY, maxY);

      scaleValue.current = nextScale;
      translateValue.current = { x: clampedX, y: clampedY };
      baseScale.setValue(nextScale);
      baseTranslateX.setValue(clampedX);
      baseTranslateY.setValue(clampedY);
      pinchScale.setValue(1);
      panTranslateX.setValue(0);
      panTranslateY.setValue(0);
    },
    [baseScale, baseTranslateX, baseTranslateY, height, panTranslateX, panTranslateY, pinchScale, width],
  );

  const reset = useCallback(() => {
    setBaseTransform(1, 0, 0);
    setIsZoomed(false);
    interactionChangeRef.current?.(false);
  }, [setBaseTransform]);

  useEffect(() => {
    reset();
  }, [height, reset, resetKey, src, width]);

  const onPinchEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { scale: pinchScale } }], {
        useNativeDriver: false,
      }),
    [pinchScale],
  );

  const onPanEvent = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { translationX: panTranslateX, translationY: panTranslateY } }],
        { useNativeDriver: false },
      ),
    [panTranslateX, panTranslateY],
  );

  const handlePinchStateChange = useCallback(
    (event: any) => {
      const { state, oldState, scale = 1 } = event.nativeEvent;
      if (state === State.ACTIVE) {
        interactionChangeRef.current?.(true);
      }
      if (oldState !== State.ACTIVE) return;

      const nextScale = clamp(scaleValue.current * Number(scale || 1), MIN_SCALE, MAX_SCALE);
      if (nextScale <= MIN_SCALE + 0.02) {
        reset();
        return;
      }

      setBaseTransform(nextScale, translateValue.current.x, translateValue.current.y);
      setIsZoomed(true);
      interactionChangeRef.current?.(true);
    },
    [reset, setBaseTransform],
  );

  const handlePanStateChange = useCallback(
    (event: any) => {
      const { state, oldState, translationX = 0, translationY = 0 } = event.nativeEvent;
      if (state === State.ACTIVE) {
        interactionChangeRef.current?.(true);
      }
      if (oldState !== State.ACTIVE) return;

      setBaseTransform(
        scaleValue.current,
        translateValue.current.x + Number(translationX || 0),
        translateValue.current.y + Number(translationY || 0),
      );
    },
    [setBaseTransform],
  );

  return (
    <GestureHandlerRootView
      testID="travel-zoomable-image"
      style={[styles.viewport, { width, height }]}
      accessibilityLabel={`${alt}. Увеличение двумя пальцами`}
    >
      <PanGestureHandler
        ref={panRef}
        enabled={isZoomed}
        simultaneousHandlers={pinchRef}
        onGestureEvent={onPanEvent}
        onHandlerStateChange={handlePanStateChange}
      >
        <Animated.View style={[styles.viewport, { width, height }]}>
          <PinchGestureHandler
            ref={pinchRef}
            simultaneousHandlers={panRef}
            onGestureEvent={onPinchEvent}
            onHandlerStateChange={handlePinchStateChange}
          >
            <Animated.View
              style={[
                styles.imageContainer,
                { width, height },
                {
                  transform: [
                    { translateX: animatedTranslateX },
                    { translateY: animatedTranslateY },
                    { scale: animatedScale },
                  ],
                },
              ]}
            >
              <ImageCardMedia
                src={src}
                style={{ width, height }}
                fit="contain"
                blurBackground
                allowCriticalWebBlur
                blurRadius={18}
                loading="eager"
                priority={priority}
                transition={200}
                alt={alt}
              />
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
