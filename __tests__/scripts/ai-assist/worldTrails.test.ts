/**
 * Маршруты мира (#3357): карточка события `sources`, сверка условий вопроса тем же `judgeCard` и подбор
 * второго яруса. Фикстура — четырнадцать маршрутов внешнего индекса, без сети.
 */
import { guardAnswer } from '@/scripts/ai-assist/answerGuard'
import { parseAskSseEvent } from '@/api/aiAssist/askProvider'
import { judgeCard, parseConditions, TRAIL_ESTIMATE_SLACK, TRAIL_MIN_DAYS_FROM, TRAIL_MIN_DAYS_SHARE } from '@/api/aiAssist/questionConditions'
import { type AiWorldTrail, LOAD_STEP_RU, LOAD_STEPS, monthRanges, monthsLabelRu, parseWorldTrail, roundAltitude, roundClimb, trailFactsLine, WORLD_OSM_LAYER_PUBLIC_PATH } from '@/api/aiAssist/trailFacts'
import type { AiSource } from '@/api/aiAssist/types'
import { asksForWorldTrails, borrowedPlaceWords, gazetteerPlace, gazetteerWords, namesTrail, ownPlaceNames, selectWorldTrails, titleKeys, type WorldCandidate } from '@/scripts/ai-assist/worldTrails'
import { toTrailCard, trailTitle } from '@/scripts/ai-index/world/cards'

import { WORLD_OPEN_LAYER, WORLD_OSM_LAYER, worldFakeVector } from '../../fixtures/worldTrails'

const YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const cardOf = (id: string, locale: 'ru' | 'be' | 'uk' | 'pl' | 'en' = 'ru'): AiWorldTrail => {
  const osm = WORLD_OSM_LAYER.find((record) => record.source_id === id)!
  const open = WORLD_OPEN_LAYER.find((record) => record.source_id === id)!
  return toTrailCard(osm, open, locale)!
}

/** Кандидаты как у службы: карточка на языке вопроса, близость по вектору-заглушке, известность, место и названия. */
const candidates = (query: string, locale: 'ru' | 'be' | 'uk' | 'pl' | 'en' = 'ru'): WorldCandidate[] => {
  const vector = worldFakeVector(query)
  return WORLD_OSM_LAYER.map((osm) => {
    const open = WORLD_OPEN_LAYER.find((record) => record.source_id === osm.source_id)!
    const countries = open.countries.flatMap((country) => Object.values(country.names))
    const places = (open.places ?? []).flatMap((place) => Object.values(place.names))
    const own = worldFakeVector([...Object.values(open.labels), ...countries].join('. '))
    return {
      card: toTrailCard(osm, open, locale)!,
      similarity: own.reduce((sum, value, index) => sum + value * vector[index], 0),
      fame: open.sitelinks,
      place: gazetteerPlace(places, countries),
      titles: titleKeys([...Object.values(open.labels), open.native_title, ...Object.values(open.aliases).flat()]),
    }
  })
}

const TMB = 'Q24777'
const GR20 = 'Q262374'
const WHW = 'Q965998'
const CAMINO = 'Q1029584'
const KEPLER = 'Q846931'
const SUDETES = 'Q5627668'
const PEDDARS = 'Q2066153'

