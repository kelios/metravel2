import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import {
  hasAnyTravelEngagementStats,
  type TravelEngagementStats,
} from '@/utils/travelEngagementStats'

type MetricKey = keyof TravelEngagementStats

type MetricDefinition = {
  key: MetricKey
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
}

const AUTHOR_METRICS: MetricDefinition[] = [
  { key: 'favoritesCount', label: 'Сохранили', icon: 'heart' },
  { key: 'wishlistCount', label: 'Хочу', icon: 'bookmark' },
  { key: 'plannedCount', label: 'Планируют', icon: 'calendar' },
]

const CALENDAR_METRICS: MetricDefinition[] = [
  { key: 'favoritesCount', label: 'Был', icon: 'check-circle' },
  { key: 'wishlistCount', label: 'Хочу', icon: 'bookmark' },
  { key: 'plannedCount', label: 'Планирую', icon: 'calendar' },
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
}: {
  summary: TravelEngagementStats | null
  travelsCount: number
  isLoading?: boolean
  mode?: 'author' | 'calendar'
}) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const isAvailable = hasAnyTravelEngagementStats(summary)
  const isCalendarMode = mode === 'calendar'
  const metrics = isCalendarMode ? CALENDAR_METRICS : AUTHOR_METRICS

  const description = useMemo(() => {
    if (isCalendarMode) {
      return 'Ваши путешествия по статусам календаря: где уже были, куда хотите поехать и что запланировали.'
    }

    if (travelsCount === 0) {
      return 'Опубликуйте первое путешествие — здесь появится общая статистика интереса аудитории.'
    }

    if (isAvailable) {
      return 'Сколько раз ваши путешествия сохранили в избранное и сколько пользователей хотят или уже планируют поездку.'
    }

    return 'Блок уже готов на фронтенде. Как только профиль начнёт получать агрегированные данные, значения появятся автоматически.'
  }, [isAvailable, isCalendarMode, travelsCount])

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isCalendarMode ? 'Календарь путешествий' : 'Социальная статистика путешествий'}
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
            <View key={metric.key} style={styles.metricCard}>
              <View style={styles.metricIconWrap}>
                <Feather name={metric.icon} size={15} color={colors.primary} />
              </View>
              <Text style={styles.metricValue}>{formatMetricValue(summary?.[metric.key])}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
