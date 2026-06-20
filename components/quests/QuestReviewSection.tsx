// components/quests/QuestReviewSection.tsx
// Отзыв о пройденном квесте: оценка 1–5 + «что понравилось» / «что улучшить».

import React, { memo, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import StarRating from '@/components/ui/StarRating'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors } from '@/hooks/useTheme'
import { useQuestReview } from '@/hooks/useQuestReview'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type Props = {
  questId: string
  questNumericId: number | undefined
  testID?: string
}

function QuestReviewSection({ questNumericId, testID = 'quest-review-section' }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isAuthenticated, requireAuth } = useRequireAuth({ intent: 'rate' })

  const { review, isSubmitting, isSubmitted, hasError, submit } = useQuestReview({
    questId: questNumericId,
    enabled: !!questNumericId,
  })

  const [rating, setRating] = useState(0)
  const [liked, setLiked] = useState('')
  const [disliked, setDisliked] = useState('')

  const effectiveRating = rating || review?.rating || 0
  const alreadyReviewed = !!review && !isSubmitted
  const showSuccess = isSubmitted || alreadyReviewed

  // Оценка обязательна (BE: rating 1..5, NOT NULL). Тексты — опциональны.
  const canSubmit = effectiveRating > 0

  const handleSubmit = () => {
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    if (!questNumericId || !canSubmit || isSubmitting) return
    submit({ rating: effectiveRating, liked: liked.trim(), disliked: disliked.trim() })
  }

  if (showSuccess) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.title}>Отзыв о квесте</Text>
        <View style={styles.successBox}>
          <Text style={styles.successText}>Спасибо за отзыв!</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>Оставьте отзыв о квесте</Text>

      <View style={styles.starsRow}>
        <Text style={styles.fieldLabel}>Ваша оценка</Text>
        <StarRating
          rating={effectiveRating}
          userRating={effectiveRating}
          interactive={isAuthenticated}
          onRate={setRating}
          disabled={isSubmitting}
          size="large"
          showValue={false}
          showCount={false}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Что понравилось?</Text>
        <TextInput
          style={styles.input}
          value={liked}
          onChangeText={setLiked}
          multiline
          numberOfLines={3}
          editable={!isSubmitting}
          placeholder="Расскажите, что было интересно"
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Что не понравилось / что улучшить?</Text>
        <TextInput
          style={styles.input}
          value={disliked}
          onChangeText={setDisliked}
          multiline
          numberOfLines={3}
          editable={!isSubmitting}
          placeholder="Что можно сделать лучше"
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>

      {hasError ? (
        <Text style={styles.errorText}>Не удалось отправить отзыв, попробуйте позже</Text>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit || isSubmitting}
        style={[styles.submitButton, (!canSubmit || isSubmitting) && styles.submitButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Отправить отзыв"
        testID={`${testID}-submit`}
      >
        <Text style={styles.submitButtonText}>{isSubmitting ? 'Отправляем…' : 'Отправить отзыв'}</Text>
      </Pressable>
    </View>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginTop: 20,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: Platform.select({ default: 16, web: 20 }),
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 14,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    starsRow: {
      gap: 8,
    },
    field: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    input: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    errorText: {
      fontSize: 13,
      color: colors.error ?? colors.danger ?? colors.warning,
    },
    submitButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primary,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    successBox: {
      paddingVertical: 16,
      paddingHorizontal: 14,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
    },
    successText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.success ?? colors.primary,
    },
  })

export default memo(QuestReviewSection)
