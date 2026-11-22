/**
 * Маршруты мира в службе (#3357): второй ярус ответа `/ai/ask` — карточки внешнего индекса группой
 * `world` в событии `sources`, страж внешних ссылок, журнал, проба здоровья. Фикстура — четырнадцать
 * маршрутов (`__tests__/fixtures/worldTrails.ts`), сети и модели нет.
 */
import { appendFileSync, readFileSync } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import { join } from 'path'

import type { Generator } from '@/scripts/ai-assist/generator'
import { AI_ASK_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK } from '@/api/aiAssist/policy'
import { createApp } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { loadConfig } from '@/scripts/ai-assist/config'
import { createDemandLog } from '@/scripts/ai-assist/demandLog'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'
import { asksWorld, loadWorldIndex, worldCandidates } from '@/scripts/ai-assist/worldIndex'
import { OSM_LAYER_FILE } from '@/scripts/ai-index/world/cards'

import { WORLD_FIXTURE_MODEL, WORLD_OSM_LAYER, writeWorldFixture } from '../../fixtures/worldTrails'
import { makeTempDir } from '../cli-test-utils'
import { fakeEmbedQuery, loadFixtureIndex, MODEL, type Spec, writeFixtureIndex } from './fixture'

type SseEvent = { event: string; data: Record<string, unknown> }
type Card = Record<string, unknown>

const post = (server: http.Server, body: unknown): Promise<{ status: number; events: SseEvent[] }> =>
  new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo
    const payload = JSON.stringify(body)
    const request = http.request({ host: '127.0.0.1', port, path: '/ai/ask', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'x-forwarded-for': '203.0.113.9' } }, (response) => {
      const parts: Buffer[] = []
      response.on('data', (chunk: Buffer) => parts.push(chunk))
      response.on('end', () => {
        const events = Buffer.concat(parts)
          .toString('utf8')
          .split('\n\n')
          .filter((block) => block.startsWith('event:'))
          .map((block) => {
            const [head, ...rest] = block.split('\n')
            return { event: head.slice(6).trim(), data: JSON.parse(rest.join('\n').replace(/^data:\s*/, '')) as Record<string, unknown> }
          })
        resolve({ status: response.statusCode ?? 0, events })
      })
    })
    request.on('error', reject)
    request.write(payload)
    request.end()
  })

const getJson = (server: http.Server, path: string): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo
    http
      .get({ host: '127.0.0.1', port, path }, (response) => {
        const parts: Buffer[] = []
        response.on('data', (chunk: Buffer) => parts.push(chunk))
        response.on('end', () => resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))))
      })
      .on('error', reject)
  })

const listen = (server: http.Server) => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const close = (server: http.Server) => new Promise<void>((resolve) => server.close(() => resolve()))

const answer = (text: string): Generator => ({
  async generate(request) {
    request.onDelta?.(text, text)
    return { text, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } }
  },
})

const SITE_ANSWER = 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816).'
const LAYER_URL = 'https://metravel.by/assets/data/world-trails-osm.jsonl'

