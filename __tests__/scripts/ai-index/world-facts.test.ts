import fs from 'fs'
import path from 'path'

import {
  buildWorldChunks,
  cardAttribution,
  OPEN_LAYER_FILE,
  type OpenLayerRecord,
  OSM_LAYER_FILE,
  type OsmLayerRecord,
  toTrailCard,
  verifyWorldIndex,
  WORLD_SOURCES,
  writeWorldIndex,
} from '@/scripts/ai-index/world/cards'
import { gridCell, parseNormals } from '@/scripts/ai-index/world/climate'
import { effortKm, estimateEffort, LOAD_STEP_RU, LOAD_STEPS, sacGrade, stagesAsDays } from '@/scripts/ai-index/world/effort'
import { candidatesToTry, joinList, lengthMismatch, referenceLengthKm, toOpenRecord, withoutAscent } from '@/scripts/ai-index/world/pipeline'
import { ascentCalibrated, checkReference, monthsAgree, REFERENCE_TRAILS, withinRange } from '@/scripts/ai-index/world/references'
import { altitudeQuantile, passableMonths, SEASON_PARAMS, segmentSeason, snowpack, temperaturesAt } from '@/scripts/ai-index/world/season'
import { articleFor, articlesOf, classQuery, fetchPlaceEntities, lengthKmOf, parentRefsOf, parseClassTsv, parseEntity, PLACE_MAX_PER_TRAIL, placeRefsOf, type RawEntity, resolvePlaces } from '@/scripts/ai-index/world/wikidata'

import { makeTempDir } from '../cli-test-utils'
import { REFERENCE_SEGMENTS, TRAIL_ENTITY } from './world.fixture'

const YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

describe('внешний индекс маршрутов: ступень нагрузки', () => {
  it('усилие — километры плюс сотни метров набора', () => {
    expect(effortKm(166, 9912)).toBe(265.1)
    expect(effortKm(10, 0)).toBe(10)
  })

  it('класс тропы задаёт заметная доля длины, а не один помеченный участок', () => {
    // Camino Francés: 1,3 км класса T3 на 768 км класс не задают.
    expect(sacGrade({ hiking: 38, mountain_hiking: 5.6, demanding_mountain_hiking: 1.3 }, 768.1)).toBe('hiking')
    // Tour du Mont Blanc: T3 и выше — 1,9 км из 166 (меньше двух процентов).
    expect(sacGrade({ hiking: 8.8, mountain_hiking: 96.7, demanding_mountain_hiking: 1.8, alpine_hiking: 0.1 }, 166)).toBe('mountain_hiking')
    // GR 20: 12,2 км класса T4.
    expect(sacGrade({ hiking: 8.7, mountain_hiking: 124.3, demanding_mountain_hiking: 21.5, alpine_hiking: 12.2 }, 183.6)).toBe('alpine_hiking')
    expect(sacGrade({}, 100)).toBeNull()
    // На коротком маршруте нужна не доля, а хотя бы полкилометра.
    expect(sacGrade({ alpine_hiking: 0.3, hiking: 4 }, 5)).toBe('hiking')
  })

  it('этапы источника — дни, только когда похожи на дневные переходы', () => {
    expect(stagesAsDays([19.3, 23.7, 22.1, 19.4, 14.3, 15.6, 14.3, 24.6])).toBe(8)
    // Шесть участков Camino Francés по 65–176 км — не дни.
    expect(stagesAsDays([163.3, 119.6, 176, 119.4, 125.1, 64.7])).toBeNull()
    expect(stagesAsDays([20])).toBeNull()
    expect(stagesAsDays(undefined)).toBeNull()
  })

  it('четыре эталона получают свои ступени и правдоподобное число дней', () => {
    const whw = estimateEffort({ distance_km: 153.3, ascent_m: 3179, max_alt_m: 550, sac: 'hiking', stages_km: [19.3, 23.7, 22.1, 19.4, 14.3, 15.6, 14.3, 24.6] })
    expect(whw).toMatchObject({ step: 'hike', days: 8, days_source: 'stages', steepness_m_per_km: 21 })
    const camino = estimateEffort({ distance_km: 768.1, ascent_m: 11345, max_alt_m: 1510, sac: 'hiking', stages_km: [163.3, 119.6, 176, 119.4, 125.1, 64.7] })
    expect(camino).toMatchObject({ step: 'hike', days: 30, days_source: 'estimate' })
    const tmb = estimateEffort({ distance_km: 166, ascent_m: 9912, max_alt_m: 2535, sac: 'mountain_hiking' })
    expect(tmb).toMatchObject({ step: 'trained', days: 9, days_source: 'estimate', steepness_m_per_km: 60 })
    const gr20 = estimateEffort({ distance_km: 183.6, ascent_m: 12000, max_alt_m: 2595, sac: 'alpine_hiking' })
    expect(gr20).toMatchObject({ step: 'alpine', days: 16 })
  })

  it('этапы, которых вдвое больше оценки от усилия, днями не считаются', () => {
    // Weg der Schweiz: четыре участка по 7,5–10 км при усилии на два дня.
    expect(estimateEffort({ distance_km: 34.9, ascent_m: 1881, max_alt_m: 877, sac: 'hiking', stages_km: [9.4, 9.9, 7.5, 8.1] })).toMatchObject({ days: 2, days_source: 'estimate' })
    // Overland Track: шесть этапов при оценке в четыре дня — в пределах полутора раз.
    expect(estimateEffort({ distance_km: 77.4, ascent_m: 1860, max_alt_m: 1271, sac: 'mountain_hiking', stages_km: [10.5, 7.5, 15, 8.4, 19.5, 16.5] })).toMatchObject({ days: 6, days_source: 'stages' })
  })

  it('короткий пологий маршрут — прогулка; тот же маршрут с крутым набором — уже нет', () => {
    expect(estimateEffort({ distance_km: 12, ascent_m: 250, max_alt_m: 400 })).toMatchObject({ step: 'walk', days: 1 })
    expect(estimateEffort({ distance_km: 12, ascent_m: 900, max_alt_m: 1800 })).toMatchObject({ step: 'trained' })
    expect(estimateEffort({ distance_km: 12, ascent_m: 250, max_alt_m: 2600 })).toMatchObject({ step: 'trained' })
    expect(estimateEffort({ distance_km: 60, ascent_m: 900, max_alt_m: 700 })).toMatchObject({ step: 'hike', days: 3 })
  })

  it('ступень, которую задал класс тропы, помечена: без разметки она была бы ниже', () => {
    // Kepler Track: по рельефу — «поход», класс T4 на 3,6 км поднимает до «нужен горный опыт».
    expect(estimateEffort({ distance_km: 61.7, ascent_m: 1500, max_alt_m: 1400, sac: 'alpine_hiking' })).toMatchObject({ step: 'alpine', step_by_grade: true })
    expect(estimateEffort({ distance_km: 61.7, ascent_m: 1500, max_alt_m: 1400, sac: 'hiking' })).toMatchObject({ step: 'hike', step_by_grade: false })
    // Tour du Mont Blanc «для подготовленных» и без класса тропы: крутизна 60 м на километр.
    expect(estimateEffort({ distance_km: 166, ascent_m: 9912, max_alt_m: 2535, sac: 'demanding_mountain_hiking' })).toMatchObject({ step: 'trained', step_by_grade: false })
    // GR 20 по рельефу — «для подготовленных», класс T4 поднимает ступень.
    expect(estimateEffort({ distance_km: 183.6, ascent_m: 12000, max_alt_m: 2595, sac: 'alpine_hiking' })).toMatchObject({ step: 'alpine', step_by_grade: true })
  })

  it('без набора высоты ступени нет', () => {
    expect(estimateEffort({ distance_km: 100 })).toBeNull()
    expect(estimateEffort({ distance_km: 0, ascent_m: 100 })).toBeNull()
  })

  it('у каждой ступени есть русская подпись', () => {
    expect(LOAD_STEPS.map((step) => LOAD_STEP_RU[step])).toEqual(['прогулка', 'поход', 'поход для подготовленных', 'нужен горный опыт'])
  })
})

