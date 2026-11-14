/**
 * #3357: маршруты мира в контуре оценки — блок «Ещё в мире» собирает код службы, поэтому проверки группы
 * `world` идут в слой подбора: маршруты блока не нарушают условие вопроса, а вопрос не о пеших маршрутах
 * блока не получает.
 */
import fs from 'fs'
import path from 'path'

import { createAskClient } from '@/api/aiAssist/askProvider'

import { createAskSession } from '../../../scripts/ai-assistant-eval/ask-path.mjs'
import { checkWorld, evaluateTurn, WORLD_ESTIMATE_SLACK } from '../../../scripts/ai-assistant-eval/checks.mjs'
import { loadCases } from '../../../scripts/ai-assistant-eval/run-core.mjs'
import { makeTempDir } from '../cli-test-utils'

type Trail = { id: string; title: string; country?: string | null; distance_km?: number; days?: number; days_estimated?: boolean; months?: number[]; effort?: string }

const YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const peddars: Trail = { id: 'Q2066153', title: 'Peddars Way', country: 'Великобритания', distance_km: 74.8, days: 3, days_estimated: true, months: YEAR, effort: 'hike' }
const tmb: Trail = { id: 'Q24777', title: 'Тур дю Монблан', country: 'Швейцария, Франция, Италия', distance_km: 166, days: 9, days_estimated: true, months: [7, 8], effort: 'trained' }
const whw: Trail = { id: 'Q965998', title: 'West Highland Way', country: 'Великобритания', distance_km: 153.3, days: 8, months: YEAR, effort: 'hike' }
const camino: Trail = { id: 'Q1029584', title: 'Французский путь', country: 'Испания', distance_km: 768.1, days: 30, days_estimated: true, months: YEAR, effort: 'hike' }

const checksOf = (world: Trail[], expectWorld: Record<string, unknown>) => checkWorld(world, expectWorld).map((problem: { check: string }) => problem.check)

const observed = (world: Trail[], extra: Record<string, unknown> = {}) => ({
  turnCreated: true,
  status: 'done',
  answerText: 'На сайте пока нет материалов по этому вопросу.',
  linkLabels: [],
  sources: [],
  fallback: true,
  noMaterial: true,
  promptEmpty: true,
  modelCall: null,
  ...(world.length ? { world } : {}),
  ...extra,
})

