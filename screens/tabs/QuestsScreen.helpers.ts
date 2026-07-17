// src/screens/tabs/QuestsScreen.helpers.ts

import { haversineKm } from '@/utils/geo';
import { isBikeQuest, isQuestForChildrenOrTeens } from '@/utils/questAudience';
import { translate as i18nT, type TranslationKey } from '@/i18n';

// Русские названия стран для заголовков групп в каталоге квестов. Ключи —
// ISO alpha-2 коды из utils/geoCountry.ts (getCountryCodeByCoords). Держи в
// синхроне: у каждого кода, который может вернуть geoCountry, должно быть имя,
// иначе заголовок группы падает на сырой код («GR», «HR»). Добавляешь квест в
// новой стране — добавь сюда её код.
export const COUNTRY_NAME_KEYS: Record<string, TranslationKey> = {
    BY: 'quests:screens.tabs.QuestsScreen.country.BY',
    PL: 'quests:screens.tabs.QuestsScreen.country.PL',
    UA: 'quests:screens.tabs.QuestsScreen.country.UA',
    RU: 'quests:screens.tabs.QuestsScreen.country.RU',
    AM: 'quests:screens.tabs.QuestsScreen.country.AM',
    GE: 'quests:screens.tabs.QuestsScreen.country.GE',
    AZ: 'quests:screens.tabs.QuestsScreen.country.AZ',
    TR: 'quests:screens.tabs.QuestsScreen.country.TR',
    DE: 'quests:screens.tabs.QuestsScreen.country.DE',
    FR: 'quests:screens.tabs.QuestsScreen.country.FR',
    IT: 'quests:screens.tabs.QuestsScreen.country.IT',
    ES: 'quests:screens.tabs.QuestsScreen.country.ES',
    CZ: 'quests:screens.tabs.QuestsScreen.country.CZ',
    SK: 'quests:screens.tabs.QuestsScreen.country.SK',
    HU: 'quests:screens.tabs.QuestsScreen.country.HU',
    RO: 'quests:screens.tabs.QuestsScreen.country.RO',
    LT: 'quests:screens.tabs.QuestsScreen.country.LT',
    LV: 'quests:screens.tabs.QuestsScreen.country.LV',
    EE: 'quests:screens.tabs.QuestsScreen.country.EE',
    MD: 'quests:screens.tabs.QuestsScreen.country.MD',
    AT: 'quests:screens.tabs.QuestsScreen.country.AT',
    CH: 'quests:screens.tabs.QuestsScreen.country.CH',
    NL: 'quests:screens.tabs.QuestsScreen.country.NL',
    BE: 'quests:screens.tabs.QuestsScreen.country.BE',
    PT: 'quests:screens.tabs.QuestsScreen.country.PT',
    GR: 'quests:screens.tabs.QuestsScreen.country.GR',
    CY: 'quests:screens.tabs.QuestsScreen.country.CY',
    RS: 'quests:screens.tabs.QuestsScreen.country.RS',
    HR: 'quests:screens.tabs.QuestsScreen.country.HR',
    SI: 'quests:screens.tabs.QuestsScreen.country.SI',
    BA: 'quests:screens.tabs.QuestsScreen.country.BA',
    MK: 'quests:screens.tabs.QuestsScreen.country.MK',
    AL: 'quests:screens.tabs.QuestsScreen.country.AL',
    BG: 'quests:screens.tabs.QuestsScreen.country.BG',
    IL: 'quests:screens.tabs.QuestsScreen.country.IL',
    JO: 'quests:screens.tabs.QuestsScreen.country.JO',
    LB: 'quests:screens.tabs.QuestsScreen.country.LB',
    IR: 'quests:screens.tabs.QuestsScreen.country.IR',
    KZ: 'quests:screens.tabs.QuestsScreen.country.KZ',
    UZ: 'quests:screens.tabs.QuestsScreen.country.UZ',
    TH: 'quests:screens.tabs.QuestsScreen.country.TH',
    VN: 'quests:screens.tabs.QuestsScreen.country.VN',
    JP: 'quests:screens.tabs.QuestsScreen.country.JP',
    CN: 'quests:screens.tabs.QuestsScreen.country.CN',
    IN: 'quests:screens.tabs.QuestsScreen.country.IN',
    US: 'quests:screens.tabs.QuestsScreen.country.US',
    CA: 'quests:screens.tabs.QuestsScreen.country.CA',
    BR: 'quests:screens.tabs.QuestsScreen.country.BR',
    AU: 'quests:screens.tabs.QuestsScreen.country.AU',
};

export const getQuestCountryName = (code: string): string => {
    const key = COUNTRY_NAME_KEYS[code];
    return key ? i18nT(key) : code;
};

// v2: сброс устаревшего авто-сохранённого города (старый код по гео сохранял
// единственный ближайший город, из-за чего по умолчанию был виден лишь 1 город).
export const STORAGE_SELECTED_CITY = 'quests_selected_city_v2';
// «Поблизости» остаётся единым продуктовым порогом, без пользовательского
// селектора и окружности радиуса на карте.
export const DEFAULT_NEARBY_RADIUS_KM = 10;
export const NEARBY_ID = '__nearby__';
export const KIDS_FILTER_ID = '__kids__';

let expoLocationModulePromise: Promise<typeof import('expo-location')> | null = null;

export async function loadExpoLocation() {
    if (!expoLocationModulePromise) {
        expoLocationModulePromise = Promise.resolve(import('expo-location'));
    }
    return expoLocationModulePromise;
}

