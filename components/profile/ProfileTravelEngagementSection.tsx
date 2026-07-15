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
import { translate as i18nT } from '@/i18n'


type MetricKey = 'favoritesCount' | 'wishlistCount' | 'visitedCount' | 'plannedCount'
export type ProfileTravelEngagementMetricKey = MetricKey

type MetricDefinition = {
  key: MetricKey
  label: string
  icon: React.ComponentProps<typeof Feather>['name']
  helper: string
}

const createAuthorMetrics = (): MetricDefinition[] => [
  { key: 'favoritesCount', label: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.saved.label'), icon: 'heart', helper: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.saved.helper') },
  { key: 'wishlistCount', label: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.wishlist.label'), icon: 'bookmark', helper: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.wishlist.helper') },
  { key: 'visitedCount', label: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.visited.label'), icon: 'check-circle', helper: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.visited.helper') },
  { key: 'plannedCount', label: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.planned.label'), icon: 'calendar', helper: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.author.planned.helper') },
]

const createCalendarMetrics = (): MetricDefinition[] => [
  { key: 'visitedCount', label: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.calendar.visited.label'), icon: 'check-circle', helper: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.calendar.visited.helper') },
  { key: 'favoritesCount', label: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.calendar.wishlist.label'), icon: 'bookmark', helper: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.calendar.wishlist.helper') },
  { key: 'plannedCount', label: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.calendar.planned.label'), icon: 'calendar', helper: i18nT('profile:components.profile.ProfileTravelEngagementSection.metrics.calendar.planned.helper') },
]

const formatMetricValue = (value: number | null | undefined) =>
  value == null ? '—' : String(value)

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
  const authorMetrics = createAuthorMetrics()
  const defaultAuthorMetrics = authorMetrics.filter((metric) => metric.key !== 'visitedCount')
  const metrics = (() => {
    if (isCalendarMode) return createCalendarMetrics()
    if (!summary) return defaultAuthorMetrics

    const availableMetrics = authorMetrics.filter((metric) => summary[metric.key] !== null)
    if (availableMetrics.length === 0) return defaultAuthorMetrics

    if (activeMetric && !availableMetrics.some((metric) => metric.key === activeMetric)) {
      return [...availableMetrics, ...authorMetrics.filter((metric) => metric.key === activeMetric)]
    }

    return availableMetrics
  })()

  const description = useMemo(() => {
    if (isCalendarMode) {
      return i18nT('profile:components.profile.ProfileTravelEngagementSection.vashi_lichnye_statusy_po_poezdkam_gde_uzhe_b_4beb4aa9')
    }

    if (isLoading) {
      return i18nT('profile:components.profile.ProfileTravelEngagementSection.sobiraem_svodnuyu_statistiku_po_vashim_opubl_7ff5d7bb')
    }

    if (travelsCount === 0) {
      return i18nT('profile:components.profile.ProfileTravelEngagementSection.opublikuyte_pervoe_puteshestvie_zdes_poyavit_db7bee4b')
    }

    if (summaryScope === 'loaded' && (loadedTravelsCount ?? 0) > 0 && (loadedTravelsCount ?? 0) < travelsCount) {
      return i18nT('profile:components.profile.ProfileTravelEngagementSection.poka_pokazyvaem_summu_po_uzhe_zagruzhennym_k_6c67a96a')
    }

    if (isAvailable) {
      return i18nT('profile:components.profile.ProfileTravelEngagementSection.zdes_sobrana_summarnaya_reaktsiya_drugih_pol_ec629916')
    }

    return i18nT('profile:components.profile.ProfileTravelEngagementSection.statistika_uzhe_podklyuchena_kak_tolko_u_mar_f4d608ba')
  }, [isAvailable, isCalendarMode, isLoading, loadedTravelsCount, summaryScope, travelsCount])

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>
            {isCalendarMode ? i18nT('profile:components.profile.ProfileTravelEngagementSection.lichnyy_kalendar_4f0c8950') : i18nT('profile:components.profile.ProfileTravelEngagementSection.statistika_avtora_28684ac1')}
          </Text>
        </View>
        <Text style={styles.sectionTitle}>
          {isCalendarMode ? i18nT('profile:components.profile.ProfileTravelEngagementSection.moi_statusy_poezdok_c164210a') : i18nT('profile:components.profile.ProfileTravelEngagementSection.chto_delayut_polzovateli_s_vashimi_marshruta_f85d97d6')}
        </Text>
        <Text style={styles.sectionDescription}>{description}</Text>
        {!isCalendarMode ? (
          <View style={styles.sectionMetaRow}>
            <View style={styles.sectionMetaChip}>
              <Text style={styles.sectionMetaChipText}>{i18nT('profile:components.profile.ProfileTravelEngagementSection.marshrutov_0c70d1ac')}{travelsCount}</Text>
            </View>
            {summaryScope === 'loaded' && (loadedTravelsCount ?? 0) > 0 && (loadedTravelsCount ?? 0) < travelsCount ? (
              <View style={styles.sectionMetaChip}>
                <Text style={styles.sectionMetaChipText}>
                  {i18nT('profile:components.profile.ProfileTravelEngagementSection.zagruzheno_8a574f0a')}{loadedTravelsCount} {i18nT('profile:components.profile.ProfileTravelEngagementSection.iz_01234bb3')}{travelsCount}
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
              accessibilityHint={onMetricPress ? i18nT('profile:components.profile.ProfileTravelEngagementSection.pokazat_sootvetstvuyuschie_kartochki_188d300c') : undefined}
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
