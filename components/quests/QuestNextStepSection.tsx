import React, { useCallback, useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { QuestCityProgressBar } from '@/components/quests/QuestCityProgressBar'
import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useQuestCityCollection } from '@/hooks/useQuestCityCollection'
import { trackNextQuestClick } from '@/utils/questRetentionAnalytics'
import { translate as i18nT } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { questRetentionOwnerId } from '@/utils/questReturnVisit'

import { useQuestReturnReminder } from './useQuestReturnReminder'

type Props = {
  /** Только что пройденный квест. */
  questId?: string
  questTitle: string
  cityId?: string
  cityName?: string
  /** Координаты города — запасная точка отсчёта, если квеста нет в каталоге. */
  cityLat?: number
  cityLng?: number
  /** Точное время нового финиша; null при повторном открытии старого финала. */
  completionFinishedAt: number | null
}

/**
 * Петля возврата на экране финала (#1484): коллекция города плюс два-три
 * непройденных квеста рядом. До этого блока взаимодействие заканчивалось
 * финальным видео — второго действия у продукта не было вовсе.
 *
 * Блок молча исчезает, пока каталог грузится и когда предлагать нечего:
 * пустая рамка на финале хуже её отсутствия.
 */
export function QuestNextStepSection({
  questId,
  questTitle,
  cityId,
  cityName,
  cityLat,
  cityLng,
  completionFinishedAt,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const userId = useAuthStore((state) => state.userId)
  const ownerId = questRetentionOwnerId(userId)

  const origin = useMemo(() => {
    if (typeof cityLat !== 'number' || typeof cityLng !== 'number') return null
    if (!Number.isFinite(cityLat) || !Number.isFinite(cityLng)) return null
    return { lat: cityLat, lng: cityLng }
  }, [cityLat, cityLng])

  const { collection, suggestions } = useQuestCityCollection({
    cityId,
    cityName,
    completedQuestId: questId,
    origin,
  })

  const remainingCount = collection ? Math.max(0, collection.totalCount - collection.completedCount) : 0

  // Локальное напоминание через неделю (native, только при уже выданном
  // разрешении на уведомления). E-mail-ветка того же шага живёт на бэкенде.
  useQuestReturnReminder({
    ownerId,
    questId,
    cityId,
    cityName,
    questTitle,
    questCompleted: true,
    remainingCount,
    completionFinishedAt,
  })

  const handleCardPress = useCallback(
    (index: number) => {
      const suggestion = suggestions[index]
      if (!suggestion) return
      trackNextQuestClick({
        questId: suggestion.quest.id,
        cityId: suggestion.quest.cityId,
        fromQuestId: questId ?? null,
        position: index + 1,
        distanceKm: suggestion.distanceKm,
        otherCity: suggestion.otherCity,
      })
    },
    [questId, suggestions],
  )

  if (!collection && !suggestions.length) return null

  const heading = i18nT('quests:components.quests.QuestNextStepSection.title')

  return (
    <View
      style={styles.section}
      testID="quest-next-step-section"
      accessibilityLabel={heading}
      role={Platform.OS === 'web' ? 'region' : undefined}
    >
      {collection ? <QuestCityProgressBar collection={collection} source="quest_finale" /> : null}

      {suggestions.length ? (
        <>
          <Text
            style={styles.title}
            role={Platform.OS === 'web' ? 'heading' : undefined}
            aria-level={2}
          >
            {heading}
          </Text>
          <Text style={styles.subtitle}>
            {i18nT('quests:components.quests.QuestNextStepSection.subtitle')}
          </Text>

          <View style={styles.list}>
            {suggestions.map((suggestion, index) => (
              <QuestForCityCard
                key={suggestion.quest.id}
                quest={suggestion.quest}
                eyebrow={
                  suggestion.otherCity && suggestion.quest.cityName
                    ? i18nT('quests:components.quests.QuestNextStepSection.eyebrowOtherCity', {
                        value1: suggestion.quest.cityName,
                      })
                    : i18nT('quests:components.quests.QuestNextStepSection.eyebrow')
                }
                distanceKm={suggestion.distanceKm}
                analyticsSource="quest_next_step"
                analyticsContextId={questId ?? null}
                onPressCard={() => handleCardPress(index)}
                style={styles.card}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    section: {
      width: '100%',
      gap: DESIGN_TOKENS.spacing.xs,
      marginTop: DESIGN_TOKENS.spacing.lg,
    },
    title: {
      marginTop: DESIGN_TOKENS.spacing.sm,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
    },
    list: {
      gap: DESIGN_TOKENS.spacing.xs,
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
    card: {
      width: '100%',
    },
  })
}

export default QuestNextStepSection

// #1484: см. QuestCityProgressBar — строки блока живут в namespace `quests`.
