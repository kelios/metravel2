/**
 * «Рядом с маршрутом» (#2911): статьи и квесты сайта в коридоре маршрута планировщика
 * из индекса metravel-assist (`POST /ai/near-route`). Карточки `AiPickCard` в
 * прокручиваемом ряду `CardRail` (как «Подобрать по описанию» на `/search`), под
 * каждой — «Добавить в маршрут»: точка с координатами источника уходит в
 * `RouteBuilder.handleAddAiPoint`. Источники, уже стоящие в маршруте (по `placeId`
 * статьи или добавленные отсюда), скрыты. Пустой ответ, отказ службы, маршрут без
 * координат — блока нет. Модуль живёт только под `EXPO_PUBLIC_AI_PICKS`: `RouteBuilder`
 * грузит его отложенным чанком по литеральному флагу (#2738), без флага запросов к
 * `/ai/*` страница не делает.
 */
import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { AiPickItem } from '@/api/aiPicks'
import { aiPickSourceKey, NEAR_ROUTE_LIMIT, routeGeoPoints, type RouteNearSuggestionsProps } from '@/components/trips/planning/RouteNearSuggestions'
import { AiPickCard, AiPickCardSkeleton } from '@/components/aiPicks/AiPickCard'
import UIButton from '@/components/ui/Button'
import CardRail from '@/components/ui/CardRail'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAiNearRoute } from '@/hooks/useAiPicks'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

const RAIL_GAP = 12
const RAIL_SLOT_WIDTH = 260
const RAIL_SLOT_WIDTH_NARROW = 220
const SKELETON_COUNT = 3
function RouteNearSuggestions({ route, onAddPoint, testID = 'route-near-suggestions' }: RouteNearSuggestionsProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isHydrated, isMobile } = useResponsive()
  const isNarrowLayout = isHydrated && isMobile
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set())

  const points = useMemo(() => routeGeoPoints(route), [route])
  const query = useAiNearRoute(points, { limit: NEAR_ROUTE_LIMIT })

  // Статья, уже стоящая точкой «Место» (placeId = id статьи), и всё, что добавлено отсюда.
  const inRoute = useMemo(() => {
    const keys = new Set(added)
    for (const point of route) if (point.placeId != null) keys.add(`travel:${point.placeId}`)
    return keys
  }, [added, route])

  const items = useMemo(() => (query.data ?? []).filter((item) => item.lat !== null && item.lng !== null && !inRoute.has(aiPickSourceKey(item))), [inRoute, query.data])
  const isLoading = points.length > 0 && query.isFetching && !query.data

  const add = useCallback(
    (item: AiPickItem) => {
      onAddPoint(item)
      setAdded((prev) => new Set(prev).add(aiPickSourceKey(item)))
    },
    [onAddPoint],
  )

  if (points.length === 0 || (!isLoading && items.length === 0)) return null

  const addLabel = i18nT('aiPicksStatic:nearRoute.add')
  const slotWidth = isNarrowLayout ? RAIL_SLOT_WIDTH_NARROW : RAIL_SLOT_WIDTH

  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.headerRow}>
        <Feather name="map-pin" size={16} color={colors.primaryDark} />
        <Text style={styles.title}>{i18nT('aiPicksStatic:nearRoute.title')}</Text>
      </View>
      <Text style={styles.hint}>{i18nT('aiPicksStatic:nearRoute.hint')}</Text>
      {isLoading ? (
        <CardRail gap={RAIL_GAP} hideArrows contentPaddingVertical={4} testID={`${testID}-loading`}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <View key={index} style={{ width: slotWidth }}>
              <AiPickCardSkeleton />
            </View>
          ))}
        </CardRail>
      ) : (
        <CardRail gap={RAIL_GAP} contentPaddingVertical={4} accessibilityLabel={i18nT('aiPicksStatic:nearRoute.title')} testID={`${testID}-rail`}>
          {items.map((item) => (
            <View key={aiPickSourceKey(item)} style={{ width: slotWidth }}>
              <AiPickCard
                item={item}
                slotWidth={slotWidth}
                actionSlot={
                  <UIButton
                    label={addLabel}
                    accessibilityLabel={`${addLabel}: ${item.title}`}
                    variant="soft"
                    size="sm"
                    icon={<Feather name="plus" size={16} color={colors.primaryDark} />}
                    onPress={() => add(item)}
                    testID={`route-near-add-${item.type}-${item.source_id}`}
                  />
                }
              />
            </View>
          ))}
        </CardRail>
      )}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    section: {
      gap: DESIGN_TOKENS.spacing.xs,
      paddingTop: DESIGN_TOKENS.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
      color: colors.text,
    },
    hint: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
  })

export default React.memo(RouteNearSuggestions)