// Тег детских квестов в meta.tags (adaptMeta → string[]). Возрастные теги
// (`age-5-7`, `age-8-10`, `age-11-14`) и `teens` тоже считаем детско-
// подростковой аудиторией для фильтра каталога.
export const KIDS_QUEST_TAG = 'kids';

export function isKidsQuest(tags?: string[] | null): boolean {
    return isQuestForChildrenOrTeens(tags);
}

export function filterKidsQuests<T extends { tags?: string[] | null }>(quests: T[]): T[] {
    return quests.filter((quest) => isKidsQuest(quest.tags));
}

export const BIKE_FILTER_ID = '__bike__';

// Канонический тег велоквестов и предикат живут в utils/questAudience.ts —
// их используют и карточки каталога, и городские лендинги.
export { BIKE_QUEST_TAG } from '@/utils/questAudience';
export { isBikeQuest };

export function filterBikeQuests<T extends { tags?: string[] | null }>(quests: T[]): T[] {
    return quests.filter((quest) => isBikeQuest(quest.tags));
}

export function buildQuestCityCatalog<
    TCity extends { id: string; name: string; countryCode?: string },
    TQuest extends { cityId?: string | null; cityName?: string | null; countryCode?: string | null },
>(cities: TCity[], quests: TQuest[]): {
    cities: TCity[];
    questsByCityId: Record<string, TQuest[]>;
    canonicalCityIdById: Record<string, string>;
} {
    const questByCityId = new Map<string, TQuest>();
    for (const quest of quests) {
        if (quest.cityId && !questByCityId.has(quest.cityId)) {
            questByCityId.set(quest.cityId, quest);
        }
    }

    const canonicalCityIdByGroup = new Map<string, string>();
    const canonicalCityIdById: Record<string, string> = {};
    const mergedCities: TCity[] = [];

    for (const city of cities) {
        const questMeta = questByCityId.get(city.id);
        const normalizedName = (city.name || questMeta?.cityName || '')
            .trim()
            .toLowerCase()
            .replace(/\u0451/g, String.fromCodePoint(0x435))
            .replace(/\s+/g, ' ');
        const countryCode = (city.countryCode || questMeta?.countryCode || '').trim().toUpperCase();
        const groupKey = normalizedName ? `${countryCode}:${normalizedName}` : `id:${city.id}`;
        const canonicalId = canonicalCityIdByGroup.get(groupKey) || city.id;

        canonicalCityIdById[city.id] = canonicalId;
        if (!canonicalCityIdByGroup.has(groupKey)) {
            canonicalCityIdByGroup.set(groupKey, canonicalId);
            mergedCities.push(city);
        }
    }

    const questsByCityId: Record<string, TQuest[]> = {};
    for (const quest of quests) {
        if (!quest.cityId) continue;
        const canonicalId = canonicalCityIdById[quest.cityId] || quest.cityId;
        (questsByCityId[canonicalId] ||= []).push(quest);
    }

    return { cities: mergedCities, questsByCityId, canonicalCityIdById };
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

export type QuestMapCenter = {
    latitude: number;
    longitude: number;
};

type QuestMapCenterCity = {
    lat?: number | null;
    lng?: number | null;
};

const BOUNDS_EPSILON = 0.000001;
const DEFAULT_QUEST_MAP_CENTER: QuestMapCenter = { latitude: 53.9, longitude: 27.56 };

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

export function getAverageQuestMapPointCenter(mapPoints: Pick<MapPoint, 'coord'>[]): QuestMapCenter | null {
    const coords = mapPoints
        .map((point) => {
            const [latStr, lngStr] = point.coord.split(',').map((value) => value.trim());
            return { lat: Number(latStr), lng: Number(lngStr) };
        })
        .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng));

    if (!coords.length) return null;

    const sum = coords.reduce(
        (acc, coord) => ({
            lat: acc.lat + coord.lat,
            lng: acc.lng + coord.lng,
        }),
        { lat: 0, lng: 0 },
    );

    return {
        latitude: sum.lat / coords.length,
        longitude: sum.lng / coords.length,
    };
}

export function resolveQuestMapCenter({
    searchTerm,
    mapPoints,
    activeMapAreaCenter,
    userLoc,
    selectedCity,
}: {
    searchTerm: string;
    mapPoints: Pick<MapPoint, 'coord'>[];
    activeMapAreaCenter: QuestMapArea | null;
    userLoc: { lat: number; lng: number } | null;
    selectedCity: QuestMapCenterCity | null | undefined;
}): QuestMapCenter {
    const averageMapPointCenter = getAverageQuestMapPointCenter(mapPoints);

    if (searchTerm.trim() && averageMapPointCenter) {
        return averageMapPointCenter;
    }

    if (
        activeMapAreaCenter &&
        Number.isFinite(activeMapAreaCenter.latitude) &&
        Number.isFinite(activeMapAreaCenter.longitude)
    ) {
        return {
            latitude: activeMapAreaCenter.latitude,
            longitude: activeMapAreaCenter.longitude,
        };
    }

    // Явный выбор города в меню приоритетнее геолокации: карта должна
    // центрироваться на квестах города, даже если пользователь далеко.
    // «Рядом» города не даёт (его нет в CITIES) — тогда падаем на userLoc ниже.
    if (selectedCity && Number.isFinite(selectedCity.lat) && Number.isFinite(selectedCity.lng)) {
        return { latitude: Number(selectedCity.lat), longitude: Number(selectedCity.lng) };
    }

    if (selectedCity && averageMapPointCenter) {
        return averageMapPointCenter;
    }

    if (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng)) {
        return { latitude: userLoc.lat, longitude: userLoc.lng };
    }

    return averageMapPointCenter ?? DEFAULT_QUEST_MAP_CENTER;
}
