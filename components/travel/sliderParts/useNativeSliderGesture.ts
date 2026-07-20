import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

type SliderListRef = {
  current: {
    scrollToOffset: (options: { offset: number; animated: boolean }) => void;
  } | null;
};

type MutableNumberRef = { current: number };

type UseNativeSliderGestureOptions = {
  containerW: number;
  containerWRef: MutableNumberRef;
  dismissSwipeHint: () => void;
  enablePrefetch: () => void;
  imagesLength: number;
  indexRef: MutableNumberRef;
  listRef: SliderListRef;
  loopEnabled: boolean;
  pauseAutoplay: () => void;
  reduceMotion: boolean;
  resumeAutoplay: () => void;
  scrollTo: (index: number, animated?: boolean) => void;
  setActiveIndex: (index: number) => void;
  setActiveIndexFromOffset: (offset: number) => void;
  toRawIndex: (index: number) => number;
  toRealIndex: (index: number) => number;
};

const readNativeTouchPageX = (event: any): number | null => {
  const nativeEvent = event?.nativeEvent;
  const candidate = nativeEvent?.pageX
    ?? nativeEvent?.changedTouches?.[0]?.pageX
    ?? nativeEvent?.touches?.[0]?.pageX;
  return Number.isFinite(candidate) ? candidate : null;
};

export const useNativeSliderGesture = ({
  containerW,
  containerWRef,
  dismissSwipeHint,
  enablePrefetch,
  imagesLength,
  indexRef,
  listRef,
  loopEnabled,
  pauseAutoplay,
  reduceMotion,
  resumeAutoplay,
  scrollTo,
  setActiveIndex,
  setActiveIndexFromOffset,
  toRawIndex,
  toRealIndex,
}: UseNativeSliderGestureOptions) => {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartIndexRef = useRef(0);
  const forcedTargetRawIndexRef = useRef<number | null>(null);

  const onMomentumScrollEnd = useCallback(
    (event: any) => {
      const offsetX = event?.nativeEvent?.contentOffset?.x ?? 0;
      const liveWidth = containerWRef.current || containerW || 1;
      const rawIndex = Math.round(offsetX / liveWidth);
      const forcedTarget = forcedTargetRawIndexRef.current;
      if (forcedTarget != null && rawIndex !== forcedTarget) {
        listRef.current?.scrollToOffset({
          offset: forcedTarget * liveWidth,
          animated: Platform.OS === 'android' ? false : !reduceMotion,
        });
        return;
      }
      forcedTargetRawIndexRef.current = null;
      if (loopEnabled) {
        if (rawIndex <= 0) {
          listRef.current?.scrollToOffset({
            offset: imagesLength * liveWidth,
            animated: false,
          });
          setActiveIndex(imagesLength - 1);
          return;
        }
        if (rawIndex >= imagesLength + 1) {
          listRef.current?.scrollToOffset({ offset: liveWidth, animated: false });
          setActiveIndex(0);
          return;
        }
        setActiveIndex(toRealIndex(rawIndex));
        return;
      }
      setActiveIndexFromOffset(offsetX);
    },
    [
      containerW,
      containerWRef,
      imagesLength,
      listRef,
      loopEnabled,
      reduceMotion,
      setActiveIndex,
      setActiveIndexFromOffset,
      toRealIndex,
    ]
  );

  const onNativeScrollBeginDrag = useCallback(() => {
    forcedTargetRawIndexRef.current = null;
    pauseAutoplay();
    dismissSwipeHint();
    enablePrefetch();
  }, [dismissSwipeHint, enablePrefetch, pauseAutoplay]);

  const settleNativeGesture = useCallback(
    (targetRealIndex: number) => {
      forcedTargetRawIndexRef.current = toRawIndex(targetRealIndex);
      scrollTo(targetRealIndex, false);
    },
    [scrollTo, toRawIndex]
  );

  const onNativeScrollEndDrag = useCallback(
    (event: any) => {
      resumeAutoplay();
      if (imagesLength <= 1 || forcedTargetRawIndexRef.current != null) return;

      const offsetX = event?.nativeEvent?.contentOffset?.x;
      if (!Number.isFinite(offsetX)) return;
      const liveWidth = containerWRef.current || containerW || 1;
      const startRealIndex = touchStartIndexRef.current;
      const startRawIndex = toRawIndex(startRealIndex);
      const displacement = offsetX - startRawIndex * liveWidth;
      const velocityX = event?.nativeEvent?.velocity?.x;
      const hasDisplacement = Math.abs(displacement) >= 12;
      const hasVelocity = Number.isFinite(velocityX) && Math.abs(velocityX) >= 0.05;
      if (!hasDisplacement && !hasVelocity) return;

      const direction = hasDisplacement
        ? displacement > 0 ? 1 : -1
        : velocityX > 0 ? 1 : -1;
      const targetRealIndex = (
        startRealIndex + direction + imagesLength
      ) % imagesLength;
      settleNativeGesture(targetRealIndex);
    },
    [containerW, containerWRef, imagesLength, resumeAutoplay, settleNativeGesture, toRawIndex]
  );

  const onNativeTouchStart = useCallback(
    (event: any) => {
      touchStartXRef.current = readNativeTouchPageX(event);
      touchStartIndexRef.current = indexRef.current;
    },
    [indexRef]
  );

  const onNativeTouchEnd = useCallback(
    (event: any) => {
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      const endX = readNativeTouchPageX(event);
      if (startX == null || endX == null || imagesLength <= 1) return;

      const fingerDeltaX = endX - startX;
      // Bitmap uploads can make Android drop move samples. The complete finger
      // path is more reliable than the FlatList offset for a short, deliberate swipe.
      if (Math.abs(fingerDeltaX) < 24) return;
      const direction = fingerDeltaX < 0 ? 1 : -1;
      const targetRealIndex = (
        touchStartIndexRef.current + direction + imagesLength
      ) % imagesLength;
      settleNativeGesture(targetRealIndex);
    },
    [imagesLength, settleNativeGesture]
  );

  const onNativeTouchCancel = useCallback(() => {
    touchStartXRef.current = null;
  }, []);

  return {
    onMomentumScrollEnd,
    onNativeScrollBeginDrag,
    onNativeScrollEndDrag,
    onNativeTouchCancel,
    onNativeTouchEnd,
    onNativeTouchStart,
  };
};
