import React from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import { Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import {
  getNavigationActionVisual,
  resolveNavigationActionKind,
} from '@/components/navigation/navigationActionMeta'
import CardActionPressable from '@/components/ui/CardActionPressable'
import type { useThemedColors } from '@/hooks/useTheme'
import type { ActionChip } from './PlaceListCard.types'

type PartStyles = {
  badgeText: StyleProp<TextStyle>
  categoryText: StyleProp<TextStyle>
  detailChip: StyleProp<ViewStyle>
  detailChipText: StyleProp<TextStyle>
  detailRow: StyleProp<ViewStyle>
  iconBtnDisabled: StyleProp<ViewStyle>
  iconBtnPressed: StyleProp<ViewStyle>
  mapActionChip: StyleProp<ViewStyle>
  mapActionIconBubble: StyleProp<ViewStyle>
  mapActionLabel: StyleProp<TextStyle>
  metaChip: StyleProp<ViewStyle>
  metaChipText: StyleProp<TextStyle>
  metaRow: StyleProp<ViewStyle>
}

export const LabeledActionChip = React.memo(function LabeledActionChip({
  accessibilityLabel,
  accessibilityState,
  children,
  disabled,
  icon,
  iconBubbleStyle,
  iconColor,
  label,
  onPress,
  styles,
  title,
}: {
  accessibilityLabel?: string
  accessibilityState?: {
    checked?: boolean
    selected?: boolean
    disabled?: boolean
    expanded?: boolean
    busy?: boolean
  }
  children?: React.ReactNode
  disabled?: boolean
  icon?: keyof typeof Feather.glyphMap
  iconBubbleStyle?: StyleProp<ViewStyle>
  iconColor?: string
  label: string
  onPress?: () => void
  styles: PartStyles
  title?: string
}) {
  return (
    <CardActionPressable
      accessibilityLabel={accessibilityLabel ?? title ?? label}
      accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      disabled={disabled}
      onPress={onPress}
      title={title ?? label}
      style={({ pressed }) => [
        styles.mapActionChip,
        pressed && !disabled && styles.iconBtnPressed,
        disabled && styles.iconBtnDisabled,
      ]}
    >
      <View style={[styles.mapActionIconBubble, iconBubbleStyle]}>
        {children ?? (icon ? <Feather name={icon} size={16} color={iconColor} /> : null)}
      </View>
      <Text style={styles.mapActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </CardActionPressable>
  )
})

export const MapActionChip = React.memo(function MapActionChip({
  action,
  colors,
  styles,
}: {
  action: ActionChip
  colors: ReturnType<typeof useThemedColors>
  styles: PartStyles
}) {
  const kind = resolveNavigationActionKind(action.key, action.label)
  const visual = kind ? getNavigationActionVisual(kind, colors) : null

  return (
    <LabeledActionChip
      accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
      icon={visual?.icon ?? action.icon}
      iconBubbleStyle={visual ? { backgroundColor: visual.tintBg } : null}
      iconColor={visual?.iconColor ?? colors.textMuted}
      label={action.label}
      onPress={action.onPress}
      styles={styles}
      title={action.title ?? action.label}
    />
  )
})

export const CardMeta = React.memo(function CardMeta({
  showTitleInContent,
  categoryLabel,
  badges,
  compact,
  styles,
}: {
  showTitleInContent: boolean
  categoryLabel?: string | null
  badges: string[]
  compact: boolean
  styles: PartStyles
}) {
  const showBadges = badges.length > 0
  if (!categoryLabel && !showBadges) return null

  if (showTitleInContent) {
    if (!showBadges) return null
    return (
      <View style={styles.detailRow}>
        {badges.map((badge, index) => (
          <View key={`${badge}-${index}`} style={styles.detailChip}>
            <Text style={styles.detailChipText} numberOfLines={1}>{badge}</Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.metaRow}>
      {!!categoryLabel && (compact ? (
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText} numberOfLines={1}>{categoryLabel}</Text>
        </View>
      ) : (
        <Text style={styles.categoryText} numberOfLines={1}>{categoryLabel}</Text>
      ))}
      {showBadges && badges.map((badge, index) => (
        <Text key={`${badge}-${index}`} style={styles.badgeText}>{badge}</Text>
      ))}
    </View>
  )
})
