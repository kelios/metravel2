import { StyleSheet, Text, View } from 'react-native'

import type { AppTelemetryFunnelStep } from '@/api/appTelemetryStats'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import AppStatsMeter from './AppStatsMeter'
import AppStatsSection from './AppStatsSection'
import { appStatsCount, meterRatio } from './appStatsLabels'

type Props = {
  steps: readonly AppTelemetryFunnelStep[]
}

export default function AppStatsFunnelPanel({ steps }: Props) {
  const colors = useThemedColors()
  const visible = steps.filter((step) => step.count > 0)
  const max = Math.max(0, ...visible.map((step) => step.count))
  return (
    <AppStatsSection testID="app-stats-funnel" title={i18nT('appStatsStatic:sections.funnel')}>
      {visible.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>{i18nT('appStatsStatic:funnel.empty')}</Text>
      ) : (
        visible.map((step) => {
          const label = `${step.name}: ${appStatsCount(step.count)}`
          return (
            <View key={step.name} style={styles.row}>
              <Text style={[styles.name, { color: colors.text }]}>{label}</Text>
              <AppStatsMeter ratio={meterRatio(step.count, max)} color={colors.accent} label={label} />
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
  name: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
})
