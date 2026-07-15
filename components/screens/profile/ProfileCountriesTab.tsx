import { useMemo } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'
import {
  type ProfileCountryApplicationRow,
  type ProfileCountryRegionGroup,
  type ProfileCountryRow,
} from './profileCountries'
import { useProfileCountriesData } from './useProfileCountriesData'
import { selectPlural, translate as i18nT } from '@/i18n'


interface ProfileCountriesTabProps {
  userId: string | number | null | undefined
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
  travelsSyncing: boolean
  loadedTravelsCount: number
  totalTravelsCount: number
  onBackToOverview: () => void
}

const formatVisitCount = (count: number) => {
  return selectPlural(count, {
    one: i18nT('profile:components.screens.profile.ProfileCountriesTab.value1_raz_1479fc9e', { value1: count }),
    few: i18nT('profile:components.screens.profile.ProfileCountriesTab.value1_raza_0ab39799', { value1: count }),
    many: i18nT('profile:components.screens.profile.ProfileCountriesTab.value1_raz_1479fc9e', { value1: count }),
    other: i18nT('profile:components.screens.profile.ProfileCountriesTab.value1_raz_1479fc9e', { value1: count }),
  })
}

const getCountryFlagLabel = (country: Pick<ProfileCountryRow, 'code' | 'name'>) => {
  if (country.code) return country.code.slice(0, 2).toUpperCase()
  const letters = country.name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return letters || '??'
}

