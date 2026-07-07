import { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import { globalFocusStyles } from '@/styles/globalFocus'
import {
  hasAnyTravelEngagementStats,
  type TravelEngagementStats,
} from '@/utils/travelEngagementStats'

type MetricKey = 'favoritesCount' | 'wishlistCount' | 'visitedCount' | 'plannedCount'
export type ProfileTravelEngagementMetricKey = MetricKey

type MetricDefinition = {
  key: MetricKey
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
  helper: string
}

const AUTHOR_METRICS: MetricDefinition[] = [
  { key: 'favoritesCount', label: 'Сохранили', icon: 'heart', helper: 'добавили в «Хочу поехать»' },
  { key: 'wishlistCount', label: 'Хотят', icon: 'bookmark', helper: 'добавили в «Хочу поехать»' },
  { key: 'visitedCount', label: 'Были', icon: 'check-circle', helper: 'уже посетили маршрут' },
  { key: 'plannedCount', label: 'Планируют', icon: 'calendar', helper: 'собираются поехать' },
]

const CALENDAR_METRICS: MetricDefinition[] = [
  { key: 'visitedCount', label: 'Был', icon: 'check-circle', helper: 'мои посещённые поездки' },
  { key: 'favoritesCount', label: 'Хочу', icon: 'bookmark', helper: 'мои «Хочу поехать»' },
  { key: 'plannedCount', label: 'Планирую', icon: 'calendar', helper: 'мои поездки с датой' },
]

const formatMetricValue = (value: number | null | undefined) =>
  value == null ? '—' : String(value)

const DEFAULT_AUTHOR_METRICS: MetricDefinition[] = AUTHOR_METRICS.filter(
  (metric) => metric.key !== 'visitedCount'
)

const createStyles = (colors: ReturnType<typeof useThemedColors>, isCompact: boolean) =>
  StyleSheet.create({
    section: {
      marginHorizontal: isCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
      padding: isCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: isCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.md,
    },
    sectionHeader: {
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    sectionBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    sectionBadgeText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as never,
    },
    sectionTitle: {
      ...DESIGN_TOKENS.typography.scale.h3,
      ...(isCompact ? { fontSize: 20, lineHeight: 26 } : null),
      color: colors.text,
    },
    sectionDescription: {
      fontSize: isCompact ? DESIGN_TOKENS.typography.sizes.xs : DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: isCompact ? 18 : 20,
    },
    sectionMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    sectionMetaChip: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    sectionMetaChipText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as never,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    metricCard: {
      flexGrow: 1,
      flexBasis: isCompact ? 104 : 160,
      minHeight: isCompact ? 78 : 88,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: isCompact ? 8 : DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.xxs,
      justifyContent: 'center',
    },
    metricCardInteractive: {
      ...Platform.select({
        web: {
          cursor: 'pointer',
        } as any,
        default: {},
      }),
    },
    metricCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    metricIconWrap: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricValue: {
      ...DESIGN_TOKENS.typography.scale.h2,
      ...(isCompact ? { fontSize: 24, lineHeight: 28 } : null),
      color: colors.text,
    },
    metricLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as never,
    },
    metricHelper: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: isCompact ? 14 : 16,
    },
    loadingGrid: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.xs,
    },
  })

