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
            RU: [41.1, 82.0, -180, 180],
        };

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
