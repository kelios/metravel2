// src/screens/tabs/QuestsScreen.helpers.ts

import { haversineKm } from '@/utils/geo';
import { isBikeQuest, isQuestForChildrenOrTeens } from '@/utils/questAudience';
import { buildCanonicalQuestCityIndex } from '@/utils/questCityCanonical';
import { translate as i18nT, type TranslationKey } from '@/i18n';

// Русские названия стран для заголовков групп в каталоге квестов. Ключи —
// ISO alpha-2 коды из поля `country_code` ответа `/quests/`. Держи в синхроне:
// у каждого кода, который может прийти с бэкенда, должно быть имя, иначе
// заголовок группы падает на сырой код («GR», «HR»). Добавляешь квест в новой
// стране — добавь сюда её код.
//
// #1393: раньше здесь стояла ссылка на `utils/geoCountry.ts`
// (`getCountryCodeByCoords`), и тест сторожил именно его таблицу. Координатный
// фолбэк из адаптера квестов убран, `geoCountry` остался только у партнёрских
// блоков, так что источником кодов он больше не является.
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
    LU: 'quests:screens.tabs.QuestsScreen.country.LU',
    FI: 'quests:screens.tabs.QuestsScreen.country.FI',
    SE: 'quests:screens.tabs.QuestsScreen.country.SE',
    NO: 'quests:screens.tabs.QuestsScreen.country.NO',
    DK: 'quests:screens.tabs.QuestsScreen.country.DK',
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
    KG: 'quests:screens.tabs.QuestsScreen.country.KG',
    TH: 'quests:screens.tabs.QuestsScreen.country.TH',
    VN: 'quests:screens.tabs.QuestsScreen.country.VN',
    JP: 'quests:screens.tabs.QuestsScreen.country.JP',
    KR: 'quests:screens.tabs.QuestsScreen.country.KR',
    MN: 'quests:screens.tabs.QuestsScreen.country.MN',
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
// селектора и окружности радиуса на карте. 10 км резали город пополам (из
// Кракова было видно 6 квестов из 9 городских), поэтому берём радиус
// агломерации + ближней вылазки на день.
export const DEFAULT_NEARBY_RADIUS_KM = 30;
export const ALL_QUESTS_ID = '__all__';
export const NEARBY_ID = '__nearby__';
export const KIDS_FILTER_ID = '__kids__';

/**
 * «Рядом» требует свежей геолокации и поэтому не восстанавливается между
 * сессиями. Старое значение `__nearby__` могло означать как настоящий
 * геофильтр, так и прежний «мягкий» дефолт всего каталога, поэтому безопасно
 * мигрируем его в явное состояние «Все квесты».
 */
export function resolveStoredQuestCatalogSelection(savedId: string | null): string {
    if (!savedId || savedId === NEARBY_ID) return ALL_QUESTS_ID;
    return savedId;
}

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

export type QuestCatalogCity = {
    id: string;
    name: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
};

type QuestCatalogQuest = {
    cityId?: string | null;
    cityName?: string | null;
    countryCode?: string | null;
    lat?: number | null;
    lng?: number | null;
};

/**
 * \u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u0433\u043e\u0440\u043e\u0434\u043e\u0432 \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f \u0438\u0437 \u0443\u0436\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043d\u043e\u0433\u043e \u0441\u043f\u0438\u0441\u043a\u0430 \u043a\u0432\u0435\u0441\u0442\u043e\u0432 (#1241): \u043c\u0435\u0442\u0430
 * \u043a\u0430\u0436\u0434\u043e\u0433\u043e \u043a\u0432\u0435\u0441\u0442\u0430 \u043d\u0435\u0441\u0451\u0442 city_id/city_name/country_code \u0438 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b \u0441\u0442\u0430\u0440\u0442\u0430, \u0430
 * \u0433\u043e\u0440\u043e\u0434\u0430 \u0431\u0435\u0437 \u043a\u0432\u0435\u0441\u0442\u043e\u0432 \u044d\u043a\u0440\u0430\u043d \u0432\u0441\u0451 \u0440\u0430\u0432\u043d\u043e \u0441\u043a\u0440\u044b\u0432\u0430\u043b \u2014 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0437\u0430\u043f\u0440\u043e\u0441
 * `/quests/cities/` \u043d\u0438\u0447\u0435\u0433\u043e \u043a \u0432\u044b\u0434\u0430\u0447\u0435 \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u043b.
 *
 * \u0414\u0443\u0431\u043b\u0438 \u0433\u043e\u0440\u043e\u0434\u0430 (\u043e\u0434\u043d\u043e \u0438 \u0442\u043e \u0436\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u043e\u0434 \u0440\u0430\u0437\u043d\u044b\u043c\u0438 id \u0431\u044d\u043a\u0435\u043d\u0434\u0430, \u043d\u0430\u043f\u0440. \u00ab\u0413\u043e\u043c\u0435\u043b\u044c\u00bb
 * 92 \u0438 19) \u0441\u043a\u043b\u0435\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0432 \u043a\u0430\u043d\u043e\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0439 id, \u0447\u0442\u043e\u0431\u044b \u0432 \u0441\u043f\u0438\u0441\u043a\u0435 \u043d\u0435 \u0431\u044b\u043b\u043e \u0434\u0432\u0443\u0445 \u0447\u0438\u043f\u043e\u0432
 * \u043e\u0434\u043d\u043e\u0433\u043e \u0433\u043e\u0440\u043e\u0434\u0430. \u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430 \u0433\u043e\u0440\u043e\u0434\u0430 \u2014 \u0446\u0435\u043d\u0442\u0440\u043e\u0438\u0434 \u0441\u0442\u0430\u0440\u0442\u043e\u0432 \u0435\u0433\u043e \u043a\u0432\u0435\u0441\u0442\u043e\u0432: \u043a\u0430\u0440\u0442\u0430
 * \u0446\u0435\u043d\u0442\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u043f\u043e \u0442\u043e\u043c\u0443, \u0447\u0442\u043e \u0440\u0435\u0430\u043b\u044c\u043d\u043e \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u043e, \u0430 \u043d\u0435 \u043f\u043e \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u0438\u0432\u043d\u043e\u043c\u0443 \u0446\u0435\u043d\u0442\u0440\u0443.
 */
