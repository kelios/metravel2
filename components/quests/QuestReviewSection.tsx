import { memo, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'

import Button from '@/components/ui/Button'
import StarRating from '@/components/ui/StarRating'
import { type QuestRating } from '@/api/questRating'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors } from '@/hooks/useTheme'
import { useQuestReview } from '@/hooks/useQuestReview'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'


type Props = {
  questId: string
  questNumericId: number | undefined
  // Живая оценка пользователя (из useQuestRatingMutation): единственный источник
  // звёзд в этом блоке — они же кормят общий рейтинг квеста через onRate.
  userRating?: number | null
  onRate?: (rating: QuestRating) => void
  isRatingSubmitting?: boolean
  testID?: string
}

const clampRating = (value: number): QuestRating =>
  Math.max(1, Math.min(5, Math.round(value))) as QuestRating

function QuestReviewSection({
  questNumericId,
  userRating,
  onRate,
  isRatingSubmitting = false,
  testID = 'quest-review-section',
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isAuthenticated, requireAuth } = useRequireAuth({ intent: 'rate' })

  const { review, isSubmitting, isSubmitted, submit } = useQuestReview({
    questId: questNumericId,
    enabled: !!questNumericId,
  })

  const [rating, setRating] = useState(0)
  const [liked, setLiked] = useState('')
  const [disliked, setDisliked] = useState('')
  const [submittedLocally, setSubmittedLocally] = useState(false)

  const liveRating =
    typeof userRating === 'number' && Number.isFinite(userRating) && userRating > 0
      ? clampRating(userRating)
      : 0
  const effectiveRating = rating || liveRating || review?.rating || 0
  const alreadyReviewed = !!review && !isSubmitted
  // Оценка (/rate/) сохраняется живьём при тапе по звезде, поэтому благодарим,
  // как только оценка выставлена и пользователь нажал «Отправить» — даже если
  // текстовый эндпоинт отзывов ещё не на бэке (BE #487).
  const showSuccess = alreadyReviewed || isSubmitted || (submittedLocally && effectiveRating > 0)

  // Оценка обязательна (BE: rating 1..5, NOT NULL). Тексты — опциональны.
  const canSubmit = effectiveRating > 0

  // Тап по звезде сразу сохраняет оценку в общий рейтинг квеста (живой /rate/).
  const handleRate = (value: number) => {
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    const next = clampRating(value)
    setRating(next)
    onRate?.(next)
  }

  const handleSubmit = () => {
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    if (!questNumericId || !canSubmit || isSubmitting) return
    // Убеждаемся, что оценка сохранена (на случай префилла без ручного тапа).
    onRate?.(clampRating(effectiveRating))
    submit({ rating: effectiveRating, liked: liked.trim(), disliked: disliked.trim() })
    setSubmittedLocally(true)
  }

  if (showSuccess) {
    return (
      <View style={styles.container} testID={testID} nativeID="quest-review-section">
        <Text style={styles.title}>{i18nT('quests:components.quests.QuestReviewSection.vash_otzyv_o_kveste_f0ff8a03')}</Text>
        <View style={styles.successBox}>
          <Text style={styles.successText}>{i18nT('quests:components.quests.QuestReviewSection.spasibo_za_otzyv_af1c9931')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container} testID={testID} nativeID="quest-review-section">
      <Text style={styles.title}>{i18nT('quests:components.quests.QuestReviewSection.otzyv_o_kveste_c6c8ceb5')}</Text>
      <Text style={styles.subtitle}>
        {i18nT('quests:components.quests.QuestReviewSection.otsenka_uchityvaetsya_v_obschem_reytinge_kve_28482d13')}</Text>

      <View style={styles.starsRow}>
        <Text style={styles.fieldLabel}>{i18nT('quests:components.quests.QuestReviewSection.vasha_otsenka_8c70d246')}</Text>
        <StarRating
          rating={effectiveRating}
          userRating={effectiveRating}
          interactive={isAuthenticated}
          onRate={handleRate}
          disabled={isSubmitting || isRatingSubmitting}
          size="large"
          showValue={false}
          showCount={false}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{i18nT('quests:components.quests.QuestReviewSection.chto_ponravilos_b836e082')}</Text>
        <TextInput
          style={styles.input}
          value={liked}
          onChangeText={setLiked}
          multiline
          numberOfLines={3}
          editable={!isSubmitting}
          placeholder={i18nT('quests:components.quests.QuestReviewSection.rasskazhite_chto_bylo_interesno_472acf46')}
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{i18nT('quests:components.quests.QuestReviewSection.chto_ne_ponravilos_chto_uluchshit_d5e68794')}</Text>
        <TextInput
          style={styles.input}
          value={disliked}
          onChangeText={setDisliked}
          multiline
          numberOfLines={3}
          editable={!isSubmitting}
          placeholder={i18nT('quests:components.quests.QuestReviewSection.chto_mozhno_sdelat_luchshe_2a40e215')}
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>

      <Button
        variant="primary"
        label={i18nT('quests:components.quests.QuestReviewSection.otpravit_otzyv_fe6d43a0')}
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={isSubmitting}
        accessibilityLabel={i18nT('quests:components.quests.QuestReviewSection.otpravit_otzyv_fe6d43a0')}
        testID={`${testID}-submit`}
        style={styles.submitButton}
      />
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
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
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
    submitButton: {
      alignSelf: 'flex-start',
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
