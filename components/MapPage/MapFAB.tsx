/**
 * MapFAB - Floating Action Button для быстрых действий на карте
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

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
}

export const MapFAB: React.FC<MapFABProps> = ({
  mainAction,
  actions = [],
  position = 'bottom-right',
  expandOnMainPress = true,
  mainActionTestID,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors, position), [colors, position]);

  const [isExpanded, setIsExpanded] = useState(false);
  const animation = useState(new Animated.Value(0))[0];

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;

    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      friction: 5,
      tension: 40,
    }).start();

    setIsExpanded(!isExpanded);
  };

  const handleMainPress = () => {
    if (actions.length > 0 && expandOnMainPress) {
      toggleExpand();
    } else {
      mainAction.onPress();
    }
  };

  const handleActionPress = (action: FABAction) => {
    action.onPress();
    toggleExpand();
  };

  return (
    <View style={styles.container}>
      {/* Backdrop overlay */}
      {isExpanded && (
        <Pressable
          style={styles.backdrop}
          onPress={toggleExpand}
          accessibilityLabel="Закрыть меню"
        />
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
                <Pressable
                  style={[
                    styles.fab,
                    styles.secondaryFab,
                    action.color && { backgroundColor: action.color },
                  ]}
                  onPress={() => handleActionPress(action)}
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                >
                  <Icon
                    name={action.icon}
                    size={24}
                    color={colors.textOnPrimary}
                  />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Main FAB */}
      <Pressable
        style={[
          styles.fab,
          styles.mainFab,
          mainAction.color && { backgroundColor: mainAction.color },
        ]}
        onPress={handleMainPress}
        onLongPress={actions.length > 0 && !expandOnMainPress ? toggleExpand : undefined}
        accessibilityLabel={mainAction.label}
        accessibilityRole="button"
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
          <Icon
            name={isExpanded && actions.length > 0 ? 'close' : mainAction.icon}
            size={28}
            color={colors.textOnPrimary}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
};

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
      zIndex: 1000,
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
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      ...colors.shadows.heavy,
    },
    mainFab: {
      backgroundColor: colors.primary,
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    secondaryFab: {
      backgroundColor: colors.surface,
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
};
