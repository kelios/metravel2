import { StyleSheet, Text, View } from 'react-native'

import type { AppTelemetryStatsDay } from '@/api/appTelemetryStats'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import AppStatsMeter from './AppStatsMeter'
import AppStatsSection from './AppStatsSection'
import { appStatsCount, appStatsDayLabel, meterRatio } from './appStatsLabels'

type Props = {
  days: readonly AppTelemetryStatsDay[]
}

export default function AppStatsDaysPanel({ days }: Props) {
  const colors = useThemedColors()
  const maxNew = Math.max(0, ...days.map((day) => day.new_installs))
  const maxActive = Math.max(0, ...days.map((day) => day.active_installs))
  return (
    <AppStatsSection testID="app-stats-days" title={i18nT('appStatsStatic:sections.days')}>
      {days.map((day) => (
        <View key={day.date} style={[styles.row, { borderColor: colors.border }]}>
          <Text style={[styles.date, { color: colors.text }]}>{appStatsDayLabel(day.date)}</Text>
          <Metric
            label={i18nT('appStatsStatic:days.newInstalls')}
            value={day.new_installs}
            ratio={meterRatio(day.new_installs, maxNew)}
            color={colors.primary}
          />
          <Metric
            label={i18nT('appStatsStatic:days.active')}
            value={day.active_installs}
            ratio={meterRatio(day.active_installs, maxActive)}
            color={colors.accent}
          />
          <Text style={[styles.sessions, { color: colors.textMuted }]}>
            {i18nT('appStatsStatic:days.sessions')}: {appStatsCount(day.sessions)}
          </Text>
        </View>
      ))}
    </AppStatsSection>
  )
}

function Metric({ label, value, ratio, color }: { label: string; value: number; ratio: number; color: string }) {
  const colors = useThemedColors()
  const text = `${label}: ${appStatsCount(value)}`
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.text }]}>{text}</Text>
      <AppStatsMeter ratio={ratio} color={color} label={text} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: DESIGN_TOKENS.spacing.xs,
    paddingBottom: DESIGN_TOKENS.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  date: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700',
  },
  metric: {
    gap: DESIGN_TOKENS.spacing.xxs,
    width: '100%',
  },
  metricLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
  sessions: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
})
