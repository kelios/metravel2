// components/MapPage/CollapsibleSection.tsx
import React, { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  LinearTransition,
} from 'react-native-reanimated'
import Feather from '@expo/vector-icons/Feather'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'

interface CollapsibleSectionProps {
  title: string
  badge?: string | number
  defaultOpen?: boolean
  children: React.ReactNode
  accessibilityLabel?: string
  icon?: string
  tone?: 'default' | 'flat'
}

const SPRING = DESIGN_TOKENS.springs.snappy

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  badge,
  defaultOpen = true,
  children,
  accessibilityLabel: _accessibilityLabel,
  icon,
  tone = 'default',
}) => {
  const [open, setOpen] = useState(defaultOpen)
  const rotation = useSharedValue(defaultOpen ? 180 : 0)
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors, tone), [colors, tone])

  const safeChildren = useMemo(
    () =>
      React.Children.map(children, (child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
          return <Text key={index}>{child}</Text>
        }
        return child
      }),
    [children]
  )

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    rotation.value = withSpring(next ? 180 : 0, SPRING)
  }

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <Animated.View style={styles.collapsibleSection} layout={LinearTransition.springify().damping(22).stiffness(240)}>
      <Pressable
        testID={`collapsible-${title}`}
        style={({ pressed }) => [
          styles.collapsibleHeader,
          pressed && styles.collapsibleHeaderPressed,
        ]}
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
      >
        <View style={styles.collapsibleTitle}>
          {icon && (
            <Feather
              name={icon as any}
              size={tone === 'flat' ? 16 : 18}
              color={colors.text}
              style={styles.titleIcon}
            />
          )}
          <Text style={styles.sectionLabel} numberOfLines={1}>{title}</Text>
          {badge !== undefined && badge !== null && badge !== '' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Animated.View style={chevronStyle}>
          <Feather
            name="chevron-down"
            size={tone === 'flat' ? 18 : 20}
            color={colors.textMuted}
          />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View
          style={styles.collapsibleContent}
          testID={`collapsible-content-${title}`}
          layout={LinearTransition.springify().damping(22).stiffness(240)}
        >
          {safeChildren}
        </Animated.View>
      )}
    </Animated.View>
  )
}

const getStyles = (colors: ThemedColors, tone: 'default' | 'flat') =>
  StyleSheet.create({
    collapsibleSection: {
      marginBottom: tone === 'flat' ? 4 : 16,
    },
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: tone === 'flat' ? 38 : 44,
      paddingVertical: tone === 'flat' ? 7 : 12,
      paddingHorizontal: tone === 'flat' ? 9 : 12,
      backgroundColor:
        tone === 'flat'
          ? (colors.surfaceElevated ?? colors.backgroundSecondary ?? colors.surface)
          : colors.surface,
      borderRadius: tone === 'flat' ? 12 : 12,
      borderWidth: 1,
      borderColor: tone === 'flat' ? colors.borderLight : colors.borderLight,
      ...(tone === 'flat' && Platform.OS === 'web'
        ? ({
            boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
          } as any)
        : null),
    },
    collapsibleHeaderPressed: {
      opacity: 0.7,
      backgroundColor:
        tone === 'flat'
          ? (colors.surfaceMuted ?? colors.backgroundSecondary ?? colors.surface)
          : colors.surface,
    },
    collapsibleTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    titleIcon: {
      marginRight: 2,
    },
    sectionLabel: {
      ...DESIGN_TOKENS.typography.scale.h3,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    badge: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      minWidth: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      ...DESIGN_TOKENS.typography.scale.caption,
      fontWeight: '700',
      color: colors.primaryText,
    },
    collapsibleContent: {
      marginTop: tone === 'flat' ? 4 : 12,
      paddingHorizontal: tone === 'flat' ? 2 : 12,
    },
  })

export default React.memo(CollapsibleSection)
