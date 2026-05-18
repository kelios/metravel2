import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'
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

const METRICS: MetricDefinition[] = [
  { key: 'favoritesCount', label: 'Сохранили', icon: 'heart' },
  { key: 'wishlistCount', label: 'Хочу', icon: 'bookmark' },
  { key: 'plannedCount', label: 'Планируют', icon: 'calendar' },
]

const formatMetricValue = (value: number | null | undefined) =>
  value == null ? '—' : String(value)

const getTravelSecondaryText = (travel: Travel) =>
  [travel.cityName, travel.countryName, travel.year].filter(Boolean).join(' • ')

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
    noteCard: {
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    noteText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    list: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    travelCard: {
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    travelTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.text,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as never,
    },
    travelMeta: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    travelMetricsRow: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    travelMetricChip: {
      flex: 1,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 2,
    },
    travelMetricValue: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.text,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as never,
    },
    travelMetricLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    loadingGrid: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    loadingList: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
  })

export function ProfileTravelEngagementSummary({
  summary,
  travelsCount,
  isLoading = false,
}: {
  summary: TravelEngagementStats | null
  travelsCount: number
  isLoading?: boolean
}) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const isAvailable = hasAnyTravelEngagementStats(summary)

  const description = useMemo(() => {
    if (travelsCount === 0) {
      return 'Опубликуйте первое путешествие — здесь появится общая статистика интереса аудитории.'
    }

    if (isAvailable) {
      return 'Сколько раз ваши путешествия сохранили в избранное и сколько пользователей хотят или уже планируют поездку.'
    }

    return 'Блок уже готов на фронтенде. Как только профиль начнёт получать агрегированные данные, значения появятся автоматически.'
  }, [isAvailable, travelsCount])

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Социальная статистика путешествий</Text>
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
          {METRICS.map((metric) => (
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

export function ProfileTravelEngagementDetails({
  travels,
  totalTravels,
  isLoading = false,
}: {
  travels: Travel[]
  totalTravels: number
  isLoading?: boolean
}) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const sortedTravels = useMemo(() => {
    return [...travels].sort((left, right) => {
      const leftStats = left.engagementStats
      const rightStats = right.engagementStats
      const leftTotal = (leftStats?.favoritesCount ?? 0) + (leftStats?.wishlistCount ?? 0) + (leftStats?.plannedCount ?? 0)
      const rightTotal = (rightStats?.favoritesCount ?? 0) + (rightStats?.wishlistCount ?? 0) + (rightStats?.plannedCount ?? 0)

      if (rightTotal !== leftTotal) return rightTotal - leftTotal
      return left.name.localeCompare(right.name, 'ru')
    })
  }, [travels])

  const hasPerTravelStats = useMemo(
    () => sortedTravels.some((travel) => hasAnyTravelEngagementStats(travel.engagementStats)),
    [sortedTravels]
  )

  if (!isLoading && totalTravels === 0) {
    return null
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>По каждому путешествию</Text>
        <Text style={styles.sectionDescription}>
          {totalTravels > travels.length
            ? `Показано ${travels.length} из ${totalTravels} путешествий. Остальные добавятся по мере загрузки списка.`
            : 'Детальная статистика по каждому опубликованному путешествию автора.'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingList}>
          <SkeletonLoader width="100%" height={112} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width="100%" height={112} borderRadius={DESIGN_TOKENS.radii.md} />
        </View>
      ) : !hasPerTravelStats ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            Детальная статистика появится здесь, как только backend начнёт возвращать счётчики по каждому путешествию.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {sortedTravels.map((travel) => {
            const stats = travel.engagementStats
            const secondaryText = getTravelSecondaryText(travel)

            return (
              <View key={String(travel.id)} style={styles.travelCard}>
                <View>
                  <Text style={styles.travelTitle}>{travel.name}</Text>
                  {secondaryText ? (
                    <Text style={styles.travelMeta}>{secondaryText}</Text>
                  ) : null}
                </View>

                <View style={styles.travelMetricsRow}>
                  {METRICS.map((metric) => (
                    <View key={metric.key} style={styles.travelMetricChip}>
                      <Text style={styles.travelMetricValue}>{formatMetricValue(stats?.[metric.key])}</Text>
                      <Text style={styles.travelMetricLabel}>{metric.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