describe('внешний индекс маршрутов: правило сезона', () => {
  const lowland = { elevation_m: 200, t2m: [2, 3, 6, 10, 14, 17, 19, 19, 15, 10, 6, 3], precip_mm_day: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] }

  it('температура приводится к высоте участка: 6,5 °C на километр', () => {
    expect(temperaturesAt(lowland, 1200, 6.5)[0]).toBeCloseTo(2 - 6.5, 5)
    expect(temperaturesAt(lowland, 200, 6.5)[6]).toBe(19)
  })

  it('снег копится в холод и сходит в тепло', () => {
    const swe = snowpack([-5, -5, -1, 4, 9, 13, 15, 15, 11, 6, 0, -4], new Array(12).fill(3), SEASON_PARAMS)
    expect(swe[1]).toBeGreaterThan(swe[0])
    expect(swe[2]).toBeGreaterThan(200)
    expect(swe[5]).toBe(0)
    expect(swe[7]).toBe(0)
  })

  it('участок без устойчивого снега проходим круглый год', () => {
    expect(segmentSeason({ altitude_m: 300, normals: lowland })).toEqual({ seasonal: false, months: YEAR, peak_swe_mm: 0 })
  })

  it('горный участок: проходимы месяцы без снега и не холоднее порога', () => {
    const season = segmentSeason(REFERENCE_SEGMENTS.tmb[1])
    expect(season.seasonal).toBe(true)
    expect(season.months).toEqual([7, 8])
    expect(season.peak_swe_mm).toBeGreaterThan(400)
  })

  it('эталоны: Tour du Mont Blanc — июль и август, GR 20 — июнь–октябрь, остальные — круглый год', () => {
    expect(passableMonths(REFERENCE_SEGMENTS.tmb)).toEqual([7, 8])
    expect(passableMonths(REFERENCE_SEGMENTS.gr20)).toEqual([6, 7, 8, 9, 10])
    expect(passableMonths(REFERENCE_SEGMENTS.whw)).toEqual(YEAR)
    expect(passableMonths(REFERENCE_SEGMENTS.camino)).toEqual(YEAR)
  })

  it('горные участки Camino Francés с неустойчивым снегом маршрут зимой не закрывают', () => {
    const peaks = REFERENCE_SEGMENTS.camino.map((segment) => segmentSeason(segment).peak_swe_mm)
    expect(Math.max(...peaks)).toBeGreaterThan(100)
    expect(Math.max(...peaks)).toBeLessThan(SEASON_PARAMS.seasonalSweMm)
    expect(REFERENCE_SEGMENTS.camino.every((segment) => !segmentSeason(segment).seasonal)).toBe(true)
  })

  it('южное полушарие: Kepler Track проходим летом — с декабря по март', () => {
    expect(passableMonths(REFERENCE_SEGMENTS.kepler)).toEqual([1, 2, 3, 12])
  })

  it('ноябрь: горные эталоны закрыты, равнинные открыты', () => {
    const november = (key: 'tmb' | 'gr20' | 'whw' | 'camino') => (passableMonths(REFERENCE_SEGMENTS[key]) ?? []).includes(11)
    expect([november('tmb'), november('gr20'), november('whw'), november('camino')]).toEqual([false, false, true, true])
  })

  it('результат эталонов не меняется на плато параметров', () => {
    for (const minTempC of [4, 6, 7]) {
      for (const seasonalSweMm of [150, 350]) {
        for (const meltMmPerDegDay of [3, 5]) {
          const params = { ...SEASON_PARAMS, minTempC, seasonalSweMm, meltMmPerDegDay }
          for (const reference of REFERENCE_TRAILS) {
            const months = passableMonths(REFERENCE_SEGMENTS[reference.key as keyof typeof REFERENCE_SEGMENTS], params)
            expect({ key: reference.key, ok: monthsAgree(months, reference) }).toEqual({ key: reference.key, ok: true })
          }
        }
      }
    }
  })

  it('месяц маршрута проходим, только если проходимы все участки; вечный снег и пустой список — факта нет', () => {
    expect(passableMonths([{ altitude_m: 300, normals: lowland }, REFERENCE_SEGMENTS.tmb[1]])).toEqual([7, 8])
    expect(passableMonths([{ altitude_m: 6200, normals: lowland }])).toBeNull()
    expect(passableMonths([])).toBeNull()
  })

  it('высота участка — заданная доля точек профиля лежит ниже неё', () => {
    const profile = Array.from({ length: 100 }, (_, i) => i * 10)
    expect(altitudeQuantile(profile, 0.9)).toBe(900)
    expect(altitudeQuantile(profile, 1)).toBe(990)
    expect(altitudeQuantile([], 0.75)).toBe(0)
  })
})

