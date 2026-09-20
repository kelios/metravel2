import React, { useMemo } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  QUESTS_LANDING_CARD_MAX_WIDTH,
  QUESTS_LANDING_CARD_MIN_WIDTH,
} from '@/constants/questLayout'
import { useTranslation } from '@/i18n/LocaleProvider'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { pluralizeQuest } from '@/screens/tabs/questsShared'
import type { QuestMeta } from '@/utils/questAdapters'
import type { QuestCountryLandingGroup } from '@/utils/questCountryLanding'

type Props = {
  country: QuestCountryLandingGroup<QuestMeta>
}

/** Runtime counterpart of the crawlable country-owned SSG sections. */
export default function QuestCountryLandingSections({ country }: Props) {
  const colors = useThemedColors()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(colors), [colors])
  const questCount = pluralizeQuest(country.quests.length)

  return (
    <>
      <View style={styles.section} testID="quest-country-overview">
        <View style={styles.titleRow}>
          <Feather name="globe" size={18} color={colors.primary} aria-hidden />
          <Text
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as Record<string, unknown>)}
            style={styles.title}
          >
            {t('quests:app.tabs.quests.country.index.overviewTitle', {
              value1: country.countryName,
            })}
          </Text>
        </View>
        <Text style={styles.body}>
          {t('quests:app.tabs.quests.country.index.overview', {
            value1: country.countryName,
            value2: questCount,
            value3: country.cities.length,
          })}
        </Text>
      </View>

      <View style={styles.section} testID="quest-country-cities">
        <View style={styles.titleRow}>
          <Feather name="map-pin" size={18} color={colors.primary} aria-hidden />
          <Text
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as Record<string, unknown>)}
            style={styles.title}
          >
            {t('quests:app.tabs.quests.country.index.citiesTitle')}
          </Text>
        </View>
        <Text style={styles.body}>
          {t('quests:app.tabs.quests.country.index.citiesLead', {
            value1: country.countryName,
          })}
        </Text>
        <View style={styles.cityList}>
          {country.cities.map((city) => (
            // Прямому ребёнку `Link asChild` отдаётся ОДИН плоский объект стиля: Slot сливает
            // стили спредом, поэтому функция `({ pressed }) => [...]` превращается в `{}` и
            // карточка теряет всю вёрстку. Состояние нажатия живёт на внутренней строке.
            <Link key={city.cityAlias} href={`/quests/${city.cityAlias}`} asChild>
              <Pressable
                style={styles.cityLink}
                accessibilityRole="link"
                accessibilityLabel={t('quests:app.tabs.quests.country.index.cityA11y', {
                  value1: city.cityName,
                  value2: pluralizeQuest(city.questCount),
                })}
              >
                {({ pressed }) => (
                  <View style={[styles.cityRow, pressed && styles.cityRowPressed]}>
                    <View style={styles.cityText}>
                      <Text style={styles.cityName}>{city.cityName}</Text>
                      <Text style={styles.cityMeta}>{pluralizeQuest(city.questCount)}</Text>
                    </View>
                    <Feather name="arrow-right" size={17} color={colors.primary} aria-hidden />
                  </View>
                )}
              </Pressable>
            </Link>
          ))}
        </View>
      </View>

      <View style={styles.section} testID="quest-country-practical">
        <View style={styles.titleRow}>
          <Feather name="compass" size={18} color={colors.primary} aria-hidden />
          <Text
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as Record<string, unknown>)}
            style={styles.title}
          >
            {t('quests:app.tabs.quests.country.index.practiceTitle')}
          </Text>
        </View>
        <Text style={styles.body}>
          {t('quests:app.tabs.quests.country.index.practice', {
            value1: country.countryName,
          })}
        </Text>
        <Text style={styles.note}>
          {t('quests:app.tabs.quests.country.index.practiceNote')}
        </Text>
      </View>
    </>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    section: {
      width: '100%',
      maxWidth: 840,
      gap: 8,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: colors.text,
    },
    body: {
      fontSize: 15,
      lineHeight: 23,
      color: colors.textMuted,
    },
    note: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSubtle,
    },
    cityList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    cityLink: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: QUESTS_LANDING_CARD_MIN_WIDTH,
      maxWidth: QUESTS_LANDING_CARD_MAX_WIDTH,
    },
    // Рамка и фон живут на ВНУТРЕННЕЙ строке: `opacity` нажатия обязана притушить карточку
    // целиком, а стиль ссылки-ребёнка `Link asChild` не умеет зависеть от `pressed`.
    // `flexGrow` тянет строку на всю высоту ссылки — соседи по ряду выше, и без него рамка
    // не дотягивалась бы до низа карточки.
    cityRow: {
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    cityRowPressed: {
      opacity: 0.75,
    },
    cityText: {
      flex: 1,
      gap: 2,
    },
    cityName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    cityMeta: {
      fontSize: 12,
      color: colors.textSubtle,
    },
  })
}
