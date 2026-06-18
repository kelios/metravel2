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
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { DEFAULT_RADIUS_KM, formatRadiusLabel } from '@/constants/mapConfig'
import type { ThemedColors } from '@/hooks/useTheme'

import { MapMobilePopover } from './MapMobilePopover'

interface RadiusOption {
  id: string
  name: string
}

interface MapMobileRadiusPopoverProps {
  colors: ThemedColors
  top: number
  options: ReadonlyArray<RadiusOption>
  currentValue: string
  onSelect: (id: string) => void
  onRequestClose: () => void
}

const MapMobileRadiusPopoverInner: React.FC<MapMobileRadiusPopoverProps> = ({
  colors,
  top,
  options,
  currentValue,
  onSelect,
  onRequestClose,
}) => {
  const resolvedValue = String(currentValue || DEFAULT_RADIUS_KM)

  // Mirror FiltersPanelRadiusSection: ensure the active value is present even if
  // it is not part of the preset list, and keep options numerically sorted.
  const radiusOptions = useMemo(() => {
    const base = (Array.isArray(options) ? options : []).filter((option) => option?.id)
    const current = resolvedValue.trim()
    if (current && !base.some((option) => String(option.id) === current)) {
      base.push({ id: current, name: formatRadiusLabel(current) })
    }
    return [...base].sort((a, b) => {
      const aValue = Number(String(a.id).replace(/\D/g, '')) || 0
      const bValue = Number(String(b.id).replace(/\D/g, '')) || 0
      return aValue - bValue
    })
  }, [options, resolvedValue])

  return (
    <MapMobilePopover
      colors={colors}
      top={top}
      onRequestClose={onRequestClose}
      testID="map-mobile-radius-popover"
    >
      <View accessibilityRole="radiogroup" testID="map-mobile-radius-options">
        {radiusOptions.map((option) => {
          const selected = String(option.id) === resolvedValue
          const label = formatRadiusLabel(option.name || option.id)
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
    </MapMobilePopover>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 40,
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
