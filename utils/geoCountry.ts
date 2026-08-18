// utils/geoCountry.ts
// Определение кода страны по координатам.
// Используется когда бэкенд не возвращает country_code.
//
// Резолв идёт четырьмя ступенями:
//   1. Точные контуры стран, которым прямоугольника не хватает: одни
//      перехватывались соседями (Кавказ, Прибалтика, Молдова, Средняя Азия,
//      RU/BY/UA), другие неразрешимо переплетены с соседом и рамкой не
//      описываются вовсе (Скандинавия, Дания, Киргизия, Монголия, Южная Корея,
//      Франция со Швейцарией и Италией). Разбор причин — в шапке
//      geoCountryOutlines.ts.
//   2. Ближайший контур в пределах COASTAL_TOLERANCE_DEG. Набережные, порты,
//      пирсы и намывы регулярно оказываются мористее береговой линии датасета:
//      батумские «Танцующие фонтаны» лежат в 1,5 км снаружи контура Грузии.
//   3. Прямоугольники остальных стран — там перекрытий, ломающих резолв, нет.
//
// Известное ограничение: контуры соседей упрощены независимо, поэтому у самой
// границы они не комплементарны. Нарва (в 500 м от реки Нарвы) попадает в контур
// России — как и до этой задачи, когда её забирал прямоугольник России.
// Раньше ступень была одна, и большой прямоугольник России (41.19–81.86 N,
// 19.64–180 E) забирал Тбилиси, Ригу, Таллин и Алматы, а прямоугольники Беларуси
// и Украины — Вильнюс и Кишинёв. Перестановками это не лечится: опустить Россию
// ниже соседей значит отдать Новосибирск Казахстану, а Эльбрус — Грузии.

import { COUNTRY_OUTLINES, OUTLINE_ORDER } from './geoCountryOutlines';

type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };
type CountryEntry = { code: string; bbox: BBox };
/** Кольцо контура вместе со своим bbox: он отсекает точку до перебора вершин. */
type Ring = { points: readonly (readonly [number, number])[]; bbox: BBox };

