/**
 * RadiusPopover — single-select radius presets.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface RadiusOption {
  id: string
  name: string
}

interface RadiusPopoverProps {
  options: ReadonlyArray<RadiusOption>
  value: string
  onChange: (next: string) => void
  onClose: () => void
}

const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm
const PILL_RADIUS = DESIGN_TOKENS.radii.pill

export const RadiusPopover: React.FC<RadiusPopoverProps> = ({
  options,
  value,
  onChange,
  onClose,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const handleSelect = (next: string) => {
    if (next !== value) onChange(next)
    onClose()
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Радиус поиска</Text>
        <Text style={styles.hint}>Один пресет</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {options.map((opt) => {
          const selected = opt.id === value
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityLabel={`${opt.name} километров`}
              accessibilityState={{ selected }}
              onPress={() => handleSelect(opt.id)}
              style={({ pressed }) => [
                styles.row,
                selected && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
            >
              <View
                style={[
                  styles.radioOuter,
                  selected && { borderColor: colors.primary },
                ]}
              >
                {selected && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                {opt.name} км
              </Text>
              {selected && (
                <Feather name="check" size={16} color={colors.primary} style={styles.rowCheck} />
              )}
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: {
      paddingBottom: 8,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
    },
    scroll: {
      maxHeight: 360,
    },
    list: {
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: CONTROL_RADIUS,
    },
    rowSelected: {
      backgroundColor: colors.primarySoft,
    },
    rowPressed: {
      opacity: 0.72,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: PILL_RADIUS,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.primary,
    },
    rowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    rowLabelSelected: {
      color: colors.primaryText,
    },
    rowCheck: {
      marginLeft: 'auto',
    },
  })
