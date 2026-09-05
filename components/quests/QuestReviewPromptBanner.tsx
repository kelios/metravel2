// Мягкая просьба об отзыве в каталоге квестов (#1795).
//
// Второй заход к просьбе после финиша: игрок вернулся в каталог — напоминаем
// про пройденный квест и ведём на его страницу, где живёт кнопка отзыва.
// Показывается один раз на квест (отметку ставит `useQuestReviewPrompt`).

import { memo, useCallback, useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  trackQuestReviewPromptClick,
  trackQuestReviewPromptShown,
} from '@/utils/questReviewAnalytics'
import { translate as i18nT } from '@/i18n'

type Props = {
  questId: string
  cityId?: string
  /** Название квеста из каталога; без него зовём отзыв без имени. */
  questTitle?: string
  onDismiss: () => void
  testID?: string
}

function QuestReviewPromptBanner({
  questId,
  cityId,
  questTitle,
  onDismiss,
  testID = 'quest-review-prompt',
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  useEffect(() => {
    trackQuestReviewPromptShown({ questId, cityId })
  }, [cityId, questId])

  const handleOpen = useCallback(() => {
    trackQuestReviewPromptClick({ questId, cityId, source: 'catalog_banner' })
    onDismiss()
    if (cityId) {
      router.push({ pathname: '/quests/[city]/[questId]', params: { city: cityId, questId } })
    }
  }, [cityId, onDismiss, questId])

  const title = questTitle
    ? i18nT('quests:components.quests.QuestReviewPromptBanner.titleWithQuest', { value1: questTitle })
    : i18nT('quests:components.quests.QuestReviewPromptBanner.title')

  return (
    <View style={styles.banner} testID={testID}>
      <Feather name="star" size={16} color={colors.warning} style={styles.icon} />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {i18nT('quests:components.quests.QuestReviewPromptBanner.subtitle')}
        </Text>
      </View>

      {cityId ? (
        <Pressable
          onPress={handleOpen}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={i18nT('quests:components.quests.QuestReviewPromptBanner.cta')}
          testID={`${testID}-cta`}
        >
          <Text style={styles.actionText}>
            {i18nT('quests:components.quests.QuestReviewPromptBanner.cta')}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onDismiss}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel={i18nT('quests:components.quests.QuestReviewPromptBanner.dismiss')}
        testID={`${testID}-dismiss`}
        hitSlop={8}
      >
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    icon: {
      marginTop: 2,
    },
    texts: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    action: {
      paddingVertical: 6,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primary,
    },
    actionText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    close: {
      padding: 2,
    },
  })

export default memo(QuestReviewPromptBanner)
