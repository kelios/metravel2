import { Platform } from 'react-native'
import { isSupportedLocale, type SupportedLocale } from '@/i18n/config'
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

/** Catalogue path for a content language from data (`inLanguage`, projection locale). */
export function questCatalogPathForLocale(locale: unknown): string {
  return isSupportedLocale(locale) ? String(localizeQuestCatalogHref('/quests', locale)) : '/quests'
}

/**
 * Members of the hub `/{locale}/quests`: quests whose page in that locale the
 * server serves (`served_locales`, #3349). A published translation alone is not
 * enough — the server withholds a noindex page (404). No field — not a member.
 */
export function selectQuestHubMembers<T extends { servedLocales?: string[] }>(quests: T[], locale: Exclude<SupportedLocale, 'ru'>): T[] {
  return quests.filter((quest) => quest.servedLocales?.includes(locale) ?? false)
}
