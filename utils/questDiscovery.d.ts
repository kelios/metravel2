import type { ApiQuestMeta } from '@/api/quests';

export type QuestDiscoveryView = 'home' | 'catalog' | 'scenario';
export type QuestDiscovery = {
  schema_version: 2; state: 'available'; locale: 'ru'; view: QuestDiscoveryView;
  publication_id: string; corpus_revision: string; source_revision: string; content_revision: string;
  quests: ApiQuestMeta[]; cities: { title: string; path: string }[]; countries: { title: string; path: string }[];
};
export function projectQuestDiscoveryRow(raw: unknown): ApiQuestMeta | null;
export function validateQuestDiscovery(raw: unknown, view: QuestDiscoveryView): QuestDiscovery | null;
