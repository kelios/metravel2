import type { SupportedLocale } from '@/i18n/config';

export type QuestLocaleRoute = {
  locale: Exclude<SupportedLocale, 'ru'>;
  cityId: number;
  questSlug: string;
  path: string;
};
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
export const QUEST_LOCALES: readonly SupportedLocale[];
export function buildQuestLocalePath(cityId: number, questSlug: string, locale: SupportedLocale): string | null;
export function parseQuestLocaleRoute(path: unknown): QuestLocaleRoute | null;
export type QuestLocaleHubRoute = { locale: Exclude<SupportedLocale, 'ru'>; path: string };
export function parseQuestLocaleHubRoute(path: unknown): QuestLocaleHubRoute | null;
export function buildQuestLocaleHubPath(locale: SupportedLocale): string | null;
export function parseQuestUrlLocale(path: unknown): Exclude<SupportedLocale, 'ru'> | null;
export function getQuestLocaleRouteParserScript(): string;
export function validateQuestServingProjection(raw: unknown, expected: QuestServingIdentity): QuestServingProjection | null;
export function questServingAlternates(projection: QuestServingProjection | null): { locale: string; href: string }[];
