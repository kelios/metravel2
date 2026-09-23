// components/trips/planning/RouteDayGroupHeader.tsx
// #1845: заголовок группы дня в списке точек. Номер, календарная дата и сумма
// километров дня — в одной строке, чтобы на узкой панели конструктора не
// занимать вторую карточку. Список групп — соседние дети `pointList`, без
// обёртки: `onLayout.y` ручки перетаскивания должен считаться в одной системе
// координат со всеми строками.
// #2058: при свёртке дней (`routeDayCollapse.ts`) заголовок — кнопка ≥ 44 px,
// строки свёрнутого дня не монтируются. Макет — trips-plan-route-tab-mock.md §3.
import React from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'

import type { RouteDayGroup } from '@/components/trips/planning/routePointDays'
import {
  dayGroupDistanceKm,
  groupRoutePointsByDay,
  hikeDayDate,
  shouldGroupRouteByDay,
} from '@/components/trips/planning/routePointDays'
import { routeDayKey, type RouteDayCollapseView } from '@/components/trips/planning/routeDayCollapse'
import { formatDistance, isDrawableCoordinatePair } from '@/components/trips/planning/tripPlanFormatting'
import type { RoutePoint } from '@/api/plannedTrips'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT, translatePlural } from '@/i18n'
import { globalFocusStyles } from '@/styles/globalFocus'
import {
  formatTripDateLong,
  formatTripDayMonth,
  tripDateUnavailableText,
} from '@/utils/tripDateTime'
import type { createStyles } from './RouteBuilder.styles'

type RouteBuilderStyles = ReturnType<typeof createStyles>

interface HeaderProps {
  group: RouteDayGroup
  route: readonly RoutePoint[]
  startDate: string | null | undefined
  styles: RouteBuilderStyles
  colors: ThemedColors
  /** `undefined` — дни не сворачиваются, заголовок остаётся подписью. */
  expanded?: boolean
  onToggle?: (group: RouteDayGroup) => void
  onShowOnMap?: (group: RouteDayGroup) => void
}

export function RouteDayGroups({
  route,
  startDate,
  styles,
  colors,
  renderPoint,
  pointSlot,
  collapse,
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
  collapse?: RouteDayCollapseView | null
}) {
  if (!shouldGroupRouteByDay(route)) {
    return <>{route.map((point, index) => renderPoint(point, index, pointSlot?.(index)))}</>
  }
  return (
    <>
      {groupRoutePointsByDay(route).flatMap((group) => {
        const key = routeDayKey(group.dayNumber)
        const expanded = collapse ? collapse.isExpanded(key) : undefined
        const onMap =
          collapse?.onShowOnMap &&
          group.indices.some((index) => isDrawableCoordinatePair(route[index]?.coordinates))
            ? collapse.onShowOnMap
            : undefined
        return [
          <RouteDayGroupHeader
            key={key}
            group={group}
            route={route}
            startDate={startDate}
            styles={styles}
            colors={colors}
            expanded={expanded}
            onToggle={collapse?.onToggle}
            onShowOnMap={onMap}
          />,
          ...(expanded === false
            ? []
            : group.indices.map((index) => {
                const point = route[index]
                return point ? renderPoint(point, index, pointSlot?.(index)) : null
              })),
        ]
      })}
    </>
  )
}

export default function RouteDayGroupHeader({
  group,
  route,
  startDate,
  styles,
  colors,
  expanded,
  onToggle,
  onShowOnMap,
}: HeaderProps) {
  const distanceKm = dayGroupDistanceKm(route, group.indices)
  const distanceLabel = formatDistance(distanceKm)
  const dateYmd =
    group.dayNumber != null ? hikeDayDate(startDate, group.dayNumber) : null
  const pointsLabel = translatePlural('tripsStatic:plan.routeDay.points', group.indices.length)
  const title =
    group.dayNumber != null
      ? i18nT('tripsStatic:plan.routeDay.heading', { day: group.dayNumber })
      : i18nT('tripsStatic:plan.routeDay.unassigned')
  const meta = [
    dateYmd ? formatTripDayMonth(dateYmd) : null,
    pointsLabel,
    distanceKm > 0 ? distanceLabel : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const accessibilityLabel =
    group.dayNumber != null
      ? i18nT('tripsStatic:plan.routeDay.headerA11y', {
          day: group.dayNumber,
          date: dateYmd ? formatTripDateLong(dateYmd) : tripDateUnavailableText(),
          points: pointsLabel,
          distance: distanceLabel,
        })
      : i18nT('tripsStatic:plan.routeDay.unassignedA11y', {
          points: pointsLabel,
          distance: distanceLabel,
        })
  const testSuffix = group.dayNumber != null ? String(group.dayNumber) : 'unassigned'

  if (expanded == null || !onToggle) {
    return (
      <View
        style={styles.dayGroupHeader}
        accessibilityRole="header"
        accessibilityLabel={accessibilityLabel}
        testID={`route-builder-day-group-${testSuffix}`}
      >
        <Text style={styles.dayGroupTitle}>{title}</Text>
        <Text style={[styles.dayGroupMeta, { color: colors.textSecondary }]}>{meta}</Text>
      </View>
    )
  }

  return (
    <View
      style={styles.dayGroupHeaderRow}
      accessibilityRole="header"
      testID={`route-builder-day-group-${testSuffix}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => onToggle(group)}
        style={({ pressed }) => [
          styles.dayGroupToggle,
          globalFocusStyles.focusable,
          pressed && { backgroundColor: colors.surfaceMuted },
        ]}
        testID={`route-builder-day-toggle-${testSuffix}`}
      >
        <Feather
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={16}
          color={colors.textSecondary}
        />
        <Text style={styles.dayGroupToggleText}>
          <Text style={styles.dayGroupTitle}>{title}</Text>
          <Text style={[styles.dayGroupMeta, { color: colors.textSecondary }]}>{` · ${meta}`}</Text>
        </Text>
      </Pressable>
      {onShowOnMap ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            group.dayNumber != null
              ? i18nT('tripsStatic:plan.routeDay.showOnMap', { day: group.dayNumber })
              : i18nT('tripsStatic:plan.routeDay.showUnassignedOnMap')
          }
          onPress={() => onShowOnMap(group)}
          style={[styles.ctrl, globalFocusStyles.focusable]}
          testID={`route-builder-day-map-${testSuffix}`}
        >
          <Feather name="crosshair" size={16} color={colors.primaryDark} />
        </Pressable>
      ) : null}
    </View>
  )
}
