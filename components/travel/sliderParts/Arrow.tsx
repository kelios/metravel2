import React, { memo, useCallback, useState } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { NAV_BTN_OFFSET } from './utils';

interface ArrowProps {
  dir: 'left' | 'right';
  onPress: () => void;
  isMobile: boolean;
  isTablet?: boolean;
  hideArrowsOnMobile?: boolean;
  insets: { left: number; right: number };
  dismissSwipeHint: () => void;
  colors: { text: string; [k: string]: any };
  styles: Record<string, any>;
}

const Arrow = memo(function Arrow({
  dir,
  onPress,
  isMobile,
  isTablet = false,
  hideArrowsOnMobile,
  insets,
  dismissSwipeHint,
  colors,
  styles,
}: ArrowProps) {
  const arrowOpacity = useSharedValue(1);
  const arrowScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [{ scale: arrowScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    arrowOpacity.value = withSpring(0.7, { damping: 15 });
    arrowScale.value = withSpring(0.95, { damping: 15 });
  }, [arrowOpacity, arrowScale]);

  const handlePressOut = useCallback(() => {
    arrowOpacity.value = withSpring(1, { damping: 15 });
    arrowScale.value = withSpring(1, { damping: 15 });
  }, [arrowOpacity, arrowScale]);

  const [isHovered, setIsHovered] = useState(false);

  const handleHover = useCallback(
    (hover: boolean) => {
      if (Platform.OS === 'web' && !isMobile) {
        setIsHovered(hover);
        if (hover) {
          arrowOpacity.value = withSpring(1, { damping: 15 });
          arrowScale.value = withSpring(1.1, { damping: 15 });
        } else {
          arrowOpacity.value = withSpring(1, { damping: 15 });
          arrowScale.value = withSpring(1, { damping: 15 });
        }
      }
    },
    [arrowOpacity, arrowScale, isMobile],
  );

  const iconSize = isMobile ? 20 : isTablet ? 22 : 24;

  if (isMobile && hideArrowsOnMobile) return null;

  return (
    <TouchableOpacity
      onPress={() => {
        dismissSwipeHint();
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // @ts-ignore - web-only props
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
      accessibilityRole="button"
      accessibilityLabel={dir === 'left' ? 'Previous slide' : 'Next slide'}
      hitSlop={12}
      activeOpacity={0.8}
      style={[
        styles.navBtn,
        isMobile ? styles.navBtnMobile : isTablet ? styles.navBtnTablet : styles.navBtnDesktop,
        dir === 'left'
          ? { left: NAV_BTN_OFFSET + 4 + (isMobile ? 8 : isTablet ? 4 : insets.left) }
          : { right: NAV_BTN_OFFSET + 4 + (isMobile ? 8 : isTablet ? 4 : insets.right) },
        Platform.OS === 'web' && isHovered && styles.navBtnHover,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <View style={styles.arrowIconContainer}>
          <Feather
            name={dir === 'left' ? 'chevron-left' : 'chevron-right'}
            size={iconSize}
            color={colors.text}
            style={styles.arrowIcon}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default Arrow;
