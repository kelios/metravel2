// components/trips/planning/RouteDayField.tsx
// #1845: выбор дня похода в форме правки точки. Чипы — уже занятые дни
// маршрута и следующий свободный; поле — любой номер 1–60. Пустое значение
// снимает день, однодневная поездка так и остаётся плоским списком.
import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import type { createStyles } from './RouteBuilder.styles'

type RouteBuilderStyles = ReturnType<typeof createStyles>

interface Props {
  styles: RouteBuilderStyles
  colors: ThemedColors
  value: string
  chipDays: number[]
  onChange: (value: string) => void
}

export default function RouteDayField({ styles, colors, value, chipDays, onChange }: Props) {
  const trimmed = value.trim()
  const noneActive = !trimmed

  return (
    <View style={styles.dayField} testID="route-builder-day-field">
      <Text style={styles.overnightLegend}>{i18nT('tripsStatic:plan.routeDay.label')}</Text>
      <View style={styles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18nT('tripsStatic:plan.routeDay.noneA11y')}
          onPress={() => onChange('')}
          style={[styles.typeChip, noneActive && styles.typeChipActive]}
          testID="route-builder-day-none"
        >
          <Text style={[styles.typeChipText, noneActive && styles.typeChipTextActive]}>
            {i18nT('tripsStatic:plan.routeDay.none')}
          </Text>
        </Pressable>
        {chipDays.map((day) => {
          const active = trimmed === String(day)
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={i18nT('tripsStatic:plan.routeDay.assignA11y', { day })}
              onPress={() => onChange(String(day))}
              style={[styles.typeChip, active && styles.typeChipActive]}
              testID={`route-builder-day-chip-${day}`}
            >
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {day}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={i18nT('tripsStatic:plan.routeDay.input')}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        style={styles.input}
        testID="route-builder-day-input"
      />
    </View>
  )
}
