import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, ViewStyle, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface SwipeablePanelProps {
  children: React.ReactNode;
  onClose: () => void;
  isOpen: boolean;
  style?: ViewStyle | ViewStyle[];
  swipeDirection?: 'left' | 'right';
  threshold?: number;
}

/**
 * SwipeablePanel - веб-версия компонента с поддержкой свайпа для закрытия
 * Использует нативные события браузера вместо react-native-gesture-handler
 */
const SwipeablePanel: React.FC<SwipeablePanelProps> = ({
  children,
  onClose,
  isOpen,
  style,
  swipeDirection = 'right',
  threshold = 100,
}) => {
  const translateX = useSharedValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);

  const closePanel = useCallback(() => {
    onClose();
  }, [onClose]);

  const finalizeDrag = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    activePointerIdRef.current = null;

    const distance = Math.abs(translateX.value);

    // Закрываем панель если превышен порог
    if (distance > threshold) {
      const finalPosition = swipeDirection === 'right' ? 400 : -400;
      translateX.value = withSpring(finalPosition, {
        damping: 20,
        stiffness: 90,
      }, (finished) => {
        if (finished) {
          runOnJS(closePanel)();
        }
      });
    } else {
      // Возвращаем панель на место
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
    }
  }, [isDragging, threshold, swipeDirection, translateX, closePanel]);

  const handlePointerDown = useCallback((e: any) => {
    const event = e.nativeEvent as PointerEvent;
    if (!event) return;
    if (activePointerIdRef.current != null) return;
    if ((event as any).isPrimary === false) return;
    activePointerIdRef.current = event.pointerId;
    setIsDragging(true);
    startXRef.current = event.clientX;
    try {
      (event.target as any)?.setPointerCapture?.(event.pointerId);
    } catch {
      // noop
    }
  }, []);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging) return;
    const event = e.nativeEvent as PointerEvent;
    if (!event) return;
    if (activePointerIdRef.current !== event.pointerId) return;

    const deltaX = event.clientX - startXRef.current;

    // Разрешаем свайп только в указанном направлении
    if (swipeDirection === 'right' && deltaX > 0) {
      translateX.value = deltaX;
    } else if (swipeDirection === 'left' && deltaX < 0) {
      translateX.value = deltaX;
    }
  }, [isDragging, swipeDirection, translateX]);

  const handlePointerUp = useCallback((e: any) => {
    const event = e.nativeEvent as PointerEvent;
    if (event && activePointerIdRef.current != null && activePointerIdRef.current !== event.pointerId) return;
    finalizeDrag();
  }, [finalizeDrag]);

  const handlePointerCancel = useCallback(() => {
    finalizeDrag();
  }, [finalizeDrag]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // Сбрасываем позицию при изменении isOpen
  React.useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
    }
  }, [isOpen, translateX]);

  // Добавляем глобальные обработчики для отслеживания движения за пределами компонента
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalPointerMove = (e: PointerEvent) => {
        if (activePointerIdRef.current == null) return;
        if (e.pointerId !== activePointerIdRef.current) return;
        const deltaX = e.clientX - startXRef.current;

        if (swipeDirection === 'right' && deltaX > 0) {
          translateX.value = deltaX;
        } else if (swipeDirection === 'left' && deltaX < 0) {
          translateX.value = deltaX;
        }
      };

      const handleGlobalPointerUp = (e: PointerEvent) => {
        if (activePointerIdRef.current == null) return;
        if (e.pointerId !== activePointerIdRef.current) return;
        finalizeDrag();
      };

      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handleGlobalPointerUp);
      window.addEventListener('pointercancel', handleGlobalPointerUp);

      return () => {
        window.removeEventListener('pointermove', handleGlobalPointerMove);
        window.removeEventListener('pointerup', handleGlobalPointerUp);
        window.removeEventListener('pointercancel', handleGlobalPointerUp);
      };
    }
  }, [isDragging, swipeDirection, translateX, finalizeDrag]);

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      <Pressable
        style={styles.pressableContent}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pressableContent: {
    flex: 1,
  },
});

export default React.memo(SwipeablePanel);

