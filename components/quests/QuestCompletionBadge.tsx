import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { pluralizeRu } from '@/utils/pluralize'

type QuestCompletionBadgeProps = {
  isCompleted: boolean
  completionsCount: number
  variant?: 'card' | 'detail'
}

const formatCompletions = (count: number): string =>
  `Пройдено ${count} ${pluralizeRu(count, 'раз', 'раза', 'раз')}`

export default function QuestCompletionBadge({
  isCompleted,
  completionsCount,
  variant = 'card',
}: QuestCompletionBadgeProps) {
  const colors = useThemedColors()

  if (!isCompleted && completionsCount <= 0) {
    return null
  }

  const isDetail = variant === 'detail'

  return (
    <View style={[styles.row, isDetail && styles.rowDetail]}>
      {isCompleted ? (
        <View
          style={[
            styles.badge,
            isDetail && styles.badgeDetail,
            { backgroundColor: colors.successSoft, borderColor: colors.success },
          ]}
        >
          <Feather name="check-circle" size={isDetail ? 16 : 13} color={colors.success} />
          <Text style={[styles.badgeText, isDetail && styles.badgeTextDetail, { color: colors.successDark }]}>
            {isDetail ? 'Вы прошли этот квест' : 'Пройден'}
          </Text>
        </View>
      ) : null}

      {completionsCount > 0 ? (
        <Text style={[styles.countText, isDetail && styles.countTextDetail, { color: colors.textMuted }]}>
          {formatCompletions(completionsCount)}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  rowDetail: {
    gap: DESIGN_TOKENS.spacing.sm,
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
  badgeDetail: {
    paddingVertical: 5,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextDetail: {
    fontSize: 14,
  },
  countText: {
    fontSize: 12,
    fontWeight: '500',
  },
  countTextDetail: {
    fontSize: 14,
  },
})
