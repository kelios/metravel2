/**
 * Маршруты мира (#3357): карточка события `sources`, сверка условий вопроса тем же `judgeCard` и подбор
 * второго яруса. Фикстура — четырнадцать маршрутов внешнего индекса, без сети.
 */
import { guardAnswer } from '@/api/aiAssist/answerGuard'
import { parseAskSseEvent } from '@/api/aiAssist/askProvider'
import { judgeCard, parseConditions, TRAIL_ESTIMATE_SLACK } from '@/api/aiAssist/questionConditions'
import { type AiWorldTrail, LOAD_STEP_RU, LOAD_STEPS, monthRanges, monthsLabelRu, parseWorldTrail, roundAltitude, roundClimb, trailFactsLine, WORLD_OSM_LAYER_PUBLIC_PATH } from '@/api/aiAssist/trailFacts'
import type { AiSource } from '@/api/aiAssist/types'
import { asksForWorldTrails, selectWorldTrails, type WorldCandidate } from '@/api/aiAssist/worldTrails'
import { toTrailCard } from '@/scripts/ai-index/world/cards'

import { WORLD_OPEN_LAYER, WORLD_OSM_LAYER, worldFakeVector } from '../../fixtures/worldTrails'

const YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const cardOf = (id: string, locale: 'ru' | 'be' | 'uk' | 'pl' | 'en' = 'ru'): AiWorldTrail => {
  const osm = WORLD_OSM_LAYER.find((record) => record.source_id === id)!
  const open = WORLD_OPEN_LAYER.find((record) => record.source_id === id)!
  return toTrailCard(osm, open, locale)!
}

/** Кандидаты как у службы: карточка на языке вопроса, близость по вектору-заглушке, известность, названия. */
const candidates = (query: string, locale: 'ru' | 'be' | 'uk' | 'pl' | 'en' = 'ru'): WorldCandidate[] => {
  const vector = worldFakeVector(query)
  return WORLD_OSM_LAYER.map((osm) => {
    const open = WORLD_OPEN_LAYER.find((record) => record.source_id === osm.source_id)!
    const names = [...Object.values(open.labels), ...Object.values(open.descriptions), ...open.countries.flatMap((country) => Object.values(country.names))].join('. ')
    const own = worldFakeVector(names)
    return { card: toTrailCard(osm, open, locale)!, similarity: own.reduce((sum, value, index) => sum + value * vector[index], 0), fame: open.sitelinks, names }
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
    // Маршрут без факта о месяцах тоже не нарушил и не совпал.
    expect(judgeCard(parseConditions('Поход в ноябре'), { type: 'trail', trail: { ...cardOf(WHW), months: undefined } })).toMatchObject({ dropped: false, score: 1 })
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
    expect(judge('Веломаршрут до 30 км', PEDDARS)).toMatchObject({ dropped: false, reasons: [], score: -1 })
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
    // Место есть, а условие не выполнено: единственный маршрут Польши длиннее 100 км.
    expect(pick('Пеший маршрут в Польше до 100 км')).toEqual([])
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
