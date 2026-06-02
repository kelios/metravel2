import React from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import { IconActionButton } from './fields'
import type { Styles } from './styles'
import type { ChipKey, QuickFilterAction, Selector } from './types'

export function IconOnlyBar({
  leadingActions,
  trailingActions,
  selectors,
  activeIndicatorByKey,
  primaryCtaLabel,
  primaryCtaTestID,
  onPressPrimaryCta,
  styles,
  colors,
}: {
  leadingActions: QuickFilterAction[]
  trailingActions: QuickFilterAction[]
  selectors: Selector[]
  activeIndicatorByKey: Record<ChipKey, number>
  primaryCtaLabel?: string
  primaryCtaTestID?: string
  onPressPrimaryCta?: () => void
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View style={styles.iconOnlyBar} pointerEvents="box-none">
      <View style={styles.iconOnlyGroup}>
        {leadingActions.map((action) => (
          <IconActionButton key={action.key} action={action} styles={styles} colors={colors} />
        ))}
      </View>

      {primaryCtaLabel && typeof onPressPrimaryCta === 'function' && (
        <Pressable
          accessibilityLabel={primaryCtaLabel}
          accessibilityRole="button"
          onPress={onPressPrimaryCta}
          testID={primaryCtaTestID}
          style={({ pressed }) => [styles.primaryCtaButton, pressed && styles.fieldPressed]}
        >
          <Feather name="search" size={14} color={colors.textOnPrimary} />
          <Text style={styles.primaryCtaText} numberOfLines={1}>
            {primaryCtaLabel}
          </Text>
        </Pressable>
      )}

      <View style={[styles.iconOnlyGroup, styles.iconOnlyFiltersGroup]}>
        {selectors.map((selector) => {
          const activeCount = activeIndicatorByKey[selector.key] ?? 0
          const isActive = activeCount > 0
          const isRadius = selector.key === 'radius'
          return (
            <Pressable
              key={selector.key}
              accessibilityLabel={
                isActive
                  ? `${selector.label}: ${selector.value} (активно: ${activeCount})`
                  : `${selector.label}: ${selector.value}`
              }
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={selector.onPress}
              style={({ pressed }) => [
                isRadius ? styles.iconTextButton : styles.iconButton,
                isActive && styles.iconButtonActive,
                pressed && styles.fieldPressed,
              ]}
            >
              {isRadius ? (
                <Text style={styles.iconTextButtonText} numberOfLines={1}>
                  {selector.value}
                </Text>
              ) : (
                <Feather
                  name={selector.icon}
                  size={16}
                  color={colors.primary}
                  style={styles.iconButtonIcon}
                />
              )}
              {!isRadius && isActive && (
                <View
                  style={styles.iconBadge}
                  pointerEvents="none"
                  testID={`map-quick-filter-badge-${selector.key}`}
                >
                  <Text style={styles.iconBadgeText} numberOfLines={1}>
                    {activeCount > 9 ? '9+' : String(activeCount)}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
        {trailingActions.map((action) => (
          <IconActionButton key={action.key} action={action} styles={styles} colors={colors} />
        ))}
      </View>
    </View>
  )
}
