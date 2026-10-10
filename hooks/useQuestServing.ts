import type { QuestServingOptions, QuestServingResult } from './questServingTypes';
export type { QuestServingOptions, QuestServingResult } from './questServingTypes';

/** Native gameplay has no web publication gate. */
export function useQuestServing(_options: QuestServingOptions): QuestServingResult {
  return { projection: null, pending: false, offline: false, refetch: () => {} };
}
