import type { SupportedLocale } from '@/i18n/config';

export { QUEST_LOCALES, parseQuestLocaleRoute, parseQuestLocaleHubRoute, parseQuestUrlLocale,
  type QuestLocaleRoute, type QuestLocaleHubRoute } from './questLocalePath';
export { buildQuestLocaleHubPath, getQuestLocaleRouteParserScript } from './questLocaleShell';

export type QuestServingIdentity = { cityId: number; questSlug: string; locale: SupportedLocale };
export type QuestServingProjection = {
  schema_version: 1;
  release_id: string | null;
  city_id: number;
  quest_slug: string;
  locale: SupportedLocale;
  state: 'available' | 'unavailable' | 'temporary_failure';
  canonical_path: string | null;
  ru_source_path: string | null;
  versions: { locale: SupportedLocale; path: string }[];
};
export function buildQuestLocalePath(cityId: number, questSlug: string, locale: SupportedLocale): string | null;
export function validateQuestServingProjection(raw: unknown, expected: QuestServingIdentity): QuestServingProjection | null;
export function questServingAlternates(projection: QuestServingProjection | null): { locale: string; href: string }[];