describe('маршруты мира: карточка события sources', () => {
  it('карточка фикстуры несёт вид trail, группу world и факты обоих слоёв', () => {
    expect(cardOf(WHW)).toEqual({
      type: 'trail',
      group: 'world',
      source_id: WHW,
      title: 'West Highland Way',
      url: 'https://en.wikipedia.org/wiki/West_Highland_Way',
      country: 'Великобритания',
      distance_km: 153.3,
      days: 8,
      ascent_m: 3179,
      max_alt_m: 550,
      grade: 'hiking',
      months: YEAR,
      effort: 'hike',
      attribution: 'OpenStreetMap, Wikidata, Copernicus DEM, NASA POWER',
    })
    expect(cardOf(GR20)).toMatchObject({ days: 16, days_estimated: true, effort: 'alpine', effort_by_grade: true, months: [6, 7, 8, 9, 10] })
  })

  // #3431 А2: метка Wikidata на языке карточки бывает записана на языке страны — название берётся из псевдонима.
  it('название: английская метка польской тропы — польская, берётся английский псевдоним; остальные локали не меняются', () => {
    expect(cardOf(SUDETES, 'en').title).toBe('Main Sudetes Trail')
    expect(cardOf(SUDETES, 'pl').title).toBe('Główny Szlak Sudecki')
    expect(cardOf(SUDETES, 'ru').title).toBe('Главный судетский маршрут')
    expect(cardOf(SUDETES, 'be').title).toBe('Галоўны судэцкі маршрут')
    expect(cardOf(SUDETES, 'uk').title).toBe('Головний судетський маршрут')
    const open = WORLD_OPEN_LAYER.find((record) => record.source_id === SUDETES)!
    // Псевдоним — тот же язык, что метка: вариант названия и сокращение переводом не считаются.
    expect(trailTitle({ ...open, aliases: { en: ['Szlak Sudecki im. Orłowicza'] } }, 'en')).toBe('Główny Szlak Sudecki')
    expect(trailTitle({ ...open, aliases: { en: ['GSS'] } }, 'en')).toBe('Główny Szlak Sudecki')
    expect(trailTitle({ ...open, aliases: { pl: ['Main Sudetes Trail'], en: ['Main Sudetes Trail'] } }, 'en')).toBe('Główny Szlak Sudecki')
    // Английское название новозеландской тропы в польской локали: псевдоним «Tongariro Crossing» — сокращение
    // той же метки (общие слова), переводом не считается; правило осторожное — метка остаётся.
    const nz = { ...open, countries: [{ qid: 'Q664', names: { en: 'New Zealand' } }], labels: { pl: 'Tongariro Alpine Crossing', en: 'Tongariro Alpine Crossing' }, aliases: { pl: ['Tongariro Crossing'] } }
    expect(trailTitle(nz, 'pl')).toBe('Tongariro Alpine Crossing')
    // Страна вне списка языков сайта (метки совпали, но язык страны неизвестен) — метка остаётся.
    expect(trailTitle({ ...open, countries: [{ qid: 'Q142', names: { en: 'France' } }] }, 'en')).toBe('Główny Szlak Sudecki')
    // Нет метки на языке карточки — прежний запас: английская, затем любая, затем название статьи.
    expect(trailTitle({ ...open, labels: { pl: 'Szlak' }, aliases: {} }, 'ru')).toBe('Szlak')
    expect(cardOf(WHW, 'ru').title).toBe('West Highland Way')
  })

  it('разбор карточки из потока: годная проходит как есть, кривые поля отбрасываются', () => {
    const card = cardOf(TMB)
    expect(parseWorldTrail(JSON.parse(JSON.stringify(card)))).toEqual(card)
    expect(parseWorldTrail({ ...card, distance_km: '166', days: -3, months: [7, 8, 13, 'x', 8], grade: 'T2', effort: 'extreme', effort_by_grade: true })).toEqual({
      type: 'trail',
      group: 'world',
      source_id: card.source_id,
      title: card.title,
      url: card.url,
      country: card.country,
      ascent_m: card.ascent_m,
      max_alt_m: card.max_alt_m,
      months: [7, 8],
      attribution: card.attribution,
    })
  })

  it('без названия, идентификатора, https-адреса или группы world карточки нет', () => {
    const card = cardOf(TMB)
    for (const broken of [{ ...card, title: ' ' }, { ...card, source_id: '' }, { ...card, url: 'http://en.wikipedia.org/wiki/X' }, { ...card, url: '/wiki/X' }, { ...card, url: 'javascript:alert(1)' }, { ...card, group: 'match' }, { ...card, type: 'travel' }, null, 'trail']) {
      expect(parseWorldTrail(broken)).toBeNull()
    }
  })

  it('клиент потока: маршруты мира отделяются от карточек сайта; сборка, не знающая вида, их просто не видит', () => {
    const site = { type: 'travel', source_id: '816', title: 'Ярмарки Польши', url: 'https://metravel.by/travels/816', snippet: 'Польша' }
    const event = parseAskSseEvent(`event: sources\ndata: ${JSON.stringify({ sources: [site, cardOf(WHW), cardOf(TMB), { type: 'trail', group: 'world', title: 'x' }], degraded: false, remaining: 5, world_layer_url: 'https://metravel.by/assets/data/world-trails-osm.jsonl' })}`)
    expect(event?.name).toBe('sources')
    const data = event!.data as { sources: AiSource[]; world?: AiWorldTrail[]; worldLayerUrl?: string }
    expect(data.sources.map((source) => source.type)).toEqual(['travel'])
    expect(data.world?.map((trail) => trail.source_id)).toEqual([WHW, TMB])
    expect(data.worldLayerUrl).toBe(`https://metravel.by${WORLD_OSM_LAYER_PUBLIC_PATH}`)
    // Без маршрутов мира событие прежней формы: ни `world`, ни адреса слоя.
    expect(parseAskSseEvent(`event: sources\ndata: ${JSON.stringify({ sources: [site], degraded: false, remaining: 5, world_layer_url: 'https://metravel.by/x' })}`)!.data).toEqual({
      sources: [expect.objectContaining({ type: 'travel' })],
      degraded: false,
      remaining: 5,
    })
    expect(parseAskSseEvent('event: done\ndata: {"status":"done","removed_links":2,"removed_world_links":1}')!.data).toMatchObject({ removedLinks: 2, removedWorldLinks: 1 })
    expect(parseAskSseEvent('event: done\ndata: {"status":"done","removed_links":0}')!.data).not.toHaveProperty('removedWorldLinks')
  })

  it('месяцы складываются в диапазоны, сезон через Новый год — один диапазон, круглый год — пусто', () => {
    expect(monthRanges([6, 7, 8, 9, 10])).toEqual([[6, 10]])
    expect(monthRanges([1, 2, 3, 12])).toEqual([[12, 3]])
    expect(monthRanges([4, 5, 9])).toEqual([[4, 5], [9, 9]])
    expect(monthRanges(YEAR)).toEqual([])
    expect(monthRanges([])).toEqual([])
    expect(monthsLabelRu([1, 2, 3, 12])).toBe('декабрь–март')
    expect(monthsLabelRu([4, 5, 9])).toBe('апрель–май, сентябрь')
  })

  it('набор высоты округляется до сотни, высшая точка — до десяти метров', () => {
    expect(roundClimb(9912)).toBe(9900)
    expect(roundClimb(521)).toBe(520)
    expect(roundAltitude(2536)).toBe(2540)
  })

  it('строка фактов: страна, длина, дни, набор, высота, ступень и месяцы — с пометками оценки и разметки', () => {
    expect(trailFactsLine(cardOf(TMB))).toBe(
      'Швейцария, Франция, Италия. Длина: 166 км. Дней: около 9 (оценка). Набор высоты: около 9 900 м. Высшая точка: 2 540 м. Нагрузка: поход для подготовленных. Без снега по климатической норме: июль–август',
    )
    expect(trailFactsLine(cardOf(GR20))).toContain('Нагрузка: нужен горный опыт (по разметке OpenStreetMap). Без снега по климатической норме: июнь–октябрь')
    expect(trailFactsLine(cardOf(WHW))).toBe('Великобритания. Длина: 153 км. Дней: 8. Набор высоты: около 3 200 м. Высшая точка: 550 м. Нагрузка: поход. Без устойчивого снега круглый год (по норме)')
    expect(trailFactsLine({ country: null })).toBe('')
    expect(LOAD_STEPS.map((step) => LOAD_STEP_RU[step])).toEqual(['прогулка', 'поход', 'поход для подготовленных', 'нужен горный опыт'])
  })
})

