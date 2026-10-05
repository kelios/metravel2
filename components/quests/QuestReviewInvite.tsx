// Второй вход в отзыв о квесте (#1795).
//
// До этого форма отзыва жила ТОЛЬКО на экране финала и только в момент
// прохождения: игрок в этот момент обычно уже закрывает телефон, поэтому на 177
// квестов и 22 прохождения не пришло ни одного отзыва. Вход живёт рядом с
// бейджем «Пройден» на странице квеста и открывает ту же самую форму
// (`QuestReviewSection`) в модальном окне — новый транспорт не заводим.
//
// #2148: у входа два представления — кнопка рядом с бейджем (desktop) и пункт
// «⋯» строки экрана (телефон). Поэтому состояние вынесено в хук: страница держит
// ОДИН экземпляр и отдаёт его кнопке, пункту, статусу фото и окну; окно
// рендерится один раз.

import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import QuestModalSheet from '@/components/quests/QuestModalSheet'
import QuestReviewSection from '@/components/quests/QuestReviewSection'
import { useQuestReview } from '@/hooks/useQuestReview'
import { useQuestReviewPhotoUpload } from '@/hooks/useQuestReviewPhotoUpload'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { trackQuestReviewPromptClick } from '@/utils/questReviewAnalytics'
import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'

type InviteArgs = {
  /** Строковый quest_id (слаг) — он же уходит в аналитику. */
  questId: string
  /** Числовой PK квеста: без него отзыв адресовать некуда. */
  questNumericId?: number
  cityId?: string
  /** Квест пройден текущим пользователем: только ему вход и нужен. */
  enabled: boolean
}

export type QuestReviewInvite = {
  questId: string
  questNumericId?: number
  cityId?: string
  /**
   * Вход показывается: квест пройден, отзыва нет и префилл не грузится. Пока
   * префилл грузится (в том числе на фоновом refetch), входом не мигаем.
   */
  canInvite: boolean
  open: () => void
  /** Незавершённая загрузка фото отзыва (#2150); `null` — показывать нечего. */
  photoStatus: { label: string; isActive: boolean } | null
  reopen: () => void
  /** Окно смонтировано (его открывали) и видно ли оно сейчас. */
  opened: boolean
  visible: boolean
  close: () => void
}

export function useQuestReviewInvite({ questId, questNumericId, cityId, enabled }: InviteArgs): QuestReviewInvite {
  const [visible, setVisible] = useState(false)
  // Форма живёт отдельно от входа: после отправки отзыв появляется в кэше, и
  // общий гейт `review` снял бы открытое окно вместе с экраном «Спасибо за
  // отзыв» и с загрузкой прикреплённых фото (она стартует уже ПОСЛЕ сохранения).
  const [opened, setOpened] = useState(false)
  const active = enabled && !!questNumericId

  // Тот же ключ react-query, что и у формы: повторного запроса не будет.
  const { review, isLoading } = useQuestReview({
    questId: questNumericId,
    questSlug: questId,
    cityId,
    enabled: active,
  })

  const open = useCallback(() => {
    trackQuestReviewPromptClick({ questId, cityId, source: 'quest_page' })
    setOpened(true)
    setVisible(true)
  }, [cityId, questId])

  const close = useCallback(() => setVisible(false), [])

  // Окно закрыли посреди загрузки фото (#2150): отзыв уже есть, входа больше
  // нет, а очередь продолжается — статус возвращает в окно.
  const photoUpload = useQuestReviewPhotoUpload(review?.id)
  const reopen = useCallback(() => {
    setOpened(true)
    setVisible(true)
  }, [])

  const showPhotoStatus =
    active && !!review && !visible && photoUpload.total > 0 && photoUpload.uploaded < photoUpload.total
  const canInvite = active && !isLoading && !review

  // Один объект на состояние: страница кладёт его в зависимости слотов.
  return useMemo(
    () => ({
      questId,
      questNumericId,
      cityId,
      canInvite,
      open,
      photoStatus: showPhotoStatus
        ? {
            label: i18nT('quests:components.quests.QuestReviewInvite.photoStatus', {
              value1: formatInteger(photoUpload.uploaded),
              value2: formatInteger(photoUpload.total),
            }),
            isActive: photoUpload.isActive,
          }
        : null,
      reopen,
      opened: active && opened,
      visible,
      close,
    }),
    [
      active,
      canInvite,
      cityId,
      close,
      open,
      opened,
      photoUpload.isActive,
      photoUpload.total,
      photoUpload.uploaded,
      questId,
      questNumericId,
      reopen,
      showPhotoStatus,
      visible,
    ],
  )
}

type PartProps = { invite: QuestReviewInvite; testID?: string }

/** Кнопка-вход рядом с бейджем «Пройден» (desktop и экран согласия). */
export const QuestReviewInviteButton = memo(function QuestReviewInviteButton({
  invite,
  testID = 'quest-review-invite',
}: PartProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  if (!invite.canInvite) return null
  const ctaLabel = i18nT('quests:components.quests.QuestReviewInvite.cta')
  return (
    <Pressable
      onPress={invite.open}
      style={styles.cta}
      accessibilityRole="button"
      accessibilityLabel={ctaLabel}
      testID={testID}
    >
      <Feather name="star" size={13} color={colors.primaryDark} />
      <Text style={styles.ctaText}>{ctaLabel}</Text>
    </Pressable>
  )
})

/** Статус незавершённой загрузки фото отзыва — возвращает в окно. */
export const QuestReviewPhotoStatus = memo(function QuestReviewPhotoStatus({
  invite,
  testID = 'quest-review-invite',
}: PartProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const status = invite.photoStatus
  if (!status) return null
  return (
    <Pressable
      onPress={invite.reopen}
      style={styles.cta}
      accessibilityRole="button"
      accessibilityLabel={status.label}
      testID={`${testID}-photo-status`}
    >
      <Feather
        name={status.isActive ? 'upload-cloud' : 'alert-circle'}
        size={13}
        color={status.isActive ? colors.primaryDark : colors.danger}
      />
      <Text style={styles.ctaText}>{status.label}</Text>
    </Pressable>
  )
})

/** Окно с той же формой отзыва, что на финале. Рендерится на странице один раз. */
export const QuestReviewInviteModal = memo(function QuestReviewInviteModal({
  invite,
  testID = 'quest-review-invite',
}: PartProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  // Гейт входа на открытое окно НЕ распространяется — иначе форма закрывалась
  // бы прямо во время набора.
  if (!invite.opened || !invite.questNumericId) return null
  return (
    <QuestModalSheet
      visible={invite.visible}
      onClose={invite.close}
      animationType="slide"
      statusBarTranslucent
      title={i18nT('quests:components.quests.QuestReviewInvite.modalTitle')}
      closeLabel={i18nT('quests:components.quests.QuestReviewInvite.close')}
      overlayLabel={i18nT('quests:components.quests.QuestReviewInvite.overlayClose')}
      testID={`${testID}-modal`}
      closeTestID={`${testID}-close`}
    >
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <QuestReviewSection
          questId={invite.questId}
          questNumericId={invite.questNumericId}
          cityId={invite.cityId}
          testID={`${testID}-form`}
        />
      </ScrollView>
    </QuestModalSheet>
  )
})

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryDark,
      backgroundColor: 'transparent',
    },
    ctaText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '600',
      color: colors.primaryDark,
    },
    body: {
      width: '100%',
    },
    bodyContent: {
      paddingBottom: DESIGN_TOKENS.spacing.sm,
    },
  })