function makeServer(options: { world?: boolean; generator?: Generator; chunks?: Spec[]; evalTrace?: boolean; layerUrl?: string | null; feedback?: boolean } = {}) {
  const demandPath = join(makeTempDir('ai-world-demand-'), 'ai-demand.jsonl')
  const world = options.world === false ? null : loadWorldIndex(writeWorldFixture(makeTempDir('ai-world-')), { expectedModel: MODEL })
  const server = createApp({
    index: options.chunks ? loadFixtureIndex(writeFixtureIndex(MODEL, options.chunks)) : loadFixtureIndex(),
    world,
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: {
      generator: options.generator ?? answer(SITE_ANSWER),
      limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: AI_ASK_DAILY_LIMIT, strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK }),
      demandLog: createDemandLog({ path: demandPath }),
      queueTimeoutMs: 200,
      trustProxy: true,
      evalTrace: options.evalTrace ? { llmUrl: 'http://127.0.0.1:8090' } : null,
      worldLayerUrl: options.layerUrl ?? null,
    },
    authorDraft: { limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: 5, strikesToBlock: 3 }) },
    feedback: options.feedback ? {} : false,
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: () => {},
  })
  const readLog = (): Array<Record<string, unknown>> => {
    try {
      return readFileSync(demandPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }
  return { server, readLog }
}

const cardsOf = (events: SseEvent[]): Card[] => ((events.find((event) => event.event === 'sources')?.data.sources as Card[] | undefined) ?? [])
const trailsOf = (events: SseEvent[]): Card[] => cardsOf(events).filter((card) => card.type === 'trail')
const doneOf = (events: SseEvent[]): Record<string, unknown> => events.at(-1)!.data

const HIKE = 'Пеший маршрут не более 100 км в ноябре'

describe('metravel-assist: маршруты мира в /ai/ask (#3357)', () => {
  it('вопрос о пешем маршруте: после карточек сайта — до трёх маршрутов мира, каждый проходит условия вопроса', async () => {
    const { server } = makeServer({ layerUrl: LAYER_URL })
    await listen(server)
    try {
      const { status, events } = await post(server, { q: HIKE, locale: 'ru' })
      expect(status).toBe(200)
      const cards = cardsOf(events)
      const trails = trailsOf(events)
      expect(trails).toHaveLength(3)
      // Сначала сайт, затем мир.
      expect(cards.slice(0, cards.length - trails.length).every((card) => card.type === 'travel' || card.type === 'quest')).toBe(true)
      expect(cards.slice(-trails.length)).toEqual(trails)
      for (const trail of trails) {
        expect(trail).toMatchObject({ type: 'trail', group: 'world', attribution: expect.stringContaining('OpenStreetMap') })
        expect(trail.distance_km as number).toBeLessThanOrEqual(100)
        expect(trail.months === undefined || (trail.months as number[]).includes(11)).toBe(true)
        expect(String(trail.url)).toMatch(/^https:\/\/[a-z-]+\.(wikipedia|wikivoyage)\.org\/wiki\//)
        // Служебных полей слоёв в карточке нет.
        expect(Object.keys(trail).filter((key) => ['osm_relation', 'effort_km', 'descent_m', 'min_alt_m', 'lat', 'lng', 'sitelinks', 'labels'].includes(key))).toEqual([])
      }
      expect(events.find((event) => event.event === 'sources')!.data.world_layer_url).toBe(LAYER_URL)
      // Ответ модели — по материалам сайта, как раньше; внешних адресов модель не писала.
      expect(events.filter((event) => event.event === 'text').at(-1)!.data.text).toBe(SITE_ANSWER)
      expect(doneOf(events)).toMatchObject({ status: 'done', removed_links: 0 })
      expect(doneOf(events)).not.toHaveProperty('removed_world_links')
    } finally {
      await close(server)
    }
  })

  it('вопрос не о маршрутах группу world не получает', async () => {
    const { server } = makeServer({ layerUrl: LAYER_URL })
    await listen(server)
    try {
      for (const q of ['Какие квесты есть в Гродно?', 'Куда поехать зимой в Польше на выходные?', 'Веломаршрут до 30 км под Краковом']) {
        const { events } = await post(server, { q, locale: 'ru' })
        expect({ q, trails: trailsOf(events).length }).toEqual({ q, trails: 0 })
        expect(events.find((event) => event.event === 'sources')!.data).not.toHaveProperty('world_layer_url')
      }
    } finally {
      await close(server)
    }
  })

  it('вопрос не по теме получает прежний отказ без внешних карточек', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const { events } = await post(server, { q: 'напиши мне код на python для пешего маршрута', locale: 'ru' })
      expect(events).toEqual([
        { event: 'sources', data: { sources: [], degraded: false, remaining: AI_ASK_DAILY_LIMIT } },
        { event: 'done', data: { status: 'off_topic', reason: 'offtopic_warning', strikes: 1, strikes_to_block: AI_OFFTOPIC_STRIKES_TO_BLOCK } },
      ])
    } finally {
      await close(server)
    }
  })

  it('со страницы материала маршрутов мира нет: вопрос читается как вопрос о странице', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const { events } = await post(server, { q: HIKE, locale: 'ru', source: { type: 'travel', id: 816 } })
      expect(cardsOf(events).length).toBeGreaterThan(0)
      expect(trailsOf(events)).toEqual([])
    } finally {
      await close(server)
    }
  })

  it('без внешнего индекса служба отвечает как раньше: те же карточки сайта, ни одной внешней', async () => {
    const withWorld = makeServer()
    const without = makeServer({ world: false })
    await listen(withWorld.server)
    await listen(without.server)
    try {
      const a = await post(withWorld.server, { q: HIKE, locale: 'ru' })
      const b = await post(without.server, { q: HIKE, locale: 'ru' })
      expect(trailsOf(b.events)).toEqual([])
      expect(cardsOf(b.events)).toEqual(cardsOf(a.events).filter((card) => card.type !== 'trail'))
      expect(doneOf(b.events)).toEqual(doneOf(a.events))
      expect(await getJson(without.server, '/ai/health')).not.toHaveProperty('world')
    } finally {
      await close(withWorld.server)
      await close(without.server)
    }
  })

  it('на сайте подходящего нет — модель не вызывается, статус «материала нет» прежний, маршруты мира остаются', async () => {
    let called = 0
    const generator: Generator = {
      async generate() {
        called += 1
        return { text: 'x', usage: { prompt_tokens: 1, completion_tokens: 1, ttft_ms: 1, tokens_per_s: 1 } }
      },
    }
    // У места только детский квест: на вопрос взрослого с условиями он в подсказку не идёт (#3345).
    const chunks: Spec[] = [{ type: 'quest', sourceId: 5, title: 'Детский квест по Бресту', text: 'детский квест брест крепость пеший маршрут', city: 'Брест', tags: ['kids', 'age-8-10'] }]
    const { server } = makeServer({ generator, chunks })
    await listen(server)
    try {
      const { events } = await post(server, { q: HIKE, locale: 'ru' })
      expect(called).toBe(0)
      expect(trailsOf(events)).toHaveLength(3)
      expect(doneOf(events)).toMatchObject({ status: 'done', fallback: true, reason: 'no_material' })
    } finally {
      await close(server)
    }
  })

  it('страж: внешний адрес остаётся только из внешней карточки этого ответа, вырезанные считает removed_world_links', async () => {
    // В Великобритании длиннее 150 км в фикстуре один маршрут — West Highland Way: он и есть внешняя карточка ответа.
    const text = `Загляните в [Ярмарки Польши](https://metravel.by/travels/816). Подробнее: [West Highland Way](https://en.wikipedia.org/wiki/West_Highland_Way). Ещё есть [GR 20](https://en.wikipedia.org/wiki/GR_20) и https://www.alltrails.com/trail/x`
    const { server, readLog } = makeServer({ generator: answer(text), feedback: true })
    await listen(server)
    try {
      const { events } = await post(server, { q: 'Пеший маршрут в Великобритании не короче 150 км', locale: 'ru' })
      expect(trailsOf(events).map((trail) => trail.source_id)).toEqual(['Q965998'])
      const shown = String(events.filter((event) => event.event === 'text').at(-1)!.data.text)
      expect(shown).toContain('[West Highland Way](https://en.wikipedia.org/wiki/West_Highland_Way)')
      expect(shown).toContain('[Ярмарки Польши](https://metravel.by/travels/816)')
      expect(shown).not.toMatch(/GR_20|alltrails/)
      const done = doneOf(events)
      expect(done).toMatchObject({ status: 'done', removed_links: 2, removed_world_links: 2 })
      // Журнал хода: маршруты мира — отдельным полем, карточки подсказки — прежним.
      const turn = readLog().find((record) => record.turn === done.turn_id)!
      expect(turn.world_ids).toEqual(['Q965998'])
      expect((turn.source_ids as string[]).every((id) => /^(travel|quest):\d+$/.test(id))).toBe(true)
    } finally {
      await close(server)
    }
  })

  it('журнал хода без маршрутов мира — прежней формы, без поля world_ids', async () => {
    const { server, readLog } = makeServer({ feedback: true })
    await listen(server)
    try {
      await post(server, { q: 'ярмарки в Кракове зимой', locale: 'ru' })
      expect(Object.keys(readLog()[0]).sort()).toEqual(['answer_chars', 'guard', 'locale', 'q', 'source_ids', 'status', 'ts', 'turn'])
    } finally {
      await close(server)
    }
  })

  it('контур оценки: событие trace несёт маршруты мира со строкой фактов; в подсказку модели они не идут', async () => {
    const { server } = makeServer({ evalTrace: true })
    await listen(server)
    try {
      const { events } = await post(server, { q: HIKE, locale: 'ru' })
      const trace = events.find((event) => event.event === 'trace')!.data
      const world = trace.world as Array<Record<string, unknown>>
      expect(world.map((trail) => trail.source_id)).toEqual(trailsOf(events).map((trail) => trail.source_id))
      expect(String(world[0].facts)).toMatch(/Длина: \d+ км/)
      expect((trace.prompt_sources as Card[]).every((card) => card.type !== 'trail')).toBe(true)
      // Вопрос не о маршрутах — в trace поля нет.
      const other = await post(server, { q: 'ярмарки в Кракове зимой', locale: 'ru' })
      expect(other.events.find((event) => event.event === 'trace')!.data).not.toHaveProperty('world')
    } finally {
      await close(server)
    }
  })

  it('название и страна карточки — на языке вопроса, с запасным английским', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const pl = await post(server, { q: 'Szlak pieszy w Polsce', locale: 'pl' })
      expect(trailsOf(pl.events)).toEqual([expect.objectContaining({ source_id: 'Q5627668', title: 'Główny Szlak Sudecki', country: 'Polska', url: expect.stringContaining('pl.wikipedia.org') })])
      const ru = await post(server, { q: 'Пеший маршрут в Польше', locale: 'ru' })
      expect(trailsOf(ru.events)).toEqual([expect.objectContaining({ source_id: 'Q5627668', country: 'Польша' })])
    } finally {
      await close(server)
    }
  })

  it('приёмка 14.11.2026: регион, остров с «на», горная система и название маршрута дают свои маршруты', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const ids = async (q: string, locale: string) => trailsOf((await post(server, { q, locale })).events).map((trail) => trail.source_id)
      expect(await ids('Пеший маршрут в Шотландии', 'ru')).toEqual(['Q965998'])
      expect(await ids('Hiking trail in Scotland', 'en')).toEqual(['Q965998'])
      expect(await ids('Szlak pieszy w Szkocji', 'pl')).toEqual(['Q965998'])
      expect(await ids('Пеший маршрут на Корсике', 'ru')).toEqual(['Q262374'])
      expect(await ids('Поход в Альпах на неделю', 'ru')).toEqual(['Q24777'])
      expect(await ids('Пеший маршрут в Тасмании', 'ru')).toEqual(['Q491216'])
      // Место, которого индекс не знает, — блока нет; чужие маршруты не показываются.
      expect(await ids('Пеший маршрут в Нарнии на три дня', 'ru')).toEqual([])
      // Вопрос из одного названия маршрута: слов о походе нет, блок есть, маршрут один.
      expect(await ids('West Highland Way', 'en')).toEqual(['Q965998'])
      expect(await ids('Трек вокруг Монблана', 'ru')).toEqual(['Q24777'])
      // Со страницы материала название маршрута блока не вызывает.
      expect(trailsOf((await post(server, { q: 'West Highland Way', locale: 'en', source: { type: 'travel', id: 816 } })).events)).toEqual([])
    } finally {
      await close(server)
    }
  })

  it('ссылка карточки — статья на языке запроса, когда она есть: у «Трека вокруг Монблана» — русская Википедия', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const card = async (q: string, locale: string) => trailsOf((await post(server, { q, locale })).events)[0]
      expect(await card('Поход в Альпах', 'ru')).toMatchObject({ source_id: 'Q24777', title: 'Трек вокруг Монблана', url: expect.stringMatching(/^https:\/\/ru\.wikipedia\.org\/wiki\//) })
      expect(await card('Szlak pieszy w Alpach', 'pl')).toMatchObject({ source_id: 'Q24777', url: 'https://pl.wikipedia.org/wiki/Tour_du_Mont_Blanc' })
      expect(await card('Hiking trail in the Alps', 'en')).toMatchObject({ source_id: 'Q24777', url: 'https://en.wikipedia.org/wiki/Tour_du_Mont_Blanc' })
      // Русской статьи о West Highland Way нет — запасная английская.
      expect(await card('Пеший маршрут в Шотландии', 'ru')).toMatchObject({ source_id: 'Q965998', url: 'https://en.wikipedia.org/wiki/West_Highland_Way' })
    } finally {
      await close(server)
    }
  })

  it('проба здоровья показывает состав внешнего индекса', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      expect((await getJson(server, '/ai/health')).world).toEqual({ trails: WORLD_OSM_LAYER.length, chunks: expect.any(Number), built_at: '2026-11-14T21:30:00.000Z' })
    } finally {
      await close(server)
    }
  })
})

