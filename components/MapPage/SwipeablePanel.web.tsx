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

  const closePanel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleMouseDown = useCallback((e: any) => {
    const event = e.nativeEvent as MouseEvent;
    setIsDragging(true);
    startXRef.current = event.clientX;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

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

  // Обработчик касаний для мобильных устройств
  const handleTouchStart = useCallback((e: any) => {
    const event = e.nativeEvent as TouchEvent;
    if (event.touches.length === 1) {
      setIsDragging(true);
      startXRef.current = event.touches[0].clientX;
    }
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    if (!isDragging) return;

    const event = e.nativeEvent as TouchEvent;
    if (event.touches.length === 1) {
      const deltaX = event.touches[0].clientX - startXRef.current;

      // Разрешаем свайп только в указанном направлении
      if (swipeDirection === 'right' && deltaX > 0) {
        translateX.value = deltaX;
      } else if (swipeDirection === 'left' && deltaX < 0) {
        translateX.value = deltaX;
      }
    }
  }, [isDragging, swipeDirection, translateX]);

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

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
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startXRef.current;

        if (swipeDirection === 'right' && deltaX > 0) {
          translateX.value = deltaX;
        } else if (swipeDirection === 'left' && deltaX < 0) {
          translateX.value = deltaX;
        }
      };

      const handleGlobalMouseUp = () => {
        handleMouseUp();
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, swipeDirection, translateX, handleMouseUp]);

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      <Pressable
        style={styles.pressableContent}
        onPressIn={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
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