export function buildQuestCityCatalog<TQuest extends QuestCatalogQuest>(quests: TQuest[]): {
    cities: QuestCatalogCity[];
    questsByCityId: Record<string, TQuest[]>;
    canonicalCityIdById: Record<string, string>;
} {
    const { canonicalCityIdById, questsByCityId } = buildCanonicalQuestCityIndex(quests);
    const cities: QuestCatalogCity[] = [];
    const cityByCanonicalId = new Map<string, QuestCatalogCity>();
    const coordSumByCanonicalId = new Map<string, { lat: number; lng: number; count: number }>();

    for (const quest of quests) {
        if (!quest.cityId) continue;
        const cityId = quest.cityId;
        const name = (quest.cityName || '').trim();
        const countryCode = (quest.countryCode || '').trim().toUpperCase();

        const canonicalId = canonicalCityIdById[cityId] || cityId;

        const city = cityByCanonicalId.get(canonicalId);
        if (!city) {
            const created: QuestCatalogCity = { id: canonicalId, name, countryCode: countryCode || undefined };
            cityByCanonicalId.set(canonicalId, created);
            cities.push(created);
        } else {
            // \u041f\u0435\u0440\u0432\u044b\u0439 \u043d\u0435\u043f\u0443\u0441\u0442\u043e\u0439 \u0430\u0442\u0440\u0438\u0431\u0443\u0442 \u0432\u044b\u0438\u0433\u0440\u044b\u0432\u0430\u0435\u0442: \u0447\u0430\u0441\u0442\u044c \u043a\u0432\u0435\u0441\u0442\u043e\u0432 \u043c\u043e\u0436\u0435\u0442 \u043f\u0440\u0438\u0439\u0442\u0438 \u0431\u0435\u0437
            // \u0438\u043c\u0435\u043d\u0438 \u0433\u043e\u0440\u043e\u0434\u0430 \u0438\u043b\u0438 \u043a\u043e\u0434\u0430 \u0441\u0442\u0440\u0430\u043d\u044b, \u0438 \u0447\u0438\u043f \u043d\u0435 \u0434\u043e\u043b\u0436\u0435\u043d \u0438\u0437-\u0437\u0430 \u044d\u0442\u043e\u0433\u043e \u043e\u043f\u0443\u0441\u0442\u0435\u0442\u044c.
            if (!city.name && name) city.name = name;
            if (!city.countryCode && countryCode) city.countryCode = countryCode;
        }

        // `Number(null)` — это 0, поэтому квест без координат нельзя пускать в
        // сумму: он утащил бы центр города в Гвинейский залив.
        const lat = quest.lat == null ? NaN : Number(quest.lat);
        const lng = quest.lng == null ? NaN : Number(quest.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const sum = coordSumByCanonicalId.get(canonicalId) || { lat: 0, lng: 0, count: 0 };
            sum.lat += lat;
            sum.lng += lng;
            sum.count += 1;
            coordSumByCanonicalId.set(canonicalId, sum);
        }
    }

    for (const city of cities) {
        const sum = coordSumByCanonicalId.get(city.id);
        if (!sum) continue;
        city.lat = sum.lat / sum.count;
        city.lng = sum.lng / sum.count;
    }

    return { cities, questsByCityId, canonicalCityIdById };
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

export function filterNearbyQuests<T extends { lat: number; lng: number }>(
    quests: T[],
    userLocation: { lat: number; lng: number } | null,
    radiusKm: number,
): Array<T & { _distanceKm: number }> {
    if (
        !userLocation
        || !Number.isFinite(userLocation.lat)
        || !Number.isFinite(userLocation.lng)
        || !Number.isFinite(radiusKm)
        || radiusKm < 0
    ) {
        return [];
    }

    return quests
        .filter((quest) => Number.isFinite(quest.lat) && Number.isFinite(quest.lng))
        .map((quest) => ({
            ...quest,
            _distanceKm: haversineKm(userLocation.lat, userLocation.lng, quest.lat, quest.lng),
        }))
        .filter((quest) => quest._distanceKm <= radiusKm)
        .sort((a, b) => a._distanceKm - b._distanceKm);
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
