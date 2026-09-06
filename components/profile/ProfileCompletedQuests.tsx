import React, { useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'
import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useQuestCityCollections } from '@/hooks/useQuestCityCollection'
import { COMPLETED_FILTER_ID, STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection'
import { PROFILE_COMPLETED_QUESTS_LIMIT } from '@/utils/questCityCollection'
import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'

/**
 * «Мои квесты» — история прохождений игрока (#1794).
 *
 * До этой секции пройденный квест было видно только бейджем на карточке в
 * каталоге: полосы коллекций рядом (#1484) отвечают на вопрос «сколько
 * осталось в городе», а не «что я прошёл». Список читает тот же компактный
 * каталог, что и полосы, — второго запроса на вкладке не появляется.
 *
 * Секция молча исчезает без прохождений: пустая рамка в профиле хуже её
 * отсутствия, ровно как у соседних полос коллекций.
 */
export function ProfileCompletedQuests() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const router = useRouter()
  const { completedQuests } = useQuestCityCollections()

  const shown = completedQuests.slice(0, PROFILE_COMPLETED_QUESTS_LIMIT)
  const hiddenCount = completedQuests.length - shown.length

  // «Показать все» ведёт в тот же срез каталога, что и строка «Пройденные» в
  // сайдбаре (#1791). Срез передаётся одноразовым ключом, который каталог
  // забирает на фокусе: вкладка живёт всю сессию, и уже открытый каталог не
  // перечитал бы сохранённый выбор — единственная кнопка секции показывала бы
  // прежний срез. Пишем до навигации, чтобы ключ уже лежал к моменту фокуса.
  const handleShowAll = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_PENDING_CATALOG_SELECTION, COMPLETED_FILTER_ID)
    } catch {
      // Недоступное хранилище — не повод не открыть каталог: игрок увидит его
      // в прежнем срезе и выберет «Пройденные» сам.
    }
    router.push('/quests')
  }, [router])

  if (!completedQuests.length) return null

  return (
    <View style={styles.wrap} testID="profile-completed-quests">
      <ProfileSectionHeader
        title={i18nT('profile:components.profile.ProfileCompletedQuests.title')}
        subtitle={i18nT('profile:components.profile.ProfileCompletedQuests.subtitle', {
          value1: formatInteger(completedQuests.length),
        })}
      />
      <View style={styles.list}>
        {shown.map((quest) => (
          <QuestForCityCard
            key={quest.id}
            quest={quest}
            eyebrow={quest.cityName || i18nT('profile:components.profile.ProfileCompletedQuests.eyebrow')}
            analyticsSource="profile_completed_quests"
            style={styles.card}
          />
        ))}
      </View>
      {hiddenCount > 0 ? (
        <Pressable
          onPress={handleShowAll}
          style={styles.showAll}
          accessibilityRole="button"
          accessibilityLabel={i18nT('profile:components.profile.ProfileCompletedQuests.showAllA11y', {
            value1: formatInteger(completedQuests.length),
          })}
          testID="profile-completed-quests-show-all"
        >
          <Text style={styles.showAllText}>
            {i18nT('profile:components.profile.ProfileCompletedQuests.showAll', {
              value1: formatInteger(completedQuests.length),
            })}
          </Text>
          <Feather name="arrow-right" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    wrap: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    list: {
      gap: DESIGN_TOKENS.spacing.sm,
    },
    card: {
      width: '100%',
    },
    showAll: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    showAllText: {
      color: colors.primary,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
    },
  })
}

export default ProfileCompletedQuests
