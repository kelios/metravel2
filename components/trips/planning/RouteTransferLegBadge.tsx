// components/trips/planning/RouteTransferLegBadge.tsx
// #2056: плашка переезда в списке точек — над точкой, до которой добираются
// поездом, самолётом, автобусом, паромом или трансфером: «Перелёт · 431 км»
// (макет `trips-plan-route-tab-mock.md` §6). Длина — по прямой между точками,
// так переезд меряет и бэкенд; в дистанцию и время маршрута она не входит.
import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { ThemedColors } from '@/hooks/useTheme'
import MapIcon from '@/components/MapPage/MapIcon'

import { ARRIVAL_MODE_ICON_NAME, formatArrivalLeg } from './tripPlanFormatting'
import type { RouteTransferSegment } from './tripRouteLegs'

interface Props {
  transfer: RouteTransferSegment
  colors: ThemedColors
}

export default function RouteTransferLegBadge({ transfer, colors }: Props) {
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <View style={styles.row} testID={`route-transfer-leg-${transfer.toIndex}`}>
      <MapIcon
        name={ARRIVAL_MODE_ICON_NAME[transfer.mode]}
        size={14}
        color={colors.infoDark}
      />
      <Text style={styles.text} numberOfLines={1}>
        {formatArrivalLeg(transfer.mode, transfer.distanceKm)}
      </Text>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    // Цвет и левая черта — те же, что у дуги переезда на карте: плашка и линия
    // читаются как одно и то же.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderLeftWidth: 3,
      borderLeftColor: colors.infoDark,
      borderRadius: 8,
      backgroundColor: colors.infoSoft,
    },
    text: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
  })
