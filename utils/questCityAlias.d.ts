export type QuestRouteKey = {
  cityId: string;
  questId: string;
  path: string;
};

export type QuestRouteVariant = QuestRouteKey;

export type ResolvedQuestCity = {
  cityId: string;
  cityIds: string[];
  alias: string | null;
  segment: string;
};

export type QuestCityLandingGroup<T = unknown> = {
  segment: string;
  alias: string | null;
  cityId: string;
  cityIds: string[];
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
  quests: T[];
};

export type NearbyQuestCityLandingGroup<T = unknown> = QuestCityLandingGroup<T> & {
  distanceKm: number;
};

export function stableTextCompare(a: unknown, b: unknown): number;
export function questRouteKey(quest: unknown): QuestRouteKey | null;
export function buildQuestCityAliasMap(quests: unknown): Map<string, string>;
export function buildQuestCityLandingGroups<T = unknown>(
  quests: T[],
  cityAliasMap?: Map<string, string> | null,
): QuestCityLandingGroup<T>[];
export function findNearbyQuestCityGroups<T = unknown>(
  current: QuestCityLandingGroup<T>,
  groups: QuestCityLandingGroup<T>[],
  options?: { limit?: number; maxDistanceKm?: number },
): NearbyQuestCityLandingGroup<T>[];
export function questRouteVariants(
  quest: unknown,
  cityAliasMap?: Map<string, string> | null,
): QuestRouteVariant[];
export function resolveQuestCitySegment(
  cityParam: string | null | undefined,
  quests: unknown,
): ResolvedQuestCity | null;