describe('внешний индекс маршрутов: эталоны и допуск', () => {
  it('диапазон с допуском считается от ближайшей границы', () => {
    expect(withinRange(9912, [10000, 10600], 0.05)).toBe(true)
    expect(withinRange(9400, [10000, 10600], 0.05)).toBe(false)
    expect(withinRange(3179, [3155, 3155], 0.05)).toBe(true)
    expect(withinRange(3445, [3155, 3155], 0.05)).toBe(false)
  })

  it('месяцы согласуются с текстом: целые месяцы сезона названы, лишних нет', () => {
    const tmb = REFERENCE_TRAILS.find((reference) => reference.key === 'tmb')!
    expect(monthsAgree([7, 8, 9], tmb)).toBe(true)
    expect(monthsAgree([6, 7, 8, 9], tmb)).toBe(true)
    expect(monthsAgree([7, 8, 9, 10], tmb)).toBe(false)
    expect(monthsAgree([8, 9], tmb)).toBe(false)
    expect(monthsAgree(null, tmb)).toBe(false)
  })

  it('набор вне допуска хотя бы на одном эталоне — набор в карточки не идёт', () => {
    const tmb = REFERENCE_TRAILS.find((reference) => reference.key === 'tmb')!
    const whw = REFERENCE_TRAILS.find((reference) => reference.key === 'whw')!
    const camino = REFERENCE_TRAILS.find((reference) => reference.key === 'camino')!
    const good = checkReference(tmb, { distance_km: 166, ascent_m: 9912, effort: 'trained', months: [7, 8, 9] })
    expect(good).toEqual({ key: 'tmb', length: true, ascent: true, step: true, months: true })
    const bad = checkReference(whw, { distance_km: 153.3, ascent_m: 4812, effort: 'hike', months: YEAR })
    expect(bad.ascent).toBe(false)
    // У Camino Francés источники набора не называют: сверки нет, и на решение она не влияет.
    const unknown = checkReference(camino, { distance_km: 768.1, ascent_m: 11345, effort: 'hike', months: YEAR })
    expect(unknown.ascent).toBeNull()
    expect(ascentCalibrated([good, unknown])).toBe(true)
    expect(ascentCalibrated([good, bad])).toBe(false)
    expect(ascentCalibrated([unknown])).toBe(false)
  })
})

