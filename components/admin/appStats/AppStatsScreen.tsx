import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  appStatsRange,
  isAppTelemetryStatsEmpty,
  type AppStatsPeriod,
  type AppTelemetryStats,
  type AppTelemetryStatsPlatform,
} from '@/api/appTelemetryStats'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import EmptyState from '@/components/ui/EmptyState'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useAppTelemetryStats } from '@/hooks/useAppTelemetryStats'
import { translate as i18nT } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { webTouchScrollStyle } from '@/utils'
import { buildCanonicalUrl } from '@/utils/seo'

import AppStatsCrashFreePanel from './AppStatsCrashFreePanel'
import AppStatsCrashesPanel from './AppStatsCrashesPanel'
import AppStatsDaysPanel from './AppStatsDaysPanel'
import AppStatsFilters from './AppStatsFilters'
import AppStatsFunnelPanel from './AppStatsFunnelPanel'
import AppStatsRetentionPanel from './AppStatsRetentionPanel'

const knownVersions = (stats: AppTelemetryStats | undefined, selected: string): string[] => {
  const versions = new Set<string>()
  for (const row of stats?.crash_free ?? []) {
    if (row.app_version) versions.add(row.app_version)
  }
  if (selected) versions.add(selected)
  return [...versions].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

export default function AppStatsScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const isFocused = useIsFocused()
  const authReady = useAuthStore((state) => state.authReady)
  const isSuperuser = useAuthStore((state) => state.isSuperuser)
  const [period, setPeriod] = useState<AppStatsPeriod>(30)
  const [platform, setPlatform] = useState<AppTelemetryStatsPlatform>('')
  const [appVersion, setAppVersion] = useState('')

  const canLoad = authReady && isSuperuser
  const range = appStatsRange(period)
  const catalogQuery = useMemo(
    () => ({ from: range.from, to: range.to, platform, appVersion: '' }),
    [platform, range.from, range.to],
  )
  const selectedQuery = useMemo(
    () => ({ ...catalogQuery, appVersion }),
    [appVersion, catalogQuery],
  )
  const catalog = useAppTelemetryStats(catalogQuery, canLoad)
  const filtered = useAppTelemetryStats(selectedQuery, canLoad && appVersion !== '')
  const active = appVersion ? filtered : catalog

  useEffect(() => {
    if (!authReady || isSuperuser) return
    router.replace('/')
  }, [authReady, isSuperuser, router])

  if (!canLoad) {
    if (!authReady) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
          <Loading colorsText={colors.textMuted} />
        </SafeAreaView>
      )
    }
    return null
  }

  const stats = active.data
  const versions = knownVersions(catalog.data, appVersion)

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
      {isFocused ? (
        <InstantSEO
          headKey="app-stats"
          title={i18nT('appStatsStatic:screen.title')}
          description={i18nT('appStatsStatic:screen.seoDescription')}
          canonical={buildCanonicalUrl('/app-stats')}
          robots="noindex, nofollow"
        />
      ) : null}
      <ScrollView testID="app-stats-scroll" style={webTouchScrollStyle} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {i18nT('appStatsStatic:screen.title')}
        </Text>
        <AppStatsFilters
          period={period}
          platform={platform}
          appVersion={appVersion}
          versions={versions}
          onPeriod={setPeriod}
          onPlatform={setPlatform}
          onVersion={setAppVersion}
        />
        {active.isPending ? <Loading colorsText={colors.textMuted} /> : null}
        {active.isError ? (
          <EmptyState
            testID="app-stats-error"
            density="compact"
            icon="alert-circle"
            title={i18nT('appStatsStatic:states.errorTitle')}
            action={{
              label: i18nT('appStatsStatic:states.retry'),
              onPress: () => {
                void active.refetch()
              },
              testID: 'app-stats-retry',
            }}
          />
        ) : null}
        {stats && isAppTelemetryStatsEmpty(stats) ? (
          <EmptyState
            testID="app-stats-empty"
            density="compact"
            icon="bar-chart-2"
            title={i18nT('appStatsStatic:states.emptyTitle')}
            description={i18nT('appStatsStatic:states.emptyDescription')}
          />
        ) : null}
        {stats && !isAppTelemetryStatsEmpty(stats) ? (
          <View testID="app-stats-content" style={styles.panels}>
            <AppStatsDaysPanel days={stats.days} />
            <AppStatsRetentionPanel retention={stats.retention} />
            <AppStatsCrashFreePanel rows={stats.crash_free} />
            <AppStatsCrashesPanel crashes={stats.top_crashes} />
            <AppStatsFunnelPanel steps={stats.funnel} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function Loading({ colorsText }: { colorsText: string }) {
  return (
    <View testID="app-stats-loading" style={styles.loading}>
      <ActivityIndicator />
      <Text style={{ color: colorsText }}>{i18nT('appStatsStatic:states.loading')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.lg,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700',
  },
  panels: {
    gap: DESIGN_TOKENS.spacing.md,
    width: '100%',
  },
  loading: {
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
})
