import { StyleSheet, Text, View } from 'react-native'

import {
  APP_STATS_PERIODS,
  type AppStatsPeriod,
  type AppTelemetryStatsPlatform,
} from '@/api/appTelemetryStats'
import Chip from '@/components/ui/Chip'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

const PERIOD_LABEL = {
  7: 'appStatsStatic:filters.period7',
  30: 'appStatsStatic:filters.period30',
  90: 'appStatsStatic:filters.period90',
} as const

type Props = {
  period: AppStatsPeriod
  platform: AppTelemetryStatsPlatform
  appVersion: string
  versions: readonly string[]
  onPeriod: (period: AppStatsPeriod) => void
  onPlatform: (platform: AppTelemetryStatsPlatform) => void
  onVersion: (appVersion: string) => void
}

export default function AppStatsFilters({
  period,
  platform,
  appVersion,
  versions,
  onPeriod,
  onPlatform,
  onVersion,
}: Props) {
  const colors = useThemedColors()
  const labelStyle = [styles.label, { color: colors.textMuted }]
  return (
    <View testID="app-stats-filters" style={styles.filters}>
      <View accessibilityRole="radiogroup" accessibilityLabel={i18nT('appStatsStatic:filters.period')} style={styles.group}>
        <Text style={labelStyle}>{i18nT('appStatsStatic:filters.period')}</Text>
        <View style={styles.row}>
          {APP_STATS_PERIODS.map((item) => (
            <Chip
              key={item}
              testID={`app-stats-period-${item}`}
              label={i18nT(PERIOD_LABEL[item])}
              selected={period === item}
              onPress={() => onPeriod(item)}
            />
          ))}
        </View>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={i18nT('appStatsStatic:filters.platform')} style={styles.group}>
        <Text style={labelStyle}>{i18nT('appStatsStatic:filters.platform')}</Text>
        <View style={styles.row}>
          <Chip
            testID="app-stats-platform-all"
            label={i18nT('appStatsStatic:filters.platformAll')}
            selected={platform === ''}
            onPress={() => onPlatform('')}
          />
          <Chip
            testID="app-stats-platform-android"
            label={i18nT('appStatsStatic:filters.platformAndroid')}
            selected={platform === 'android'}
            onPress={() => onPlatform('android')}
          />
          <Chip
            testID="app-stats-platform-ios"
            label={i18nT('appStatsStatic:filters.platformIos')}
            selected={platform === 'ios'}
            onPress={() => onPlatform('ios')}
          />
        </View>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={i18nT('appStatsStatic:filters.version')} style={styles.group}>
        <Text style={labelStyle}>{i18nT('appStatsStatic:filters.version')}</Text>
        <View style={styles.row}>
          <Chip
            testID="app-stats-version-all"
            label={i18nT('appStatsStatic:filters.versionAll')}
            selected={appVersion === ''}
            onPress={() => onVersion('')}
          />
          {versions.map((version) => (
            <Chip
              key={version}
              testID={`app-stats-version-${version}`}
              label={version}
              selected={appVersion === version}
              onPress={() => onVersion(version)}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  filters: {
    gap: DESIGN_TOKENS.spacing.md,
    width: '100%',
  },
  group: {
    gap: DESIGN_TOKENS.spacing.xs,
    width: '100%',
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
})
