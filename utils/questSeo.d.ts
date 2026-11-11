import type { TranslationKey, TranslationParams } from '@/i18n/resources';

export type QuestSeoTranslationKey = Extract<
  TranslationKey,
  `seo:utils.questSeo.${string}`
>;

export type QuestSeoInput = {
  title?: string | null;
  cityName?: string | null;
  points?: number | string | null;
  durationMin?: number | string | null;
  translate?: (key: QuestSeoTranslationKey, params?: TranslationParams) => string;
  translatePlural?: (key: QuestSeoTranslationKey, count: number, params?: TranslationParams) => string;
  locale?: string;
};

export type QuestSeoMetadata = {
  title: string;
  description: string;
};

export type QuestCityLandingPlace = {
  title?: string | null;
  location?: string | null;
};

export type QuestCityLandingMetaInput = {
  cityName?: string | null;
  /** Только для разведения двух городов с одинаковым именем в разных странах. */
  countryName?: string | null;
  questTitles?: readonly string[];
  /** Точки маршрутов города в порядке `walk.places`. */
  places?: readonly QuestCityLandingPlace[];
  nearbyCityNames?: readonly string[];
  translate?: QuestSeoInput['translate'];
  translatePlural?: QuestSeoInput['translatePlural'];
  locale?: string;
};

export function buildBrandedSeoTitle(base?: string | null, maxLength?: number): string;
export function buildQuestCityLandingMeta(input?: QuestCityLandingMetaInput): QuestSeoMetadata;
export function buildQuestSeoMetadata(input?: QuestSeoInput): QuestSeoMetadata;
export function questCityLandingPlaceLabels(
  places?: readonly QuestCityLandingPlace[] | null,
  cityName?: string | null,
): string[];
export function clampMetaDescription(value?: string | null, maxEncodedLength?: number): string;
export function encodedAttributeLength(value?: string | null): number;
