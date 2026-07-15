import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'


type QuestCompletionBadgeProps = {
  isCompleted: boolean
  completionsCount: number
  variant?: 'card' | 'detail'
}

const formatCompletions = (count: number): string =>
  i18nT('quests:components.quests.QuestCompletionBadge.completionCount', { count })

function CardBadge({ isCompleted, completionsCount }: QuestCompletionBadgeProps) {
  const colors = useThemedColors()

  return (
    <View style={styles.row}>
      {isCompleted ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.successSoft, borderColor: colors.success },
          ]}
        >
          <Feather name="check-circle" size={13} color={colors.success} />
          <Text style={[styles.badgeText, { color: colors.successDark }]}>{i18nT('quests:components.quests.QuestCompletionBadge.proyden_e3667f0a')}</Text>
        </View>
      ) : null}

      {completionsCount > 0 ? (
        <Text style={[styles.countText, { color: colors.textMuted }]}>
          {formatCompletions(completionsCount)}
        </Text>
      ) : null}
    </View>
  )
}

function DetailBadge({ isCompleted, completionsCount }: QuestCompletionBadgeProps) {
  const colors = useThemedColors()

  return (
    <View style={styles.detailRow}>
      {isCompleted ? (
        <View
          accessible
          accessibilityLabel={i18nT('quests:components.quests.QuestCompletionBadge.vy_proshli_etot_kvest_7e00d905')}
          style={[
            styles.detailChip,
            { backgroundColor: colors.successSoft, borderColor: colors.success },
          ]}
        >
          <Feather name="check-circle" size={15} color={colors.success} />
        </View>
      ) : null}

      {completionsCount > 0 ? (
        <View
          accessible
          accessibilityLabel={formatCompletions(completionsCount)}
          style={[styles.detailChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
        >
          <Feather name="flag" size={13} color={colors.textMuted} />
          <Text style={[styles.detailChipText, { color: colors.textMuted }]}>{completionsCount}</Text>
        </View>
      ) : null}
    </View>
  )
}

export default function QuestCompletionBadge({
  isCompleted,
  completionsCount,
  variant = 'card',
}: QuestCompletionBadgeProps) {
  if (!isCompleted && completionsCount <= 0) {
    return null
  }

  if (variant === 'detail') {
    return <DetailBadge isCompleted={isCompleted} completionsCount={completionsCount} />
  }

  return <CardBadge isCompleted={isCompleted} completionsCount={completionsCount} />
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 3,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  countText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
})
