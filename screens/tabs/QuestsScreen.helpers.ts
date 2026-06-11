// src/screens/tabs/QuestsScreen.helpers.ts

export const COUNTRY_NAMES: Record<string, string> = {
    BY: 'Беларусь',
    PL: 'Польша',
    AM: 'Армения',
    RU: 'Россия',
    UA: 'Украина',
    LT: 'Литва',
    LV: 'Латвия',
    EE: 'Эстония',
    GE: 'Грузия',
};

export const STORAGE_SELECTED_CITY = 'quests_selected_city';
export const STORAGE_NEARBY_RADIUS = 'quests_nearby_radius_km';
export const DEFAULT_NEARBY_RADIUS_KM = 15;
export const NEARBY_ID = '__nearby__';

let expoLocationModulePromise: Promise<typeof import('expo-location')> | null = null;

export async function loadExpoLocation() {
    if (!expoLocationModulePromise) {
        expoLocationModulePromise = Promise.resolve(import('expo-location'));
    }
    return expoLocationModulePromise;
}

export type MapPoint = {
    id?: string | number;
    coord: string;
    address: string;
    travelImageThumbUrl: string;
    categoryName: string;
    articleUrl?: string;
    urlTravel?: string;
    questMeta?: {
        id: string;
        title: string;
        cityId: string;
        cityName?: string;
        countryName?: string;
        points?: number;
        durationMin?: number;
        difficulty?: 'easy' | 'medium' | 'hard';
        tags?: string[];
        petFriendly?: boolean;
        cover?: string;
    };
};
