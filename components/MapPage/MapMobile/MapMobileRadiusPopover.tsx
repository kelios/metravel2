/**
 * MapMobileRadiusPopover — compact radius picker shown under the ◎ Радиус icon.
 *
 * Reuses the SAME data source as FiltersPanelRadiusSection: radius options from
 * `filters.radius`, the current value from `filterValue.radius`, and applies the
 * change through the same `onFilterChange('radius', id)` callback. No duplicated
 * radius logic — only a compact presentation.
 *
 * Tapping a value applies it immediately (badge updates) and closes the popover.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { formatRadiusLabel, resolveMapRadiusKm } from '@/constants/mapConfig'
import type { ThemedColors } from '@/hooks/useTheme'

import { MapMobilePopover } from './MapMobilePopover'

interface RadiusOption {
  id: string
  name: string
}

interface MapMobileRadiusPopoverProps {
  colors: ThemedColors
  top: number
  /** Optional right offset (desktop anchors under the radius FAB). */
  right?: number
  minWidth?: number
  maxWidth?: number
  options: ReadonlyArray<RadiusOption>
  currentValue: string
  summary?: string
  onSelect: (id: string) => void
  onRequestClose: () => void
  /** Card height cap down to the dock (desktop branch, #2243-III); the list scrolls. */
  maxHeight?: number
}

const MapMobileRadiusPopoverInner: React.FC<MapMobileRadiusPopoverProps> = ({
  colors,
  top,
  right,
  minWidth = 176,
  maxWidth = 240,
  options,
  currentValue,
  summary,
  onSelect,
  onRequestClose,
  maxHeight,
}) => {
  const resolvedRadius = resolveMapRadiusKm(currentValue)

  // Mirror FiltersPanelRadiusSection: ensure the active value is present even if
  // it is not part of the preset list, and keep options numerically sorted.
  const radiusOptions = useMemo(() => {
    const base = (Array.isArray(options) ? options : []).filter((option) => option?.id)
    if (!base.some((option) => resolveMapRadiusKm(option.id) === resolvedRadius)) {
      // A positive sub-kilometre input queries 0 km. Selecting "0" itself
      // would instead restore the default, so retain the original input then.
      const id = resolvedRadius === 0 ? currentValue.trim() : String(resolvedRadius)
      base.push({ id, name: id })
    }
    return base.sort((a, b) => resolveMapRadiusKm(a.id) - resolveMapRadiusKm(b.id))
  }, [options, currentValue, resolvedRadius])

  return (
    <MapMobilePopover
      colors={colors}
      top={top}
      right={right}
      minWidth={minWidth}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      onRequestClose={onRequestClose}
      testID="map-mobile-radius-popover"
    >
      <ScrollView
        style={styles.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {summary && (
          <Text style={[styles.summary, { color: colors.text }]}>{summary}</Text>
        )}
        <View accessibilityRole="radiogroup" testID="map-mobile-radius-options">
          {radiusOptions.map((option) => {
            const radius = resolveMapRadiusKm(option.id)
            const selected = radius === resolvedRadius
            const label = formatRadiusLabel(radius)
            return (
              <Pressable
                key={String(option.id)}
                testID={`map-mobile-radius-option-${option.id}`}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => {
                  onSelect(String(option.id))
                  onRequestClose()
                }}
                style={({ pressed }) => [
                  styles.row,
                  selected && { backgroundColor: colors.primarySoft },
                  pressed && !selected && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Text
                  style={[
                    styles.rowText,
                    { color: selected ? colors.primary : colors.text },
                    selected && styles.rowTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </MapMobilePopover>
  )
}

const styles = StyleSheet.create({
  // Shrinks under the card's `maxHeight` (desktop branch above the dock).
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  summary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    minHeight: 44,
    minWidth: 144,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 18,
  },
  rowTextSelected: {
    fontWeight: '700',
  },
})

export const MapMobileRadiusPopover = React.memo(MapMobileRadiusPopoverInner)