describe('metravel-assist: загрузка внешнего индекса (#3357)', () => {
  it('индекс загружается: маршруты с обоими слоями, кандидаты несут карточку, известность и названия', () => {
    const index = loadWorldIndex(writeWorldFixture(makeTempDir('ai-world-')), { expectedModel: WORLD_FIXTURE_MODEL })
    expect(index.trails).toHaveLength(WORLD_OSM_LAYER.length)
    expect(index.trails.every((trail) => trail.rows.length > 0)).toBe(true)
    const candidates = worldCandidates(index, new Float32Array(index.dim).fill(0.35), 'en')
    expect(candidates).toHaveLength(WORLD_OSM_LAYER.length)
    const whw = candidates.find((candidate) => candidate.card.source_id === 'Q965998')!
    expect(whw).toMatchObject({ fame: 15, card: { title: 'West Highland Way', country: 'United Kingdom', group: 'world' } })
    // Газеттир маршрута: страна и места ниже страны на языках индекса; название — ключом для вопроса-названия.
    expect(whw.place.countries).toEqual(expect.arrayContaining(['Великобритания', 'Kingdom']))
    expect(whw.place.cities).toEqual(expect.arrayContaining(['Шотландия', 'Scotland', 'Szkocja', 'Highland']))
    expect(whw.titles).toContain('west highland way')
    expect(Number.isFinite(whw.similarity)).toBe(true)
    expect(asksWorld(index, 'West Highland Way')).toBe(true)
    expect(asksWorld(index, 'Пеший маршрут на выходные')).toBe(true)
    expect(asksWorld(index, 'Какие квесты есть в Гродно?')).toBe(false)
  })

  it('модель векторов обязана совпадать с моделью службы; индекс без векторов и с подменённым слоем не грузится', () => {
    const dist = writeWorldFixture(makeTempDir('ai-world-'))
    expect(() => loadWorldIndex(dist, { expectedModel: 'embeddinggemma-300m' })).toThrow(/собран моделью "fake-model".*embeddinggemma-300m/)
    expect(() => loadWorldIndex(writeWorldFixture(makeTempDir('ai-world-'), { model: null }), { expectedModel: MODEL })).toThrow(/без векторов/)
    expect(() => loadWorldIndex(makeTempDir('ai-world-empty-'), { expectedModel: MODEL })).toThrow(/нет внешнего индекса/)
    appendFileSync(join(dist, OSM_LAYER_FILE), `${JSON.stringify({ ...WORLD_OSM_LAYER[0], source_id: 'Q7' })}\n`)
    expect(() => loadWorldIndex(dist, { expectedModel: MODEL })).toThrow(/не прошёл проверку.*trails-osm\.jsonl/)
  })

  it('конфигурация: без переменных внешнего индекса нет; адрес слоя — только https', () => {
    expect(loadConfig({})).toMatchObject({ worldIndexDir: null, worldLayerUrl: null })
    expect(loadConfig({ AI_WORLD_INDEX_DIR: 'dist/ai-world', AI_WORLD_LAYER_URL: 'https://metravel.by/assets/data/world-trails-osm.jsonl' })).toMatchObject({
      worldIndexDir: 'dist/ai-world',
      worldLayerUrl: 'https://metravel.by/assets/data/world-trails-osm.jsonl',
    })
    expect(loadConfig({ AI_WORLD_LAYER_URL: 'http://metravel.by/x' }).worldLayerUrl).toBeNull()
  })
})
