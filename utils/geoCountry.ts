// utils/geoCountry.ts
// Определение кода страны по координатам через bounding boxes.
// Используется когда бэкенд не возвращает country_code.

type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };
type CountryEntry = { code: string; bbox: BBox };

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
    { code: 'FR', bbox: { minLat: 41.34, maxLat: 51.09, minLng: -5.14, maxLng: 9.56  } },
    { code: 'IT', bbox: { minLat: 35.49, maxLat: 47.09, minLng: 6.63,  maxLng: 18.52 } },
    { code: 'ES', bbox: { minLat: 27.64, maxLat: 43.79, minLng: -18.17,maxLng: 4.33  } },
    { code: 'CZ', bbox: { minLat: 48.55, maxLat: 51.06, minLng: 12.09, maxLng: 18.86 } },
    { code: 'SK', bbox: { minLat: 47.73, maxLat: 49.61, minLng: 16.83, maxLng: 22.57 } },
    { code: 'HU', bbox: { minLat: 45.74, maxLat: 48.59, minLng: 16.11, maxLng: 22.90 } },
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
    { code: 'HR', bbox: { minLat: 42.39, maxLat: 46.55, minLng: 13.49, maxLng: 19.45 } },
    { code: 'SI', bbox: { minLat: 45.42, maxLat: 46.88, minLng: 13.38, maxLng: 16.61 } },
    { code: 'BA', bbox: { minLat: 42.56, maxLat: 45.28, minLng: 15.74, maxLng: 19.62 } },
    { code: 'MK', bbox: { minLat: 40.85, maxLat: 42.36, minLng: 20.45, maxLng: 23.04 } },
    { code: 'AL', bbox: { minLat: 39.64, maxLat: 42.66, minLng: 19.27, maxLng: 21.07 } },
    { code: 'BG', bbox: { minLat: 41.23, maxLat: 44.22, minLng: 22.36, maxLng: 28.61 } },
    { code: 'IL', bbox: { minLat: 29.50, maxLat: 33.34, minLng: 34.27, maxLng: 35.90 } },
    { code: 'JO', bbox: { minLat: 29.19, maxLat: 33.37, minLng: 34.96, maxLng: 39.30 } },
    { code: 'LB', bbox: { minLat: 33.05, maxLat: 34.69, minLng: 35.10, maxLng: 36.62 } },
    { code: 'IR', bbox: { minLat: 25.06, maxLat: 39.78, minLng: 44.03, maxLng: 63.33 } },
    { code: 'KZ', bbox: { minLat: 40.57, maxLat: 55.44, minLng: 50.27, maxLng: 87.36 } },
    { code: 'UZ', bbox: { minLat: 37.18, maxLat: 45.59, minLng: 55.99, maxLng: 73.15 } },
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

/**
 * Возвращает ISO 3166-1 alpha-2 код страны по координатам.
 * Использует bounding boxes — достаточно точно для определения страны квеста.
 * Возвращает undefined если страна не определена.
 */
export function getCountryCodeByCoords(lat: number, lng: number): string | undefined {
    for (const { code, bbox } of COUNTRIES) {
        if (
            lat >= bbox.minLat && lat <= bbox.maxLat &&
            lng >= bbox.minLng && lng <= bbox.maxLng
        ) {
            return code;
        }
    }
    return undefined;
}
