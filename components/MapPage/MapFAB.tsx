import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import MapIcon from './MapIcon'
import CardActionPressable from '@/components/ui/CardActionPressable'

type FABPosition = 'bottom-right' | 'bottom-left' | 'bottom-center'

const ACTION_OFFSET_STEP = 70

interface FABAction {
  icon: string
  label: string
  onPress: () => void
  color?: string
}

interface MapFABProps {
  mainAction: FABAction
  actions?: FABAction[]
  position?: FABPosition
  expandOnMainPress?: boolean
  mainActionTestID?: string
  containerStyle?: StyleProp<ViewStyle>
}

export const MapFAB: React.FC<MapFABProps> = React.memo(
  ({
    mainAction,
    actions = [],
    position = 'bottom-right',
    expandOnMainPress = true,
    mainActionTestID,
    containerStyle,
  }) => {
    const colors = useThemedColors()
    const styles = useMemo(() => getStyles(colors, position), [colors, position])

    const [isExpanded, setIsExpanded] = useState(false)
    const animation = useRef(new Animated.Value(0)).current

    useEffect(() => {
      Animated.spring(animation, {
        toValue: isExpanded ? 1 : 0,
        useNativeDriver: false,
        friction: 5,
        tension: 40,
      }).start()
    }, [isExpanded, animation])

    const toggleExpand = useCallback(() => setIsExpanded((prev) => !prev), [])

    const handleMainPress = useCallback(() => {
      if (actions.length > 0 && expandOnMainPress) {
        toggleExpand()
      } else {
        mainAction.onPress()
      }
    }, [actions.length, expandOnMainPress, toggleExpand, mainAction])

    const handleActionPress = useCallback(
      (action: FABAction) => {
        action.onPress()
        toggleExpand()
      },
      [toggleExpand],
    )

    const rotate = animation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '45deg'],
    })

    return (
      <View style={[styles.container, containerStyle]}>
        {isExpanded && (
          <CardActionPressable
            style={styles.backdrop}
            onPress={toggleExpand}
            accessibilityLabel="Закрыть меню"
          >
            {null}
          </CardActionPressable>
        )}

        {actions.length > 0 && (
          <View style={styles.actionsContainer}>
            {actions.map((action, index) => {
              const translateY = animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -(ACTION_OFFSET_STEP * (index + 1))],
              })
              const scale = animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              })

              return (
                <Animated.View
                  key={action.label}
                  style={[
                    styles.actionButton,
                    { transform: [{ translateY }, { scale }], opacity: animation },
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
                    <MapIcon name={action.icon} size={22} color={colors.text} />
                  </CardActionPressable>
                </Animated.View>
              )
            })}
          </View>
        )}

        <CardActionPressable
          style={[
            styles.fab,
            styles.mainFab,
            mainAction.color && { backgroundColor: mainAction.color },
          ]}
          onPress={handleMainPress}
          onLongPress={actions.length > 0 && !expandOnMainPress ? toggleExpand : undefined}
          accessibilityLabel={
            isExpanded && actions.length > 0 ? 'Закрыть меню' : mainAction.label
          }
          testID={mainActionTestID}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <MapIcon
              name={isExpanded && actions.length > 0 ? 'close' : mainAction.icon}
              size={26}
              color={colors.textOnPrimary}
            />
          </Animated.View>
        </CardActionPressable>
      </View>
    )
  },
)

const getStyles = (colors: ThemedColors, position: FABPosition) => {
  const positionStyles: Record<FABPosition, ViewStyle> = {
    'bottom-right': { right: 20, bottom: 20 },
    'bottom-left': { left: 20, bottom: 20 },
    'bottom-center': { bottom: 20, alignSelf: 'center' },
  }

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
    actionButton: { position: 'absolute', bottom: 0, right: 0 },
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
      backgroundColor: Platform.OS === 'web' ? colors.surfaceAlpha40 : colors.surface,
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
  })
}
