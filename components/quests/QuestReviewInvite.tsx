// Второй вход в отзыв о квесте (#1795).
//
// До этого форма отзыва жила ТОЛЬКО на экране финала и только в момент
// прохождения: игрок в этот момент обычно уже закрывает телефон, поэтому на 177
// квестов и 22 прохождения не пришло ни одного отзыва. Кнопка живёт рядом с
// бейджем «Пройден» на странице квеста и открывает ту же самую форму
// (`QuestReviewSection`) в модальном окне — новый транспорт не заводим.

import { memo, useCallback, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

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

  // Тот же ключ react-query, что и у формы: повторного запроса не будет.
  const { review, isLoading } = useQuestReview({
    questId: questNumericId,
    questSlug: questId,
    cityId,
    enabled: !!questNumericId,
  })

  const handleOpen = useCallback(() => {
    trackQuestReviewPromptClick({ questId, cityId, source: 'quest_page' })
    setVisible(true)
  }, [cityId, questId])

  const handleClose = useCallback(() => setVisible(false), [])

  // Отзыв уже оставлен — второй вход не нужен. Пока префилл грузится, кнопку не
  // показываем: мигание «оставьте отзыв» тому, кто его уже написал, хуже паузы.
  if (!questNumericId || isLoading || review) return null

  const ctaLabel = i18nT('quests:components.quests.QuestReviewInvite.cta')

  return (
    <>
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

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet} testID={`${testID}-modal`}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {i18nT('quests:components.quests.QuestReviewInvite.modalTitle')}
              </Text>
              <Pressable
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={i18nT('quests:components.quests.QuestReviewInvite.close')}
                testID={`${testID}-close`}
                hitSlop={8}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetBody}
              contentContainerStyle={styles.sheetBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              <QuestReviewSection
                questId={questId}
                questNumericId={questNumericId}
                cityId={cityId}
                testID={`${testID}-form`}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '90%',
      backgroundColor: colors.background,
      borderTopLeftRadius: DESIGN_TOKENS.radii.lg,
      borderTopRightRadius: DESIGN_TOKENS.radii.lg,
      overflow: 'hidden',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    sheetBody: {
      maxHeight: 560,
    },
    sheetBodyContent: {
      padding: DESIGN_TOKENS.spacing.lg,
    },
  })

export default memo(QuestReviewInvite)