export function ProfileCountriesTab({
  userId,
  travels,
  personalTravelStatusEntries,
  travelsSyncing,
  loadedTravelsCount,
  totalTravelsCount,
  onBackToOverview,
}: ProfileCountriesTabProps) {
  const colors = useThemedColors()
  const { isMobile, width } = useResponsive()
  const isCompact = isMobile || width < 640
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact])
  const {
    applicationRows,
    isInitialLoading,
    progressPercent,
    showCatalogError,
    showFallbackCatalogLoading,
    showPartialCatalogWarning,
    showTravelsSyncing,
    stats,
  } = useProfileCountriesData({
    userId,
    travels,
    personalTravelStatusEntries,
    travelsSyncing,
    loadedTravelsCount,
    totalTravelsCount,
  })

  return (
    <View style={styles.wrap}>
      <ProfileSectionHeader
        title={i18nT('profile:components.screens.profile.ProfileCountriesTab.strany_9526955d')}
        subtitle={i18nT('profile:components.screens.profile.ProfileCountriesTab.vash_progress_po_poseschennym_stranam_b87694d2')}
        onBack={onBackToOverview}
        backLabel={i18nT('profile:components.screens.profile.ProfileCountriesTab.uroven_f829d52e')}
      />

      <View style={styles.summaryCard}>
        <View style={styles.metricsRow}>
          <CountryMetric label={i18nT('profile:components.screens.profile.ProfileCountriesTab.posetili_15cefd0f')} value={stats.visitedCount} tone="success" />
          <CountryMetric label={i18nT('profile:components.screens.profile.ProfileCountriesTab.ostalos_ae766f93')} value={stats.remainingCount} tone="muted" />
          <CountryMetric label={i18nT('profile:components.screens.profile.ProfileCountriesTab.vsego_db000654')} value={stats.totalCount} tone="neutral" />
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>

        {showTravelsSyncing || showFallbackCatalogLoading || showPartialCatalogWarning ? (
          <View style={styles.noticeRow}>
            {showFallbackCatalogLoading || showTravelsSyncing ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Feather name="alert-circle" size={14} color={colors.warning} />
            )}
            <Text style={styles.noticeText}>
              {showTravelsSyncing
                ? i18nT('profile:components.screens.profile.ProfileCountriesTab.zagruzhaem_marshruty_value1_iz_value2_81a95ec0', { value1: loadedTravelsCount, value2: totalTravelsCount })
                : showFallbackCatalogLoading
                  ? i18nT('profile:components.screens.profile.ProfileCountriesTab.zagruzhaem_spisok_stran_61a28cab')
                  : i18nT('profile:components.screens.profile.ProfileCountriesTab.ne_udalos_obnovit_dannye_pokazyvaem_sohranen_06c297a1')}
            </Text>
          </View>
        ) : null}
      </View>

      {isInitialLoading ? (
        <View style={styles.skeletonGrid}>
          <SkeletonLoader width="100%" height={54} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width="100%" height={54} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width="100%" height={54} borderRadius={DESIGN_TOKENS.radii.md} />
        </View>
      ) : showCatalogError ? (
        <View style={styles.emptyCard}>
          <Feather name="alert-circle" size={18} color={colors.warning} />
          <Text style={styles.emptyTitle}>{i18nT('profile:components.screens.profile.ProfileCountriesTab.ne_udalos_zagruzit_strany_926c595b')}</Text>
          <Text style={styles.emptyText}>{i18nT('profile:components.screens.profile.ProfileCountriesTab.poprobuyte_otkryt_vkladku_pozzhe_vash_progre_20beff4f')}</Text>
        </View>
      ) : (
        <>
          <ApplicationTravelHistorySummary rows={applicationRows} />
          <WorldProgressMap groups={stats.regionGroups} />
          <View style={styles.regionList}>
            {stats.regionGroups.map((group) => (
              <RegionSection key={group.key} group={group} />
            ))}
          </View>
        </>
      )}
    </View>
  )

  function CountryMetric({
    label,
    value,
    tone,
  }: {
    label: string
    value: number
    tone: 'success' | 'neutral' | 'muted'
  }) {
    const toneColor =
      tone === 'success'
        ? colors.success
        : tone === 'neutral'
          ? colors.text
          : colors.textMuted

    return (
      <View style={styles.metric}>
        <Text style={[styles.metricValue, { color: toneColor }]}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    )
  }

  function CountryFlagBadge({ country, compact = false }: { country: ProfileCountryRow; compact?: boolean }) {
    return (
      <View
        style={[
          styles.flagBadge,
          compact ? styles.flagBadgeCompact : null,
          country.visited ? styles.flagBadgeVisited : styles.flagBadgeMuted,
        ]}
      >
        <Text
          style={[
            styles.flagBadgeText,
            compact ? styles.flagBadgeTextCompact : null,
            country.visited ? styles.flagBadgeTextVisited : styles.flagBadgeTextMuted,
          ]}
          numberOfLines={1}
        >
          {getCountryFlagLabel(country)}
        </Text>
      </View>
    )
  }

  function ApplicationTravelHistorySummary({ rows }: { rows: ProfileCountryApplicationRow[] }) {
    return (
      <View style={styles.applicationCard}>
        <View style={styles.applicationTitleRow}>
          <Feather name="bar-chart-2" size={16} color={colors.primaryDark} />
          <Text style={styles.applicationTitle}>{i18nT('profile:components.screens.profile.ProfileCountriesTab.statistika_po_stranam_ca086727')}</Text>
        </View>

        {rows.length === 0 ? (
          <View style={styles.applicationEmpty}>
            <Feather name="info" size={16} color={colors.textMuted} />
            <Text style={styles.applicationMutedText}>
              {i18nT('profile:components.screens.profile.ProfileCountriesTab.poseschennyh_stran_poka_net_kogda_poyavyatsy_6e06189d')}</Text>
          </View>
        ) : (
          <View style={styles.applicationList}>
            {rows.map((row) => (
              <View key={row.id} style={styles.applicationRow}>
                <View style={styles.applicationCountryTitleWrap}>
                  <Text style={styles.applicationCountryTitle} numberOfLines={1}>
                    {row.name}
                  </Text>
                  {row.code ? (
                    <Text style={styles.applicationCountryCode}>{row.code}</Text>
                  ) : null}
                </View>
                {row.firstKnownDateLabel ? (
                  <Text style={styles.applicationDateText} numberOfLines={1}>
                    {row.firstKnownDateLabel}
                  </Text>
                ) : null}
                <View style={styles.applicationCountBadge}>
                  <Text style={styles.applicationCountText}>{formatVisitCount(row.visitCount)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    )
  }

  function WorldProgressMap({ groups }: { groups: ProfileCountryRegionGroup[] }) {
    return (
      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View style={styles.mapTitleRow}>
            <Feather name="map" size={16} color={colors.primaryDark} />
            <Text style={styles.mapTitle}>{i18nT('profile:components.screens.profile.ProfileCountriesTab.progress_po_regionam_e6d2abe9')}</Text>
          </View>
          <Text style={styles.mapSubtitle}>
            {i18nT('profile:components.screens.profile.ProfileCountriesTab.zelenym_gde_uzhe_byli_serym_kuda_esche_preds_813acf1b')}</Text>
        </View>
        <View style={styles.mapGrid}>
          {groups.map((group) => {
            const percent = group.totalCount > 0
              ? Math.min(100, Math.round((group.visitedCount / group.totalCount) * 100))
              : 0
            const previewCountries = [
              ...group.rows.filter((country) => country.visited),
              ...group.rows.filter((country) => !country.visited),
            ].slice(0, isCompact ? 4 : 6)

            return (
              <View
                key={group.key}
                style={[styles.mapRegion, group.visitedCount > 0 ? styles.mapRegionVisited : null]}
              >
                <View style={styles.mapRegionHeader}>
                  <Text style={styles.mapRegionTitle} numberOfLines={1}>{group.label}</Text>
                  <Text style={styles.mapRegionCount}>{group.visitedCount}/{group.totalCount}</Text>
                </View>
                <View style={styles.mapProgressTrack}>
                  <View style={[styles.mapProgressFill, { width: `${percent}%` }]} />
                </View>
                <View style={styles.mapFlagsRow}>
                  {previewCountries.map((country) => (
                    <CountryFlagBadge
                      key={`${group.key}-flag-${country.id}`}
                      country={country}
                      compact
                    />
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      </View>
    )
  }

  function RegionSection({ group }: { group: ProfileCountryRegionGroup }) {
    return (
      <View style={styles.regionSection}>
        <View style={styles.regionHeader}>
          <View style={styles.regionTitleWrap}>
            <Text style={styles.regionTitle}>{group.label}</Text>
            <Text style={styles.regionSubtitle}>
              {i18nT('profile:components.screens.profile.ProfileCountriesTab.posetili_a24308d2')}{group.visitedCount} {i18nT('profile:components.screens.profile.ProfileCountriesTab.vsego_5c6b3497')}{group.totalCount}
            </Text>
          </View>
          <View style={styles.regionBadge}>
            <Text style={styles.regionBadgeText}>{group.remainingCount} {i18nT('profile:components.screens.profile.ProfileCountriesTab.ostalos_c2cf7caa')}</Text>
          </View>
        </View>
        <View style={styles.countryGrid}>
          {group.rows.map((country) => (
            <CountryTile key={country.id} country={country} />
          ))}
        </View>
      </View>
    )
  }

  function CountryTile({ country }: { country: ProfileCountryRow }) {
    return (
      <View
        style={[styles.countryTile, country.visited ? styles.countryTileVisited : styles.countryTileMuted]}
        accessibilityRole="text"
        accessibilityLabel={`${country.name}: ${country.visited ? i18nT('profile:components.screens.profile.ProfileCountriesTab.poseschena_d0d01a14') : i18nT('profile:components.screens.profile.ProfileCountriesTab.ne_poseschena_e9afa926')}`}
      >
        <CountryFlagBadge country={country} />
        <Text
          style={[styles.countryName, country.visited ? null : styles.countryNameMuted]}
          numberOfLines={1}
        >
          {country.name}
        </Text>
        <Feather
          name={country.visited ? 'check-circle' : 'circle'}
          size={16}
          color={country.visited ? colors.success : colors.textSubtle}
        />
      </View>
    )
  }
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isCompact: boolean) =>
  StyleSheet.create({
    wrap: {
      gap: DESIGN_TOKENS.spacing.sm,
      paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    summaryCard: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    metric: {
      flexGrow: 1,
      flexBasis: isCompact ? 80 : 120,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    metricValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
    },
    metricLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as never,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    progressFill: {
      height: '100%',
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.success,
    },
    progressPercent: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.success,
      minWidth: 34,
      textAlign: 'right',
    },
    noticeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    noticeText: {
      flex: 1,
      minWidth: 0,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textMuted,
    },
    skeletonGrid: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    emptyCard: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.xs,
      alignItems: 'flex-start',
    },
    emptyTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.text,
    },
    emptyText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 20,
      color: colors.textMuted,
    },
    applicationCard: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    applicationTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    applicationTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.text,
    },
    applicationEmpty: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    applicationList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    applicationRow: {
      flexGrow: 1,
      flexBasis: isCompact ? '100%' : 240,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 7,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
    },
    applicationCountryTitleWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    applicationDateText: {
      fontSize: 11,
      lineHeight: 14,
      color: colors.textMuted,
    },
    applicationCountryTitle: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 19,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.text,
    },
    applicationCountryCode: {
      fontSize: 10,
      lineHeight: 12,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      letterSpacing: 0,
    },
    applicationCountBadge: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    applicationCountText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 16,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.primaryText,
    },
    applicationMutedText: {
      flex: 1,
      minWidth: 0,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textMuted,
    },
    mapCard: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    mapHeader: {
      gap: 4,
    },
    mapTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    mapTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.text,
    },
    mapSubtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textMuted,
    },
    mapGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    mapRegion: {
      flexGrow: 1,
      flexBasis: isCompact ? '100%' : 250,
      minHeight: 106,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    mapRegionVisited: {
      borderColor: colors.success,
      backgroundColor: colors.successSoft,
    },
    mapRegionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    mapRegionTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.text,
    },
    mapRegionCount: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.textMuted,
    },
    mapProgressTrack: {
      height: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    mapProgressFill: {
      height: '100%',
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.success,
    },
    mapFlagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    regionList: {
      gap: DESIGN_TOKENS.spacing.md,
    },
    regionSection: {
      gap: DESIGN_TOKENS.spacing.sm,
    },
    regionHeader: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    regionTitleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    regionTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.text,
    },
    regionSubtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 17,
    },
    regionBadge: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    regionBadgeText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as never,
      color: colors.textMuted,
    },
    countryGrid: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      ...Platform.select({
        web: {
          alignItems: 'stretch',
        } as object,
        default: {},
      }),
    },
    countryTile: {
      flexGrow: 1,
      flexBasis: isCompact ? '48%' : 170,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 6,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
    },
    countryTileVisited: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    countryTileMuted: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.borderLight,
      opacity: 0.62,
    },
    flagBadge: {
      width: 42,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    flagBadgeCompact: {
      width: 34,
      height: 22,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    flagBadgeVisited: {
      backgroundColor: colors.surface,
      borderColor: colors.success,
    },
    flagBadgeMuted: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
    },
    flagBadgeText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as never,
      color: colors.text,
      letterSpacing: 0,
    },
    flagBadgeTextCompact: {
      fontSize: 10,
      lineHeight: 12,
    },
    flagBadgeTextVisited: {
      color: colors.success,
    },
    flagBadgeTextMuted: {
      color: colors.textMuted,
    },
    countryName: {
      flex: 1,
      minWidth: 0,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 18,
      color: colors.text,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as never,
    },
    countryNameMuted: {
      color: colors.textMuted,
    },
  })