describe('маршруты мира: условия вопроса сверяет judgeCard', () => {
  const judge = (question: string, id: string) => judgeCard(parseConditions(question), { type: 'trail', trail: cardOf(id) })

  it('длина: длиннее названной границы — убрать, в пределах — совпало', () => {
    expect(judge('Пеший маршрут не более 100 км', WHW)).toMatchObject({ dropped: true })
    expect(judge('Пеший маршрут не более 100 км', PEDDARS)).toMatchObject({ dropped: false, reasons: ['пеший маршрут', '75 км'] })
    expect(judge('Хочу длинный поход, не короче 100 км', PEDDARS)).toMatchObject({ dropped: true })
    expect(judge('Хочу длинный поход, не короче 100 км', CAMINO)).toMatchObject({ dropped: false, reasons: ['пеший маршрут', '768 км'] })
  })

  it('месяц вне расчётного сезона убирает маршрут; в сезоне — совпало', () => {
    expect(judge('Поход в ноябре', TMB)).toMatchObject({ dropped: true })
    expect(judge('Поход в ноябре', GR20)).toMatchObject({ dropped: true })
    expect(judge('Поход в июле', TMB)).toMatchObject({ dropped: false, reasons: ['без снега по норме: июль', 'пеший маршрут'] })
    // Южное полушарие: Kepler Track без снега с декабря по март.
    expect(judge('Поход в январе', KEPLER)).toMatchObject({ dropped: false })
    expect(judge('Поход в июле', KEPLER)).toMatchObject({ dropped: true })
  })

  it('вердикт «круглый год» условие месяца не нарушает и не усиливает', () => {
    const verdict = judge('Поход в ноябре', WHW)
    expect(verdict).toMatchObject({ dropped: false, reasons: ['пеший маршрут'], score: 1 })
  })

  // #3431 (приёмка на полном индексе): пять маршрутов без расчёта месяцев проходили условие месяца.
  it('маршрут без факта о месяцах на вопрос с месяцем не предлагается; без месяца в вопросе — как прежде', () => {
    const noMonths = { type: 'trail' as const, trail: { ...cardOf(WHW), months: undefined } }
    expect(judgeCard(parseConditions('Поход в ноябре'), noMonths)).toMatchObject({ dropped: true })
    expect(judgeCard(parseConditions('Поход летом'), { type: 'trail', trail: { ...cardOf(WHW), months: [] } })).toMatchObject({ dropped: true })
    expect(judgeCard(parseConditions('Поход не длиннее 200 км'), noMonths)).toMatchObject({ dropped: false })
    // У статьи сайта без месяцев условие по-прежнему не нарушено: неизвестно — не нарушено.
    expect(judgeCard(parseConditions('Поход в ноябре'), { type: 'travel', facts: { type: 'travel', source_id: 1, categories: ['Поход'] } })).toMatchObject({ dropped: false })
  })

  // #3431: «на неделю» давало маршруты на один день.
  it('число дней — и нижняя граница: «на неделю» — не маршрут на день; «на выходные» — и однодневный годится', () => {
    const days = (count: number, estimated = false) => ({ type: 'trail' as const, trail: { ...cardOf(WHW), days: count, ...(estimated ? { days_estimated: true } : {}) } })
    const week = parseConditions('Поход на неделю')
    expect(week.maxDays).toBe(7)
    expect([1, 2, 3].map((count) => judgeCard(week, days(count)).dropped)).toEqual([true, true, true])
    expect([4, 5, 7].map((count) => judgeCard(week, days(count)).dropped)).toEqual([false, false, false])
    expect(judgeCard(week, days(1, true)).dropped).toBe(true)
    expect(judgeCard(parseConditions('Поход на 5 дней'), days(2)).dropped).toBe(true)
    expect(judgeCard(parseConditions('Поход на 5 дней'), days(3)).dropped).toBe(false)
    // До трёх дней нижней границы нет.
    expect(judgeCard(parseConditions('Поход на выходные'), days(1))).toMatchObject({ dropped: false, reasons: expect.arrayContaining(['1 день']) })
    expect(TRAIL_MIN_DAYS_FROM).toBe(3)
    expect(TRAIL_MIN_DAYS_SHARE).toBe(0.5)
    // Точная граница: с трёх дней — «не короче двух», на двух днях нижней границы ещё нет.
    expect([1, 2].map((count) => judgeCard(parseConditions('Поход на 3 дня'), days(count)).dropped)).toEqual([true, false])
    expect(judgeCard(parseConditions('Поход на 2 дня'), days(1)).dropped).toBe(false)
    // Статья сайта на один день по-прежнему отвечает на «поездку на неделю».
    expect(judgeCard(week, { type: 'travel', facts: { type: 'travel', source_id: 1, number_days: 1 } }).dropped).toBe(false)
  })

  it('дни по этапам сверяются строго, оценочные — с запасом в полтора раза', () => {
    expect(TRAIL_ESTIMATE_SLACK).toBe(1.5)
    // West Highland Way — 8 этапов источника.
    expect(judge('Поход на 7 дней', WHW)).toMatchObject({ dropped: true })
    expect(judge('Поход на 8 дней', WHW)).toMatchObject({ dropped: false, reasons: ['8 дней', 'пеший маршрут'] })
    // Tour du Mont Blanc — около 9 дней по оценке: на 7 дней не нарушение и не совпадение, на 6 — нарушение.
    expect(judge('Поход на 7 дней', TMB)).toMatchObject({ dropped: false, reasons: ['пеший маршрут'] })
    expect(judge('Поход на 6 дней', TMB)).toMatchObject({ dropped: true })
    expect(judge('Поход на 10 дней', TMB)).toMatchObject({ dropped: false, reasons: ['около 9 дней', 'пеший маршрут'] })
  })

  it('«для новичков»: прогулка совпала, маршрут для подготовленных и с горным опытом убран', () => {
    const walk = { ...cardOf(PEDDARS), effort: 'walk' as const }
    expect(judgeCard(parseConditions('Лёгкий пеший маршрут для новичков'), { type: 'trail', trail: walk })).toMatchObject({ dropped: false, reasons: expect.arrayContaining(['прогулка']) })
    expect(judge('Лёгкий пеший маршрут для новичков', PEDDARS)).toMatchObject({ dropped: false })
    expect(judge('Лёгкий пеший маршрут для новичков', TMB)).toMatchObject({ dropped: true })
    expect(judge('Лёгкий пеший маршрут для новичков', GR20)).toMatchObject({ dropped: true })
  })

  it('велосипедный вопрос маршрут мира не совпадает и по длине не сверяет; вид материала к нему не относится', () => {
    // Другой вид маршрута — явное нарушение (#3416): на вопрос о веломаршруте блок «Ещё в мире» и не строится.
    expect(judge('Веломаршрут до 30 км', PEDDARS)).toMatchObject({ dropped: true, reasons: [], score: -1 })
    // «Какие статьи о походах» — вид материала `travel`: маршруту мира это ни плюс, ни минус.
    const conditions = parseConditions('Пеший маршрут до 100 км')
    expect(conditions.kind).toBe('travel')
    expect(judgeCard(conditions, { type: 'trail', trail: cardOf(PEDDARS) }).score).toBe(2)
  })

  it('факты маршрута мира не читаются у карточки сайта', () => {
    const conditions = parseConditions('Пеший маршрут не более 100 км')
    expect(judgeCard(conditions, { type: 'travel', trail: cardOf(WHW) })).toMatchObject({ dropped: false, reasons: [] })
  })
})

