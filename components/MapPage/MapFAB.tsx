/**
 * MapFAB - Floating Action Button для быстрых действий на карте
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MapIcon from './MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';

interface FABAction {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

interface MapFABProps {
  /** Основное действие (главная кнопка) */
  mainAction: FABAction;
  /** Дополнительные действия (раскрываются при клике) */
  actions?: FABAction[];
  /** Позиция на экране */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  /** Открывать меню по нажатию на главную кнопку */
  expandOnMainPress?: boolean;
  /** testID для главной кнопки */
  mainActionTestID?: string;
  /** Доп. стили для контейнера (например, поднять над BottomDock на web) */
  containerStyle?: StyleProp<ViewStyle>;
}

export const MapFAB: React.FC<MapFABProps> = React.memo(({
  mainAction,
  actions = [],
  position = 'bottom-right',
  expandOnMainPress = true,
  mainActionTestID,
  containerStyle,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors, position), [colors, position]);

  const [isExpanded, setIsExpanded] = useState(false);
  const animation = useState(new Animated.Value(0))[0];

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => {
      const toValue = prev ? 0 : 1;
      Animated.spring(animation, {
        toValue,
        useNativeDriver: false,
        friction: 5,
        tension: 40,
      }).start();
      return !prev;
    });
  }, [animation]);

  const handleMainPress = useCallback(() => {
    if (actions.length > 0 && expandOnMainPress) {
      toggleExpand();
    } else {
      mainAction.onPress();
    }
  }, [actions.length, expandOnMainPress, toggleExpand, mainAction]);

  const handleActionPress = useCallback((action: FABAction) => {
    action.onPress();
    toggleExpand();
  }, [toggleExpand]);

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Backdrop overlay */}
      {isExpanded && (
        <CardActionPressable
          style={styles.backdrop}
          onPress={toggleExpand}
          accessibilityLabel="Закрыть меню"
        >
          {null}
        </CardActionPressable>
      )}

      {/* Secondary actions */}
      {actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {actions.map((action, index) => {
            const translateY = animation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -(70 * (index + 1))],
            });

            const scale = animation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            });

            const opacity = animation;

            return (
              <Animated.View
                key={action.label}
                style={[
                  styles.actionButton,
                  {
                    transform: [{ translateY }, { scale }],
                    opacity,
                  },
                ]}
              >
                <CardActionPressable
                  style={[
                    styles.fab,
                    styles.secondaryFab,
                    action.color && { backgroundColor: action.color },
                  ]}
                  onPress={() => handleActionPress(action)}
                  accessibilityLabel={action.label}
                >
                  <MapIcon
                    name={action.icon}
                    size={22}
                    color={colors.text}
                  />
                </CardActionPressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Main FAB */}
      <CardActionPressable
        style={[
          styles.fab,
          styles.mainFab,
          mainAction.color && { backgroundColor: mainAction.color },
        ]}
        onPress={handleMainPress}
        onLongPress={actions.length > 0 && !expandOnMainPress ? toggleExpand : undefined}
        accessibilityLabel={mainAction.label}
        testID={mainActionTestID}
      >
        <Animated.View
          style={{
            transform: [
              {
                rotate: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '45deg'],
                }),
              },
            ],
          }}
        >
          <MapIcon
            name={isExpanded && actions.length > 0 ? 'close' : mainAction.icon}
            size={26}
            color={colors.textOnPrimary}
          />
        </Animated.View>
      </CardActionPressable>
    </View>
  );
});

const getStyles = (
  colors: ThemedColors,
  position: 'bottom-right' | 'bottom-left' | 'bottom-center'
) => {
  const positionStyles = {
    'bottom-right': { right: 20, bottom: 20 },
    'bottom-left': { left: 20, bottom: 20 },
    'bottom-center': { bottom: 20, alignSelf: 'center' as const },
  };

  return StyleSheet.create({
    container: {
      position: 'absolute',
      ...positionStyles[position],
      zIndex: 800,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      zIndex: -1,
    },
    actionsContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      alignItems: 'center',
    },
    actionButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },
    fab: {
      width: 52,
      height: 52,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      ...colors.shadows.medium,
    },
    mainFab: {
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 10px 28px rgba(15,23,42,0.22), 0 4px 10px rgba(15,23,42,0.14)',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          } as any)
        : Platform.select({
            ios: {
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 12,
            },
            android: { elevation: 10 },
          })),
    },
    secondaryFab: {
      backgroundColor:
        Platform.OS === 'web' ? colors.surfaceAlpha40 : colors.surface,
      width: 46,
      height: 46,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            boxShadow:
              '0 4px 14px rgba(15,23,42,0.12), 0 1px 2px rgba(15,23,42,0.06)',
          } as any)
        : null),
    },
  });
};
