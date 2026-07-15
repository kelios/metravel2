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
  locale?: string;
};

export type QuestSeoMetadata = {
  title: string;
  description: string;
};

export function buildBrandedSeoTitle(base?: string | null, maxLength?: number): string;
export function buildQuestSeoMetadata(input?: QuestSeoInput): QuestSeoMetadata;
export function clampMetaDescription(value?: string | null, maxEncodedLength?: number): string;
export function encodedAttributeLength(value?: string | null): number;
