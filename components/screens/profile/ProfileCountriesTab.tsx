import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { fetchAllCountries } from '@/api/misc'
import { fetchUserCountryProgress } from '@/api/user'
import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { queryConfigs } from '@/utils/reactQueryConfig'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'
import {
  buildCountryApplicationRows,
  buildProfileCountryStats,
  buildProfileCountryStatsFromProgress,
  type ProfileCountryApplicationRow,
  type ProfileCountryRegionGroup,
  type ProfileCountryRow,
} from './profileCountries'

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
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} раз`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} раза`
  return `${count} раз`
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
  const [countries, setCountries] = useState<unknown[]>([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError] = useState(false)
  const countryProgressQuery = useQuery({
    queryKey: queryKeys.userCountryProgress(userId),
    queryFn: () => fetchUserCountryProgress(userId as string | number),
    enabled: Boolean(userId),
    ...queryConfigs.dynamic,
  })
  const shouldLoadFallbackCatalog = !userId || countryProgressQuery.isError

  useEffect(() => {
    if (!shouldLoadFallbackCatalog) {
      setCountries([])
      setCountriesLoading(false)
      setCountriesError(false)
      return
    }

    const controller = new AbortController()
    let mounted = true

    setCountriesLoading(true)
    setCountriesError(false)

    fetchAllCountries({ signal: controller.signal, throwOnError: true })
      .then((nextCountries) => {
        if (!mounted) return
        setCountries(nextCountries)
      })
      .catch((error) => {
        if (!mounted) return
        if (error instanceof Error && error.name === 'AbortError') return
        setCountriesError(true)
        setCountries([])
      })
      .finally(() => {
        if (mounted) setCountriesLoading(false)
      })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [shouldLoadFallbackCatalog])

  const backendStats = useMemo(
    () =>
      countryProgressQuery.data
        ? buildProfileCountryStatsFromProgress(countryProgressQuery.data)
        : null,
    [countryProgressQuery.data],
  )

  const fallbackStats = useMemo(
    () =>
      buildProfileCountryStats({
        countries,
        travels,
        personalTravelStatusEntries,
      }),
    [countries, personalTravelStatusEntries, travels],
  )
  const stats = backendStats ?? fallbackStats
  const applicationRows = useMemo(() => buildCountryApplicationRows(stats.rows), [stats.rows])

  const progressPercent = stats.totalCount > 0
    ? Math.min(100, Math.round((stats.visitedCount / stats.totalCount) * 100))
    : 0

  const isInitialLoading =
    (countryProgressQuery.isLoading && !backendStats && stats.rows.length === 0) ||
    (shouldLoadFallbackCatalog && countriesLoading && stats.rows.length === 0)
  const showCatalogError =
    (countryProgressQuery.isError || countriesError) && stats.rows.length === 0
  const showPartialCatalogWarning =
    !backendStats && (countryProgressQuery.isError || countriesError) && stats.rows.length > 0
  const showTravelsSyncing =
    !backendStats && travelsSyncing && totalTravelsCount > 0 && loadedTravelsCount < totalTravelsCount

  return (
    <View style={styles.wrap}>
      <ProfileSectionHeader
        title="Страны"
        subtitle="Ваш прогресс по посещённым странам"
        onBack={onBackToOverview}
        backLabel="Главное"
      />

      <View style={styles.summaryCard}>
        <View style={styles.metricsRow}>
          <CountryMetric label="Посетили" value={stats.visitedCount} tone="success" />
          <CountryMetric label="Осталось" value={stats.remainingCount} tone="muted" />
          <CountryMetric label="Всего" value={stats.totalCount} tone="neutral" />
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>

        {showTravelsSyncing || (shouldLoadFallbackCatalog && countriesLoading) || showPartialCatalogWarning ? (
          <View style={styles.noticeRow}>
            {(shouldLoadFallbackCatalog && countriesLoading) || showTravelsSyncing ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Feather name="alert-circle" size={14} color={colors.warning} />
            )}
            <Text style={styles.noticeText}>
              {showTravelsSyncing
                ? `Загружаем маршруты: ${loadedTravelsCount} из ${totalTravelsCount}`
                : shouldLoadFallbackCatalog && countriesLoading
                  ? 'Загружаем список стран'
                  : 'Не удалось обновить данные, показываем сохранённые'}
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
          <Text style={styles.emptyTitle}>Не удалось загрузить страны</Text>
          <Text style={styles.emptyText}>Попробуйте открыть вкладку позже — ваш прогресс сохранится.</Text>
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
          <Text style={styles.applicationTitle}>Статистика по странам</Text>
        </View>

        {rows.length === 0 ? (
          <View style={styles.applicationEmpty}>
            <Feather name="info" size={16} color={colors.textMuted} />
            <Text style={styles.applicationMutedText}>
              Посещённых стран пока нет. Когда появятся маршруты или отметки «Был здесь», здесь появится статистика по странам.
            </Text>
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
            <Text style={styles.mapTitle}>Прогресс по регионам</Text>
          </View>
          <Text style={styles.mapSubtitle}>
            Зелёным — где уже были, серым — куда ещё предстоит.
          </Text>
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
              Посетили {group.visitedCount} / всего {group.totalCount}
            </Text>
          </View>
          <View style={styles.regionBadge}>
            <Text style={styles.regionBadgeText}>{group.remainingCount} осталось</Text>
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
        accessibilityLabel={`${country.name}: ${country.visited ? 'посещена' : 'не посещена'}`}
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
