import type { SupportedLocale } from '@/i18n/config';

export type QuestLocaleRoute = {
  locale: Exclude<SupportedLocale, 'ru'>;
  cityId: number;
  questSlug: string;
  path: string;
};
export type QuestLocaleHubRoute = { locale: Exclude<SupportedLocale, 'ru'>; path: string };
export const QUEST_LOCALES: readonly SupportedLocale[];
export function parseQuestLocaleRoute(path: unknown): QuestLocaleRoute | null;
export function parseQuestLocaleHubRoute(path: unknown): QuestLocaleHubRoute | null;
export function parseQuestUrlLocale(path: unknown): Exclude<SupportedLocale, 'ru'> | null;
