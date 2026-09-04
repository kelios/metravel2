export type QuestCountryCityGroup<T = unknown> = {
  cityAlias: string;
  cityName: string;
  questCount: number;
  cityIds: string[];
  quests: T[];
};

export type QuestCountryLandingGroup<T = unknown> = {
  countryCode: string;
  countryAlias: string;
  countryName: string;
  quests: T[];
  cities: QuestCountryCityGroup<T>[];
};

export const ISO_ALPHA2_CODES: Set<string>;
export const QUEST_COUNTRY_LANDING_MIN_CITIES: number;
export function questCountryLandingIsIndexable(
  country: { cities?: unknown[] } | null | undefined,
): boolean;
export function normalizeIsoCountryCode(value: unknown): string | null;
export function getIsoCountryDisplayName(
  countryCode: unknown,
  locale?: string,
  fallback?: string,
): string;
export function getQuestCountryAlias(countryCode: unknown): string | null;
export function buildQuestCountryLandingGroups<T = unknown>(
  quests: T[],
  options?: { locale?: string },
): QuestCountryLandingGroup<T>[];
export function resolveQuestCountryAlias<T = unknown>(
  countryParam: string | null | undefined,
  quests: T[],
  options?: { locale?: string },
): QuestCountryLandingGroup<T> | null;
export function stableTextCompare(a: unknown, b: unknown): number;
