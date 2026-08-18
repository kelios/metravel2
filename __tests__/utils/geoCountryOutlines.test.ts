import { COUNTRY_OUTLINES, OUTLINE_ORDER } from '@/utils/geoCountryOutlines';

/**
 * Контуры сгенерированы из Natural Earth и правятся только пересборкой. Порча
 * данных (нечисловой токен, нечётное число дельт, потерянное кольцо) не роняет
 * резолвер: он молча отдаёт страну соседу. Эти проверки делают такую порчу видимой.
 */
const decodeRing = (encoded: string) => {
    const deltas = encoded.split(',').map(Number);
    const points: [number, number][] = [];
    let lng = 0;
    let lat = 0;
    for (let i = 0; i < deltas.length - 1; i += 2) {
        lng += deltas[i];
        lat += deltas[i + 1];
        points.push([lng / 100, lat / 100]);
    }
    return { points, deltas };
};

describe('COUNTRY_OUTLINES data integrity', () => {
    it('has an outline for every code in OUTLINE_ORDER and nothing extra', () => {
        expect(Object.keys(COUNTRY_OUTLINES).sort()).toEqual([...OUTLINE_ORDER].sort());
    });

    it.each(OUTLINE_ORDER)('%s: rings decode to finite coordinates on Earth', (code) => {
        const rings = COUNTRY_OUTLINES[code];
        expect(rings.length).toBeGreaterThan(0);

        rings.forEach((encoded, ringIndex) => {
            const { points, deltas } = decodeRing(encoded);
            // Нечётное число токенов означает потерянную координату.
            expect(`${code}#${ringIndex} deltas`).toBe(
                deltas.length % 2 === 0 ? `${code}#${ringIndex} deltas` : 'odd delta count',
            );
            expect(points.length).toBeGreaterThanOrEqual(3);

            points.forEach(([lng, lat]) => {
                expect(Number.isFinite(lng) && Number.isFinite(lat)).toBe(true);
                expect(lat).toBeGreaterThanOrEqual(-90);
                expect(lat).toBeLessThanOrEqual(90);
                expect(lng).toBeGreaterThanOrEqual(-180);
                expect(lng).toBeLessThanOrEqual(180);
            });
        });
    });

    it('keeps every ring inside the plausible extent of its country', () => {
        // Грубые рамки: ловят перепутанные местами страны и съехавшую точку отсчёта,
        // не завися от конкретного допуска упрощения.
        const EXTENTS: Record<string, [number, number, number, number]> = {
            GE: [40.8, 43.8, 39.8, 46.9], AM: [38.7, 41.5, 43.3, 46.8],
            AZ: [38.2, 42.1, 44.6, 50.6], LV: [55.5, 58.2, 20.8, 28.4],
            EE: [57.3, 59.8, 21.6, 28.4], LT: [53.7, 56.6, 20.8, 27.0],
            MD: [45.3, 48.7, 26.5, 30.3], KZ: [40.4, 55.6, 46.3, 87.5],
            BY: [51.1, 56.3, 23.0, 33.0], UA: [44.2, 52.5, 22.0, 40.4],
            PL: [48.9, 55.0, 14.0, 24.2], CZ: [48.5, 51.1, 12.0, 18.9],
            // Контур Финляндии включает Аланды (в Natural Earth это отдельный
            // feature AX), контур Норвегии — Шпицберген вплоть до Квитёйи
            // (33.6 в.д.), контур Кореи — Уллындо и Пэннёндо. Рамки шире
            // материковых именно поэтому.
            FI: [59.7, 70.2, 19.5, 31.7], SE: [55.2, 69.2, 10.9, 24.3],
            NO: [57.9, 80.7, 4.8, 33.8], DK: [54.4, 57.9, 8.0, 15.2],
            KG: [39.1, 43.4, 69.1, 80.4], MN: [41.5, 52.2, 87.6, 120.0],
            KR: [33.1, 38.7, 124.5, 131.0],
            // Контур Франции — только метрополия и Корсика: заморские
            // департаменты лежат в том же feature Natural Earth, но в контур не
            // берутся. Контур Италии включает Сицилию, Сардинию и мелкие острова
            // вплоть до Лампедузы (35.5 с.ш.) и Пантеллерии.
            CH: [45.7, 47.9, 5.8, 10.6], IT: [35.3, 47.2, 6.5, 18.7],
            FR: [41.2, 51.2, -5.3, 9.7],
            RU: [41.1, 82.0, -180, 180],
        };

        // Новая контурная страна без рамки — не «тест прошёл», а незакрытая проверка.
        expect(OUTLINE_ORDER.filter((code) => !EXTENTS[code])).toEqual([]);

        for (const code of OUTLINE_ORDER) {
            const [minLat, maxLat, minLng, maxLng] = EXTENTS[code];
            for (const encoded of COUNTRY_OUTLINES[code]) {
                for (const [lng, lat] of decodeRing(encoded).points) {
                    expect({ code, lat, lng }).toEqual({
                        code,
                        lat: lat >= minLat && lat <= maxLat ? lat : `${lat} outside ${code}`,
                        lng: lng >= minLng && lng <= maxLng ? lng : `${lng} outside ${code}`,
                    });
                }
            }
        }
    });
});
