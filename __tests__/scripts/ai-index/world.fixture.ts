/**
 * Фикстура внешнего индекса маршрутов (#3357) — без сети.
 *
 * `REFERENCE_SEGMENTS` — участки четырёх эталонов и Kepler Track, как их собрал конвейер 14.11.2026: высота,
 * ниже которой лежит девять десятых участка (Copernicus DEM GLO-30 вдоль геометрии OSM), и нормы ячейки
 * NASA POWER (температура, °C, и осадки, мм в сутки, по месяцам; высота ячейки, м).
 */
import type { OverpassElement } from '@/scripts/ai-index/world/overpass'
import type { SeasonSegment } from '@/scripts/ai-index/world/season'
import type { RawEntity } from '@/scripts/ai-index/world/wikidata'

// prettier-ignore
export const REFERENCE_SEGMENTS: Record<'tmb' | 'gr20' | 'whw' | 'camino' | 'kepler', SeasonSegment[]> = {
  tmb: [
    { altitude_m: 2051, normals: { elevation_m: 1714, t2m: [-6.66, -6.39, -2.75, 2.65, 6.99, 11.38, 13.07, 12.72, 9.05, 5.15, -0.65, -4.96], precip_mm_day: [3.45, 2.71, 3.04, 2.47, 3.78, 3.51, 3.33, 3.39, 2.54, 2.77, 3.14, 3.56] } },
    { altitude_m: 2350, normals: { elevation_m: 1714, t2m: [-6.66, -6.39, -2.75, 2.65, 6.99, 11.38, 13.07, 12.72, 9.05, 5.15, -0.65, -4.96], precip_mm_day: [3.45, 2.71, 3.04, 2.47, 3.78, 3.51, 3.33, 3.39, 2.54, 2.77, 3.14, 3.56] } },
    { altitude_m: 2317, normals: { elevation_m: 2008, t2m: [-8.29, -8.01, -4.21, 1.12, 5.72, 10.45, 12.24, 11.83, 8, 3.85, -2.1, -6.75], precip_mm_day: [2.36, 2.02, 2.27, 2.29, 3.31, 2.95, 2.54, 2.5, 2.17, 2.29, 2.93, 2.56] } },
  ],
  gr20: [
    { altitude_m: 2011, normals: { elevation_m: 449, t2m: [7.8, 7.56, 9.63, 12.49, 16.18, 20.73, 23.63, 23.79, 20.13, 16.66, 12.34, 9.04], precip_mm_day: [1.75, 1.95, 1.85, 1.5, 1.46, 0.74, 0.32, 0.49, 1.5, 2.51, 3.09, 2.11] } },
    { altitude_m: 2047, normals: { elevation_m: 298, t2m: [8.66, 8.51, 10.63, 13.54, 17.24, 21.87, 24.86, 25.17, 21.41, 17.77, 13.34, 9.97], precip_mm_day: [3.24, 3.21, 2.66, 2.09, 1.93, 0.79, 0.33, 0.52, 1.89, 3.35, 4.25, 3.2] } },
    { altitude_m: 1855, normals: { elevation_m: 493, t2m: [7.27, 7.19, 9.39, 12.37, 16.3, 21.4, 24.77, 24.9, 20.26, 16.31, 11.81, 8.45], precip_mm_day: [2.36, 2.35, 2.08, 1.67, 1.66, 0.73, 0.3, 0.51, 1.7, 2.64, 3.57, 2.48] } },
    { altitude_m: 1724, normals: { elevation_m: 493, t2m: [7.27, 7.19, 9.39, 12.37, 16.3, 21.4, 24.77, 24.9, 20.26, 16.31, 11.81, 8.45], precip_mm_day: [2.36, 2.35, 2.08, 1.67, 1.66, 0.73, 0.3, 0.51, 1.7, 2.64, 3.57, 2.48] } },
  ],
  whw: [
    { altitude_m: 153, normals: { elevation_m: 194, t2m: [2.87, 2.86, 4.11, 6.55, 9.43, 12.33, 13.85, 13.42, 11.46, 8.5, 5.49, 3.42], precip_mm_day: [4.42, 3.62, 3.04, 2.52, 2.98, 3.54, 3.92, 4.42, 3.53, 4.61, 4.45, 4.24] } },
    { altitude_m: 278, normals: { elevation_m: 387, t2m: [1.24, 1.19, 2.48, 5.07, 8, 10.91, 12.49, 11.98, 9.99, 6.98, 3.95, 1.88], precip_mm_day: [4.98, 4.1, 3.43, 2.89, 3.46, 4, 4.3, 4.88, 3.94, 5, 4.85, 4.66] } },
    { altitude_m: 392, normals: { elevation_m: 300, t2m: [2.26, 2.15, 3.32, 5.76, 8.6, 11.38, 12.85, 12.44, 10.62, 7.76, 4.89, 2.88], precip_mm_day: [6.19, 4.94, 4.13, 3.19, 3.84, 4.17, 4.58, 5.24, 4.83, 5.8, 5.78, 5.94] } },
  ],
  camino: [
    { altitude_m: 1236, normals: { elevation_m: 621, t2m: [3.88, 4.08, 7.02, 9.7, 12.91, 16.96, 18.96, 19.36, 16.49, 12.86, 7.38, 4.48], precip_mm_day: [3.37, 2.92, 2.7, 2.77, 2.62, 2.26, 1.45, 1.53, 1.96, 2.64, 4.07, 2.99] } },
    { altitude_m: 592, normals: { elevation_m: 497, t2m: [4.59, 5.14, 8.2, 11, 14.5, 18.85, 20.98, 21.08, 17.77, 13.81, 8.15, 4.99], precip_mm_day: [2.17, 2.02, 2.07, 2.1, 1.93, 1.77, 1, 0.95, 1.36, 1.85, 2.57, 1.8] } },
    { altitude_m: 578, normals: { elevation_m: 679, t2m: [4.24, 4.67, 7.56, 10.25, 13.64, 18, 20.1, 20.31, 17.08, 13.18, 7.53, 4.75], precip_mm_day: [2.1, 1.99, 2.01, 2.04, 1.9, 1.72, 0.97, 0.84, 1.29, 1.88, 2.51, 1.82] } },
    { altitude_m: 1104, normals: { elevation_m: 832, t2m: [3.54, 3.94, 6.69, 9.35, 12.66, 17.11, 19.24, 19.46, 16.28, 12.39, 6.83, 4.07], precip_mm_day: [2.11, 1.91, 1.98, 1.94, 1.8, 1.58, 0.94, 0.82, 1.16, 1.87, 2.5, 1.83] } },
    { altitude_m: 994, normals: { elevation_m: 918, t2m: [2.71, 3.21, 5.99, 8.68, 11.98, 16.35, 18.55, 18.69, 15.6, 11.52, 6.08, 3.14], precip_mm_day: [2.07, 1.79, 1.91, 2.11, 1.78, 1.49, 0.81, 0.82, 1.17, 2.2, 2.59, 2.03] } },
    { altitude_m: 848, normals: { elevation_m: 908, t2m: [2.7, 3.31, 6.15, 8.86, 12.28, 16.71, 19, 19, 15.81, 11.51, 6.03, 3.04], precip_mm_day: [1.92, 1.65, 1.74, 2.01, 1.68, 1.34, 0.76, 0.76, 1.14, 2.23, 2.42, 1.92] } },
    { altitude_m: 877, normals: { elevation_m: 915, t2m: [2.76, 3.4, 6.27, 9.05, 12.63, 17.27, 19.74, 19.55, 16.13, 11.56, 6.02, 3.09], precip_mm_day: [1.76, 1.54, 1.58, 1.87, 1.57, 1.16, 0.66, 0.65, 1.05, 2.2, 2.18, 1.78] } },
    { altitude_m: 905, normals: { elevation_m: 916, t2m: [2.97, 3.52, 6.32, 9.07, 12.7, 17.4, 20.01, 19.83, 16.41, 11.69, 6.16, 3.3], precip_mm_day: [1.85, 1.62, 1.61, 1.81, 1.51, 1.08, 0.62, 0.62, 1.01, 2.23, 2.15, 1.87] } },
    { altitude_m: 1447, normals: { elevation_m: 1035, t2m: [2.73, 3.03, 5.56, 8.23, 11.85, 16.54, 19.26, 19.14, 15.82, 11.08, 5.72, 3.09], precip_mm_day: [2.2, 1.89, 1.85, 1.83, 1.44, 1.11, 0.62, 0.62, 1.01, 2.39, 2.35, 2.25] } },
    { altitude_m: 1287, normals: { elevation_m: 992, t2m: [3.23, 3.46, 5.85, 8.37, 11.87, 16.38, 19, 18.89, 16.04, 11.32, 6.09, 3.7], precip_mm_day: [2.75, 2.3, 2.35, 2.05, 1.52, 1.17, 0.65, 0.69, 1.05, 2.88, 2.85, 2.88] } },
    { altitude_m: 689, normals: { elevation_m: 522, t2m: [5.88, 6.01, 8.16, 10.29, 13.15, 17.15, 19.64, 19.79, 17.6, 13.47, 8.58, 6.24], precip_mm_day: [3.73, 3, 3.13, 2.62, 1.97, 1.46, 0.88, 1.04, 1.23, 3.84, 4.14, 3.82] } },
    { altitude_m: 454, normals: { elevation_m: 446, t2m: [6.61, 6.64, 8.56, 10.52, 13.14, 16.52, 18.99, 19.39, 17.54, 13.65, 9.18, 7.02], precip_mm_day: [4.57, 3.51, 3.75, 3.08, 2.26, 1.63, 1.01, 1.22, 1.4, 4.67, 4.99, 4.56] } },
  ],
  kepler: [
    { altitude_m: 1270, normals: { elevation_m: 672, t2m: [10.91, 10.84, 9.62, 7.36, 5.2, 3.1, 2.5, 3.4, 4.69, 5.8, 7.64, 9.87], precip_mm_day: [6.39, 6.1, 5.78, 5.91, 6.14, 5.47, 5.38, 4.84, 5.94, 6.59, 6.1, 6.35] } },
  ],
}

