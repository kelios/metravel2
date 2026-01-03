/**
 * SwipeableListItem - обертка для AddressListItem с жестами свайпа
 * Свайп влево → Избранное
 * Свайп вправо → Построить маршрут
 */

import React, { useRef } from 'react';
import { StyleSheet, Animated, Pressable, Text, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useThemedColors } from '@/hooks/useTheme';

interface SwipeableListItemProps {
  children: React.ReactNode;
  /** Callback для добавления в избранное */
  onFavorite?: () => void;
  /** Callback для построения маршрута */
  onBuildRoute?: () => void;
  /** Показывать ли кнопку избранного */
  showFavorite?: boolean;
  /** Показывать ли кнопку маршрута */
  showRoute?: boolean;
  /** Уже в избранном? */
  isFavorite?: boolean;
}

export const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  onFavorite,
  onBuildRoute,
  showFavorite = true,
  showRoute = true,
  isFavorite = false,
}) => {
  const colors = useThemedColors();
  const swipeableRef = useRef<Swipeable>(null);

  // Web не поддерживает жесты, показываем просто children
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  const handleFavorite = () => {
    swipeableRef.current?.close();
    onFavorite?.();
  };

  const handleBuildRoute = () => {
    swipeableRef.current?.close();
    onBuildRoute?.();
  };

  // Левый свайп → Избранное
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!showFavorite || !onFavorite) return null;

    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.leftAction, { transform: [{ scale }] }]}>
        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: isFavorite ? colors.warning : colors.accent },
          ]}
          onPress={handleFavorite}
          accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          <Icon
            name={isFavorite ? 'star' : 'star-border'}
            size={24}
            color={colors.textOnPrimary}
          />
          <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>
            {isFavorite ? 'Убрать' : 'Избранное'}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  // Правый свайп → Маршрут
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!showRoute || !onBuildRoute) return null;

    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.rightAction, { transform: [{ scale }] }]}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleBuildRoute}
          accessibilityLabel="Построить маршрут сюда"
        >
          <Icon name="directions" size={24} color={colors.textOnPrimary} />
          <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>
            Маршрут
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={60}
      rightThreshold={60}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 20,
  },
  rightAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    minWidth: 80,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});

