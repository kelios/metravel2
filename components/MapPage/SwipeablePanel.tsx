import React, { useCallback } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
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
 * SwipeablePanel - компонент с поддержкой свайпа для закрытия
 * Используется для мобильных панелей карты
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
  const startX = useSharedValue(0);

  const closePanel = useCallback(() => {
    onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // Разрешаем свайп только в указанном направлении
      if (swipeDirection === 'right' && event.translationX > 0) {
        translateX.value = event.translationX;
      } else if (swipeDirection === 'left' && event.translationX < 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const velocity = swipeDirection === 'right' ? event.velocityX : -event.velocityX;
      const distance = Math.abs(translateX.value);

      // Закрываем панель если превышен порог или скорость достаточно высокая
      if (distance > threshold || velocity > 500) {
        const finalPosition = swipeDirection === 'right' ? 400 : -400;
        translateX.value = withSpring(finalPosition, {
          damping: 20,
          stiffness: 90,
        }, () => {
          runOnJS(closePanel)();
        });
      } else {
        // Возвращаем панель на место
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 90,
        });
      }
    });

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

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default React.memo(SwipeablePanel);

