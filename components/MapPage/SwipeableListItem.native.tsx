import React, { useRef } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedColors } from '@/hooks/useTheme';
import MapIcon from './MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { translate as i18nT } from '@/i18n'

/**
 * Свайп по карточке списка на карте: влево — «Хочу поехать», вправо — маршрут.
 * react-native-gesture-handler 3 убрал legacy `Swipeable` (Animated API); остался
 * `ReanimatedSwipeable`, который отдаёт прогресс и смещение как SharedValue reanimated.
 * Web-вариант без жестов — `SwipeableListItem.tsx`.
 */

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

const ACTION_REVEAL_DISTANCE = 80;

type ActionScaleProps = {
  translation: SharedValue<number>;
  /** Направление раскрытия: левая панель растёт при положительном смещении, правая — при отрицательном */
  side: 'left' | 'right';
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const ScaledAction: React.FC<ActionScaleProps> = ({ translation, side, style, children }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = side === 'left'
      ? interpolate(translation.value, [0, ACTION_REVEAL_DISTANCE], [0, 1], Extrapolation.CLAMP)
      : interpolate(translation.value, [-ACTION_REVEAL_DISTANCE, 0], [1, 0], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};

export const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  onFavorite,
  onBuildRoute,
  showFavorite = true,
  showRoute = true,
  isFavorite = false,
}) => {
  const colors = useThemedColors();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleFavorite = () => {
    swipeableRef.current?.close();
    onFavorite?.();
  };

  const handleBuildRoute = () => {
    swipeableRef.current?.close();
    onBuildRoute?.();
  };

  // Левый свайп → «Хочу поехать»
  const renderLeftActions = (_progress: SharedValue<number>, translation: SharedValue<number>) => {
    if (!showFavorite || !onFavorite) return null;

    return (
      <ScaledAction translation={translation} side="left" style={styles.leftAction}>
        <CardActionPressable
          style={[
            styles.actionButton,
            { backgroundColor: isFavorite ? colors.warning : colors.accent },
          ]}
          onPress={handleFavorite}
          accessibilityLabel={isFavorite ? i18nT('map:components.MapPage.SwipeableListItem.ubrat_iz_hochu_poehat_6b91534d') : i18nT('map:components.MapPage.SwipeableListItem.dobavit_v_hochu_poehat_76409f76')}
        >
          <MapIcon
            name={isFavorite ? 'star' : 'star-border'}
            size={24}
            color={colors.textOnPrimary}
          />
          <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>
            {isFavorite ? i18nT('map:components.MapPage.SwipeableListItem.ubrat_45c6d419') : i18nT('map:components.MapPage.SwipeableListItem.zhelaniya_ed825f5b')}
          </Text>
        </CardActionPressable>
      </ScaledAction>
    );
  };

  // Правый свайп → Маршрут
  const renderRightActions = (_progress: SharedValue<number>, translation: SharedValue<number>) => {
    if (!showRoute || !onBuildRoute) return null;

    return (
      <ScaledAction translation={translation} side="right" style={styles.rightAction}>
        <CardActionPressable
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleBuildRoute}
          accessibilityLabel={i18nT('map:components.MapPage.SwipeableListItem.postroit_marshrut_syuda_3db1b91e')}
        >
          <MapIcon name="directions" size={24} color={colors.textOnPrimary} />
          <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>
            {i18nT('map:components.MapPage.SwipeableListItem.marshrut_43ca4e50')}</Text>
        </CardActionPressable>
      </ScaledAction>
    );
  };

  return (
    <ReanimatedSwipeable
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
    </ReanimatedSwipeable>
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
