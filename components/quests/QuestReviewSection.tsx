import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'

import Button from '@/components/ui/Button'
import StarRating from '@/components/ui/StarRating'
import QuestReviewPhotoPicker, {
  type QuestReviewPhotoDraft,
} from '@/components/quests/QuestReviewPhotoPicker'
import { type QuestRating } from '@/api/questRating'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors } from '@/hooks/useTheme'
import { useQuestReview } from '@/hooks/useQuestReview'
import { useQuestReviewPhotoUpload } from '@/hooks/useQuestReviewPhotoUpload'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'


type Props = {
  questId: string
  questNumericId: number | undefined
  /** Город квеста — уходит в событие аналитики вместе с отзывом. */
  cityId?: string
  testID?: string
}

const clampRating = (value: number): QuestRating =>
  Math.max(1, Math.min(5, Math.round(value))) as QuestRating

function QuestReviewSection({
  questId,
  questNumericId,
  cityId,
  testID = 'quest-review-section',
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isAuthenticated, authReady, requireAuth } = useRequireAuth({ intent: 'rate' })

  const {
    review,
    submittedReview,
    isLoading,
    hasLoadError,
    isSubmitting,
    isSubmitted,
    hasError,
    submit,
  } = useQuestReview({
    questId: questNumericId,
    questSlug: questId,
    cityId,
    enabled: !!questNumericId,
  })

  const [rating, setRating] = useState(0)
  const [liked, setLiked] = useState('')
  const [disliked, setDisliked] = useState('')
  const [photos, setPhotos] = useState<QuestReviewPhotoDraft[]>([])

  const {
    statuses: photoStatuses,
    failedNames: photoFailedNames,
    isUploading: isUploadingPhotos,
    hasUploaded: hasUploadedPhotos,
    uploadAll: uploadPhotos,
  } = useQuestReviewPhotoUpload({ questId, cityId })

  // Загрузка стартует ровно один раз и только после подтверждённого сервером
  // сохранения: до этого нет `id`, по которому адресуется фото. Ref нужен
  // потому, что эффект переживает ре-рендеры экрана финала.
  const photoUploadStartedRef = useRef(false)
  useEffect(() => {
    if (!submittedReview || photos.length === 0 || photoUploadStartedRef.current) return
    photoUploadStartedRef.current = true
    void uploadPhotos(submittedReview.id, photos)
  }, [photos, submittedReview, uploadPhotos])

  const effectiveRating = rating || review?.rating || 0
  const alreadyReviewed = !!review && !isSubmitted
  // Благодарим только за подтверждённое сервером сохранение. Здесь была
  // оптимистичная ветка «оценка выставлена и нажата отправка»: её писали, пока
  // эндпоинт отзывов ждали от бэка (#487). Эндпоинт вышел, и с ним ветка стала
  // означать «Спасибо за отзыв» поверх упавшего запроса — отзыва нет, а игрок
  // уверен, что оставил его (#1486).
  const showSuccess = alreadyReviewed || isSubmitted

  // Оценка обязательна (BE: rating 1..5, NOT NULL). Тексты — опциональны.
  const prefillUnavailable = isLoading || hasLoadError
  const canSubmit = effectiveRating > 0 && !prefillUnavailable

  // Звезда — часть черновика формы. Единственная запись оценки происходит
  // атомарно вместе с текстом по кнопке «Отправить отзыв» (#1578).
  const handleRate = (value: number) => {
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    const next = clampRating(value)
    setRating(next)
  }

  const handleSubmit = () => {
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    if (!questNumericId || !canSubmit || prefillUnavailable || isSubmitting) return
    submit({ rating: effectiveRating, liked: liked.trim(), disliked: disliked.trim() })
  }

  if (showSuccess) {
    return (
      <View style={styles.container} testID={testID} nativeID="quest-review-section">
        <Text style={styles.title}>{i18nT('quests:components.quests.QuestReviewSection.vash_otzyv_o_kveste_f0ff8a03')}</Text>
        <View style={styles.successBox}>
          <Text style={styles.successText}>{i18nT('quests:components.quests.QuestReviewSection.spasibo_za_otzyv_af1c9931')}</Text>
        </View>

        {/* Фото продолжают грузиться уже после того, как отзыв сохранён:
            прогресс обязан жить здесь, иначе он исчезнет вместе с формой и
            игрок решит, что снимки потерялись. */}
        {photos.length > 0 && (
          <QuestReviewPhotoPicker
            value={photos}
            onChange={setPhotos}
            statuses={photoStatuses}
            disabled
            testID={`${testID}-photos`}
          />
        )}

        {isUploadingPhotos && (
          <Text style={styles.noteText} testID={`${testID}-photo-uploading`}>
            {i18nT('quests:components.quests.QuestReviewSection.photoUploading')}
          </Text>
        )}

        {/* Модерация задерживает показ: без этой строки задержка читается как
            потеря файла (сервер к тому же снимает `moderation` при загрузке). */}
        {!isUploadingPhotos && hasUploadedPhotos && (
          <Text style={styles.noteText} testID={`${testID}-photo-moderation`}>
            {i18nT('quests:components.quests.QuestReviewSection.photoModerationNote')}
          </Text>
        )}

        {/* Отзыв остаётся сохранённым: не доехали конкретные файлы, и они
            названы поимённо. */}
        {!isUploadingPhotos && photoFailedNames.length > 0 && (
          <Text
            style={styles.errorText}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID={`${testID}-photo-error`}
          >
            {i18nT('quests:components.quests.QuestReviewSection.photoUploadFailed', {
              value1: photoFailedNames.join(', '),
            })}
          </Text>
        )}
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
          // Гость тоже должен иметь доступный вход в auth-flow: тап по звезде
          // вызывает handleRate -> requireAuth, но не меняет локальный рейтинг.
          interactive
          onRate={handleRate}
          disabled={!authReady || prefillUnavailable || isSubmitting}
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
          editable={!prefillUnavailable && !isSubmitting}
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
          editable={!prefillUnavailable && !isSubmitting}
          placeholder={i18nT('quests:components.quests.QuestReviewSection.chto_mozhno_sdelat_luchshe_2a40e215')}
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>

      <QuestReviewPhotoPicker
        value={photos}
        onChange={setPhotos}
        disabled={prefillUnavailable || isSubmitting}
        testID={`${testID}-photos`}
      />

      {hasError && (
        // Сообщение появляется после асинхронной отправки, поэтому объявляется
        // так же, как остальные ошибки форм проекта
        // (`components/forms/FormFieldWithValidation.tsx`): без live-region
        // экранный диктор не сообщит о провале, а кнопка просто выйдет из
        // loading — игрок решит, что отзыв ушёл.
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID={`${testID}-error`}
        >
          {i18nT('errorsStatic:api.misc.sendFailed')}
        </Text>
      )}

      {hasLoadError && (
        <Text style={styles.errorText} testID={`${testID}-load-error`}>
          {i18nT('quests:components.quests.QuestReviewsModal.ne_udalos_zagruzit_otzyvy_651269a8')}
        </Text>
      )}

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
    errorText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.error,
    },
    noteText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
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
