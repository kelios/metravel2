import type { SupportedLocale } from '@/i18n/config';

export type QuestPublicRoute = {
  kind: 'detail' | 'city' | 'country'; locale: SupportedLocale; path: string;
  city?: string; slug?: string; country?: string;
};
export type QuestPublicItem = { title: string; text: string; facts: string; path: string | null; lang: SupportedLocale | null };
export type QuestPublicPage = {
  meta: { title: string; description: string; canonical: string; image: string | null; tourist_type?: string | null; city_name?: string | null };
  heading: string; kicker: string; lead: string; paragraphs: string[]; facts: string[];
  sections: { heading: string; paragraphs: string[]; items: QuestPublicItem[] }[];
};
export type QuestPublicProjection = {
  schema_version: 2; state: 'available'; kind: QuestPublicRoute['kind']; locale: SupportedLocale;
  publication_id: string; corpus_revision: string; source_revision: string; content_revision: string;
  city_id: number | null; quest_slug: string | null; country_code: string | null;
  canonical_path: string; ru_source_path: string | null;
  versions: { locale: SupportedLocale; path: string; content_revision: string }[];
  quality: { indexable: boolean; word_count: number; own_fivegram_ratio: number | null };
  page: QuestPublicPage;
};
export function parseQuestPublicRoute(pathname: string): QuestPublicRoute | null;
export function safePublicPath(value: unknown): boolean;
export function safePublicImageUrl(value: unknown): boolean;
export function validateQuestPublicProjection(raw: unknown, route: QuestPublicRoute): QuestPublicProjection | null;
