// src/screens/tabs/QuestsScreen.helpers.ts

import { haversineKm } from '@/utils/geo';

export const COUNTRY_NAMES: Record<string, string> = {
    BY: 'Беларусь',
    PL: 'Польша',
    AM: 'Армения',
    CZ: 'Чехия',
    DE: 'Германия',
    FR: 'Франция',
    GE: 'Грузия',
    HU: 'Венгрия',
    LT: 'Литва',
    NL: 'Нидерланды',
    TR: 'Турция',
    RU: 'Россия',
    UA: 'Украина',
    LV: 'Латвия',
    EE: 'Эстония',
};

// v2: сброс устаревшего авто-сохранённого города (старый код по гео сохранял
// единственный ближайший город, из-за чего по умолчанию был виден лишь 1 город).
export const STORAGE_SELECTED_CITY = 'quests_selected_city_v2';
export const STORAGE_NEARBY_RADIUS = 'quests_nearby_radius_km';
// Компактный набор радиусов для карты квестов (без переноса чипов на мобильном).
export const ALLOWED_NEARBY_RADII_KM = [5, 10, 20, 50] as const;
export type NearbyRadiusKm = (typeof ALLOWED_NEARBY_RADII_KM)[number];
// Дефолт из нового набора. Прежний дефолт 15 больше не допустим; 10 — ближайшее
// меньшее допустимое значение, разумный старт для пешего радиуса «рядом».
export const DEFAULT_NEARBY_RADIUS_KM: NearbyRadiusKm = 10;
export const NEARBY_ID = '__nearby__';

// Нормализуем сохранённый/произвольный радиус к допустимому набору, чтобы
// легаси-значения (15/30) не оставляли невидимый selected state. Ближайшее
// значение, при равенстве — первое встреченное (меньшее). 15 → 10, 30 → 20.
export function normalizeNearbyRadiusKm(value: number | null | undefined): NearbyRadiusKm {
    if (value == null) return DEFAULT_NEARBY_RADIUS_KM;
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_NEARBY_RADIUS_KM;
    let best: NearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM;
    let bestDist = Infinity;
    for (const option of ALLOWED_NEARBY_RADII_KM) {
        const dist = Math.abs(option - numeric);
        if (dist < bestDist) {
            bestDist = dist;
            best = option;
        }
    }
    return best;
}

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

export type MapViewportBounds = {
    south: number;
    west: number;
    north: number;
    east: number;
};

export type QuestMapArea = {
    latitude: number;
    longitude: number;
    bbox?: MapViewportBounds | null;
    zoom?: number;
};

const BOUNDS_EPSILON = 0.000001;

export function isValidMapViewportBounds(bounds: MapViewportBounds | null | undefined): bounds is MapViewportBounds {
    if (!bounds) return false;
    const { south, west, north, east } = bounds;
    return (
        Number.isFinite(south) &&
        Number.isFinite(west) &&
        Number.isFinite(north) &&
        Number.isFinite(east) &&
        south >= -90 &&
        north <= 90 &&
        south <= north &&
        west >= -180 &&
        west <= 180 &&
        east >= -180 &&
        east <= 180
    );
}

export function isCoordinateInMapViewport(
    lat: number,
    lng: number,
    bounds: MapViewportBounds | null | undefined,
): boolean {
    if (!isValidMapViewportBounds(bounds)) return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    const withinLat = lat >= bounds.south - BOUNDS_EPSILON && lat <= bounds.north + BOUNDS_EPSILON;
    if (!withinLat) return false;

    if (bounds.west <= bounds.east) {
        return lng >= bounds.west - BOUNDS_EPSILON && lng <= bounds.east + BOUNDS_EPSILON;
    }

    return lng >= bounds.west - BOUNDS_EPSILON || lng <= bounds.east + BOUNDS_EPSILON;
}

export function filterQuestsByMapSearchArea<T extends { lat: number; lng: number }>(
    quests: T[],
    area: QuestMapArea,
    fallbackRadiusKm: number,
): Array<T & { _distanceKm: number }> {
    const withDistance = quests
        .filter((quest) => Number.isFinite(quest.lat) && Number.isFinite(quest.lng))
        .map((quest) => ({
            ...quest,
            _distanceKm: haversineKm(area.latitude, area.longitude, quest.lat, quest.lng),
        }));

    const filtered = isValidMapViewportBounds(area.bbox)
        ? withDistance.filter((quest) => isCoordinateInMapViewport(quest.lat, quest.lng, area.bbox))
        : withDistance.filter((quest) => quest._distanceKm <= fallbackRadiusKm);

    return filtered.sort((a, b) => a._distanceKm - b._distanceKm);
}
