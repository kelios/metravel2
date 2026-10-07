// src/utils/geo.ts

import { haversineKm } from '@/utils/geoDistance';

// CQ-2: единая реализация живёт в `utils/geoDistance.ts`; здесь — ре-экспорт
// для существующих импортёров.
export { haversineKm };

type QuestLike = {
    lat: number; lng: number;
    petFriendly?: boolean;
    difficulty?: string;
    tags?: string[];
};

export function getQuestsNearby<T extends QuestLike>(
    quests: T[],
    lat: number,
    lng: number,
    radiusKm: number,
    opts?: {
        petFriendlyOnly?: boolean;
        difficulty?: string[];
        tagsAnyOf?: string[];
    },
): T[] {
    const { petFriendlyOnly, difficulty, tagsAnyOf } = opts || {};
    return quests
        .filter(q => {
            if (petFriendlyOnly && !q.petFriendly) return false;
            if (difficulty && difficulty.length && !difficulty.includes(q.difficulty ?? 'easy')) return false;
            if (tagsAnyOf && tagsAnyOf.length && !tagsAnyOf.some(t => q.tags?.includes(t))) return false;
            return true;
        })
        .map(q => ({ q, dist: haversineKm(lat, lng, q.lat, q.lng) }))
        .filter(x => x.dist <= radiusKm)
        .sort((a, b) => a.dist - b.dist)
        .map(x => x.q);
}