describe('внешний индекс маршрутов: перечень Wikidata', () => {
  it('запрос класса берёт подклассы, статьи и необязательный P402', () => {
    expect(classQuery('Q2143825')).toContain('wdt:P31/wdt:P279* wd:Q2143825')
    expect(classQuery('Q2143825')).toContain('OPTIONAL { ?item wdt:P402 ?osm }')
  })

  it('TSV службы запросов: элемент с несколькими отношениями и без них', () => {
    const tsv = ['?item\t?osm', '<http://www.wikidata.org/entity/Q24777>\t"9678362"', '<http://www.wikidata.org/entity/Q24777>\t"124456"', '<http://www.wikidata.org/entity/Q5>\t', ''].join('\n')
    expect(parseClassTsv(tsv)).toEqual([
      { qid: 'Q24777', osm: [124456, 9678362] },
      { qid: 'Q5', osm: [] },
    ])
  })

  it('элемент: названия пяти языков, длина в километрах из миль, статьи без Commons', () => {
    const trail = parseEntity(TRAIL_ENTITY)
    expect(trail.labels).toEqual({ ru: 'Тропа Фикстура', en: 'Fixture Trail' })
    expect(trail.aliases).toEqual({ pl: ['Szlak Fixture'], en: ['FT'] })
    expect(trail.countries).toEqual(['Q39', 'Q38'])
    expect(trail.osm).toEqual([1])
    // 96 миль; значение с пометкой «устарело» не берётся.
    expect(trail.wd_length_km).toBe(154.5)
    expect(lengthKmOf({ id: 'Q2', claims: { P2043: [{ mainsnak: { datavalue: { value: { amount: '+5', unit: '1' } } } }] } })).toBeUndefined()
    expect(articlesOf(TRAIL_ENTITY).map((article) => article.site)).toEqual(['dewiki', 'enwiki', 'ruwikivoyage'])
  })

  it('статья карточки: язык вопроса, затем английская, затем запасной язык', () => {
    const articles = articlesOf(TRAIL_ENTITY)
    expect(articleFor(articles, 'ru')).toMatchObject({ site: 'ruwikivoyage', lang: 'ru', kind: 'wikivoyage' })
    expect(articleFor(articles, 'pl')).toMatchObject({ site: 'enwiki' })
    expect(articleFor(articles.filter((article) => article.site === 'dewiki'), 'uk')).toMatchObject({ site: 'dewiki', lang: 'de' })
    expect(articleFor([], 'en')).toBeNull()
  })

  it('связь с OSM в обе стороны: P402 важнее тега, среди помеченных — superroute', () => {
    const entries = joinList(
      [
        { qid: 'Q24777', osm: [9678362] },
        { qid: 'Q10', osm: [] },
        { qid: 'Q11', osm: [] },
        { qid: 'Q10', osm: [] },
      ],
      [
        { id: 500, qid: 'Q24777', type: 'route' },
        { id: 700, qid: 'Q10', type: 'route', distance: '40' },
        { id: 701, qid: 'Q10', type: 'superroute' },
        { id: 900, qid: 'Q999', type: 'route' },
      ],
    )
    expect(entries).toEqual([
      { qid: 'Q10', relation: 701, link: 'tag', candidates: [701, 700] },
      { qid: 'Q24777', relation: 9678362, link: 'both', candidates: [9678362, 500] },
    ])
  })
})

