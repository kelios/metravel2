import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'
import { QuestCityProgressBar } from '@/components/quests/QuestCityProgressBar'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useQuestCityCollections } from '@/hooks/useQuestCityCollection'
import { translate as i18nT } from '@/i18n'

/** Сколько коллекций показываем в профиле: полос больше — это уже каталог. */
const MAX_COLLECTIONS = 4

/**
 * Коллекции городов в профиле (#1484) — та же полоса, что на экране финала.
 * Показываются только города с прохождениями: незакрытая коллекция и есть
 * причина вернуться, а нулевые полосы всех городов каталога — шум.
 */
export function ProfileQuestCollections() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { collections } = useQuestCityCollections()

  if (!collections.length) return null

  return (
    <View style={styles.wrap} testID="profile-quest-collections">
      <ProfileSectionHeader
        title={i18nT('profile:components.profile.ProfileQuestCollections.title')}
        subtitle={i18nT('profile:components.profile.ProfileQuestCollections.subtitle')}
      />
      <View style={styles.card}>
        {collections.slice(0, MAX_COLLECTIONS).map((collection) => (
          <QuestCityProgressBar
            key={collection.cityId}
            collection={collection}
            source="profile"
          />
        ))}
      </View>
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    wrap: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    card: {
      gap: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  })
}

export default ProfileQuestCollections
