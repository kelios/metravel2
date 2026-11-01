import { memo, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_MAIN_DOORS } from '@/constants/advent'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventCampaignView } from '@/hooks/useAdventCampaign'
import AdventCountdown from './AdventCountdown'

type Props = Pick<AdventCampaignView, 'openedCount' | 'doneCount' | 'streak' | 'nextDoor' | 'now' | 'hydrated'>

function AdventHeader({ openedCount, doneCount, streak, nextDoor, now, hydrated }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const ratio = Math.min(1, openedCount / ADVENT_MAIN_DOORS)

  return (
    <View style={styles.card} testID="advent-header">
      <Text style={styles.progress}>
        {i18nT('adventStatic:header.progress', { value1: formatInteger(openedCount), value2: formatInteger(ADVENT_MAIN_DOORS) })}
      </Text>
      <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: ADVENT_MAIN_DOORS, now: openedCount }}>
        <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={styles.statText}>{i18nT('adventStatic:header.done', { value1: formatInteger(doneCount) })}</Text>
        </View>
        <View style={styles.stat}>
          <Feather name="zap" size={16} color={colors.warning} />
          <Text style={styles.statText}>{i18nT('adventStatic:header.streak', { value1: formatInteger(streak) })}</Text>
        </View>
      </View>
      <AdventCountdown nextDoor={nextDoor} now={now} hydrated={hydrated} />
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    progress: { fontSize: 18, fontWeight: '700', color: colors.text },
    bar: { height: 8, borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.backgroundTertiary, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.primary },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.md },
    stat: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xxs, flexShrink: 1 },
    statText: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, flexShrink: 1 },
  })

export default memo(AdventHeader)