describe('внешний индекс маршрутов: места маршрута ниже страны', () => {
  const item = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } })
  const place = (id: string, labels: Record<string, string>, claims: Record<string, string[]> = {}): RawEntity => ({
    id,
    labels: Object.fromEntries(Object.entries(labels).map(([locale, value]) => [locale, { value }])),
    claims: Object.fromEntries(Object.entries(claims).map(([property, ids]) => [property, property === 'P625' ? [{ mainsnak: { datavalue: { value: { latitude: 1, longitude: 2 } } } }] : ids.map(item)])),
  })
  // West Highland Way: округ → Шотландия → Великобритания; гряда → горная система; «часть от» — сеть троп без координат.
  const trail: RawEntity = { id: 'Q965998', claims: { P131: [item('Q208279'), item('Q201149')], P706: [item('Q106652')], P361: [item('Q900'), item('Q901')], P17: [item('Q145')] } }
  const entities = new Map<string, RawEntity>(
    [
      place('Q208279', { en: 'Highland', ru: 'Хайленд' }, { P131: ['Q22'] }),
      place('Q201149', { en: 'Stirling' }, { P131: ['Q22'] }),
      place('Q22', { en: 'Scotland', ru: 'Шотландия', pl: 'Szkocja' }, { P131: ['Q145'], P31: ['Q3336843'] }),
      place('Q145', { en: 'United Kingdom', ru: 'Великобритания' }, { P31: ['Q3624078'] }),
      place('Q106652', { en: 'Grampian Mountains', ru: 'Грампианские горы' }, { P4552: ['Q1'], P361: ['Q2'] }),
      place('Q1', { en: 'Scottish Highlands' }, { P361: ['Q46'] }),
      place('Q2', { en: 'Great Britain' }, { P625: ['x'], P361: ['Q46'] }),
      place('Q46', { en: 'Europe', ru: 'Европа' }, { P31: ['Q5107'], P625: ['x'] }),
      place('Q900', { en: "Scotland's Great Trails" }),
      place('Q901', { en: 'Loch Lomond and The Trossachs National Park', ru: 'Лох-Ломонд и Троссахс' }, { P625: ['x'] }),
      place('Q777', { de: 'Nur Deutsch' }),
    ].map((entity) => [entity.id, entity]),
  )
  const rules = { countries: new Set(['Q145']), exclude: new Set(['Q965998']) }

  it('ссылки элемента на места — по пяти свойствам, без повторов', () => {
    expect(placeRefsOf(trail)).toEqual([
      { qid: 'Q208279', kind: 'admin' },
      { qid: 'Q201149', kind: 'admin' },
      { qid: 'Q106652', kind: 'terrain' },
      { qid: 'Q900', kind: 'part' },
      { qid: 'Q901', kind: 'part' },
    ])
    expect(parseEntity(trail).place_refs).toHaveLength(5)
    expect(placeRefsOf({ id: 'Q5' })).toEqual([])
  })

  it('цепочка идёт вверх: у административной единицы — по P131, у рельефа — к горной системе и целому', () => {
    expect(parentRefsOf(entities.get('Q208279')!, 'admin')).toEqual([{ qid: 'Q22', kind: 'admin' }])
    expect(parentRefsOf(entities.get('Q106652')!, 'terrain')).toEqual([{ qid: 'Q1', kind: 'range' }, { qid: 'Q2', kind: 'part' }])
    expect(parentRefsOf(entities.get('Q106652')!, 'admin')).toEqual([])
  })

  it('места маршрута: рельеф, затем регионы — от крупных к мелким; страна и часть света в места не идут', () => {
    const places = resolvePlaces(placeRefsOf(trail), entities, rules)
    expect(places.map((entry) => entry.qid)).toEqual(['Q1', 'Q2', 'Q106652', 'Q901', 'Q22', 'Q208279', 'Q201149'])
    expect(places.find((entry) => entry.qid === 'Q22')).toEqual({ qid: 'Q22', names: { ru: 'Шотландия', pl: 'Szkocja', en: 'Scotland' }, kind: 'admin' })
    expect(places.map((entry) => entry.qid)).not.toContain('Q145')
    expect(places.map((entry) => entry.qid)).not.toContain('Q46')
  })

  it('«часть от» без координат (сеть троп) местом не считается; место без названия на языках сайта — тоже', () => {
    const places = resolvePlaces([{ qid: 'Q900', kind: 'part' }, { qid: 'Q777', kind: 'admin' }, { qid: 'Q404', kind: 'admin' }], entities, rules)
    expect(places).toEqual([])
  })

  it('Шотландия помечена в Wikidata классом «страна», но местом остаётся; упразднённое государство местом не считается', () => {
    const scotland = place('Q22', { en: 'Scotland', ru: 'Шотландия' }, { P131: ['Q145', 'Q174193'], P31: ['Q3336843', 'Q6256'] })
    const former = { ...place('Q174193', { en: 'United Kingdom of Great Britain and Ireland' }), claims: { P576: [{ mainsnak: { datavalue: { value: { time: '+1927-04-12T00:00:00Z' } } } }] } }
    const map = new Map<string, RawEntity>([...entities, ['Q22', scotland], ['Q174193', former]])
    expect(resolvePlaces([{ qid: 'Q208279', kind: 'admin' }], map, rules).map((entry) => entry.qid)).toEqual(['Q22', 'Q208279'])
  })

  it('сам маршрут перечня и повтор места в цепочке не берутся; глубина и число мест ограничены', () => {
    expect(resolvePlaces([{ qid: 'Q965998', kind: 'part' }], new Map([...entities, ['Q965998', { ...trail, labels: { en: { value: 'West Highland Way' } } }]]), rules)).toEqual([])
    const chain = new Map<string, RawEntity>(Array.from({ length: 8 }, (_, index) => [`Q${index + 1000}`, place(`Q${index + 1000}`, { en: `Level ${index}` }, { P131: [`Q${index + 1001}`] })]))
    expect(resolvePlaces([{ qid: 'Q1000', kind: 'admin' }], chain, rules).map((entry) => entry.qid)).toEqual(['Q1003', 'Q1002', 'Q1001', 'Q1000'])
    const wide = new Map<string, RawEntity>(Array.from({ length: 40 }, (_, index) => [`Q${index + 2000}`, place(`Q${index + 2000}`, { en: `County ${index}` })]))
    expect(resolvePlaces([...wide.keys()].map((qid) => ({ qid, kind: 'admin' as const })), wide, rules)).toHaveLength(PLACE_MAX_PER_TRAIL)
  })

  // #3431 А3: место, к которому пришли вторым видом связи, раскрывается и по нему.
  describe('место раскрывается по каждому виду связи', () => {
    // Маршрут: округ (P131) → регион; гряда (P706) → массив (P4552) → тот же регион как «часть от» (P361).
    // Регион — и административная единица (вверх страна), и часть горной системы (P4552 → Альпы).
    const world = new Map<string, RawEntity>(
      [
        place('Q10', { en: 'District' }, { P131: ['Q20'] }),
        place('Q11', { en: 'Ridge' }, { P4552: ['Q12'] }),
        place('Q12', { en: 'Massif' }, { P361: ['Q20'] }),
        place('Q20', { en: 'Region', ru: 'Регион' }, { P131: ['Q145'], P4552: ['Q30'], P625: ['x'] }),
        place('Q30', { en: 'Alps', ru: 'Альпы' }),
        place('Q145', { en: 'United Kingdom' }, { P31: ['Q3624078'] }),
      ].map((entity) => [entity.id, entity]),
    )
    const refs = [{ qid: 'Q10', kind: 'admin' as const }, { qid: 'Q11', kind: 'terrain' as const }]

    it('загрузка: регион, уже загруженный как административная единица, дораскрывается к горной системе', async () => {
      const asked: string[][] = []
      const load = async (qids: readonly string[]) => {
        asked.push([...qids])
        return new Map(qids.flatMap((qid) => (world.has(qid) ? [[qid, world.get(qid)!] as const] : [])))
      }
      const loaded = await fetchPlaceEntities(refs, rules, { rawDir: 'unused' }, load)
      // Регион найден на втором уровне (от округа) и снова на третьем (от массива): его горная система загружена.
      expect([...loaded.keys()].sort()).toEqual(['Q10', 'Q11', 'Q12', 'Q145', 'Q20', 'Q30'])
      // Каждый элемент запрошен один раз.
      expect(asked.flat().sort()).toEqual(['Q10', 'Q11', 'Q12', 'Q145', 'Q20', 'Q30'])
    })

    it('места маршрута: горная система региона входит в список, сам регион — один раз', () => {
      const places = resolvePlaces(refs, world, rules).map((entry) => entry.qid)
      expect(places).toContain('Q30')
      expect(places.filter((qid) => qid === 'Q20')).toHaveLength(1)
      expect(places.sort()).toEqual(['Q10', 'Q11', 'Q12', 'Q20', 'Q30'])
    })

    it('цикл «часть от» друг друга не зацикливает разбор', async () => {
      const loop = new Map<string, RawEntity>([place('Q50', { en: 'A' }, { P361: ['Q51'], P625: ['x'] }), place('Q51', { en: 'B' }, { P361: ['Q50'], P625: ['x'] })].map((entity) => [entity.id, entity]))
      const load = async (qids: readonly string[]) => new Map(qids.flatMap((qid) => (loop.has(qid) ? [[qid, loop.get(qid)!] as const] : [])))
      expect([...(await fetchPlaceEntities([{ qid: 'Q50', kind: 'part' }], rules, { rawDir: 'unused' }, load)).keys()].sort()).toEqual(['Q50', 'Q51'])
      expect(resolvePlaces([{ qid: 'Q50', kind: 'part' }], loop, rules).map((entry) => entry.qid).sort()).toEqual(['Q50', 'Q51'])
    })
  })

  it('места входят в слой Wikidata и в текст смыслового поиска на языке фрагмента', () => {
    const countries = new Map([['Q145', { id: 'Q145', labels: { en: { value: 'United Kingdom' }, ru: { value: 'Великобритания' } } }]])
    const places = resolvePlaces(placeRefsOf(trail), entities, rules)
    const record = toOpenRecord({ ...parseEntity(TRAIL_ENTITY), countries: ['Q145'] }, countries, places)!
    expect(record.places?.map((entry) => entry.names.en)).toEqual(['Scottish Highlands', 'Great Britain', 'Grampian Mountains', 'Loch Lomond and The Trossachs National Park', 'Scotland', 'Highland', 'Stirling'])
    const chunks = buildWorldChunks(record)
    expect(chunks.find((chunk) => chunk.locale === 'ru')!.text).toContain('Великобритания. Scottish Highlands, Great Britain, Грампианские горы, Лох-Ломонд и Троссахс, Шотландия, Хайленд')
    expect(chunks.find((chunk) => chunk.locale === 'pl')!.text).toContain('Szkocja')
    // Без мест поля в записи нет: слой прежних сборок читается как раньше.
    expect(toOpenRecord({ ...parseEntity(TRAIL_ENTITY), countries: ['Q145'] }, countries)).not.toHaveProperty('places')
  })
})