describe('маршруты мира: подбор второго яруса', () => {
  const pick = (question: string, locale: 'ru' | 'be' | 'uk' | 'pl' | 'en' = 'ru') => selectWorldTrails(question, candidates(question, locale))

  it('включается только на вопрос о пешем маршруте', () => {
    expect(asksForWorldTrails(parseConditions('Пеший маршрут не более 100 км в ноябре'))).toBe(true)
    for (const question of ['Какие квесты есть в Гродно?', 'Где дешёвые отели в Париже?', 'Куда поехать на выходные?', 'Веломаршрут до 30 км под Краковом', 'Сколько стоит квест?']) {
      expect(pick(question)).toEqual([])
    }
    expect(selectWorldTrails('Пеший маршрут до 100 км', [])).toEqual([])
    expect(selectWorldTrails(null, candidates(''))).toEqual([])
  })

  it('«Пеший маршрут не более 100 км в ноябре»: до трёх маршрутов, каждый не длиннее 100 км и не закрыт снегом в ноябре', () => {
    const trails = pick('Пеший маршрут не более 100 км в ноябре')
    expect(trails).toHaveLength(3)
    for (const trail of trails) {
      expect(trail.distance_km).toBeLessThanOrEqual(100)
      expect(trail.months === undefined || trail.months.includes(11)).toBe(true)
      expect(trail).toMatchObject({ type: 'trail', group: 'world' })
    }
    // Kepler Track (62 км) вне сезона в ноябре, Weg der Schweiz (35 км) — тоже: в блок не идут.
    expect(trails.map((trail) => trail.source_id)).not.toContain(KEPLER)
    expect(trails.map((trail) => trail.source_id)).not.toContain('Q361659')
  })

  it('на пяти языках условие длины соблюдается одинаково', () => {
    const questions: Array<[string, 'ru' | 'be' | 'uk' | 'pl' | 'en']> = [
      ['Пеший маршрут до 80 км', 'ru'],
      ['Пешы маршрут да 80 км', 'be'],
      ['Піший маршрут до 80 км', 'uk'],
      ['Szlak pieszy do 80 km', 'pl'],
      ['A hike of no more than 80 km', 'en'],
    ]
    for (const [question, locale] of questions) {
      const trails = pick(question, locale)
      expect({ question, count: trails.length }).toEqual({ question, count: 3 })
      expect(trails.every((trail) => (trail.distance_km ?? 0) <= 80)).toBe(true)
    }
  })

  it('длинный маршрут: «не короче 100 км» — известные длинные тропы, порядок — по известности и близости', () => {
    const trails = pick('Хочу длинный поход, не короче 100 км')
    expect(trails).toHaveLength(3)
    expect(trails.every((trail) => (trail.distance_km ?? 0) >= 100)).toBe(true)
    // Все четыре длинных маршрута фикстуры известны (15–22 статьи); короткие в блок не попали.
    expect([TMB, GR20, WHW, CAMINO, SUDETES]).toEqual(expect.arrayContaining(trails.map((trail) => trail.source_id)))
  })

  it('место вопроса: маршруты названной страны; страны без маршрутов — блока нет', () => {
    expect(pick('Szlak pieszy w Polsce', 'pl').map((trail) => trail.source_id)).toEqual([SUDETES])
    expect(pick('Пеший маршрут в Испании').map((trail) => trail.source_id)).toEqual([CAMINO])
    expect(pick('Пеший маршрут в Беларуси до 100 км')).toEqual([])
    expect(pick('Szlak pieszy do 100 km w Polsce', 'pl')).toEqual([])
    // Место есть, а условие не выполнено: единственный маршрут Польши длиннее 100 км.
    expect(pick('Пеший маршрут в Польше до 100 км')).toEqual([])
  })

  it('регион внутри страны: Шотландия на трёх языках находит West Highland Way, а не всю Великобританию', () => {
    for (const [question, locale] of [['Пеший маршрут в Шотландии', 'ru'], ['Hiking trail in Scotland', 'en'], ['Szlak pieszy w Szkocji', 'pl']] as const) {
      expect({ question, ids: pick(question, locale).map((trail) => trail.source_id) }).toEqual({ question, ids: [WHW] })
    }
    // Страна по-прежнему даёт все свои маршруты: West Highland Way и Peddars Way.
    expect(pick('Пеший маршрут в Великобритании').map((trail) => trail.source_id).sort()).toEqual([PEDDARS, WHW].sort())
    expect(pick('Пеший маршрут в Англии').map((trail) => trail.source_id)).toEqual([PEDDARS])
  })

  it('остров с предлогом «на», горная система и штат: место берётся из газеттира индекса, а не из списка предлогов', () => {
    expect(pick('Пеший маршрут на Корсике').map((trail) => trail.source_id)).toEqual([GR20])
    expect(pick('Hiking trail on Corsica', 'en').map((trail) => trail.source_id)).toEqual([GR20])
    expect(pick('Szlak pieszy na Korsyce', 'pl').map((trail) => trail.source_id)).toEqual([GR20])
    expect(pick('Поход в Альпах на неделю').map((trail) => trail.source_id)).toEqual([TMB])
    expect(pick('Пеший маршрут в Тасмании').map((trail) => trail.source_id)).toEqual(['Q491216'])
    expect(pick('Пеший маршрут в Судетах').map((trail) => trail.source_id)).toEqual([SUDETES])
    // «На выходные», «на два дня», «на машине» местом не становятся: блок идёт как на вопрос без места.
    expect(pick('Пеший маршрут на выходные')).toHaveLength(3)
    expect(pick('Поход на два дня не длиннее 60 км').every((trail) => (trail.distance_km ?? 0) <= 60)).toBe(true)
  })

  it('общее слово в названиях мест двух маршрутов их не связывает: Альпы — не Weg der Schweiz и не GR 20', () => {
    // У «Трека вокруг Монблана» среди мест «Canton of Valais» и «Метраполія Францыі», у Weg der Schweiz —
    // «Canton of Uri», у GR 20 — «Метраполія Францыі»: на вопрос об Альпах идёт только первый.
    expect(pick('Пеший маршрут в Альпах').map((trail) => trail.source_id)).toEqual([TMB])
    expect(pick('Hiking trail in the Alps', 'en').map((trail) => trail.source_id)).toEqual([TMB])
    expect(pick('Пеший маршрут на Корсике не короче 100 км').map((trail) => trail.source_id)).toEqual([GR20])
  })

  it('место и условие вместе: маршруты места, не прошедшие условие, в блок не идут', () => {
    expect(pick('Поход в Альпах в ноябре')).toEqual([])
    expect(pick('Пеший маршрут в Шотландии до 100 км')).toEqual([])
    expect(pick('Пеший маршрут в Шотландии не короче 150 км').map((trail) => trail.source_id)).toEqual([WHW])
  })

  it('место, которого газеттир не знает, блок закрывает: чужие маршруты не показываются', () => {
    for (const question of ['Пеший маршрут в Нарнии на три дня', 'Hiking trail in Atlantis', 'Поход в Беларуси', 'Szlak pieszy w Bieszczadach']) {
      expect({ question, trails: pick(question) }).toEqual({ question, trails: [] })
    }
  })

  // #3416 п.4 и п.6: общий разбор места — страна на другом языке и в другом падеже, вопрос без заглавных букв.
  it('страна на языке вопроса и в его падеже: «we Włoszech», «у Британії» — по общей таблице стран', () => {
    expect(pick('Szlak pieszy we Włoszech', 'pl').map((trail) => trail.source_id)).toEqual([TMB])
    expect(pick('Піший маршрут в Італії', 'uk').map((trail) => trail.source_id)).toEqual([TMB])
    // В индексе украинское название страны — «Сполучене Королівство»: вопрос находит её по коду.
    expect(pick('Піший маршрут у Британії', 'uk').map((trail) => trail.source_id).sort()).toEqual([PEDDARS, WHW].sort())
    expect(pick('Hiking trail in Poland', 'en').map((trail) => trail.source_id)).toEqual([SUDETES])
    expect(pick('Пешы маршрут у Польшчы', 'be').map((trail) => trail.source_id)).toEqual([SUDETES])
  })

  it('слово страны в названии места остаётся только у страны и в чужом падеже: «Jura Szwabska w Niemczech»', () => {
    const place = gazetteerPlace(['Jura Szwabska w Niemczech', 'Саксония'], ['Niemcy', 'Германия', 'Germany'])
    expect(place.cities).toEqual(['Jura', 'Szwabska', 'Саксония'])
    // Чужая страна в названии места остаётся местом: штат Джорджия у маршрута США Грузией не считается.
    expect(gazetteerPlace(['Georgia'], ['США', 'United States']).cities).toEqual(['Georgia'])
  })

  it.each<[string, 'ru' | 'be' | 'uk' | 'pl' | 'en', string]>([
    ['пеший маршрут в шотландии', 'ru', WHW],
    ['Пеший маршрут в шотландии не короче 100 км', 'ru', WHW],
    ['пешы маршрут у шатландыі', 'be', WHW],
    ['піший маршрут у шотландії', 'uk', WHW],
    ['szlak pieszy w szkocji', 'pl', WHW],
    ['hiking trail in scotland', 'en', WHW],
    ['пеший маршрут на корсике', 'ru', GR20],
    ['szlak pieszy w polsce', 'pl', SUDETES],
  ])('вопрос без заглавных букв: место читается по предлогу — «%s»', (question, locale, id) => {
    expect(pick(question, locale).map((trail) => trail.source_id)).toEqual([id])
  })

  it('вопрос без заглавных: страна без маршрутов в индексе блок закрывает, слово без места — нет', () => {
    for (const question of ['пеший маршрут в беларуси', 'hiking trail in belarus', 'szlak pieszy na białorusi', 'Пеший маршрут с Анной по беларуси']) {
      expect({ question, trails: pick(question) }).toEqual({ question, trails: [] })
    }
    expect(pick('пеший маршрут на выходные')).toHaveLength(3)
    expect(pick('пеший маршрут в горах на неделю')).toHaveLength(3)
  })

  // #3357, приёмка на полном индексе (781 маршрут). D1: место вопроса совпадало со словами газеттира по общему
  // началу. Названия мест — из полного индекса: Нара и Норрботтен, Швабский Альб, Альберта, Альбасете, Альфёльд.
  describe('полный индекс: место — падежная форма названия, а не общее начало (#3357, D1)', () => {
    type Place = { qid: string; names: Record<string, string> }
    const ALPS: Place = { qid: 'Q1286', names: { ru: 'Альпы', be: 'Альпы', uk: 'Альпи', pl: 'Alpy', en: 'Alps' } }
    const GRAIAN: Place = { qid: 'Q1262', names: { ru: 'Грайские Альпы', be: 'Грайскія Альпы', uk: 'Грайські Альпи', pl: 'Alpy Graickie', en: 'Graian Alps' } }
    const PACA: Place = { qid: 'Q15104', names: { ru: 'Прованс — Альпы — Лазурный Берег', be: 'рэгіён Праванс — Альпы — Лазурны Бераг', uk: 'Прованс — Альпи — Лазурний Берег', pl: 'Prowansja-Alpy-Lazurowe Wybrzeże', en: "Provence-Alpes-Côte d'Azur" } }
    const DINARIC: Place = { qid: 'Q189915', names: { ru: 'Динарское нагорье', be: 'Дынарскае нагор’е', uk: 'Динарські Альпи', pl: 'Góry Dynarskie', en: 'Dinaric Alps' } }
    const SCOTLAND: Place = { qid: 'Q22', names: { ru: 'Шотландия', be: 'Шатландыя', uk: 'Шотландія', pl: 'Szkocja', en: 'Scotland' } }
    const NOVA_SCOTIA: Place = { qid: 'Q1952', names: { ru: 'Новая Шотландия', be: 'Новая Шатландыя', uk: 'Нова Шотландія', pl: 'Nowa Szkocja', en: 'Nova Scotia' } }
    const TATRAS: Place = { qid: 'Q194263', names: { ru: 'Татры', be: 'Татры', uk: 'Татри', pl: 'Tatry', en: 'Tatra Mountains' } }
    const HIGH_TATRAS: Place = { qid: 'Q189689', names: { ru: 'Высокие Татры', be: 'Высокія Татры', uk: 'Високі Татри', pl: 'Tatry Wysokie', en: 'High Tatras' } }
    const TATRAS_TWIN: Place = { qid: 'Q999001', names: { ru: 'Татры', pl: 'Tatry', en: 'Tatras' } }
    const SAXON: Place = { qid: 'Q157080', names: { ru: 'Саксонская Швейцария', pl: 'Szwajcaria Saksońska', en: 'Saxon Switzerland' } }
    const plain = (qid: string, ...names: string[]): Place => ({ qid, names: Object.fromEntries(names.map((name, index) => [['ru', 'be', 'uk', 'pl', 'en'][index], name])) })
    const trails: Array<{ id: string; places: Place[]; countries: string[]; km?: number; months?: number[] }> = [
      { id: 'tmb', places: [GRAIAN, ALPS], countries: ['Франция', 'France', 'Francja'] },
      { id: 'graian-only', places: [GRAIAN], countries: ['Италия', 'Italy', 'Włochy'] },
      { id: 'gr2013', places: [PACA], countries: ['Франция', 'France', 'Francja'] },
      { id: 'premuzic', places: [DINARIC], countries: ['Хорватия', 'Croatia'] },
      { id: 'schwab', places: [plain('Q1', 'Швабский Альб', 'Швабскі Альб', 'Швабський Альб', 'Jura Szwabska', 'Swabian Jura')], countries: ['Германия', 'Germany', 'Niemcy'] },
      { id: 'alberta', places: [plain('Q2', 'Альберта', 'Альберта', 'Альберта', 'Alberta', 'Alberta')], countries: ['Канада', 'Canada'] },
      { id: 'albacete', places: [plain('Q3', 'Альбасете', 'Альбасетэ', 'Альбасете', 'Albacete', 'Albacete')], countries: ['Испания', 'Spain'] },
      { id: 'alfold', places: [plain('Q4', 'Альфёльд', 'Альфельд', 'Альфельд', 'Wielka Nizina Węgierska', 'Great Hungarian Plain')], countries: ['Венгрия', 'Hungary'] },
      { id: 'alta', places: [plain('Q5', 'Альта', 'Альта', 'Альта', 'Alta', 'Alta'), plain('Q6', 'Альо', 'Альо', 'Альо', 'Ålö', 'Ålö')], countries: ['Норвегия', 'Norway'] },
      { id: 'nara', places: [plain('Q7', 'Нара', 'Нара', 'Нара', 'Nara', 'Nara')], countries: ['Япония', 'Japan'] },
      { id: 'norrbotten', places: [plain('Q8', 'Норботтен', 'Нарботэн', 'Норрботтен', 'Norrbotten', 'Norrbotten')], countries: ['Швеция', 'Sweden'] },
      { id: 'whw', places: [SCOTLAND], countries: ['Великобритания', 'United Kingdom'] },
      { id: 'skyline', places: [NOVA_SCOTIA], countries: ['Канада', 'Canada'] },
      { id: 'tatra', places: [TATRAS, HIGH_TATRAS], countries: ['Словакия', 'Slovakia', 'Słowacja'] },
      { id: 'tatra-twin', places: [TATRAS_TWIN], countries: ['Польша', 'Poland', 'Polska'] },
      { id: 'malerweg', places: [SAXON], countries: ['Германия', 'Germany', 'Niemcy'] },
      { id: 'swiss', places: [], countries: ['Швейцария', 'Switzerland', 'Szwajcaria'] },
      { id: 'e1', places: [plain('Q9', 'Северная Европа', 'Паўночная Еўропа', 'Північна Європа', 'Europa Północna', 'Northern Europe')], countries: ['Норвегия', 'Norway'], km: 2733 },
      // Второй круг: страны других частей света — названиями, как их отдаёт Wikidata (см. `worldIndexCountries.ts`).
      { id: 'rota', places: [], countries: ['Португалия', 'Portugal', 'Portugalia'], km: 220 },
      { id: 'kungs', places: [], countries: ['Швеция', 'Sweden', 'Szwecja'], months: [6, 7, 8, 9] },
      { id: 'lycian', places: [], countries: ['Турция', 'Турцыя', 'Туреччина', 'Turcja', 'Turkey'] },
      { id: 'sultans', places: [], countries: ['Венгрия', 'Hungary', 'Болгария', 'Bulgaria', 'Турция', 'Turkey'] },
      { id: 'annapurna', places: [], countries: ['Непал', 'Nepal'] },
      { id: 'appalachian', places: [], countries: ['США', 'Злучаныя Штаты Амерыкі', 'Сполучені Штати Америки', 'Stany Zjednoczone', 'United States'] },
      { id: 'condor', places: [], countries: ['Чили', 'Чылі', 'Чилі', 'Chile'] },
      { id: 'kepler', places: [], countries: ['Новая Зеландия', 'Новая Зеландыя', 'Нова Зеландія', 'Nowa Zelandia', 'New Zealand'] },
      { id: 'otter', places: [], countries: ['ЮАР', 'Паўднёва-Афрыканская Рэспубліка', 'Південно-Африканська Республіка', 'Południowa Afryka', 'South Africa'] },
      // Страны нет в таблице: часть света определить нельзя.
      { id: 'nowhere', places: [], countries: ['Зеленогория', 'Zelenogoria'] },
    ]
    const borrowed = borrowedPlaceWords(trails.flatMap((trail) => trail.places))
    const pool: WorldCandidate[] = trails.map((trail, index) => ({
      card: { ...cardOf(WHW), source_id: trail.id, title: trail.id, distance_km: trail.km ?? 60, days: 3, months: trail.months ?? YEAR },
      similarity: 1 - index / 100,
      fame: 10,
      place: gazetteerPlace(trail.places.flatMap((place) => ownPlaceNames(place, borrowed)), trail.countries),
      titles: [],
    }))
    const found = (question: string) => selectWorldTrails(question, pool, 100).map((trail) => trail.source_id).sort()

    it.each(['Пеший маршрут в Нарнии на три дня', 'Пешы маршрут у Нарніі', 'Піший маршрут у Нарнії', 'Szlak pieszy w Narnii', 'Hiking trail in Narnia'])('«%s» — места нет: блока нет', (question) => {
      expect(found(question)).toEqual([])
    })

    it.each([
      ['Пеший маршрут в Альпах', ['graian-only', 'tmb']],
      ['Поход в Альпах для новичков', ['graian-only', 'tmb']],
      ['Пешы маршрут у Альпах', ['graian-only', 'tmb']],
      ['Піший маршрут в Альпах', ['graian-only', 'tmb']],
      ['Szlak pieszy w Alpach', ['graian-only', 'tmb']],
      ['Hiking trail in the Alps', ['graian-only', 'tmb']],
    ])('«%s» — только Альпы: ни Швабского Альба, ни Альберты, ни региона «Прованс — Альпы — Лазурный Берег»', (question, expected) => {
      // «Для новичков» отсеивает по ступени: у фикстуры ступень «поход» — проходит.
      expect(found(question)).toEqual(expected)
    })

    it('прежние формы не ломаются: падежи названия на пяти языках', () => {
      expect(found('Пеший маршрут в Шотландии')).toEqual(['whw'])
      expect(found('Пешы маршрут у Шатландыі')).toEqual(['whw'])
      expect(found('Піший маршрут у Шотландії')).toEqual(['whw'])
      expect(found('Szlak pieszy w Szkocji')).toEqual(['whw'])
      expect(found('Hiking trail in Scotland')).toEqual(['whw'])
      expect(found('Пеший маршрут в Татрах')).toEqual(['tatra', 'tatra-twin'])
      expect(found('Szlak pieszy w Tatrach')).toEqual(['tatra', 'tatra-twin'])
      expect(found('A hike in the Tatras')).toEqual(['tatra', 'tatra-twin'])
      expect(found('Пеший маршрут в Альберте')).toEqual(['alberta'])
      expect(found('Пеший маршрут в Наре')).toEqual(['nara'])
      expect(found('Szlak pieszy w Niemczech')).toEqual(['malerweg', 'schwab'])
    })

    it('чужое слово в названии места: «Новая Шотландия» — не Шотландия, «Dinaric Alps» — не Альпы; тёзки и «Высокие Татры» остаются', () => {
      expect([...(borrowed.get(NOVA_SCOTIA.qid) ?? [])]).toEqual(expect.arrayContaining(['шотландия', 'scotland']))
      expect([...(borrowed.get(PACA.qid) ?? [])]).toEqual(expect.arrayContaining(['альпы', 'alps']))
      expect([...(borrowed.get(DINARIC.qid) ?? [])]).toEqual(expect.arrayContaining(['альпи', 'alps']))
      for (const kept of [GRAIAN, HIGH_TATRAS, TATRAS, TATRAS_TWIN, SCOTLAND, ALPS]) expect({ qid: kept.qid, borrowed: borrowed.has(kept.qid) }).toEqual({ qid: kept.qid, borrowed: false })
      // Своё слово региона остаётся: «в Провансе» по-прежнему находит его маршрут.
      expect(ownPlaceNames(PACA, borrowed)).toContain('Прованс —  — Лазурный Берег')
      expect(found('Пеший маршрут в Провансе')).toEqual(['gr2013'])
      expect(found('Hiking trail in Nova Scotia')).toEqual(['skyline'])
    })

    it('страна и место с её именем: «в Швейцарии» — маршруты Швейцарии, а не Саксонской Швейцарии', () => {
      expect(found('Пеший маршрут в Швейцарии')).toEqual(['swiss'])
      expect(found('Hiking trail in Switzerland')).toEqual(['swiss'])
    })

    // D2 и второй круг: часть света — не слово газеттира, а отбор по странам этой части света. В первом круге
    // «в Европе … до 100 км» отдавал весь индекс — в блоке стоял Main Range walk (Австралия).
    const EUROPE_UNDER_100 = ['albacete', 'alfold', 'alta', 'gr2013', 'graian-only', 'kungs', 'malerweg', 'norrbotten', 'premuzic', 'schwab', 'sultans', 'swiss', 'tatra', 'tatra-twin', 'tmb', 'whw']
    it.each(['Пеший маршрут в Европе до 100 км', 'Пешы маршрут у Еўропе да 100 км', 'Піший маршрут у Європі до 100 км', 'Szlak pieszy w Europie do 100 km', 'Hiking trail in Europe under 100 km', 'пеший маршрут в европе до 100 км'])(
      '«%s» — только страны Европы: ни Канады, ни Японии, ни США, ни Турции, ни страны вне таблицы',
      (question) => {
        expect(found(question)).toEqual(EUROPE_UNDER_100)
      },
    )

    it.each(['Пеший маршрут в Азии', 'Пешы маршрут у Азіі', 'Піший маршрут в Азії', 'Szlak pieszy w Azji', 'Hiking trail in Asia', 'пеший маршрут в азии'])('«%s» — страны Азии, европейских нет; Турция — Азия, маршрут через обе части света — в обеих', (question) => {
      expect(found(question)).toEqual(['annapurna', 'lycian', 'nara', 'sultans'])
    })

    it('часть света пересекается с месяцем и длиной: «в Европе в ноябре до 100 км» применяет все три условия', () => {
      // Без «rota» (220 км), «e1» (2 733 км) и «kungs» (месяцы июнь — сентябрь).
      expect(found('Пеший маршрут в Европе в ноябре до 100 км')).toEqual(EUROPE_UNDER_100.filter((id) => id !== 'kungs'))
      expect(found('Пеший маршрут в Европе')).toEqual([...EUROPE_UNDER_100, 'e1', 'rota'].sort())
      expect(found('Пеший маршрут в Европе длиннее 200 км')).toEqual(['e1', 'rota'])
    })

    it('обе Америки, одна из них, Океания, Африка, Евразия — на языке вопроса', () => {
      expect(found('Пеший маршрут в Америке')).toEqual(['alberta', 'appalachian', 'condor', 'skyline'])
      for (const question of ['Пеший маршрут в Южной Америке', 'Пешы маршрут у Паўднёвай Амерыцы', 'Піший маршрут у Південній Америці', 'Szlak pieszy w Ameryce Południowej', 'Hiking trail in South America', 'пеший маршрут в южной америке']) {
        expect({ question, ids: found(question) }).toEqual({ question, ids: ['condor'] })
      }
      for (const question of ['Пеший маршрут в Северной Америке', 'Szlak pieszy w Ameryce Północnej', 'Hiking trail in North America']) {
        expect({ question, ids: found(question) }).toEqual({ question, ids: ['alberta', 'appalachian', 'skyline'] })
      }
      expect(found('Пеший маршрут в Океании')).toEqual(['kepler'])
      for (const question of ['Пеший маршрут в Африке', 'Пешы маршрут у Афрыцы', 'Піший маршрут в Африці', 'Szlak pieszy w Afryce', 'Hiking trail in Africa']) expect({ question, ids: found(question) }).toEqual({ question, ids: ['otter'] })
      expect(found('Пеший маршрут в Евразии до 100 км')).toEqual([...EUROPE_UNDER_100, 'annapurna', 'lycian', 'nara'].sort())
      expect(found('Пеший маршрут в Антарктиде')).toEqual([])
    })

    it('часть света рядом с местом и страной сужает отбор; уточнение «Северная Европа» газеттир не знает', () => {
      expect(found('Пеший маршрут в Европе, в Польше')).toEqual(['tatra-twin'])
      expect(found('Пеший маршрут в Альпах в Европе')).toEqual(['graian-only', 'tmb'])
      expect(found('Пеший маршрут в Азии в Альпах')).toEqual([])
      expect(found('Пеший маршрут в Северной Европе')).toEqual([])
      // Исключение часть света не называет — как страну и город: отбора нет.
      expect(found('Пеший маршрут в мире, кроме Европы')).toHaveLength(pool.length)
    })

    it('страна, чьё название газеттир на слова не раскладывает, находится по коду таблицы: «в США», «в ЮАР»', () => {
      expect(found('Пеший маршрут в США')).toEqual(['appalachian'])
      expect(found('Hiking trail in the USA')).toEqual(['appalachian'])
      expect(found('Пеший маршрут в ЮАР')).toEqual(['otter'])
      expect(found('Поход в Новой Зеландии')).toEqual(['kepler'])
      expect(found('Пеший маршрут в Чили')).toEqual(['condor'])
    })

    it('часть света в газеттир не идёт ни сама, ни из названия «Северная Европа», ни из названия страны', () => {
      expect(gazetteerPlace(['Европа', 'Северная Европа', 'Northern Europe', 'Азия', 'North America', 'Корсика'], ['Франция']).cities).toEqual(['Корсика'])
      const usa = gazetteerPlace([], ['США', 'Злучаныя Штаты Амерыкі', 'Сполучені Штати Америки', 'United States'])
      expect(usa.countries).toEqual(['Злучаныя', 'Штаты', 'Сполучені', 'Штати', 'States'])
      expect(usa.codes).toEqual(['US'])
      expect(gazetteerPlace([], ['Południowa Afryka', 'South Africa'])).toEqual({ cities: [], countries: [], codes: ['ZA'] })
      // Страны нет в таблице — кодов нет: под отбор по части света маршрут не пройдёт.
      expect(gazetteerPlace([], ['Зеленогория']).codes).toEqual([])
    })
  })

  // #3357, требование 5: слой полей OSM выложен производной базой под ODbL вместе с условиями.
  it('слой ODbL лежит по адресу из контракта: одна запись на маршрут, рядом — условия с лицензией и атрибуцией', () => {
    const fs = require('fs') as typeof import('fs')
    const path = require('path') as typeof import('path')
    const publicDir = path.join(__dirname, '../../../public')
    const lines = fs.readFileSync(path.join(publicDir, WORLD_OSM_LAYER_PUBLIC_PATH), 'utf8').trim().split('\n')
    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(records.length).toBeGreaterThan(500)
    expect(new Set(records.map((record) => record.source_id)).size).toBe(records.length)
    for (const record of records) {
      expect(String(record.source_id)).toMatch(/^Q\d+$/)
      expect(Number.isInteger(record.osm_relation)).toBe(true)
      expect(Number(record.distance_km)).toBeGreaterThan(0)
    }
    // В слое — только поля, посчитанные по геометрии OSM: названий и текстов из Википедии в нём нет.
    const allowed = ['source_id', 'osm_relation', 'distance_km', 'loop', 'lat', 'lng', 'ascent_m', 'descent_m', 'max_alt_m', 'min_alt_m', 'grade', 'days', 'days_estimated', 'effort_km', 'effort', 'effort_by_grade', 'months']
    expect([...new Set(records.flatMap((record) => Object.keys(record)))].filter((key) => !allowed.includes(key))).toEqual([])
    const terms = fs.readFileSync(path.join(publicDir, WORLD_OSM_LAYER_PUBLIC_PATH.replace(/\.jsonl$/, '-LICENSE.txt')), 'utf8')
    for (const required of ['Open Database License (ODbL) 1.0', 'https://opendatacommons.org/licenses/odbl/1-0/', '© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright', 'Copernicus WorldDEM-30', 'POWER Project', `${records.length} `]) {
      expect(terms).toContain(required)
    }
  })

  it('слова газеттира: каждое слово названия с заглавной буквы, без общих слов и месяцев', () => {
    expect(gazetteerWords(['Шотландия', 'Scottish Highlands', 'Новая Зеландия', 'North Island', 'Loch Lomond and The Trossachs National Park', 'May', 'Восточная Англия', 'Великобритания'])).toEqual([
      'Шотландия', 'Scottish', 'Highlands', 'Зеландия', 'Loch', 'Lomond', 'Trossachs', 'Англия', 'Великобритания',
    ])
    // Слово страны в названии места («метрополия Франции») остаётся только у страны.
    expect(gazetteerPlace(['метрополия Франции', 'Корсика', 'Great Britain'], ['Франция', 'France'])).toEqual({ cities: ['Корсика', 'Britain'], countries: ['Франция', 'France'], codes: ['FR'] })
  })

  it('общее слово названия место не называет: «Новая тропа» — не Новая Зеландия, «North» — не Северный остров', () => {
    const kepler = pick('Новая тропа для похода на 5 дней').map((trail) => trail.source_id)
    expect(kepler).toHaveLength(3)
    expect(pick('Поход в Новой Зеландии').map((trail) => trail.source_id)).toEqual([KEPLER])
  })

  it('месяц после предлога места — условие сезона, а не место', () => {
    const trails = pick('Which hiking trail can I walk in 4 days in June?', 'en')
    expect(trails.length).toBeGreaterThan(0)
    expect(trails.every((trail) => !trail.months || trail.months.includes(6))).toBe(true)
  })

  it('часть света отбором по месту не служит', () => {
    const trails = pick('Посоветуй многодневный пеший маршрут до 120 км в Европе')
    expect(trails).toHaveLength(3)
    expect(trails.every((trail) => (trail.distance_km ?? 0) <= 120)).toBe(true)
  })

  it('совпавшее условие сезона ставит маршрут выше маршрута «круглый год»', () => {
    // В июле у Tour du Mont Blanc и GR 20 сезон: условие месяца совпало, у West Highland Way — нет.
    const ids = selectWorldTrails('Поход в июле, не короче 150 км', candidates('Поход в июле, не короче 150 км'), 5).map((trail) => trail.source_id)
    expect(ids.slice(0, 3)).toEqual(expect.arrayContaining([TMB, GR20, SUDETES]))
    expect(ids.indexOf(WHW)).toBeGreaterThan(ids.indexOf(TMB))
    expect(ids.indexOf(CAMINO)).toBeGreaterThan(ids.indexOf(GR20))
  })

  it('вопрос из одного названия маршрута включает блок и не добавляет к нему другие маршруты', () => {
    expect(pick('West Highland Way', 'en').map((trail) => trail.source_id)).toEqual([WHW])
    expect(pick('Трек вокруг Монблана').map((trail) => trail.source_id)).toEqual([TMB])
    expect(pick('Расскажи про Tour du Mont Blanc').map((trail) => trail.source_id)).toEqual([TMB])
    expect(pick('Что такое Główny Szlak Sudecki?', 'pl').map((trail) => trail.source_id)).toEqual([SUDETES])
    // Однословное название маршрут не называет; вопрос не о маршрутах блока не получает.
    expect(pick('Какие квесты есть в Гродно?')).toEqual([])
  })

  // #3431: «Расскажи про GR 20» блока не получал — название короче порога.
  it('название-шифр из букв и номера называет маршрут, только когда написано заглавными и целиком', () => {
    for (const question of ['Расскажи про GR 20', 'Что такое GR 20?', 'Сколько дней идти GR20?', 'Tell me about GR 20']) {
      expect({ question, ids: pick(question).map((trail) => trail.source_id) }).toEqual({ question, ids: [GR20] })
    }
    // Строчными, другой номер и часть номера — не этот маршрут.
    for (const question of ['расскажи про gr 20', 'Расскажи про GR 2013', 'Расскажи про GR 2', 'Автобус 20 до вокзала']) {
      expect({ question, trails: pick(question) }).toEqual({ question, trails: [] })
    }
    expect(titleKeys(['GR 20', 'GR20', 'E4', 'E 4', 'A1', 'TMB 1', 'Camino'])).toEqual(['gr 20', 'gr20', 'tmb 1'])
  })

  it('названный маршрут стоит первым и условиями вопроса не отсеивается; остальные идут за ним', () => {
    // West Highland Way — 8 дней по этапам; спросили о нём «за 5 дней».
    const trails = pick('Пеший маршрут West Highland Way за 5 дней')
    expect(trails[0].source_id).toBe(WHW)
    expect(trails).toHaveLength(3)
    expect(trails.slice(1).every((trail) => !trail.days || (trail.days_estimated ? trail.days < 7.5 : trail.days <= 5))).toBe(true)
  })

  it('ключи названий: без диакритики и знаков; название от двух слов либо от восьми букв', () => {
    expect(titleKeys(['West Highland Way', 'Tour du Mont-Blanc', 'Główny Szlak Sudecki', 'E4', 'Camino', 'Kungsleden', 'The Way', null])).toEqual(['west highland way', 'tour du mont blanc', 'głowny szlak sudecki', 'kungsleden'])
    expect(namesTrail('Сколько дней идти Tour du Mont Blanc?', ['tour du mont blanc'])).toBe(true)
    expect(namesTrail('Tour du Mont-Blanc!', ['tour du mont blanc'])).toBe(true)
    // Только целыми словами: «Kungsledens» и часть названия маршрут не называют.
    expect(namesTrail('тур вокруг Mont Blanc', ['tour du mont blanc'])).toBe(false)
    expect(namesTrail('Kungsledenstuga', ['kungsleden'])).toBe(false)
    expect(namesTrail('', ['kungsleden'])).toBe(false)
  })

  it('название короче трёх слов — только с заглавной буквы у каждого слова: «a long trail» — не Long Trail', () => {
    expect(namesTrail('Hiking a long trail in Poland', ['long trail'])).toBe(false)
    expect(namesTrail('Hiking a Long trail in Poland', ['long trail'])).toBe(false)
    expect(namesTrail('Hike the Long Trail in Vermont', ['long trail'])).toBe(true)
    expect(namesTrail('пеший маршрут как kungsleden', ['kungsleden'])).toBe(false)
    expect(namesTrail('Пеший маршрут как Kungsleden', ['kungsleden'])).toBe(true)
    // Совпадение со строчной раньше в тексте не мешает найти написание с заглавной дальше.
    expect(namesTrail('long trail or Long Trail?', ['long trail'])).toBe(true)
    // От трёх слов регистр не важен.
    expect(namesTrail('west highland way за 5 дней', ['west highland way'])).toBe(true)
  })

  it('общие слова мест слоя газеттиром не становятся: пояс через Евразию, «Grand», польские слова с «ł», слова из трёх букв', () => {
    expect(gazetteerWords(['Alpide belt', 'Альпійска-Гімалайскі пояс', 'Средиземноморский складчатый пояс', 'Łańcuch alpejsko-himalajski', 'Grand Canyon', 'Dolny Śląsk', 'Północna Irlandia', 'Trenčiansky kraj', 'Мар-дель-Плата', 'Las Palmas'])).toEqual([
      'Śląsk', 'Irlandia', 'Trenčiansky', 'Плата', 'Palmas',
    ])
  })

  it('подбор детерминирован: тот же вопрос — те же маршруты в том же порядке', () => {
    const question = 'Пеший маршрут не более 100 км в ноябре'
    expect(pick(question)).toEqual(pick(question))
  })
})

