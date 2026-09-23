// components/trips/planning/RouteArrivalModeField.tsx
// #2056: «Как добираюсь сюда» в форме правки точки. «Как вся поездка» — точка
// едет в прогон, который прокладывает движок; поезд, перелёт, автобус, паром и
// трансфер делают отрезок от предыдущей точки переездом: он не прокладывается,
// рисуется дугой и не входит в дистанцию и время. У первой точки поля нет —
// предыдущей у неё нет, и бэкенд держит там `''` (#2055).
import React from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'

import type { RoutePointArrivalMode } from '@/api/plannedTrips'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { ARRIVAL_MODES } from '@/utils/routePointArrivalMode'
import { ARRIVAL_MODE_ICON_NAME, ARRIVAL_MODE_LABEL } from './tripPlanFormatting'
import type { createStyles } from './RouteBuilder.styles'

type RouteBuilderStyles = ReturnType<typeof createStyles>

/** Черновик способа прибытия правимой точки: значение и его запись одним пропсом. */
export interface RouteArrivalDraft {
  value: RoutePointArrivalMode | null
  onChange: (mode: RoutePointArrivalMode | null) => void
}

interface Props {
  styles: RouteBuilderStyles
  colors: ThemedColors
  draft: RouteArrivalDraft
}

export default function RouteArrivalModeField({ styles, colors, draft }: Props) {
  const options: Array<RoutePointArrivalMode | null> = [null, ...ARRIVAL_MODES]
  return (
    <View style={styles.dayField} testID="route-builder-arrival-field">
      <Text style={styles.overnightLegend}>
        {i18nT('trips:components.trips.planning.arrivalMode.label')}
      </Text>
      <View style={styles.chipRow}>
        {options.map((mode) => {
          const active = draft.value === mode
          return (
            <Pressable
              key={mode ?? 'inherit'}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => draft.onChange(mode)}
              style={[styles.typeChip, active && styles.typeChipActive]}
              testID={`route-builder-arrival-${mode ?? 'inherit'}`}
            >
              {mode ? (
                <Feather
                  name={ARRIVAL_MODE_ICON_NAME[mode] as never}
                  size={13}
                  color={active ? colors.textOnPrimary : colors.textSecondary}
                />
              ) : null}
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {mode
                  ? ARRIVAL_MODE_LABEL[mode]
                  : i18nT('trips:components.trips.planning.arrivalMode.inherit')}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
