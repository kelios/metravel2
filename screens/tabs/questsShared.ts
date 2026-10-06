import { translatePlural } from '@/i18n'
export type City = {
    id: string;
    name: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
};

export type NearbyCity = City & { isNearby: true };

export type { QuestMeta } from '@/utils/questAdapters';

/**
 * Порядок каталога квестов (#1988). Одно состояние вместо набора тумблеров:
 * варианты взаимно исключают друг друга.
 */
export type QuestSortOrder = 'default' | 'popular' | 'rating';

export const pluralizeQuest = (n: number): string => {
    return translatePlural('shared:screens.tabs.questsShared.questsCount', n, { value1: n });
};

export const pluralizePoints = (n: number): string => {
    return translatePlural('shared:screens.tabs.questsShared.pointsCount', n, { value1: n });
};