export function ProfileTravelEngagementSummary({
  summary,
  travelsCount,
  loadedTravelsCount,
  isLoading = false,
  mode = 'author',
  activeMetric,
  onMetricPress,
  summaryScope = 'all',
}: {
  summary: TravelEngagementStats | null
  travelsCount: number
  loadedTravelsCount?: number
  isLoading?: boolean
  mode?: 'author' | 'calendar'
  activeMetric?: MetricKey | null
  onMetricPress?: (metric: MetricKey) => void
  summaryScope?: 'all' | 'loaded'
}) {
  const colors = useThemedColors()
  const { isMobile, width } = useResponsive()
  const isCompact = isMobile || width < 640
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact])
  const isAvailable = hasAnyTravelEngagementStats(summary)
  const isCalendarMode = mode === 'calendar'
  const metrics = useMemo(() => {
    if (isCalendarMode) return CALENDAR_METRICS
    if (!summary) return DEFAULT_AUTHOR_METRICS

    const availableMetrics = AUTHOR_METRICS.filter((metric) => summary[metric.key] !== null)
    if (availableMetrics.length === 0) return DEFAULT_AUTHOR_METRICS

    if (activeMetric && !availableMetrics.some((metric) => metric.key === activeMetric)) {
      return [...availableMetrics, ...AUTHOR_METRICS.filter((metric) => metric.key === activeMetric)]
    }

    return availableMetrics
  }, [activeMetric, isCalendarMode, summary])

  const description = useMemo(() => {
    if (isCalendarMode) {
      return 'Ваши личные статусы по поездкам: где уже были, что хотите и что уже внесли в планы.'
    }

    if (isLoading) {
      return 'Собираем сводную статистику по вашим опубликованным маршрутам.'
    }

    if (travelsCount === 0) {
      return 'Опубликуйте первое путешествие — здесь появится общая статистика интереса аудитории.'
    }

    if (summaryScope === 'loaded' && (loadedTravelsCount ?? 0) > 0 && (loadedTravelsCount ?? 0) < travelsCount) {
      return 'Пока показываем сумму по уже загруженным карточкам. Полная сводка появится после подгрузки всех маршрутов.'
    }

    if (isAvailable) {
      return 'Здесь собрана суммарная реакция других пользователей на ваши маршруты: сохранения, желания, посещения и планы.'
    }

    return 'Статистика уже подключена. Как только у маршрутов появятся сохранения, желания и планы, значения отобразятся здесь.'
  }, [isAvailable, isCalendarMode, isLoading, loadedTravelsCount, summaryScope, travelsCount])

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>
            {isCalendarMode ? 'Личный календарь' : 'Статистика автора'}
          </Text>
        </View>
        <Text style={styles.sectionTitle}>
          {isCalendarMode ? 'Мои статусы поездок' : 'Что делают пользователи с вашими маршрутами'}
        </Text>
        <Text style={styles.sectionDescription}>{description}</Text>
        {!isCalendarMode ? (
          <View style={styles.sectionMetaRow}>
            <View style={styles.sectionMetaChip}>
              <Text style={styles.sectionMetaChipText}>Маршрутов: {travelsCount}</Text>
            </View>
            {summaryScope === 'loaded' && (loadedTravelsCount ?? 0) > 0 && (loadedTravelsCount ?? 0) < travelsCount ? (
              <View style={styles.sectionMetaChip}>
                <Text style={styles.sectionMetaChipText}>
                  Загружено: {loadedTravelsCount} из {travelsCount}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingGrid}>
          <SkeletonLoader width="32%" height={88} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width="32%" height={88} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width="32%" height={88} borderRadius={DESIGN_TOKENS.radii.md} />
        </View>
      ) : (
        <View style={styles.metricsGrid}>
          {metrics.map((metric) => (
            <Pressable
              key={metric.key}
              style={({ pressed }) => [
                styles.metricCard,
                onMetricPress && styles.metricCardInteractive,
                activeMetric === metric.key && styles.metricCardActive,
                pressed && onMetricPress ? { opacity: 0.92 } : null,
                onMetricPress ? globalFocusStyles.focusable : null,
              ]}
              onPress={onMetricPress ? () => onMetricPress(metric.key) : undefined}
              disabled={!onMetricPress}
              accessibilityRole={onMetricPress ? 'button' : undefined}
              accessibilityLabel={`${metric.label}: ${formatMetricValue(summary?.[metric.key])}`}
              accessibilityHint={onMetricPress ? 'Показать соответствующие карточки' : undefined}
              accessibilityState={onMetricPress ? { selected: activeMetric === metric.key } : undefined}
            >
              <View style={styles.metricIconWrap}>
                <Feather
                  name={metric.icon}
                  size={15}
                  color={activeMetric === metric.key ? colors.primary : colors.primary}
                />
              </View>
              <Text style={styles.metricValue}>{formatMetricValue(summary?.[metric.key])}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              {!isCompact ? <Text style={styles.metricHelper}>{metric.helper}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}
