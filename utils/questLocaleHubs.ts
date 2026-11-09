import { Platform } from 'react-native'
import type { SupportedLocale } from '@/i18n/config'
import { buildQuestLocaleHubPath } from '@/utils/questLocaleRouting'

/**
 * #3217: the hubs `/{be,uk,pl,en}/quests` go public only together with their
 * backend serving (gateway, Nginx location, sitemap) — the same release rule as
 * the translated details (#2364). Until the build sets the flag no link points there.
 */
export function areQuestLocaleHubsPublished(): boolean {
  return Platform.OS === 'web' && process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS === 'true'
}

/** The one rule «interface locale → catalogue address» for navigation links. */
export function localizeQuestCatalogHref<T extends string | object>(href: T, locale: SupportedLocale): T | string {
  if (href !== '/quests' || locale === 'ru' || !areQuestLocaleHubsPublished()) return href
  return buildQuestLocaleHubPath(locale) ?? href
}
