import { memo, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_MAIN_DOORS } from '@/constants/advent'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventCampaignView } from '@/hooks/useAdventCampaign'
import type { AdventSyncState } from '@/hooks/useAdventApi'
import AdventCountdown from './AdventCountdown'

type Props = Pick<AdventCampaignView, 'openedCount' | 'doneCount' | 'streak' | 'nextDoor' | 'now' | 'hydrated'> & {
  /** Состояние серверного прогресса (#2867); у гостя строка не показывается. */
  syncState?: AdventSyncState
}

// Ключи литералами: статический аудит i18n видит только прямые вызовы перевода со строкой.
const SYNC_VISUALS: Record<Exclude<AdventSyncState, 'guest'>, { icon: keyof typeof Feather.glyphMap; label: () => string }> = {
  synced: { icon: 'cloud', label: () => i18nT('adventStatic:sync.synced') },
  syncing: { icon: 'refresh-cw', label: () => i18nT('adventStatic:sync.syncing') },
  local: { icon: 'smartphone', label: () => i18nT('adventStatic:sync.local') },
}

function AdventHeader({ openedCount, doneCount, streak, nextDoor, now, hydrated, syncState = 'guest' }: Props) {
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
      {hydrated && syncState !== 'guest' ? (
        <View style={styles.stat} testID={`advent-sync-${syncState}`}>
          <Feather name={SYNC_VISUALS[syncState].icon} size={14} color={colors.textMuted} />
          <Text style={styles.syncText}>{SYNC_VISUALS[syncState].label()}</Text>
        </View>
      ) : null}
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
    syncText: { fontSize: 13, lineHeight: 18, color: colors.textMuted, flexShrink: 1 },
  })

export default memo(AdventHeader)
