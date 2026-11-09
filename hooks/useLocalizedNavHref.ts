import { useCallback } from 'react'
import type { Href } from 'expo-router'
import { useLocaleRevision } from '@/i18n/useLocaleRevision'
import { localizeQuestCatalogHref } from '@/utils/questLocaleHubs'

/** Navigation href in the interface locale (#3217): «Quests» leads to the locale hub. */
export function useLocalizedNavHref(): (href: Href) => Href {
  const locale = useLocaleRevision()
  return useCallback((href: Href) => localizeQuestCatalogHref(href, locale) as Href, [locale])
}
