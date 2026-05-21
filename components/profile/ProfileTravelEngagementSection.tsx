import { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import {
  hasAnyTravelEngagementStats,
  type TravelEngagementStats,
} from '@/utils/travelEngagementStats'

type MetricKey = 'favoritesCount' | 'visitedCount' | 'plannedCount'
export type ProfileTravelEngagementMetricKey = MetricKey

type MetricDefinition = {
  key: MetricKey
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
  helper: string
}

const AUTHOR_METRICS: MetricDefinition[] = [
  { key: 'favoritesCount', label: 'Сохранили', icon: 'heart', helper: 'добавили в избранное' },
  { key: 'visitedCount', label: 'Были', icon: 'check-circle', helper: 'уже посетили маршрут' },
  { key: 'plannedCount', label: 'Планируют', icon: 'calendar', helper: 'собираются поехать' },
]

const CALENDAR_METRICS: MetricDefinition[] = [
  { key: 'visitedCount', label: 'Был', icon: 'check-circle', helper: 'мои посещённые поездки' },
  { key: 'favoritesCount', label: 'Хочу', icon: 'bookmark', helper: 'мой список желаний' },
  { key: 'plannedCount', label: 'Планирую', icon: 'calendar', helper: 'мои поездки с датой' },
]

const formatMetricValue = (value: number | null | undefined) =>
  value == null ? '—' : String(value)

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    section: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.md,
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
      color: colors.text,
    },
    sectionDescription: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    metricsGrid: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    metricCard: {
      flex: 1,
      minHeight: 88,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
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
      lineHeight: 16,
    },
    loadingGrid: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.xs,
    },
  })

export function ProfileTravelEngagementSummary({
  summary,
  travelsCount,
  isLoading = false,
  mode = 'author',
  activeMetric,
  onMetricPress,
}: {
  summary: TravelEngagementStats | null
  travelsCount: number
  isLoading?: boolean
  mode?: 'author' | 'calendar'
  activeMetric?: MetricKey | null
  onMetricPress?: (metric: MetricKey) => void
}) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const isAvailable = hasAnyTravelEngagementStats(summary)
  const isCalendarMode = mode === 'calendar'
  const metrics = isCalendarMode ? CALENDAR_METRICS : AUTHOR_METRICS

  const description = useMemo(() => {
    if (isCalendarMode) {
      return 'Ваши личные статусы по поездкам: где уже были, что хотите и что уже внесли в планы.'
    }

    if (travelsCount === 0) {
      return 'Опубликуйте первое путешествие — здесь появится общая статистика интереса аудитории.'
    }

    if (isAvailable) {
      return 'Здесь собрана реакция других пользователей на ваши маршруты: сохранения, посещения и планы.'
    }

    return 'Когда backend начнёт отдавать author-агрегаты, здесь появятся сохранения, посещения и планы других пользователей.'
  }, [isAvailable, isCalendarMode, travelsCount])

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
              <Text style={styles.metricHelper}>{metric.helper}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}