// Упорядочены от меньших/специфичных к большим для точности перекрытий
const COUNTRIES: CountryEntry[] = [
    { code: 'BY', bbox: { minLat: 51.26, maxLat: 56.17, minLng: 23.18, maxLng: 32.78 } },
    { code: 'PL', bbox: { minLat: 49.00, maxLat: 54.84, minLng: 14.12, maxLng: 24.15 } },
    { code: 'UA', bbox: { minLat: 44.39, maxLat: 52.38, minLng: 22.14, maxLng: 40.23 } },
    { code: 'RU', bbox: { minLat: 41.19, maxLat: 81.86, minLng: 19.64, maxLng: 180.0 } },
    { code: 'AM', bbox: { minLat: 38.84, maxLat: 41.30, minLng: 43.45, maxLng: 46.63 } },
    { code: 'GE', bbox: { minLat: 41.05, maxLat: 43.59, minLng: 39.99, maxLng: 46.72 } },
    { code: 'AZ', bbox: { minLat: 38.39, maxLat: 41.91, minLng: 44.77, maxLng: 50.37 } },
    { code: 'TR', bbox: { minLat: 35.82, maxLat: 42.11, minLng: 25.67, maxLng: 44.82 } },
    { code: 'DE', bbox: { minLat: 47.27, maxLat: 55.06, minLng: 5.87,  maxLng: 15.04 } },
    // FR разбита на материк и Корсику: единый прямоугольник тянулся до lng 9.56
    // только ради острова, а материковая Франция кончается на 8.23. Сегодня обе
    // рамки нерабочие — у FR есть контур, а PLAIN_BOXES отбрасывает страны с
    // контуром, — но лежат они здесь по той же причине, что и рамки BY, PL, UA:
    // на случай, если контур когда-нибудь уберут, данные должны быть верными.
    { code: 'FR', bbox: { minLat: 42.33, maxLat: 51.09, minLng: -5.14, maxLng: 8.25  } },
    { code: 'FR', bbox: { minLat: 41.33, maxLat: 43.03, minLng: 8.53,  maxLng: 9.57  } },
    { code: 'ES', bbox: { minLat: 27.64, maxLat: 43.79, minLng: -18.17,maxLng: 4.33  } },
    { code: 'SK', bbox: { minLat: 47.73, maxLat: 49.61, minLng: 16.83, maxLng: 22.57 } },
    { code: 'HU', bbox: { minLat: 45.74, maxLat: 48.59, minLng: 16.11, maxLng: 22.90 } },
    { code: 'CZ', bbox: { minLat: 48.55, maxLat: 51.06, minLng: 12.09, maxLng: 18.86 } },
    { code: 'RO', bbox: { minLat: 43.62, maxLat: 48.27, minLng: 20.26, maxLng: 29.76 } },
    { code: 'LT', bbox: { minLat: 53.90, maxLat: 56.45, minLng: 20.93, maxLng: 26.84 } },
    { code: 'LV', bbox: { minLat: 55.67, maxLat: 57.97, minLng: 20.97, maxLng: 28.24 } },
    { code: 'EE', bbox: { minLat: 57.52, maxLat: 59.68, minLng: 21.76, maxLng: 28.21 } },
    { code: 'MD', bbox: { minLat: 45.47, maxLat: 48.49, minLng: 26.62, maxLng: 30.14 } },
    { code: 'AT', bbox: { minLat: 46.37, maxLat: 49.02, minLng: 9.53,  maxLng: 17.16 } },
    { code: 'CH', bbox: { minLat: 45.82, maxLat: 47.81, minLng: 5.96,  maxLng: 10.49 } },
    { code: 'NL', bbox: { minLat: 50.75, maxLat: 53.56, minLng: 3.36,  maxLng: 7.23  } },
    { code: 'BE', bbox: { minLat: 49.50, maxLat: 51.51, minLng: 2.54,  maxLng: 6.41  } },
    { code: 'PT', bbox: { minLat: 36.96, maxLat: 42.15, minLng: -9.52, maxLng: -6.19 } },
    { code: 'GR', bbox: { minLat: 34.80, maxLat: 41.75, minLng: 19.37, maxLng: 29.65 } },
    { code: 'RS', bbox: { minLat: 42.23, maxLat: 46.19, minLng: 18.82, maxLng: 23.01 } },
    // BA перед HR: Хорватия дугой охватывает Боснию, их bbox сильно
    // перекрываются (Сараево 18.41 попадает в оба). Босния — «внутренняя»,
    // поэтому проверяется первой, иначе город с пустым country_code утечёт в HR.
    { code: 'BA', bbox: { minLat: 42.56, maxLat: 45.28, minLng: 15.74, maxLng: 19.62 } },
    { code: 'HR', bbox: { minLat: 42.39, maxLat: 46.55, minLng: 13.49, maxLng: 19.45 } },
    { code: 'SI', bbox: { minLat: 45.42, maxLat: 46.88, minLng: 13.38, maxLng: 16.61 } },
    // IT ниже балканских/альпийских соседей: его широкий bbox (до lng 18.52)
    // перекрывает Сараево/Загреб/Любляну/Женеву, поэтому специфичные страны
    // (CH, AT, SI, HR, BA) должны матчиться раньше, иначе их города утекают в IT.
    { code: 'IT', bbox: { minLat: 35.49, maxLat: 47.09, minLng: 6.63,  maxLng: 18.52 } },
    { code: 'MK', bbox: { minLat: 40.85, maxLat: 42.36, minLng: 20.45, maxLng: 23.04 } },
    { code: 'AL', bbox: { minLat: 39.64, maxLat: 42.66, minLng: 19.27, maxLng: 21.07 } },
    { code: 'BG', bbox: { minLat: 41.23, maxLat: 44.22, minLng: 22.36, maxLng: 28.61 } },
    { code: 'IL', bbox: { minLat: 29.50, maxLat: 33.34, minLng: 34.27, maxLng: 35.90 } },
    { code: 'JO', bbox: { minLat: 29.19, maxLat: 33.37, minLng: 34.96, maxLng: 39.30 } },
    { code: 'LB', bbox: { minLat: 33.05, maxLat: 34.69, minLng: 35.10, maxLng: 36.62 } },
    { code: 'IR', bbox: { minLat: 25.06, maxLat: 39.78, minLng: 44.03, maxLng: 63.33 } },
    { code: 'UZ', bbox: { minLat: 37.18, maxLat: 45.59, minLng: 55.99, maxLng: 73.15 } },
    { code: 'KZ', bbox: { minLat: 40.57, maxLat: 55.44, minLng: 50.27, maxLng: 87.36 } },
    { code: 'TH', bbox: { minLat: 5.61,  maxLat: 20.46, minLng: 97.34, maxLng: 105.64} },
    { code: 'VN', bbox: { minLat: 8.56,  maxLat: 23.39, minLng: 102.14,maxLng: 109.46} },
    { code: 'JP', bbox: { minLat: 24.25,  maxLat: 45.52, minLng: 122.93,maxLng: 153.99} },
    { code: 'CN', bbox: { minLat: 18.16, maxLat: 53.56, minLng: 73.50, maxLng: 134.77} },
    { code: 'IN', bbox: { minLat: 8.07,  maxLat: 37.10, minLng: 68.11, maxLng: 97.40 } },
    { code: 'US', bbox: { minLat: 24.52, maxLat: 49.38, minLng: -124.77,maxLng: -66.95} },
    { code: 'CA', bbox: { minLat: 41.68, maxLat: 83.11, minLng: -141.0, maxLng: -52.62} },
    { code: 'BR', bbox: { minLat: -33.75,maxLat: 5.27,  minLng: -73.99, maxLng: -28.85} },
    { code: 'AU', bbox: { minLat: -43.64,maxLat: -10.67,minLng: 113.34, maxLng: 153.57} },
];

