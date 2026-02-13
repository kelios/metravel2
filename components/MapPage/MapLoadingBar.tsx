/**
 * MapLoadingBar — тонкая progress-полоса поверх карты при загрузке/обновлении данных
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface MapLoadingBarProps {
  visible: boolean;
}

const BAR_HEIGHT = 3;

export const MapLoadingBar: React.FC<MapLoadingBarProps> = React.memo(({ visible }) => {
  const colors = useThemedColors();
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      progress.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        progress.stopAnimation();
        progress.setValue(0);
      });
    }
  }, [visible, progress, opacity]);

  const width = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0%', '70%', '100%'],
  });

  return (
    <Animated.View
      style={[styles.container, { opacity, pointerEvents: 'none' }]}
    >
      <Animated.View
        style={[
          styles.bar,
          {
            backgroundColor: colors.primary,
            width: width as any,
          },
        ]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    zIndex: 10,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null),
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
});
