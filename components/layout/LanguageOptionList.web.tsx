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
// #3367: the RU catalogue `/quests` is one of the same family of addresses, so a
// choice there opens the chosen language's catalogue too (one behaviour).
const isQuestCatalogPath = (pathname: string) =>
  pathname.replace(/\/+$/, '') === '/quests' || Boolean(parseQuestLocaleHubRoute(pathname))

const openChosenCatalog = (pathname: string) => (locale: SupportedLocale) => {
  const target = String(localizeQuestCatalogHref('/quests', locale))
  if (target !== pathname.replace(/\/+$/, '')) router.push(target as Href)
}

export default function LanguageOptionList(props: Props) {
  const navigation = useQuestVersionNavigation()
  const { setLocale } = useLocale()
  const pathname = usePathname()
  if (!navigation?.bound) {
    return isQuestCatalogPath(pathname)
      ? <PreferenceOptions {...props} onLocaleSelected={openChosenCatalog(pathname)} />
      : <PreferenceOptions {...props} />
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