const OUTLINE_CODES = new Set(OUTLINE_ORDER);

/**
 * Порядок ступени 4. Сама ступень выбирает страну по ближайшему контуру, так что
 * порядок решает только точные ничьи; Россия сдвинута в конец, потому что при
 * равном расстоянии сосед с компактной геометрией — более вероятный ответ, чем
 * страна, кольцо которой тянется от Балтики до Чукотки.
 */
const OUTLINE_FALLBACK_ORDER = [...OUTLINE_ORDER].sort((a, b) =>
    a === 'RU' ? 1 : b === 'RU' ? -1 : 0,
);

/** Прямоугольники стран без контура — ступень 3. */
const PLAIN_BOXES = COUNTRIES.filter((entry) => !OUTLINE_CODES.has(entry.code));

let decodedOutlines: Record<string, Ring[]> | null = null;

/** Разворачивает дельта-строки контуров в кольца [lng, lat]. Считается один раз. */
function getOutlines(): Record<string, Ring[]> {
    if (decodedOutlines) return decodedOutlines;

    const decoded: Record<string, Ring[]> = {};
    for (const code of OUTLINE_ORDER) {
        const encodedRings = COUNTRY_OUTLINES[code];
        if (!encodedRings) continue;
        decoded[code] = encodedRings.map((encoded) => {
            const deltas = encoded.split(',');
            const points: [number, number][] = [];
            const bbox: BBox = {
                minLat: Infinity,
                maxLat: -Infinity,
                minLng: Infinity,
                maxLng: -Infinity,
            };
            let lng = 0;
            let lat = 0;
            for (let i = 0; i < deltas.length - 1; i += 2) {
                lng += Number(deltas[i]);
                lat += Number(deltas[i + 1]);
                const pointLng = lng / 100;
                const pointLat = lat / 100;
                points.push([pointLng, pointLat]);
                if (pointLat < bbox.minLat) bbox.minLat = pointLat;
                if (pointLat > bbox.maxLat) bbox.maxLat = pointLat;
                if (pointLng < bbox.minLng) bbox.minLng = pointLng;
                if (pointLng > bbox.maxLng) bbox.maxLng = pointLng;
            }
            return { points, bbox };
        });
    }

    decodedOutlines = decoded;
    return decoded;
}

/** Ray casting: чётное число пересечений — точка снаружи кольца. */
function isInsideRing(lat: number, lng: number, ring: Ring): boolean {
    if (!isInsideBBox(lat, lng, ring.bbox)) return false;

    const { points } = ring;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [lngI, latI] = points[i];
        const [lngJ, latJ] = points[j];
        if (
            latI > lat !== latJ > lat &&
            lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
        ) {
            inside = !inside;
        }
    }
    return inside;
}

function isInsideBBox(lat: number, lng: number, bbox: BBox, pad = 0): boolean {
    return (
        lat >= bbox.minLat - pad &&
        lat <= bbox.maxLat + pad &&
        lng >= bbox.minLng - pad &&
        lng <= bbox.maxLng + pad
    );
}

/**
 * Насколько далеко от контура точку ещё считаем «своей».
 * Допуск применяется ко всему периметру, включая сухопутные границы, поэтому
 * он намеренно узкий: 0.02° (около 2 км) хватает набережным и портовым молам
 * (батумские «Танцующие фонтаны» — 1,5 км), но не отбирает у соседа приграничные
 * города — Медыка в Польше и Нида в Литве остаются за своими странами.
 */
