// components/trips/planning/RouteDayGroupHeader.tsx
// #1845: заголовок группы дня в списке точек. Номер, календарная дата и сумма
// километров дня — в одной строке, чтобы на узкой панели конструктора не
// занимать вторую карточку. Список групп — соседние дети `pointList`, без
// обёртки: `onLayout.y` ручки перетаскивания должен считаться в одной системе
// координат со всеми строками.
import React from 'react'
import { Text, View } from 'react-native'

import type { RouteDayGroup } from '@/components/trips/planning/routePointDays'
import {
  dayGroupDistanceKm,
  groupRoutePointsByDay,
  hikeDayDate,
  shouldGroupRouteByDay,
} from '@/components/trips/planning/routePointDays'
import { formatDistance } from '@/components/trips/planning/tripPlanFormatting'
import type { RoutePoint } from '@/api/plannedTrips'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { formatTripDateLong, tripDateUnavailableText } from '@/utils/tripDateTime'
import type { createStyles } from './RouteBuilder.styles'

type RouteBuilderStyles = ReturnType<typeof createStyles>

interface HeaderProps {
  group: RouteDayGroup
  route: readonly RoutePoint[]
  startDate: string | null | undefined
  styles: RouteBuilderStyles
  colors: ThemedColors
}

export function RouteDayGroups({
  route,
  startDate,
  styles,
  colors,
  renderPoint,
  pointSlot,
}: {
  route: readonly RoutePoint[]
  startDate: string | null | undefined
  styles: RouteBuilderStyles
  colors: ThemedColors
  renderPoint: (
    point: RoutePoint,
    index: number,
    editorSlot?: React.ReactNode,
  ) => React.ReactNode
  pointSlot?: (index: number) => React.ReactNode | undefined
}) {
  if (!shouldGroupRouteByDay(route)) {
    return <>{route.map((point, index) => renderPoint(point, index, pointSlot?.(index)))}</>
  }
  return (
    <>
      {groupRoutePointsByDay(route).flatMap((group) => [
        <RouteDayGroupHeader
          key={group.dayNumber == null ? 'unassigned' : `day-${group.dayNumber}`}
          group={group}
          route={route}
          startDate={startDate}
          styles={styles}
          colors={colors}
        />,
        ...group.indices.map((index) => {
          const point = route[index]
          return point ? renderPoint(point, index, pointSlot?.(index)) : null
        }),
      ])}
    </>
  )
}

export default function RouteDayGroupHeader({
  group,
  route,
  startDate,
  styles,
  colors,
}: HeaderProps) {
  const distanceKm = dayGroupDistanceKm(route, group.indices)
  const distanceLabel = formatDistance(distanceKm)
  const dateYmd =
    group.dayNumber != null ? hikeDayDate(startDate, group.dayNumber) : null
  const dateLabel = dateYmd ? formatTripDateLong(dateYmd) : null
  const title =
    group.dayNumber != null
      ? i18nT('tripsStatic:plan.routeDay.heading', { day: group.dayNumber })
      : i18nT('tripsStatic:plan.routeDay.unassigned')
  const meta = [dateLabel, distanceKm > 0 ? distanceLabel : null].filter(Boolean).join(' · ')
  const accessibilityLabel =
    group.dayNumber != null
      ? i18nT('tripsStatic:plan.routeDay.headerA11y', {
          day: group.dayNumber,
          date: dateLabel ?? tripDateUnavailableText(),
          distance: distanceLabel,
        })
      : i18nT('tripsStatic:plan.routeDay.unassignedA11y', { distance: distanceLabel })

  return (
    <View
      style={styles.dayGroupHeader}
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      testID={
        group.dayNumber != null
          ? `route-builder-day-group-${group.dayNumber}`
          : 'route-builder-day-group-unassigned'
      }
    >
      <Text style={styles.dayGroupTitle}>{title}</Text>
      {meta ? (
        <Text style={[styles.dayGroupMeta, { color: colors.textSecondary }]}>{meta}</Text>
      ) : null}
    </View>
  )
}
