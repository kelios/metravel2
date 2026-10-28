import { StyleSheet, Text, View } from 'react-native'

import type { AppTelemetryRetentionCell } from '@/api/appTelemetryStats'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import AppStatsSection from './AppStatsSection'
import { appStatsCount, appStatsPercent } from './appStatsLabels'

const CELLS = [
  ['d1', 'appStatsStatic:retention.d1'],
  ['d7', 'appStatsStatic:retention.d7'],
  ['d30', 'appStatsStatic:retention.d30'],
] as const

type Props = {
  retention: {
    d1: AppTelemetryRetentionCell
    d7: AppTelemetryRetentionCell
    d30: AppTelemetryRetentionCell
  }
}

export default function AppStatsRetentionPanel({ retention }: Props) {
  const colors = useThemedColors()
  return (
    <AppStatsSection testID="app-stats-retention" title={i18nT('appStatsStatic:sections.retention')}>
      <View style={styles.row}>
        {CELLS.map(([key, labelKey]) => {
          const cell = retention[key]
          return (
            <View key={key} style={[styles.cell, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{i18nT(labelKey)}</Text>
              <Text style={[styles.rate, { color: colors.text }]}>{appStatsPercent(cell.rate)}</Text>
              <Text style={[styles.of, { color: colors.text }]}>
                {i18nT('appStatsStatic:retention.of', {
                  retained: appStatsCount(cell.retained),
                  cohort: appStatsCount(cell.cohort_size),
                })}
              </Text>
            </View>
          )
        })}
      </View>
    </AppStatsSection>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  cell: {
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: DESIGN_TOKENS.radii.sm,
    padding: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.xxs,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
  rate: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700',
  },
  of: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
})
