import React from 'react'
import { Text } from 'react-native'

import {
  QuestLandingCityLinks,
  QuestLandingSection,
  useQuestLandingSectionStyles,
} from '@/components/quests/QuestLandingLayout'
import { useTranslation } from '@/i18n/LocaleProvider'
import { useThemedColors } from '@/hooks/useTheme'
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
  const styles = useQuestLandingSectionStyles(colors)
  const questCount = pluralizeQuest(country.quests.length)

  return (
    <>
      <QuestLandingSection
        styles={styles}
        colors={colors}
        testID="quest-country-overview"
        icon="globe"
        title={t('quests:app.tabs.quests.country.index.overviewTitle', {
          value1: country.countryName,
        })}
      >
        <Text style={styles.body}>
          {t('quests:app.tabs.quests.country.index.overview', {
            value1: country.countryName,
            value2: questCount,
            value3: country.cities.length,
          })}
        </Text>
      </QuestLandingSection>

      <QuestLandingSection
        styles={styles}
        colors={colors}
        testID="quest-country-cities"
        icon="map-pin"
        title={t('quests:app.tabs.quests.country.index.citiesTitle')}
      >
        <Text style={styles.body}>
          {t('quests:app.tabs.quests.country.index.citiesLead', {
            value1: country.countryName,
          })}
        </Text>
        <QuestLandingCityLinks
          styles={styles}
          colors={colors}
          links={country.cities.map((city) => ({
            key: city.cityAlias,
            href: `/quests/${city.cityAlias}`,
            a11yLabel: t('quests:app.tabs.quests.country.index.cityA11y', {
              value1: city.cityName,
              value2: pluralizeQuest(city.questCount),
            }),
            name: city.cityName,
            meta: pluralizeQuest(city.questCount),
          }))}
        />
      </QuestLandingSection>

      <QuestLandingSection
        styles={styles}
        colors={colors}
        testID="quest-country-practical"
        icon="compass"
        title={t('quests:app.tabs.quests.country.index.practiceTitle')}
      >
        <Text style={styles.body}>
          {t('quests:app.tabs.quests.country.index.practice', {
            value1: country.countryName,
          })}
        </Text>
        <Text style={styles.note}>
          {t('quests:app.tabs.quests.country.index.practiceNote')}
        </Text>
      </QuestLandingSection>
    </>
  )
}