const way = (id: number, points: Array<[number, number]>, tags: Record<string, string> = {}): OverpassElement => ({
  type: 'way',
  id,
  tags,
  geometry: points.map(([lat, lon]) => ({ lat, lon })),
})

/**
 * Ответ Overpass на запрос маршрута: superroute 1 из двух этапов (10 и 11) и варианта (12, роль
 * `alternative`). Путь 102 входит в оба этапа и считается один раз; путь 103 нарисован «навстречу».
 * Основной маршрут идёт по меридиану от 46,00° до 46,04° с. ш. — около 4,45 км; вариант — 1,1 км в сторону.
 */
export const ROUTE_ELEMENTS: OverpassElement[] = [
  {
    type: 'relation',
    id: 1,
    tags: { type: 'superroute', route: 'hiking', name: 'Fixture Trail', network: 'nwn', wikidata: 'Q1' },
    members: [
      { type: 'relation', ref: 10, role: '' },
      { type: 'relation', ref: 11, role: '' },
      { type: 'relation', ref: 12, role: 'alternative' },
    ],
  },
  { type: 'relation', id: 10, tags: { type: 'route', name: 'Stage 1' }, members: [{ type: 'way', ref: 101, role: '' }, { type: 'way', ref: 102, role: '' }] },
  { type: 'relation', id: 11, tags: { type: 'route', name: 'Stage 2' }, members: [{ type: 'way', ref: 102, role: '' }, { type: 'way', ref: 103, role: '' }, { type: 'way', ref: 104, role: '' }, { type: 'way', ref: 199, role: 'excursion' }] },
  { type: 'relation', id: 12, tags: { type: 'route', name: 'Variant' }, members: [{ type: 'way', ref: 105, role: '' }] },
  way(101, [[46.0, 7.0], [46.01, 7.0]], { sac_scale: 'hiking' }),
  way(102, [[46.01, 7.0], [46.02, 7.0]], { sac_scale: 'mountain_hiking' }),
  way(103, [[46.03, 7.0], [46.02, 7.0]], { sac_scale: 'alpine_hiking' }),
  way(104, [[46.03, 7.0], [46.04, 7.0]]),
  way(105, [[46.02, 7.0], [46.02, 7.0144]], { sac_scale: 'difficult_alpine_hiking' }),
  way(199, [[46.04, 7.0], [46.04, 7.01]]),
]