describe('контур оценки: маршруты мира (#3357)', () => {
  it('без ожидания проверок нет; маршруты блока, не нарушающие условие, проходят', () => {
    expect(checkWorld([tmb], null)).toEqual([])
    expect(checksOf([peddars], { min: 1, max_km: 90, month: 12 })).toEqual([])
    expect(checksOf([whw, camino], { min: 1, min_km: 150 })).toEqual([])
    expect(checksOf([camino], { min: 1, min_km: 500, country: 'испан' })).toEqual([])
  })

  it('world_condition: маршрут длиннее границы, вне расчётного сезона, не той страны', () => {
    expect(checksOf([peddars, whw], { min: 1, max_km: 90 })).toEqual(['world_condition'])
    expect(checkWorld([whw], { max_km: 90 })[0].detail).toContain('West Highland Way')
    expect(checksOf([peddars], { min_km: 150 })).toEqual(['world_condition'])
    expect(checksOf([tmb], { month: 11 })).toEqual(['world_condition'])
    expect(checksOf([tmb], { month: 7 })).toEqual([])
    expect(checksOf([whw], { min_km: 100, country: 'испан' })).toEqual(['world_condition'])
    // Маршрут без длины условие длины не подтверждает.
    expect(checksOf([{ id: 'Q1', title: 'Без длины' }], { max_km: 90 })).toEqual(['world_condition'])
  })

  it('неизвестно — не нарушено: маршрут без месяцев и «круглый год» условие месяца не нарушают', () => {
    expect(checksOf([{ ...peddars, months: undefined }, whw], { month: 11 })).toEqual([])
  })

  it('дни по этапам сверяются строго, оценочные — с запасом в полтора раза', () => {
    expect(WORLD_ESTIMATE_SLACK).toBe(1.5)
    expect(checksOf([whw], { max_days: 7 })).toEqual(['world_condition'])
    expect(checksOf([whw], { max_days: 8 })).toEqual([])
    expect(checksOf([tmb], { max_days: 7 })).toEqual([])
    expect(checksOf([tmb], { max_days: 6 })).toEqual(['world_condition'])
  })

  it('world_missing: маршрутов меньше нужного; world_unexpected: блок там, где его быть не должно, или больше трёх', () => {
    expect(checksOf([], { min: 1, max_km: 90 })).toEqual(['world_missing'])
    expect(checksOf([peddars], { max: 0 })).toEqual(['world_unexpected'])
    expect(checksOf([], { max: 0 })).toEqual([])
    expect(checksOf([peddars, whw, tmb, camino], { min: 1 })).toEqual(['world_unexpected'])
  })

  it('провалы блока — слой подбора; ход «материала на сайте нет» с верным блоком проходит', () => {
    const expectation = { expect: 'any_on_topic', lang: 'ru', question: 'Какой пеший маршрут до 90 км пройти в декабре?', expectWorld: { min: 1, max_km: 90, month: 12 } }
    const good = evaluateTurn(expectation, observed([peddars]))
    expect(good.failures).toEqual([])
    expect(good.metrics.world).toBe(1)
    const bad = evaluateTurn(expectation, observed([whw]))
    expect(bad.failures).toEqual([{ check: 'world_condition', layer: 'retrieval', detail: expect.stringContaining('153.3 км при границе до 90') }])
    const none = evaluateTurn(expectation, observed([]))
    expect(none.failures).toEqual([{ check: 'world_missing', layer: 'retrieval', detail: 'маршрутов мира 0 из 1 нужных' }])
    // Вопрос не о маршрутах: блок — провал подбора.
    const control = evaluateTurn({ expect: 'any_on_topic', lang: 'ru', question: 'Какие музеи стоит посетить в Гданьске за один день?', expectWorld: { max: 0 } }, observed([peddars]))
    expect(control.failures.map((failure: { check: string; layer: string }) => `${failure.check}/${failure.layer}`)).toEqual(['world_unexpected/retrieval'])
    // Ход без ожидания блок не проверяет.
    expect(evaluateTurn({ expect: 'any_on_topic', lang: 'ru', question: 'Поход в горы' }, observed([whw])).failures).toEqual([])
  })

  it('путь службы: маршруты мира события sources попадают в наблюдение хода; у отказа «не по теме» их нет', async () => {
    const trail = { type: 'trail', group: 'world', source_id: 'Q2066153', title: 'Peddars Way', url: 'https://en.wikipedia.org/wiki/Peddars_Way', country: 'Великобритания', distance_km: 74.8, days: 3, days_estimated: true, months: YEAR, effort: 'hike', attribution: 'OpenStreetMap, Wikidata' }
    const body = (done: string) => [`event: sources\ndata: ${JSON.stringify({ sources: [trail], degraded: false, remaining: 19 })}`, `event: done\ndata: ${done}`, ''].join('\n\n')
    const session = (done: string) =>
      createAskSession({
        createAskClient,
        askUrl: 'http://service.test',
        visitor: '2001:db8::a',
        locale: 'ru',
        fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => body(done) }),
      })
    const noSources = await session('{"status":"no_sources"}')('Какой пеший маршрут до 90 км пройти в декабре?')
    expect(noSources).toMatchObject({ status: 'no_sources', sources: [], world: [{ id: 'Q2066153', title: 'Peddars Way', distance_km: 74.8, days: 3, days_estimated: true, months: YEAR, effort: 'hike' }] })
    const offTopic = await session('{"status":"off_topic","reason":"offtopic_warning","strikes":1,"strikes_to_block":3}')('рецепт борща')
    expect(offTopic.world).toBeUndefined()
  })

  it('набор живых вопросов: группа world — не меньше двенадцати вопросов о маршрутах на пяти языках и контрольные без блока', () => {
    const live = loadCases(path.join(process.cwd(), 'scripts/ai-assistant-eval/cases.live.jsonl')) as { id: string; group: string; lang: string; expects: string[]; expect_world?: Record<string, number | string> }[]
    const world = live.filter((item) => item.group === 'world')
    expect(world.every((item) => item.expect_world && item.expects[0] === 'any_on_topic')).toBe(true)
    const asked = world.filter((item) => (item.expect_world!.min as number) >= 1)
    expect(asked.length).toBeGreaterThanOrEqual(12)
    expect([...new Set(asked.map((item) => item.lang))].sort()).toEqual(['be', 'en', 'pl', 'ru', 'uk'])
    // У каждого вопроса о маршруте есть проверяемое условие.
    expect(asked.every((item) => ['max_km', 'min_km', 'month', 'max_days'].some((key) => item.expect_world![key] !== undefined))).toBe(true)
    const control = world.filter((item) => item.expect_world!.max === 0)
    expect(control.length).toBeGreaterThanOrEqual(3)
    // Вне группы ожидания блока нет: прежние вопросы набора не менялись.
    expect(live.filter((item) => item.group !== 'world' && item.expect_world)).toEqual([])
  })

  it('кривое ожидание блока в наборе — ошибка загрузки', () => {
    const file = path.join(makeTempDir('ai-eval-world-'), 'cases.jsonl')
    const write = (expectWorld: unknown) => fs.writeFileSync(file, `${JSON.stringify({ id: 'w1', group: 'world', lang: 'ru', q: 'Пеший маршрут до 90 км', expect: 'any_on_topic', expect_world: expectWorld })}\n`)
    write({ min: 1, max_km: 90, month: 12 })
    expect(loadCases(file)).toHaveLength(1)
    for (const broken of [{ month: 13 }, { max_km: '90' }, { maxKm: 90 }, { min: -1 }, 'да']) {
      write(broken)
      expect(() => loadCases(file)).toThrow(/expect_world/)
    }
  })
})
