import type { ApiQuestMeta } from '@/api/quests';

export type TravelGraphQuest = { quest: ApiQuestMeta; score: number; distance_km: number | null };
export type TravelRelatedLink = { path: string; name: string };
export type TravelLinkGraph = {
  schema_version: 2; state: 'available'; locale: 'ru'; view: 'travel'; travel_id: number;
  publication_id: string; corpus_revision: string; source_revision: string; content_revision: string;
  quests: TravelGraphQuest[]; related: TravelRelatedLink[];
};
export type TravelLinkGraphResult = TravelLinkGraph | {
  state: 'pending' | 'error'; errorCode: string; retryAfterSeconds: 5;
  sourceCheckedAt: number | null; sourceAgeSeconds: number | null;
};
export function buildQuestPromoMeta(quest: unknown, bundle: unknown): unknown;
export function buildQuestPromoCatalog(quests: unknown[], bundles: Map<string, unknown>): unknown[];
export function findTravelQuestPromoMatches(travel: unknown, quests: unknown[], limit?: number): unknown[];
export function buildRelatedIndex(travels: unknown[]): unknown;
export function pickRelatedTravels(travel: unknown, index: unknown, limit?: number): TravelRelatedLink[];
export function buildTravelLinkGraphs(travels: unknown[], quests: unknown[], bundles: Record<string, unknown>): Record<string, Pick<TravelLinkGraph, 'quests' | 'related'>>;
