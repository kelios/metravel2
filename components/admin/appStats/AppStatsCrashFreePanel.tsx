import { StyleSheet, Text, View } from 'react-native'

import type { AppTelemetryCrashFreeRow } from '@/api/appTelemetryStats'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import AppStatsMeter from './AppStatsMeter'
import AppStatsSection from './AppStatsSection'
import { appStatsCount, appStatsPercent, appStatsPlatformLabel } from './appStatsLabels'

type Props = {
  rows: readonly AppTelemetryCrashFreeRow[]
}

export default function AppStatsCrashFreePanel({ rows }: Props) {
  const colors = useThemedColors()
  return (
    <AppStatsSection testID="app-stats-crash-free" title={i18nT('appStatsStatic:sections.crashFree')}>
      {rows.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>{i18nT('appStatsStatic:crashFree.empty')}</Text>
      ) : (
        rows.map((row) => {
          const title = `${row.app_version} · ${appStatsPlatformLabel(row.platform)}`
          const detail = `${appStatsPercent(row.crash_free_percent)} · ${i18nT('appStatsStatic:crashFree.sessions')}: ${appStatsCount(row.sessions)}`
          return (
            <View key={`${row.app_version}:${row.platform}`} style={styles.row}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.detail, { color: colors.textMuted }]}>{detail}</Text>
              <AppStatsMeter ratio={row.crash_free_percent / 100} color={colors.primary} label={`${title}. ${detail}`} />
            </View>
          )
        })
      )}
    </AppStatsSection>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: DESIGN_TOKENS.spacing.xxs,
    width: '100%',
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },
  detail: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
})
