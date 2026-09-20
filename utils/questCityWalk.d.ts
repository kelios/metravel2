export type QuestCityWalkPlace = {
  questId: string
  questTitle: string
  pointIndex: number
  title: string
  location: string
  sentences: string[]
  openingHours: string
  ticketPrice: string
}

export type QuestCityWalkRoute = {
  questId: string
  title: string
  pointCount: number
  optionalCount: number
  museumCount: number
  durationMin: number
  difficulty: string
  petFriendly: boolean
  startLocation: string
  finishLocation: string
}

export type QuestCityWalkModel = {
  places: QuestCityWalkPlace[]
  otherPlaces: string[]
  routes: QuestCityWalkRoute[]
}

export type QuestCityWalkOptions = {
  questLimit?: number
  placeLimit?: number
  sentenceLimit?: number
}

export const QUEST_CITY_WALK_QUEST_LIMIT: number
export const QUEST_CITY_WALK_PLACE_LIMIT: number
export const QUEST_CITY_WALK_SENTENCE_LIMIT: number

export function buildQuestCityWalkModel(
  quests: unknown[],
  bundles: Map<string, unknown> | Record<string, unknown> | null | undefined,
  options?: QuestCityWalkOptions,
): QuestCityWalkModel
export function isQuestWalkSentence(sentence: unknown): boolean
export function questCityWalkQuestIds(quests: unknown[], options?: QuestCityWalkOptions): string[]
export function questCityWalkBundleCount(
  quests: unknown[],
  bundles: Map<string, unknown> | Record<string, unknown> | null | undefined,
  options?: QuestCityWalkOptions,
): number
export function questCityWalkHasContent(walk: QuestCityWalkModel | null | undefined): boolean
export function questWalkKey(quest: unknown): string