/** Элемент Wikidata в форме `wbgetentities`: длина в милях, статьи на двух языках и ссылка на Commons. */
export const TRAIL_ENTITY: RawEntity = {
  id: 'Q1',
  labels: { en: { value: 'Fixture Trail' }, ru: { value: 'Тропа Фикстура' } },
  aliases: { en: [{ value: 'FT' }, { value: 'FT' }], pl: [{ value: 'Szlak Fixture' }] },
  descriptions: { en: { value: 'long-distance trail in the Alps' } },
  claims: {
    P17: [{ mainsnak: { datavalue: { value: { id: 'Q39' } } } }, { mainsnak: { datavalue: { value: { id: 'Q38' } } } }],
    P402: [{ mainsnak: { datavalue: { value: '1' } } }],
    P2043: [
      { rank: 'deprecated', mainsnak: { datavalue: { value: { amount: '+999', unit: 'http://www.wikidata.org/entity/Q828224' } } } },
      { mainsnak: { datavalue: { value: { amount: '+96', unit: 'http://www.wikidata.org/entity/Q253276' } } } },
    ],
  },
  sitelinks: {
    enwiki: { title: 'Fixture Trail', url: 'https://en.wikipedia.org/wiki/Fixture_Trail' },
    dewiki: { title: 'Fixture-Weg', url: 'https://de.wikipedia.org/wiki/Fixture-Weg' },
    ruwikivoyage: { title: 'Тропа Фикстура', url: 'https://ru.wikivoyage.org/wiki/Тропа_Фикстура' },
    commonswiki: { title: 'Category:Fixture Trail', url: 'https://commons.wikimedia.org/wiki/Category:Fixture_Trail' },
  },
}
