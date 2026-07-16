export type QuestRouteKey = {
  cityId: string;
  questId: string;
  path: string;
};

export type QuestRouteVariant = QuestRouteKey;

export type ResolvedQuestCity = {
  cityId: string;
  alias: string | null;
};

export function questRouteKey(quest: unknown): QuestRouteKey | null;
export function buildQuestCityAliasMap(quests: unknown): Map<string, string>;
export function questRouteVariants(
  quest: unknown,
  cityAliasMap?: Map<string, string> | null,
): QuestRouteVariant[];
export function resolveQuestCitySegment(
  cityParam: string | null | undefined,
  quests: unknown,
): ResolvedQuestCity | null;
