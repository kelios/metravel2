import { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native'

import type { AppTelemetryTopCrash } from '@/api/appTelemetryStats'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import AppStatsSection from './AppStatsSection'
import { appStatsCount, appStatsDateTimeLabel } from './appStatsLabels'

type Props = {
  crashes: readonly AppTelemetryTopCrash[]
}

export default function AppStatsCrashesPanel({ crashes }: Props) {
  const colors = useThemedColors()
  const [openSignature, setOpenSignature] = useState<string | null>(null)
  return (
    <AppStatsSection testID="app-stats-crashes" title={i18nT('appStatsStatic:sections.crashes')}>
      {crashes.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>{i18nT('appStatsStatic:crashes.empty')}</Text>
      ) : (
        crashes.map((crash, index) => {
          const open = openSignature === crash.signature
          return (
            <View key={crash.signature} style={[styles.row, { borderColor: colors.border }]}>
              <Pressable
                testID={`app-stats-crash-${index}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={open ? i18nT('appStatsStatic:crashes.hideStack') : i18nT('appStatsStatic:crashes.showStack')}
                onPress={() => setOpenSignature(open ? null : crash.signature)}
                style={styles.summary}
              >
                <Text style={[styles.message, webWrap, { color: colors.text }]}>{crash.message}</Text>
                <Text style={[styles.meta, webWrap, { color: colors.textMuted }]}>
                  {i18nT('appStatsStatic:crashes.count')}: {appStatsCount(crash.count)}
                  {' · '}
                  {i18nT('appStatsStatic:crashes.installs')}: {appStatsCount(crash.installs_affected)}
                </Text>
                <Text style={[styles.meta, webWrap, { color: colors.textMuted }]}>
                  {i18nT('appStatsStatic:crashes.versions')}: {crash.app_versions.join(', ') || '—'}
                </Text>
                <Text style={[styles.meta, webWrap, { color: colors.textMuted }]}>
                  {i18nT('appStatsStatic:crashes.firstSeen')}: {appStatsDateTimeLabel(crash.first_seen)}
                  {' · '}
                  {i18nT('appStatsStatic:crashes.lastSeen')}: {appStatsDateTimeLabel(crash.last_seen)}
                </Text>
                <Text style={[styles.toggle, { color: colors.primaryText }]}>
                  {open ? i18nT('appStatsStatic:crashes.hideStack') : i18nT('appStatsStatic:crashes.showStack')}
                </Text>
              </Pressable>
              {open ? (
                <ScrollView
                  testID={`app-stats-crash-stack-${index}`}
                  style={[styles.stackScroll, { backgroundColor: colors.backgroundSecondary }]}
                  contentContainerStyle={styles.stackContent}
                  nestedScrollEnabled
                >
                  <Text selectable style={[styles.stack, { color: colors.text }]}>
                    {crash.stack}
                  </Text>
                </ScrollView>
              ) : null}
            </View>
          )
        })
      )}
    </AppStatsSection>
  )
}

const webWrap = Platform.OS === 'web' ? ({ wordBreak: 'break-word' } as TextStyle) : null

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.xs,
    width: '100%',
  },
  summary: {
    gap: DESIGN_TOKENS.spacing.xxs,
    width: '100%',
  },
  message: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },
  meta: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
  toggle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    marginTop: DESIGN_TOKENS.spacing.xxs,
  },
  stackScroll: {
    maxHeight: 240,
    borderRadius: DESIGN_TOKENS.radii.sm,
    width: '100%',
  },
  stackContent: {
    padding: DESIGN_TOKENS.spacing.sm,
  },
  stack: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    ...(Platform.OS === 'web' ? { wordBreak: 'break-word' } : {}),
  } as TextStyle,
})
