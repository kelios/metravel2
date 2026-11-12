// utils/questVisitorOrder.ts
// Порядок каталога квестов по месту посетителя (#3228): сначала квесты его
// страны, затем ближайшие. Сигналы — без запроса разрешений и без бэкенда:
// точная позиция, если посетитель уже дал её «Рядом» или карте, иначе часовой
// пояс устройства. Пояс указывает страну и её опорный город (`Europe/Minsk` →
// Беларусь, Минск); локаль для этого не годится — у большинства посетителей
// из Беларуси она `ru-RU`. Без сигнала порядок каталога прежний.

import { haversineKm } from '@/utils/geo';

export type QuestVisitorOrigin = {
    source: 'location' | 'timezone';
    /** Страна посетителя (ISO-2, верхний регистр); у точной позиции не нужна. */
    countryCode: string | null;
    lat: number;
    lng: number;
};

/** Признак порядка выдачи — уходит в аналитику клика по карточке. */
export type QuestCatalogOrderKind =
    | 'default'
    | 'visitor_location'
    | 'visitor_timezone'
    | 'popular'
    | 'rating'
    | 'distance'
    | 'search_similarity';

// Пояс → [страна, широта, долгота опорного города]. Только страны, где у
// каталога есть квесты или откуда к нам приходят (BY, PL, RU, LT, UA — ядро).
const TIME_ZONE_ORIGINS: Record<string, [string, number, number]> = {
    'Europe/Minsk': ['BY', 53.9, 27.56],
    'Europe/Warsaw': ['PL', 52.23, 21.01],
    'Europe/Moscow': ['RU', 55.75, 37.62],
    'Europe/Kaliningrad': ['RU', 54.71, 20.51],
    'Europe/Samara': ['RU', 53.2, 50.15],
    'Europe/Volgograd': ['RU', 48.71, 44.51],
    'Asia/Yekaterinburg': ['RU', 56.84, 60.6],
    'Asia/Novosibirsk': ['RU', 55.03, 82.92],
    'Europe/Vilnius': ['LT', 54.69, 25.28],
    'Europe/Riga': ['LV', 56.95, 24.11],
    'Europe/Tallinn': ['EE', 59.44, 24.75],
    'Europe/Kyiv': ['UA', 50.45, 30.52],
    'Europe/Kiev': ['UA', 50.45, 30.52],
    'Europe/Chisinau': ['MD', 47.01, 28.86],
    'Europe/Berlin': ['DE', 52.52, 13.4],
    'Europe/Prague': ['CZ', 50.08, 14.44],
    'Europe/Bratislava': ['SK', 48.15, 17.11],
    'Europe/Vienna': ['AT', 48.21, 16.37],
    'Europe/Budapest': ['HU', 47.5, 19.04],
    'Europe/Zurich': ['CH', 47.38, 8.54],
    'Europe/Rome': ['IT', 41.9, 12.5],
    'Europe/Madrid': ['ES', 40.42, -3.7],
    'Europe/Lisbon': ['PT', 38.72, -9.14],
    'Europe/Paris': ['FR', 48.86, 2.35],
    'Europe/Brussels': ['BE', 50.85, 4.35],
    'Europe/Amsterdam': ['NL', 52.37, 4.9],
    'Europe/Luxembourg': ['LU', 49.61, 6.13],
    'Europe/London': ['GB', 51.51, -0.13],
    'Europe/Copenhagen': ['DK', 55.68, 12.57],
    'Europe/Stockholm': ['SE', 59.33, 18.07],
    'Europe/Oslo': ['NO', 59.91, 10.75],
    'Europe/Helsinki': ['FI', 60.17, 24.94],
    'Europe/Zagreb': ['HR', 45.81, 15.98],
    'Europe/Belgrade': ['RS', 44.79, 20.45],
    'Europe/Podgorica': ['ME', 42.44, 19.26],
    'Europe/Sarajevo': ['BA', 43.86, 18.41],
    'Europe/Tirane': ['AL', 41.33, 19.82],
    'Europe/Athens': ['GR', 37.98, 23.73],
    'Europe/Sofia': ['BG', 42.7, 23.32],
    'Europe/Bucharest': ['RO', 44.43, 26.1],
    'Europe/Istanbul': ['TR', 41.01, 28.98],
    'Asia/Nicosia': ['CY', 35.17, 33.36],
    'Europe/Nicosia': ['CY', 35.17, 33.36],
    'Asia/Tbilisi': ['GE', 41.72, 44.79],
    'Asia/Yerevan': ['AM', 40.18, 44.51],
    'Asia/Baku': ['AZ', 40.41, 49.87],
    'Asia/Almaty': ['KZ', 43.24, 76.89],
    'Asia/Tashkent': ['UZ', 41.3, 69.24],
    'Asia/Jerusalem': ['IL', 31.77, 35.21],
    'Asia/Dubai': ['AE', 25.2, 55.27],
    'Africa/Cairo': ['EG', 30.04, 31.24],
};

export function resolveTimeZoneOrigin(timeZone: string | null | undefined): QuestVisitorOrigin | null {
    const entry = timeZone ? TIME_ZONE_ORIGINS[timeZone] : undefined;
    if (!entry) return null;
    const [countryCode, lat, lng] = entry;
    return { source: 'timezone', countryCode, lat, lng };
}

/** Часовой пояс устройства (IANA); движок без `Intl` его не знает. */
export function readDeviceTimeZone(): string | null {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return null;
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}

export function resolveQuestVisitorOrigin(
    location: { lat: number; lng: number } | null,
    timeZone: string | null,
): QuestVisitorOrigin | null {
    if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
        return { source: 'location', countryCode: null, lat: location.lat, lng: location.lng };
    }
    return resolveTimeZoneOrigin(timeZone);
}

// Две бесконечности (оба квеста без координат) равны: `Infinity - Infinity`
// дал бы NaN и нестабильный порядок.
const compareDistance = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);

type OrderableQuest = { countryCode?: string; lat: number; lng: number };

/**
 * Страна посетителя первой, внутри каждой части — по расстоянию от посетителя.
 * Квест без координат идёт в конец своей части; при равенстве сохраняется
 * порядок каталога (сортировка стабильна).
 */
export function sortQuestsByVisitorOrigin<T extends OrderableQuest>(quests: T[], origin: QuestVisitorOrigin): T[] {
    const keyed = quests.map((quest) => ({
        quest,
        foreign: origin.countryCode && quest.countryCode !== origin.countryCode ? 1 : 0,
        distance: Number.isFinite(quest.lat) && Number.isFinite(quest.lng)
            ? haversineKm(origin.lat, origin.lng, quest.lat, quest.lng)
            : Number.POSITIVE_INFINITY,
    }));
    keyed.sort((a, b) => a.foreign - b.foreign || compareDistance(a.distance, b.distance));
    return keyed.map(({ quest }) => quest);
}