describe('внешний индекс маршрутов: выбор отношения', () => {
  it('без длины Wikidata пробуется только выбранное отношение, с длиной — до трёх кандидатов', () => {
    const entry = { relation: 3971061, candidates: [3971061, 11816201, 11816202, 11816203] }
    expect(candidatesToTry(entry, undefined)).toEqual([3971061])
    expect(candidatesToTry(entry, 70)).toEqual([3971061, 11816201, 11816202])
  })
})

describe('внешний индекс маршрутов: климатические нормы', () => {
  it('точка привязывается к центру ячейки сетки 0,5° × 0,625°', () => {
    expect(gridCell(45.83, 6.87)).toEqual({ lat: 46, lon: 6.875 })
    expect(gridCell(56.82, -5.1)).toEqual({ lat: 57, lon: -5 })
    expect(gridCell(42.21, 9.05)).toEqual({ lat: 42, lon: 8.75 })
  })

  it('ответ службы: высота ячейки, температура и осадки по месяцам', () => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const series = (base: number) => Object.fromEntries([...months.map((key, index) => [key, base + index]), ['ANN', 0]])
    const body = { geometry: { coordinates: [6.875, 46, 1714.15] }, properties: { parameter: { T2M: series(-6), PRECTOTCORR: series(1) } }, header: { fill_value: -999, range: '2001-2025' } }
    expect(parseNormals(JSON.stringify(body), { lat: 46, lon: 6.875 })).toEqual({
      lat: 46,
      lon: 6.875,
      elevation_m: 1714.15,
      t2m: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
      precip_mm_day: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      period: '2001-2025',
    })
    const holed = { ...body, properties: { parameter: { T2M: { ...series(-6), MAR: -999 }, PRECTOTCORR: series(1) } } }
    expect(parseNormals(JSON.stringify(holed), { lat: 46, lon: 6.875 })).toBeNull()
    expect(parseNormals('{}', { lat: 0, lon: 0 })).toBeNull()
  })
})

