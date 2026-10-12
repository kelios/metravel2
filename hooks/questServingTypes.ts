import type { SupportedLocale } from '@/i18n/config';
import type { QuestServingProjection } from '@/utils/questLocaleRouting';

export type QuestServingOptions = {
  cityId: number | undefined;
  questSlug: string;
  locale: SupportedLocale;
  enabled: boolean;
  /** Revalidation-only caller: pause after a 503 without package identity, unless the document carries this quest's bootstrap. */
  requireBootstrap?: boolean;
};
export type QuestServingResult = {
  projection: QuestServingProjection | null;
  pending: boolean;
  offline: boolean;
  refetch: () => void;
};
export type QuestVersionNavigation = {
  bound: boolean;
  projection: QuestServingProjection | null;
  locale: SupportedLocale;
};
