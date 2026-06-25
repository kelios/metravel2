/**
 * MapMobileTransportPopover — compact transport-profile picker shown under the
 * route transport icon in the mobile map toolbar.
 *
 * Reuses the SAME source of truth as the desktop filters sheet: TRANSPORT_MODES
 * from `../transportModes`. Selecting a profile applies it immediately through
 * `setTransportMode` (route recomputes reactively) and closes the popover.
 */
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { ThemedColors } from '@/hooks/useTheme'

import MapIcon from '../MapIcon'
import { TRANSPORT_MODES, type TransportMode } from '../transportModes'
import { MapMobilePopover } from './MapMobilePopover'

interface MapMobileTransportPopoverProps {
  colors: ThemedColors
  top: number
  right?: number
  minWidth?: number
  maxWidth?: number
  currentValue: TransportMode
  onSelect: (mode: TransportMode) => void
  onRequestClose: () => void
}

const MapMobileTransportPopoverInner: React.FC<MapMobileTransportPopoverProps> = ({
  colors,
  top,
  right,
  minWidth = 176,
  maxWidth = 240,
  currentValue,
  onSelect,
  onRequestClose,
}) => {
  return (
    <MapMobilePopover
      colors={colors}
      top={top}
      right={right}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onRequestClose={onRequestClose}
      testID="map-mobile-transport-popover"
    >
      <View accessibilityRole="radiogroup" testID="map-mobile-transport-options">
        {TRANSPORT_MODES.map((option) => {
          const selected = option.key === currentValue
          return (
            <Pressable
              key={option.key}
              testID={`map-mobile-transport-option-${option.key}`}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => {
                onSelect(option.key)
                onRequestClose()
              }}
              style={({ pressed }) => [
                styles.row,
                selected && { backgroundColor: colors.primarySoft },
                pressed && !selected && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <MapIcon
                name={option.icon}
                size={18}
                color={selected ? colors.primary : colors.text}
              />
              <Text
                style={[
                  styles.rowText,
                  { color: selected ? colors.primary : colors.text },
                  selected && styles.rowTextSelected,
                ]}
                numberOfLines={1}
              >
                {option.label}
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
    minHeight: 44,
    minWidth: 144,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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

export const MapMobileTransportPopover = React.memo(MapMobileTransportPopoverInner)
