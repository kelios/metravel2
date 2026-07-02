import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native'

import StarRating from '@/components/ui/StarRating'
import { type QuestRating } from '@/api/questRating'
import { useAuth } from '@/context/AuthContext'
import { useQuestRatingMutation } from '@/hooks/useQuestRating'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type Props = {
  questNumericId: number | undefined
}

function QuestFinaleRating({ questNumericId }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isAuthenticated } = useAuth()
  const { userRating, isSubmitting, canRate, rate } = useQuestRatingMutation(questNumericId)
  const [editing, setEditing] = useState(false)

  if (!isAuthenticated || !questNumericId) return null

  const handleRate = (value: number) => {
    if (!canRate || isSubmitting) return
    rate(value as QuestRating)
    setEditing(false)
  }

  const showInteractive = userRating == null || editing

  return (
    <View style={styles.container} testID="quest-finale-rating">
      <Text style={styles.label}>{showInteractive ? 'Оцените квест' : 'Ваша оценка'}</Text>

      {showInteractive ? (
        <StarRating
          rating={userRating ?? 0}
          userRating={userRating}
          interactive
          disabled={isSubmitting}
          onRate={handleRate}
          size="large"
          showValue={false}
          showCount={false}
          testID="quest-finale-rating-stars"
        />
      ) : (
        <View style={styles.savedRow}>
          <StarRating
            rating={userRating}
            size="medium"
            showValue={false}
            showCount={false}
            testID="quest-finale-rating-saved"
          />
          <Pressable
            onPress={() => setEditing(true)}
            style={styles.changeButton}
            accessibilityRole="button"
            accessibilityLabel="Изменить оценку квеста"
            testID="quest-finale-rating-change"
          >
            <Text style={styles.changeButtonText}>Изменить</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      alignSelf: 'stretch',
      maxWidth: 460,
      marginTop: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    label: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.textMuted,
    },
    savedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
    },
    changeButton: {
      paddingVertical: 4,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    changeButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.primaryText,
    },
  })

export default memo(QuestFinaleRating)
