// src/screens/tabs/QuestsScreen.helpers.ts

import { haversineKm } from '@/utils/geo';

// Русские названия стран для заголовков групп в каталоге квестов. Ключи —
// ISO alpha-2 коды из utils/geoCountry.ts (getCountryCodeByCoords). Держи в
// синхроне: у каждого кода, который может вернуть geoCountry, должно быть имя,
// иначе заголовок группы падает на сырой код («GR», «HR»). Добавляешь квест в
// новой стране — добавь сюда её код.
export const COUNTRY_NAMES: Record<string, string> = {
    BY: 'Беларусь',
    PL: 'Польша',
    UA: 'Украина',
    RU: 'Россия',
    AM: 'Армения',
    GE: 'Грузия',
    AZ: 'Азербайджан',
    TR: 'Турция',
    DE: 'Германия',
    FR: 'Франция',
    IT: 'Италия',
    ES: 'Испания',
    CZ: 'Чехия',
    SK: 'Словакия',
    HU: 'Венгрия',
    RO: 'Румыния',
    LT: 'Литва',
    LV: 'Латвия',
    EE: 'Эстония',
    MD: 'Молдова',
    AT: 'Австрия',
    CH: 'Швейцария',
    NL: 'Нидерланды',
    BE: 'Бельгия',
    PT: 'Португалия',
    GR: 'Греция',
    CY: 'Кипр',
    RS: 'Сербия',
    HR: 'Хорватия',
    SI: 'Словения',
    BA: 'Босния и Герцеговина',
    MK: 'Северная Македония',
    AL: 'Албания',
    BG: 'Болгария',
    IL: 'Израиль',
    JO: 'Иордания',
    LB: 'Ливан',
    IR: 'Иран',
    KZ: 'Казахстан',
    UZ: 'Узбекистан',
    TH: 'Таиланд',
    VN: 'Вьетнам',
    JP: 'Япония',
    CN: 'Китай',
    IN: 'Индия',
    US: 'США',
    CA: 'Канада',
    BR: 'Бразилия',
    AU: 'Австралия',
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

// Тег детских/семейных квестов в meta.tags (adaptMeta → string[]). Держим в
// одном месте: бейдж «Для детей» на карточке и синонимы для русского поиска
// («детский»/«семейный») опираются на него.
export const KIDS_QUEST_TAG = 'kids';

export function isKidsQuest(tags?: string[] | null): boolean {
    if (!tags || !tags.length) return false;
    return tags.some((tag) => typeof tag === 'string' && tag.trim().toLowerCase() === KIDS_QUEST_TAG);
}

export function filterKidsQuests<T extends { tags?: string[] | null }>(quests: T[]): T[] {
    return quests.filter((quest) => isKidsQuest(quest.tags));
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
            .toLocaleLowerCase('ru')
            .replace(/ё/g, 'е')
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
