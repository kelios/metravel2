import React from 'react'
import { router, usePathname, type Href } from 'expo-router'

import QuestVersionLinks from '@/components/quests/QuestVersionLinks'
import { useQuestVersionNavigation } from '@/hooks/useQuestVersionNavigation'
import { useLocale } from '@/i18n/LocaleProvider'
import type { SupportedLocale } from '@/i18n/config'
import { parseQuestLocaleHubRoute } from '@/utils/questLocalePath'
import { localizeQuestCatalogHref } from '@/utils/questLocaleHubs'

type Props = { onChosen?: () => void; testIDPrefix?: string }
type PreferenceProps = Props & { onLocaleSelected?: (locale: SupportedLocale) => void }
const PreferenceOptions = require('./LanguageOptionList.tsx').default as React.ComponentType<PreferenceProps>

// #3217: the hub's URL owns its language, so a choice made there leaves for the
// catalogue of the chosen language; staying would keep the page suspended.
const openChosenCatalog = (locale: SupportedLocale) => {
  router.push(localizeQuestCatalogHref('/quests', locale) as Href)
}

export default function LanguageOptionList(props: Props) {
  const navigation = useQuestVersionNavigation()
  const { setLocale } = useLocale()
  const onHub = Boolean(parseQuestLocaleHubRoute(usePathname()))
  if (!navigation?.bound) {
    return onHub ? <PreferenceOptions {...props} onLocaleSelected={openChosenCatalog} /> : <PreferenceOptions {...props} />
  }
  return (
    <QuestVersionLinks
      projection={navigation.projection}
      currentLocale={navigation.locale}
      onSelectLocale={setLocale}
      {...props}
    />
  )
}
