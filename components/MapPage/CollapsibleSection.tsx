// components/MapPage/CollapsibleSection.tsx
import React, { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
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
            <Feather name={icon as any} size={18} color={colors.text} style={styles.titleIcon} />
          )}
          <Text style={styles.sectionLabel} numberOfLines={1}>{title}</Text>
          {badge !== undefined && badge !== null && badge !== '' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-down" size={20} color={colors.textMuted} />
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
      marginBottom: tone === 'flat' ? 8 : 16,
    },
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingVertical: tone === 'flat' ? 10 : 12,
      paddingHorizontal: 12,
      backgroundColor: tone === 'flat' ? (colors.backgroundSecondary ?? colors.surface) : colors.surface,
      borderRadius: 12,
      borderWidth: tone === 'flat' ? 0 : 1,
      borderColor: tone === 'flat' ? 'transparent' : colors.borderLight,
    },
    collapsibleHeaderPressed: {
      opacity: 0.7,
      backgroundColor: tone === 'flat' ? (colors.surfaceMuted ?? colors.backgroundSecondary ?? colors.surface) : colors.surface,
    },
    collapsibleTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    titleIcon: {
      marginRight: 4,
    },
    sectionLabel: {
      ...DESIGN_TOKENS.typography.scale.h3,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
    },
    badge: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      minWidth: 24,
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
      paddingHorizontal: tone === 'flat' ? 4 : 12,
    },
  })

export default React.memo(CollapsibleSection)