describe('внешний индекс маршрутов: карточка, слои и манифест', () => {
  const osm: OsmLayerRecord = {
    source_id: 'Q1',
    osm_relation: 1,
    distance_km: 153.3,
    loop: false,
    lat: 56.4,
    lng: -4.7,
    ascent_m: 3179,
    descent_m: 3210,
    max_alt_m: 550,
    min_alt_m: 4,
    grade: 'hiking',
    days: 8,
    effort_km: 185.1,
    effort: 'hike',
    months: YEAR,
  }
  const countries = new Map([
    ['Q39', { id: 'Q39', labels: { en: { value: 'Switzerland' }, ru: { value: 'Швейцария' }, pl: { value: 'Szwajcaria' } } }],
    ['Q38', { id: 'Q38', labels: { en: { value: 'Italy' }, ru: { value: 'Италия' } } }],
  ])
  const open = toOpenRecord(parseEntity(TRAIL_ENTITY), countries) as OpenLayerRecord

  it('слой Wikidata: названия стран, статья на каждый язык, число статей; длина — отдельным полем', () => {
    expect(open.countries).toEqual([
      { qid: 'Q39', names: { ru: 'Швейцария', pl: 'Szwajcaria', en: 'Switzerland' } },
      { qid: 'Q38', names: { ru: 'Италия', en: 'Italy' } },
    ])
    expect(open.sitelinks).toBe(3)
    expect(open.links.ru).toEqual({ url: 'https://ru.wikivoyage.org/wiki/Тропа_Фикстура', lang: 'ru', kind: 'wikivoyage' })
    expect(open.links.be).toMatchObject({ lang: 'en' })
    expect(open.wd_length_km).toBe(154.5)
  })

  it('элемент без статьи в слой не идёт; без названия на языках сайта заголовком служит название статьи', () => {
    expect(toOpenRecord({ ...parseEntity(TRAIL_ENTITY), articles: [] }, countries)).toBeNull()
    const german = toOpenRecord(
      { ...parseEntity(TRAIL_ENTITY), labels: {}, articles: [{ site: 'dewiki', lang: 'de', kind: 'wikipedia', title: 'Rennsteig (Wanderweg)', url: 'https://de.wikipedia.org/wiki/Rennsteig_(Wanderweg)' }] },
      countries,
    )!
    expect(german.native_title).toBe('Rennsteig')
    expect(toTrailCard(osm, german, 'ru')).toMatchObject({ title: 'Rennsteig', url: 'https://de.wikipedia.org/wiki/Rennsteig_(Wanderweg)' })
    expect(buildWorldChunks(german)[0].title).toBe('Rennsteig')
    expect(open).not.toHaveProperty('native_title')
  })

  it('карточка: длина — из слоя OSM, название, страна и ссылка — из слоя Wikidata, значения не смешиваются', () => {
    expect(toTrailCard(osm, open, 'ru')).toEqual({
      type: 'trail',
      group: 'world',
      source_id: 'Q1',
      title: 'Тропа Фикстура',
      url: 'https://ru.wikivoyage.org/wiki/Тропа_Фикстура',
      country: 'Швейцария, Италия',
      distance_km: 153.3,
      days: 8,
      ascent_m: 3179,
      max_alt_m: 550,
      grade: 'hiking',
      months: YEAR,
      effort: 'hike',
      attribution: 'OpenStreetMap, Wikidata, Copernicus DEM, NASA POWER',
    })
    // Польского названия нет — английское; страна — на польском, где оно есть.
    expect(toTrailCard(osm, open, 'pl')).toMatchObject({ title: 'Fixture Trail', country: 'Szwajcaria, Italy', url: 'https://en.wikipedia.org/wiki/Fixture_Trail' })
  })

  it('оценочные дни помечены; без фактов рельефа и климата их источников в атрибуции нет', () => {
    expect(toTrailCard({ ...osm, days: 7, days_estimated: true }, open, 'en')).toMatchObject({ days: 7, days_estimated: true })
    expect(toTrailCard({ ...osm, effort: 'alpine', effort_by_grade: true }, open, 'en')).toMatchObject({ effort: 'alpine', effort_by_grade: true })
    expect(toTrailCard(osm, open, 'en')).not.toHaveProperty('effort_by_grade')
    const bare = withoutAscent({ ...osm, months: undefined, max_alt_m: undefined })
    expect(bare).toEqual({ source_id: 'Q1', osm_relation: 1, distance_km: 153.3, loop: false, lat: 56.4, lng: -4.7, max_alt_m: undefined, min_alt_m: 4, grade: 'hiking', months: undefined })
    expect(cardAttribution(bare)).toBe('OpenStreetMap, Wikidata')
    const card = toTrailCard(bare, open, 'en')!
    expect(card).not.toHaveProperty('ascent_m')
    expect(card).not.toHaveProperty('days')
    expect(card).not.toHaveProperty('effort')
    expect(card).not.toHaveProperty('months')
  })

  it('слои разных маршрутов в карточку не соединяются', () => {
    expect(toTrailCard({ ...osm, source_id: 'Q2' }, open, 'en')).toBeNull()
  })

  it('текст смыслового поиска — только из слоя Wikidata, по фрагменту на язык с названием', () => {
    const chunks = buildWorldChunks(open)
    expect(chunks.map((chunk) => chunk.locale)).toEqual(['ru', 'be', 'pl'])
    expect(chunks[0]).toMatchObject({ source_id: 'Q1', title: 'Тропа Фикстура', text: 'Тропа Фикстура. FT, Fixture Trail. long-distance trail in the Alps. Швейцария, Италия' })
    // Белорусского названия нет: английский фрагмент один на все такие языки (uk и en повторили бы его).
    expect(chunks[1]).toMatchObject({ title: 'Fixture Trail', text: 'Fixture Trail. FT. long-distance trail in the Alps. Switzerland, Italy' })
    expect(chunks[2].text).toBe('Fixture Trail. Szlak Fixture, FT. long-distance trail in the Alps. Szwajcaria, Italy')
    expect(chunks.every((chunk) => /^wQ1-(ru|be|pl)-[0-9a-f]{16}$/.test(chunk.id))).toBe(true)
    expect(chunks.some((chunk) => /153|3179|550/.test(chunk.text))).toBe(false)
  })

  it('длина геометрии, далёкая от длины Wikidata, — отношение не тот маршрут', () => {
    expect(lengthMismatch(153.3, 154.5)).toBe(false)
    expect(lengthMismatch(60, 154.5)).toBe(true)
    expect(lengthMismatch(60, undefined)).toBe(false)
    // #3431: нет длины Wikidata — геометрия сверяется с тегом `distance` отношения OSM.
    expect(referenceLengthKm({ wd_length_km: 154.5, tag_distance_km: 298 })).toBe(154.5)
    expect(referenceLengthKm({ tag_distance_km: 298 })).toBe(298)
    for (const row of [{}, { tag_distance_km: 0 }, { tag_distance_km: Number.NaN }]) expect(referenceLengthKm(row)).toBeUndefined()
    // Kammweg: 149,8 км геометрии при теге 298; Naheweg: 16,1 при 75 — участок, а не маршрут.
    expect(lengthMismatch(149.8, referenceLengthKm({ tag_distance_km: 298 }))).toBe(true)
    expect(lengthMismatch(16.1, referenceLengthKm({ tag_distance_km: 75 }))).toBe(true)
    expect(lengthMismatch(290, referenceLengthKm({ tag_distance_km: 298 }))).toBe(false)
    // С длиной для сверки пробуются и другие отношения элемента.
    expect(candidatesToTry({ relation: 1, candidates: [1, 2, 3] }, referenceLengthKm({ tag_distance_km: 298 }))).toEqual([1, 2, 3])
  })

  it('манифест несёт лицензию и атрибуцию каждого источника; проверка ловит подмену слоя', () => {
    const dist = makeTempDir('world-index-')
    const manifest = writeWorldIndex(dist, { osm: [osm, { ...osm, source_id: 'Q404' }], open: [open], dem: 'Copernicus DEM GLO-30', ascent: { stepM: 30, smoothM: 0, thresholdM: 20 }, builtAt: '2026-11-14T00:00:00.000Z' })
    // Маршрут без слоя Wikidata в индекс не попал.
    expect(manifest.trails).toBe(1)
    expect(manifest.chunks).toBe(3)
    expect(manifest.layers.osm.file).toBe(OSM_LAYER_FILE)
    expect(manifest.layers.wikidata.file).toBe(OPEN_LAYER_FILE)
    expect(manifest.sources.map((source) => source.id)).toEqual(['osm', 'wikidata', 'copernicus-dem', 'nasa-power', 'wikipedia'])
    expect(manifest.sources.find((source) => source.id === 'osm')).toMatchObject({ license: 'ODbL 1.0', attribution: '© OpenStreetMap contributors', file: OSM_LAYER_FILE })
    expect(manifest.params.ascent.thresholdM).toBe(20)
    expect(verifyWorldIndex(dist)).toEqual([])

    // Слой OSM не содержит полей Wikidata, и наоборот.
    const osmLine = JSON.parse(fs.readFileSync(path.join(dist, OSM_LAYER_FILE), 'utf8').trim())
    const openLine = JSON.parse(fs.readFileSync(path.join(dist, OPEN_LAYER_FILE), 'utf8').trim())
    expect(Object.keys(osmLine).filter((key) => key in openLine)).toEqual(['source_id'])

    fs.appendFileSync(path.join(dist, OSM_LAYER_FILE), `${JSON.stringify({ ...osm, source_id: 'Q7' })}\n`)
    expect(verifyWorldIndex(dist).join(' ')).toMatch(/trails-osm\.jsonl/)
  })

  it('запрещённых источников в манифесте нет, у каждого есть адрес лицензии', () => {
    const text = JSON.stringify(WORLD_SOURCES).toLowerCase()
    for (const banned of ['alltrails', 'komoot', 'wikiloc', 'outdooractive', 'waymarked', 'worldclim', 'open-meteo', 'ffrandonn']) expect(text).not.toContain(banned)
    for (const source of WORLD_SOURCES) expect(source.license_url).toMatch(/^https:\/\//)
  })
})
