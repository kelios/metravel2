// components/quests/QuestRatingBlock.tsx
// Оценка квеста на финале: интерактивные звёзды (если не оценивал) либо
// собственная оценка + «Изменить». Источник рейтинга и оптимистика — из
// useQuestRatingMeta + useRateQuestMutation.

import React, { memo, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import StarRating from '@/components/ui/StarRating'
import { useAuth } from '@/context/AuthContext'
import { useRateQuestMutation } from '@/hooks/useQuestRating'
import { useQuestRatingMeta } from '@/hooks/useQuestRatingMeta'
import { useThemedColors } from '@/hooks/useTheme'
import type { RateQuestRating } from '@/api/questRating'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type Props = {
  questId: string
  questNumericId: number | undefined
  testID?: string
}

function QuestRatingBlock({ questId, questNumericId, testID = 'quest-rating-block' }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isAuthenticated } = useAuth()

  const { userRating } = useQuestRatingMeta(questId, questNumericId)
  const rate = useRateQuestMutation(questNumericId)
  const [editing, setEditing] = useState(false)

  if (!isAuthenticated || questNumericId == null) return null

  const showInteractive = userRating == null || editing

  const handleRate = (value: number) => {
    rate.mutate(value as RateQuestRating)
    setEditing(false)
  }

  if (showInteractive) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.title}>Оцените квест</Text>
        <StarRating
          rating={userRating}
          userRating={userRating}
          interactive
          disabled={rate.isPending}
          onRate={handleRate}
          size="large"
          showValue={false}
          showCount={false}
          testID={`${testID}-stars`}
        />
        {rate.isError ? (
          <Text style={styles.errorText}>Не удалось сохранить оценку, попробуйте ещё раз</Text>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>Ваша оценка</Text>
      <View style={styles.ratedRow}>
        <StarRating
          rating={userRating}
          userRating={userRating}
          size="large"
          showValue={false}
          showCount={false}
          testID={`${testID}-stars`}
        />
        <Pressable
          onPress={() => setEditing(true)}
          style={styles.editButton}
          accessibilityRole="button"
          accessibilityLabel="Изменить оценку"
          testID={`${testID}-edit`}
        >
          <Text style={styles.editButtonText}>Изменить</Text>
        </Pressable>
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginTop: 20,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    ratedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    },
    editButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    errorText: {
      fontSize: 13,
      color: colors.warning,
    },
  })

export default memo(QuestRatingBlock)
