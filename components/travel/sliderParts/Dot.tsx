import React, { memo } from 'react';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  type SharedValue,
} from 'react-native-reanimated';
import { DOT_SIZE, DOT_ACTIVE_SIZE } from './utils';

interface DotProps {
  i: number;
  x: SharedValue<number>;
  containerW: number;
  total: number;
  reduceMotion: boolean;
  dotStyle: any;
}

const Dot = memo(function Dot({
  i,
  x,
  containerW,
  total,
  reduceMotion,
  dotStyle,
}: DotProps) {
  const style = useAnimatedStyle(() => {
    const scrollPosition = x.value;
    const currentIndex = scrollPosition / (containerW || 1);

    const inputRange = [i - 1, i, i + 1];
    const outputRange = [DOT_SIZE, DOT_ACTIVE_SIZE, DOT_SIZE];

    const width = interpolate(
      currentIndex,
      inputRange,
      outputRange,
      Extrapolate.CLAMP,
    );

    const opacity = interpolate(
      currentIndex,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolate.CLAMP,
    );

    return {
      width: reduceMotion
        ? Math.abs(currentIndex - i) < 0.5
          ? DOT_ACTIVE_SIZE
          : DOT_SIZE
        : width,
      height: DOT_SIZE,
      opacity: reduceMotion
        ? Math.abs(currentIndex - i) < 0.5
          ? 1
          : 0.3
        : opacity,
      borderRadius: DOT_SIZE / 2,
    };
  }, [containerW, total, reduceMotion, i]);

  return <Animated.View style={[dotStyle, style]} />;
});

export default Dot;