describe('маршруты мира: страж содержания', () => {
  const site: AiSource[] = [
    { type: 'travel', source_id: '505', title: 'Mullerthal Trail: 112 км по Люксембургу', url: 'https://metravel.by/travels/mullerthal-trail', path: '/travels/mullerthal-trail', snippet: 'Люксембург. Дней: 6. Длина: 112 км. Месяц: май', score: 0.9 },
  ]
  const world = [cardOf(WHW), cardOf(TMB)]
  const context = { question: 'Пеший маршрут не более 120 км', promptSources: site, worldSources: world }

  it('внешняя ссылка вне внешних карточек вырезается и считается; ссылка на карточку сайта остаётся', () => {
    const raw = `Пройдите [Mullerthal Trail: 112 км по Люксембургу](${site[0].url}). Ещё есть [GR 20](https://en.wikipedia.org/wiki/GR_20).`
    const guarded = guardAnswer(raw, site, context)
    expect(guarded.text).toBe(`Пройдите [Mullerthal Trail: 112 км по Люксембургу](${site[0].url}).`)
    expect(guarded).toMatchObject({ removed: 1, removedWorld: 1, fallback: false })
  })

  it('число о маршруте мира из памяти модели — без опоры: фраза убирается', () => {
    const raw = `Пройдите [Mullerthal Trail: 112 км по Люксембургу](${site[0].url}) — 112 км. West Highland Way в Шотландии тянется на 154 км.`
    const guarded = guardAnswer(raw, site, context)
    expect(guarded.text).not.toContain('154')
    expect(guarded.text).toContain('112 км')
    expect(guarded.ungroundedNumbers).toBe(1)
  })

  it('без внешних карточек страж ведёт себя как раньше', () => {
    const raw = `Пройдите [Mullerthal Trail: 112 км по Люксембургу](${site[0].url}).`
    expect(guardAnswer(raw, site, { question: context.question, promptSources: site })).toMatchObject({ text: raw, removed: 0, removedWorld: 0, relabeled: 0 })
  })
})