const COASTAL_TOLERANCE_DEG = 0.02;

/**
 * Запас рамки кольца на ступени 4. Рамка обрезана по упрощённому контуру, и коса
 * или мыс могут оказаться сразу за её краем: Нида на Куршской косе лежит в 0.04°
 * западнее рамки Литвы. Ступень грубая по своей природе — она лишь говорит,
 * рядом с геометрией какой страны точка находится.
 */
const RING_BOX_PADDING_DEG = 0.05;

function distanceToSegment(
    lat: number,
    lng: number,
    [lngA, latA]: readonly [number, number],
    [lngB, latB]: readonly [number, number],
): number {
    const dLng = lngB - lngA;
    const dLat = latB - latA;
    const lengthSq = dLng * dLng + dLat * dLat;
    const projection = lengthSq
        ? ((lng - lngA) * dLng + (lat - latA) * dLat) / lengthSq
        : 0;
    const clamped = Math.max(0, Math.min(1, projection));
    return Math.hypot(lng - (lngA + clamped * dLng), lat - (latA + clamped * dLat));
}

/**
 * Расстояние до кольца, но только пока оно может оказаться меньше `limit`:
 * дальше точного значения нам всё равно не нужно, а кольцо России — 1118 вершин.
 */
function distanceToRing(lat: number, lng: number, ring: Ring, limit: number): number {
    if (!isInsideBBox(lat, lng, ring.bbox, limit)) return Infinity;

    const { points } = ring;
    let best = Infinity;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const distance = distanceToSegment(lat, lng, points[j], points[i]);
        if (distance < best) {
            best = distance;
            if (best === 0) break;
        }
    }
    return best;
}

/**
 * Возвращает ISO 3166-1 alpha-2 код страны по координатам.
 * Точность — уровень страны: у самой границы и у уреза воды возможна ошибка
 * в несколько километров, для группировки точек и партнёрских ссылок этого хватает.
 * Возвращает undefined если страна не определена.
 */
export function getCountryCodeByCoords(lat: number, lng: number): string | undefined {
    const outlines = getOutlines();
    for (const code of OUTLINE_ORDER) {
        const rings = outlines[code];
        if (rings?.some((ring) => isInsideRing(lat, lng, ring))) {
            return code;
        }
    }

    let nearestCode: string | undefined;
    let nearestDistance = COASTAL_TOLERANCE_DEG;
    for (const code of OUTLINE_ORDER) {
        for (const ring of outlines[code] ?? []) {
            const distance = distanceToRing(lat, lng, ring, nearestDistance);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestCode = code;
            }
        }
    }
    if (nearestCode) return nearestCode;

    for (const { code, bbox } of PLAIN_BOXES) {
        if (isInsideBBox(lat, lng, bbox)) return code;
    }

    // Ступень 4 — рамки самих колец, а не прямоугольники стран. Прямоугольник
    // России (41.19–81.86 N, 19.64–180 E) накрыл бы Финляндию и Прибалтику, то
    // есть повторил бы дефект, ради которого заведены контуры; рамка кольца
    // ограничена реальной геометрией и лишь добирает точки у воды — порт Певека,
    // лиман Анадыря, Куршскую косу, восточный берег Каспия.
    //
    // Рамка отвечает лишь на вопрос «может ли точка быть рядом с этой страной»,
    // поэтому из всех подошедших берём страну с ближайшим контуром, а не первую
    // по порядку. Порядком это не решается: рамка кольца Норвегии
    // (57.99–71.13 N, 4.93–31.06 E) накрывает Швецию и Финляндию целиком, а
    // рамка Финляндии — Кронштадт и Высоцк. Выбор по порядку отдавал Нюнесхамн
    // Норвегии, до берега которой оттуда 239 км, а до шведского — 2,6 км.
    let fallbackCode: string | undefined;
    let fallbackDistance = Infinity;
    for (const code of OUTLINE_FALLBACK_ORDER) {
        for (const ring of outlines[code] ?? []) {
            if (!isInsideBBox(lat, lng, ring.bbox, RING_BOX_PADDING_DEG)) continue;
            const distance = distanceToRing(lat, lng, ring, fallbackDistance);
            if (distance < fallbackDistance) {
                fallbackDistance = distance;
                fallbackCode = code;
            }
        }
    }

    return fallbackCode;
}
