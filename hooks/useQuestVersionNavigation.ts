import type { SupportedLocale } from '@/i18n/config';
import type { QuestServingProjection } from '@/utils/questLocaleRouting';
import type { QuestVersionNavigation } from './questServingTypes';
export type { QuestVersionNavigation } from './questServingTypes';
export function useQuestVersionNavigation(): QuestVersionNavigation | null { return null; }
export function usePublishQuestVersionNavigation(
  _projection: QuestServingProjection | null, _enabled: boolean, _locale: SupportedLocale,
): void {}
