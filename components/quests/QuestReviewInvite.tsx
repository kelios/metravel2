// Второй вход в отзыв о квесте (#1795).
//
// До этого форма отзыва жила ТОЛЬКО на экране финала и только в момент
// прохождения: игрок в этот момент обычно уже закрывает телефон, поэтому на 177
// квестов и 22 прохождения не пришло ни одного отзыва. Кнопка живёт рядом с
// бейджем «Пройден» на странице квеста и открывает ту же самую форму
// (`QuestReviewSection`) в модальном окне — новый транспорт не заводим.

import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import QuestModalSheet from '@/components/quests/QuestModalSheet'
import QuestReviewSection from '@/components/quests/QuestReviewSection'
import { useQuestReview } from '@/hooks/useQuestReview'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { trackQuestReviewPromptClick } from '@/utils/questReviewAnalytics'
import { translate as i18nT } from '@/i18n'

type Props = {
  /** Строковый quest_id (слаг) — он же уходит в аналитику. */
  questId: string
  /** Числовой PK квеста: без него отзыв адресовать некуда. */
  questNumericId?: number
  cityId?: string
  testID?: string
}

function QuestReviewInvite({
  questId,
  questNumericId,
  cityId,
  testID = 'quest-review-invite',
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [visible, setVisible] = useState(false)
  // Форма живёт отдельно от кнопки: после отправки отзыв появляется в кэше, и
  // общий гейт `review` снял бы открытое окно вместе с экраном «Спасибо за
  // отзыв» и с загрузкой прикреплённых фото (она стартует уже ПОСЛЕ сохранения).
  const [opened, setOpened] = useState(false)

  // Тот же ключ react-query, что и у формы: повторного запроса не будет.
  const { review, isLoading } = useQuestReview({
    questId: questNumericId,
    questSlug: questId,
    cityId,
    enabled: !!questNumericId,
  })

  const handleOpen = useCallback(() => {
    trackQuestReviewPromptClick({ questId, cityId, source: 'quest_page' })
    setOpened(true)
    setVisible(true)
  }, [cityId, questId])

  const handleClose = useCallback(() => setVisible(false), [])

  if (!questNumericId) return null

  // Кнопка-вход прячется, когда отзыв уже есть; пока префилл грузится (в том
  // числе на фоновом refetch), кнопкой не мигаем. На открытое окно этот гейт НЕ
  // распространяется — иначе форма закрывалась бы прямо во время набора.
  const showCta = !isLoading && !review
  const ctaLabel = i18nT('quests:components.quests.QuestReviewInvite.cta')

  return (
    <>
      {showCta ? (
        <Pressable
          onPress={handleOpen}
          style={styles.cta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          testID={testID}
        >
          <Feather name="star" size={13} color={colors.primaryDark} />
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}

      {opened ? (
        <QuestModalSheet
          visible={visible}
          onClose={handleClose}
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
              questId={questId}
              questNumericId={questNumericId}
              cityId={cityId}
              testID={`${testID}-form`}
            />
          </ScrollView>
        </QuestModalSheet>
      ) : null}
    </>
  )
}

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

export default memo(QuestReviewInvite)
