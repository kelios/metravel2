/**
 * @jest-environment node
 */
import { readFileSync } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import { join } from 'path'

import { ASK_HISTORY_TEXT_LIMIT } from '@/api/aiAssist/askProvider'
import { AiGeneratorError, type GenerateRequest, type Generator } from '@/api/aiAssist/generator'
import { NO_PLACE_NOTE_RU, OFFTOPIC_REPLY_RU, PAGE_MODE_RULE_RU, type PromptHints } from '@/api/aiAssist/prompt'
import { AI_ASK_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK, AI_PAGE_NEARBY_LIMIT } from '@/api/aiAssist/policy'
import type { DemandEntry as ClientDemandEntry, DemandReason as ClientDemandReason } from '@/api/aiAssist/demandLog'
import { createApp } from '@/scripts/ai-assist/app'
import { clientIp, GENERATOR_RETRY_AFTER_SEC } from '@/scripts/ai-assist/ask'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { loadConfig } from '@/scripts/ai-assist/config'
import { createDemandLog, type DemandEntry, type DemandReason } from '@/scripts/ai-assist/demandLog'
import { AskLimits, createCounterStore, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'
import { ASK_FRAGMENT_CHARS, SNIPPET_CHARS } from '@/scripts/ai-assist/search'
import type { SourceFacts } from '@/scripts/ai-index/format'

import { makeTempDir } from '../cli-test-utils'
import { fakeEmbedQuery, FIXTURE_CHUNKS, loadFixtureIndex, MODEL, type Spec, writeFixtureIndex } from './fixture'

/** 25.10.2026 21:30 UTC = 00:30 Minsk 26.10; 20:59:59 UTC = 23:59:59 Minsk 25.10. */
const MINSK_LATE = new Date('2026-10-25T20:59:59Z')
const MINSK_AFTER_MIDNIGHT = new Date('2026-10-25T21:00:00Z')

describe('metravel-assist /ai/ask: календарный день по Europe/Minsk', () => {
  it('ключ дня и секунды до полуночи считаются в зоне, а не в UTC', () => {
    const clock = createDayClock('Europe/Minsk')
    expect(clock.dayKey(MINSK_LATE)).toBe('2026-10-25')
    expect(clock.secondsToMidnight(MINSK_LATE)).toBe(1)
    expect(clock.dayKey(MINSK_AFTER_MIDNIGHT)).toBe('2026-10-26')
    expect(clock.secondsToMidnight(MINSK_AFTER_MIDNIGHT)).toBe(86_400)
    expect(createDayClock('UTC').dayKey(MINSK_LATE)).toBe('2026-10-25')
    expect(createDayClock('UTC').secondsToMidnight(MINSK_LATE)).toBe(3 * 3600 + 1)
    expect(() => createDayClock('Mars/Olympus')).toThrow(RangeError)
  })

  it('MemoryCounterStore: TTL, decr не ниже нуля', async () => {
    let now = 1_000_000
    const store = new MemoryCounterStore(() => now)
    expect(await store.incr('k', 10)).toBe(1)
    expect(await store.incr('k', 10)).toBe(2)
    expect(await store.get('k')).toBe(2)
    expect(await store.decr('k')).toBe(1)
    expect(await store.decr('k')).toBe(0)
    expect(await store.decr('k')).toBe(0)
    await store.incr('k', 10)
    now += 10_001
    expect(await store.get('k')).toBe(0)
    expect(store.size).toBe(0)
  })

  it('redis-счётчик: INCR+EXPIRE до полуночи, ошибка redis уводит счёт в память', async () => {
    const calls: string[][] = []
    const values = new Map<string, number>()
    const redis = {
      get: async (key: string) => (values.has(key) ? String(values.get(key)) : null),
      setEx: async () => {},
      incr: async (key: string) => {
        calls.push(['INCR', key])
        values.set(key, (values.get(key) ?? 0) + 1)
        return values.get(key)!
      },
      decr: async (key: string) => {
        values.set(key, (values.get(key) ?? 0) - 1)
        return values.get(key)!
      },
      expire: async (key: string, ttl: number) => void calls.push(['EXPIRE', key, String(ttl)]),
      close: () => {},
    }
    const limits = new AskLimits({ store: createCounterStore(redis), clock: createDayClock('Europe/Minsk'), dailyLimit: 20, strikesToBlock: 3 })
    expect(await limits.registerOffTopicStrike('1.2.3.4', MINSK_LATE)).toEqual({ strikes: 1, blocked: false })
    expect(calls).toEqual([
      ['INCR', 'ai-ask:v1:offtopic:2026-10-25:1.2.3.4'],
      ['EXPIRE', 'ai-ask:v1:offtopic:2026-10-25:1.2.3.4', '61'],
    ])
    // Новый день — новый ключ: вчерашние страйки не считаются.
    expect(await limits.offTopicState('1.2.3.4', MINSK_AFTER_MIDNIGHT)).toEqual({ strikes: 0, blocked: false })
    // decr ниже нуля откатывается, а созданный им ключ получает TTL.
    await limits.refundQuestion('1.2.3.4', MINSK_LATE)
    expect(values.get('ai-ask:v1:quota:2026-10-25:1.2.3.4')).toBe(0)
    expect(calls.at(-1)).toEqual(['EXPIRE', 'ai-ask:v1:quota:2026-10-25:1.2.3.4', '60'])

    const lines: string[] = []
    const broken = createCounterStore({ ...redis, incr: async () => Promise.reject(new Error('down')), get: async () => Promise.reject(new Error('down')) }, (line) => lines.push(line))
    const fallback = new AskLimits({ store: broken, clock: createDayClock('Europe/Minsk'), dailyLimit: 1, strikesToBlock: 3 })
    expect(await fallback.consumeQuestion('9.9.9.9', MINSK_LATE)).toEqual({ used: 1, remaining: 0, exceeded: false })
    expect(await fallback.consumeQuestion('9.9.9.9', MINSK_LATE)).toEqual({ used: 2, remaining: 0, exceeded: true })
    expect(lines[0]).toMatch(/redis incr: down/)
  })

  it('числа политики — общие с клиентом', () => {
    expect(AI_ASK_DAILY_LIMIT).toBe(20)
    expect(AI_OFFTOPIC_STRIKES_TO_BLOCK).toBe(3)
    // Форма строки журнала и причины совпадают с клиентским demandLog.ts — один отчёт читает оба.
    const entry: ClientDemandEntry = { ts: '', q: '', locale: '', reason: 'offtopic_blocked' } satisfies DemandEntry
    const reason: ClientDemandReason = 'no_sources' satisfies DemandReason
    expect([entry, reason]).toBeTruthy()
  })
})

describe('metravel-assist /ai/ask: IP посетителя', () => {
  const requestWith = (headers: http.IncomingHttpHeaders, remoteAddress = '10.0.0.1') =>
    ({ headers, socket: { remoteAddress } }) as unknown as http.IncomingMessage

  it('за прокси — X-Real-IP, затем последний X-Forwarded-For; без доверия — сокет', () => {
    // Начало X-Forwarded-For присылает посетитель, nginx дописывает настоящий адрес в конец.
    expect(clientIp(requestWith({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7' }), true)).toBe('203.0.113.7')
    expect(clientIp(requestWith({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7', 'x-real-ip': '203.0.113.8' }), true)).toBe('203.0.113.8')
    expect(clientIp(requestWith({ 'x-real-ip': '203.0.113.8' }), true)).toBe('203.0.113.8')
    expect(clientIp(requestWith({}), true)).toBe('10.0.0.1')
    expect(clientIp(requestWith({ 'x-forwarded-for': '203.0.113.7' }), false)).toBe('10.0.0.1')
  })
})

interface SseReply {
  status: number
  headers: http.IncomingHttpHeaders
  events: { event: string; data: any }[]
  json: any
}

function post(server: http.Server, path: string, body: unknown, headers: Record<string, string> = {}): Promise<SseReply> {
  const { port } = server.address() as AddressInfo
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method: 'POST', path, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers } },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          const sse = String(response.headers['content-type'] ?? '').startsWith('text/event-stream')
          const events = sse
            ? raw
                .split('\n\n')
                .filter((part) => part.trim())
                .map((part) => {
                  const lines = part.split('\n')
                  const event = lines.find((line) => line.startsWith('event: '))!.slice(7)
                  const data = JSON.parse(lines.find((line) => line.startsWith('data: '))!.slice(6))
                  return { event, data }
                })
            : []
          resolve({ status: response.statusCode ?? 0, headers: response.headers, events, json: sse || !raw ? null : JSON.parse(raw) })
        })
      },
    )
    request.on('error', reject)
    request.write(payload)
    request.end()
  })
}

const listen = (server: http.Server) => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const close = (server: http.Server) => new Promise<void>((resolve) => server.close(() => resolve()))

/** Фальшивая модель: отдаёт текст кусками, может «висеть» или падать как llama-server. */
function fakeGenerator(script: (request: GenerateRequest) => Promise<string> | string): Generator {
  return {
    async generate(request) {
      const text = await script(request)
      let full = ''
      for (const piece of text.split(/(?<= )/)) {
        full += piece
        request.onDelta?.(piece, full)
      }
      return { text: full, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } }
    },
  }
}

function makeServer(overrides: { generator?: Generator | null; dailyLimit?: number; now?: () => Date; queueTimeoutMs?: number; embedQuery?: typeof fakeEmbedQuery; chunks?: Spec[]; facts?: SourceFacts[]; askFragmentChars?: { travel?: number; quest?: number }; evalTrace?: boolean; promptHints?: PromptHints } = {}) {
  const logDir = makeTempDir('ai-demand-')
  const demandPath = join(logDir, 'nested', 'ai-demand.jsonl')
  const limits = new AskLimits({
    store: new MemoryCounterStore(),
    clock: createDayClock('Europe/Minsk'),
    dailyLimit: overrides.dailyLimit ?? AI_ASK_DAILY_LIMIT,
    strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
  })
  const generator = overrides.generator === undefined ? fakeGenerator(() => 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816) и на https://evil.example/x') : overrides.generator
  const server = createApp({
    index: overrides.chunks || overrides.facts ? loadFixtureIndex(writeFixtureIndex(MODEL, overrides.chunks ?? FIXTURE_CHUNKS, overrides.facts)) : loadFixtureIndex(),
    modelKey: MODEL,
    embedQuery: overrides.embedQuery ?? fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    askFragmentChars: overrides.askFragmentChars,
    ask: {
      generator,
      limits,
      demandLog: createDemandLog({ path: demandPath, now: overrides.now }),
      queueTimeoutMs: overrides.queueTimeoutMs ?? 200,
      trustProxy: true,
      now: overrides.now,
      evalTrace: overrides.evalTrace ? { llmUrl: 'http://127.0.0.1:8090' } : null,
      promptHints: overrides.promptHints,
    },
    authorDraft: { limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: 5, strikesToBlock: 3 }) },
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: () => {},
  })
  const readLog = () => {
    try {
      return readFileSync(demandPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }
  return { server, limits, readLog }
}

describe('metravel-assist: POST /ai/ask — фильтр тем и блок на IP', () => {
  it('1-й и 2-й вопрос не по теме — SSE-отказ с предупреждением без подбора; 3-й — 429 до полуночи и запись в журнал; блок держится и для вопроса по теме', async () => {
    const now = () => MINSK_LATE
    const { server, readLog } = makeServer({ now })
    await listen(server)
    try {
      const ip = { 'x-forwarded-for': '203.0.113.7' }
      const first = await post(server, '/ai/ask', { q: 'как готовить кашу', locale: 'ru' }, ip)
      expect(first.status).toBe(200)
      expect(first.headers['content-type']).toMatch(/text\/event-stream/)
      expect(first.events).toEqual([
        { event: 'sources', data: { sources: [], degraded: false, remaining: AI_ASK_DAILY_LIMIT } },
        { event: 'done', data: { status: 'off_topic', reason: 'offtopic_warning', strikes: 1, strikes_to_block: 3 } },
      ])
      const second = await post(server, '/ai/ask', { q: 'напиши мне код на python' }, ip)
      expect(second.events[1].data).toMatchObject({ status: 'off_topic', reason: 'offtopic_warning', strikes: 2 })

      const third = await post(server, '/ai/ask', { q: 'рецепт борща', locale: 'pl' }, ip)
      expect(third.status).toBe(429)
      expect(third.headers['retry-after']).toBe('1')
      expect(third.json).toMatchObject({ error: 'offtopic_blocked', retry_after_sec: 1, strikes: 3, strikes_to_block: 3 })
      expect(readLog()).toEqual([{ ts: MINSK_LATE.toISOString(), q: 'рецепт борща', locale: 'pl', reason: 'offtopic_blocked' }])

      // «Очистил localStorage и спросил о маршруте» — для сервера это тот же IP: блок до полуночи.
      const onTopic = await post(server, '/ai/ask', { q: 'ярмарки в Кракове зимой' }, ip)
      expect(onTopic.status).toBe(429)
      expect(onTopic.json.error).toBe('offtopic_blocked')
      expect(readLog()).toHaveLength(1)

      // Другой IP не затронут; вопросы не по теме дневной лимит не тратят.
      const other = await post(server, '/ai/ask', { q: 'ярмарки в Кракове зимой' }, { 'x-forwarded-for': '198.51.100.2' })
      expect(other.status).toBe(200)
      expect(other.events[0].data.remaining).toBe(AI_ASK_DAILY_LIMIT - 1)
    } finally {
      await close(server)
    }
  })

  it('после полуночи по Минску блок снимается', async () => {
    let current = MINSK_LATE
    const { server } = makeServer({ now: () => current })
    await listen(server)
    try {
      for (let i = 0; i < 3; i += 1) await post(server, '/ai/ask', { q: 'анекдот про программиста' })
      expect((await post(server, '/ai/ask', { q: 'квест по Гродно' })).status).toBe(429)
      current = MINSK_AFTER_MIDNIGHT
      const reply = await post(server, '/ai/ask', { q: 'квест по Гродно' })
      expect(reply.status).toBe(200)
      expect(reply.events.at(-1)!.data.status).toBe('done')
    } finally {
      await close(server)
    }
  })
})

describe('metravel-assist: POST /ai/ask — ответ по теме', () => {
  it('SSE: источники из индекса в форме AiSource, text после стража, done с removed_links и usage; лимит списан', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: 'ярмарки краков', locale: 'ru', history: [{ role: 'user', text: 'привет' }] })
      expect(reply.status).toBe(200)
      expect(reply.headers['x-accel-buffering']).toBe('no')
      const [sources, ...rest] = reply.events
      expect(sources.event).toBe('sources')
      expect(sources.data.remaining).toBe(AI_ASK_DAILY_LIMIT - 1)
      expect(sources.data.sources.length).toBeGreaterThan(0)
      expect(sources.data.sources.length).toBeLessThanOrEqual(8)
      // Фальшивые 8-мерные векторы порядок не гарантируют: проверяем форму карточки, а не место.
      const fair = sources.data.sources.find((source: { source_id: string }) => source.source_id === '816')
      expect(fair).toMatchObject({ type: 'travel', source_id: '816', title: 'Ярмарки Польши', url: 'https://metravel.by/travels/816', path: '/travels/816' })
      expect(typeof fair.snippet).toBe('string')
      expect(typeof fair.score).toBe('number')
      const texts = rest.filter((e) => e.event === 'text')
      expect(texts.length).toBeGreaterThan(0)
      // Чужой адрес вырезан, ссылка карточки осталась — и в стриме, и в финале.
      expect(texts.at(-1)!.data.text).toBe('Загляните в [Ярмарки Польши](https://metravel.by/travels/816) и на')
      expect(texts.every((e) => !String(e.data.text).includes('evil.example'))).toBe(true)
      expect(rest.at(-1)).toEqual({
        event: 'done',
        data: { status: 'done', removed_links: 1, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 }, remaining: AI_ASK_DAILY_LIMIT - 1 },
      })
    } finally {
      await close(server)
    }
  })

  it('опора уточнений (#2719/#2884): уточнение ищется вместе с последним самостоятельным вопросом истории, модель получает исходный вопрос', async () => {
    const embedded: string[] = []
    const prompts: string[] = []
    const generator = fakeGenerator((request) => {
      prompts.push(String(request.messages.at(-1)?.content ?? ''))
      return 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816)'
    })
    const { server } = makeServer({
      generator,
      embedQuery: async (q) => {
        embedded.push(q)
        return fakeEmbedQuery(q)
      },
    })
    await listen(server)
    try {
      const history = [
        { role: 'user', text: 'ярмарки краков' },
        { role: 'assistant', text: 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816)' },
        { role: 'user', text: 'А какой из них подойдёт детям?' },
        { role: 'assistant', text: 'Любой.' },
      ]
      const follow = await post(server, '/ai/ask', { q: 'А там есть музеи?', locale: 'ru', history })
      expect(follow.status).toBe(200)
      const own = await post(server, '/ai/ask', { q: 'А в Бресте что посмотреть?', locale: 'ru', history })
      expect(own.status).toBe(200)
      expect(embedded).toEqual(['ярмарки краков А там есть музеи?', 'А в Бресте что посмотреть?'])
      expect(prompts[0]).toContain('Вопрос посетителя: А там есть музеи?')
      expect(prompts[0]).not.toContain('Вопрос посетителя: ярмарки краков')
    } finally {
      await close(server)
    }
  })

  it('#2897: source ставит карточку страницы из индекса первой на каждом ходу; локаль квеста; уточнение опирается на её заголовок; нет в индексе — без закрепления', async () => {
    const embedded: string[] = []
    const prompts: string[] = []
    const generator = fakeGenerator((request) => {
      prompts.push(String(request.messages.at(-1)?.content ?? ''))
      return 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816)'
    })
    const { server } = makeServer({
      generator,
      embedQuery: async (q) => {
        embedded.push(q)
        return fakeEmbedQuery(q)
      },
    })
    await listen(server)
    try {
      // Вопрос про квест Гродно, источник — статья 816: она первая, квест — следом, дубля 816 нет.
      const first = await post(server, '/ai/ask', { q: 'квест гродно замок', locale: 'ru', source: { type: 'travel', id: 816 } })
      expect(first.status).toBe(200)
      const ids = first.events[0].data.sources.map((s: { type: string; source_id: string }) => `${s.type}:${s.source_id}`)
      expect(ids[0]).toBe('travel:816')
      expect(ids).toContain('quest:1')
      expect(ids.filter((id: string) => id === 'travel:816')).toHaveLength(1)
      expect(ids.length).toBeLessThanOrEqual(8)
      // Режим страницы (#3290): страница — группа `page`, найденное подбором — группа `nearby`, не больше трёх.
      expect(first.events[0].data.sources[0]).toMatchObject({ title: 'Ярмарки Польши', url: 'https://metravel.by/travels/816', path: '/travels/816', group: 'page' })
      expect(first.events[0].data.sources.slice(1).every((s: { group?: string }) => s.group === 'nearby')).toBe(true)
      expect(ids.length).toBeLessThanOrEqual(1 + AI_PAGE_NEARBY_LIMIT)
      // В подсказке модели — только страница: квест Гродно стоит в списке источников, но не в карточках.
      expect(prompts[0]).toContain('[1] Статья «Ярмарки Польши» — https://metravel.by/travels/816')
      expect(prompts[0]).not.toContain('Квест по Гродно')

      // Второй ход с тем же источником: карточка снова первая; уточнение ищется вместе с её заголовком.
      const history = [{ role: 'user', text: 'квест гродно замок' }, { role: 'assistant', text: 'Загляните в [Квест по Гродно](https://metravel.by/quests/1)' }]
      const second = await post(server, '/ai/ask', { q: 'А что там рядом?', locale: 'ru', history, source: { type: 'travel', id: 816 } })
      expect(second.events[0].data.sources[0].source_id).toBe('816')
      // В истории есть самостоятельный вопрос — опора из неё, не заголовок.
      expect(embedded[1]).toBe('квест гродно замок А что там рядом?')
      const fresh = await post(server, '/ai/ask', { q: 'А что там рядом?', locale: 'ru', source: { type: 'travel', id: 816 } })
      expect(fresh.status).toBe(200)
      expect(embedded[2]).toBe('Ярмарки Польши А что там рядом?')

      // Квест на локали запроса: польский фрагмент и URL `/quests/1-pl`.
      const pl = await post(server, '/ai/ask', { q: 'zamek grodno', locale: 'pl', source: { type: 'quest', id: 1 } })
      expect(pl.events[0].data.sources[0]).toMatchObject({ type: 'quest', source_id: '1', title: 'Quest po Grodnie', url: 'https://metravel.by/quests/1-pl' })

      // Материала нет в индексе (опубликован после сборки): ход без закреплённой карточки.
      const missing = await post(server, '/ai/ask', { q: 'ярмарки краков', locale: 'ru', source: { type: 'travel', id: 999 } })
      expect(missing.status).toBe(200)
      expect(missing.events[0].data.sources.some((s: { source_id: string }) => s.source_id === '999')).toBe(false)
      expect(missing.events[0].data.sources.length).toBeGreaterThan(0)
    } finally {
      await close(server)
    }
  })

  it('#3290: режим страницы — в подсказке только карточка страницы: строка фактов и её фрагменты под вопрос; соседи — группой nearby в источниках', async () => {
    const seen: { system: string; user: string }[] = []
    const NEIGHBOUR_URL = 'https://metravel.by/travels/700'
    const generator = fakeGenerator((request) => {
      seen.push({ system: String(request.messages[0]?.content ?? ''), user: String(request.messages.at(-1)?.content ?? '') })
      return `На ярмарки хватит двух дней: [Ярмарки Польши](https://metravel.by/travels/816). Ещё есть [Тропа Мюллерталь](${NEIGHBOUR_URL}).`
    })
    const question = 'Сколько дней занимает поездка и что взять с собой?'
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'рождественские ярмарки краков вроцлав гданьск открываются в конце ноября', city: 'Краков' },
      { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'сколько дней занимает поездка на ярмарки: хватит двух дней на город', city: 'Краков' },
      { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'что взять с собой: термос, тёплую обувь и наличные злотые', city: 'Краков' },
      { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'глинтвейн пряники и ёлочные игрушки на рынке', city: 'Краков' },
      { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'парковка у старого города платная круглые сутки', city: 'Краков' },
      // Сосед ближе к вопросу, чем любая строка страницы: раньше он попадал в подсказку и давал «около 6 дней».
      { type: 'travel', sourceId: 700, title: 'Тропа Мюллерталь', text: question, city: 'Люксембург' },
      { type: 'travel', sourceId: 701, title: 'Италия с собакой', text: 'сколько дней занимает поездка с собакой по италии', city: 'Рим' },
      { type: 'quest', sourceId: 1, locale: 'ru', title: 'Квест по Гродно', text: 'квест гродно замок фарный костёл задание', city: 'Гродно' },
    ]
    const facts: SourceFacts[] = [{ type: 'travel', source_id: 816, number_days: 2, months: [11, 12] }]
    const PAGE_TEXTS = chunks.filter((chunk) => chunk.sourceId === 816).map((chunk) => chunk.text)
    // Вектор запроса совпадает с фрагментом «что взять с собой»: он обязан войти в карточку страницы.
    // Точный порядок баллов проверяет `page.test.ts` на управляемых векторах.
    const { server } = makeServer({ generator, chunks, facts, evalTrace: true, embedQuery: async () => fakeEmbedQuery(PAGE_TEXTS[2]) })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: question, locale: 'ru', source: { type: 'travel', id: 816 } })
      expect(reply.status).toBe(200)
      const sources = reply.events[0].data.sources as { type: string; source_id: string; snippet: string; group?: string }[]
      expect(sources.map((s) => [`${s.type}:${s.source_id}`, s.group])).toEqual([['travel:816', 'page'], ...sources.slice(1).map((s) => [`${s.type}:${s.source_id}`, 'nearby'])])
      expect(sources.slice(1).map((s) => `${s.type}:${s.source_id}`)).toContain('travel:700')
      expect(sources.length).toBeLessThanOrEqual(1 + AI_PAGE_NEARBY_LIMIT)

      // Карточка страницы: строка фактов (#3287), затем три лучших под вопрос фрагмента — только её текст, в порядке страницы.
      const FACTS_LINE = 'Польша, Краков. Дней: 2. Месяцы: ноябрь, декабрь. '
      expect(sources[0].snippet.startsWith(FACTS_LINE)).toBe(true)
      const fragments = sources[0].snippet.slice(FACTS_LINE.length).split(' … ')
      expect(fragments).toHaveLength(3)
      expect(fragments).toContain(PAGE_TEXTS[2])
      const order = fragments.map((fragment) => PAGE_TEXTS.indexOf(fragment))
      expect(order.every((position) => position >= 0)).toBe(true)
      expect(order).toEqual([...order].sort((a, b) => a - b))

      // Подсказка: одна карточка — страница; правило режима дописано к системному сообщению.
      expect(seen[0].user.match(/^\[\d+\] /gm)).toEqual(['[1] '])
      expect(seen[0].user).toContain(`[1] Статья «Ярмарки Польши» — https://metravel.by/travels/816\n${sources[0].snippet}`)
      expect(seen[0].user).not.toMatch(/Мюллерталь|Италия|Гродно/)
      expect(seen[0].system.endsWith(PAGE_MODE_RULE_RU)).toBe(true)
      expect((reply.events.find((event) => event.event === 'trace')!.data.prompt_sources as { source_id: string; group?: string }[]).map((s) => [s.source_id, s.group])).toEqual([['816', 'page']])

      // Ссылка ответа — только на страницу: адреса соседа в подсказке не было, страж его убирает.
      expect(reply.events.filter((event) => event.event === 'text').at(-1)!.data.text).toBe('На ярмарки хватит двух дней: [Ярмарки Польши](https://metravel.by/travels/816). Ещё есть Тропа Мюллерталь.')
      expect(reply.events.at(-1)!.data).toMatchObject({ status: 'done', removed_links: 1 })

      // Место вопроса есть на странице («гданьск» в тексте статьи) — режим страницы остаётся.
      const onPage = await post(server, '/ai/ask', { q: 'Есть ли парковка у ярмарки в Гданьске?', locale: 'ru', source: { type: 'travel', id: 816 } })
      expect(onPage.events[0].data.sources[0]).toMatchObject({ source_id: '816', group: 'page' })
      expect(seen[1].user.match(/^\[\d+\] /gm)).toEqual(['[1] '])
    } finally {
      await close(server)
    }
  })

  it('#3290: место вопроса дальше первых 200 знаков фрагмента страницы режим страницы не снимает', async () => {
    const generator = fakeGenerator(() => 'Парковка есть: [Ярмарки Польши](https://metravel.by/travels/816).')
    // Сниппет строки в памяти — первые 200 знаков; «Гданьск» стоит дальше и виден только в полном тексте.
    const longText = `${'рождественские ярмарки краков вроцлав торговые ряды глинтвейн пряники '.repeat(4)}парковка у ярмарки в гданьске платная`
    expect(longText.indexOf('гданьске')).toBeGreaterThan(200)
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: longText, city: 'Краков' },
      { type: 'travel', sourceId: 700, title: 'Тропа Мюллерталь', text: 'маршрут по ущельям люксембурга', city: 'Люксембург' },
    ]
    const { server } = makeServer({ generator, chunks })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: 'Есть ли парковка у ярмарки в Гданьске?', locale: 'ru', source: { type: 'travel', id: 816 } })
      expect(reply.status).toBe(200)
      expect(reply.events[0].data.sources[0]).toMatchObject({ source_id: '816', group: 'page' })
    } finally {
      await close(server)
    }
  })

  it('#3290: вопрос с местом, которого на странице нет, идёт общим подбором — страница в источниках группой nearby и не в подсказке, без правила режима; квест отвечает по своей странице', async () => {
    const seen: { system: string; user: string }[] = []
    const generator = fakeGenerator((request) => {
      seen.push({ system: String(request.messages[0]?.content ?? ''), user: String(request.messages.at(-1)?.content ?? '') })
      return 'Загляните в [Квест по Гродно](https://metravel.by/quests/1)'
    })
    const facts: SourceFacts[] = [{ type: 'quest', source_id: 1, points: 9, duration_min: 90, difficulty: 'easy' }]
    const { server } = makeServer({ generator, facts })
    await listen(server)
    try {
      const page = { type: 'travel', id: 816 }
      const exit = await post(server, '/ai/ask', { q: 'А что посмотреть в Гродно?', locale: 'ru', source: page })
      expect(exit.status).toBe(200)
      const sources = exit.events[0].data.sources as { type: string; source_id: string; group?: string }[]
      // Обычный ход: карточка места вопроса — первой и одна в подсказке; страница осталась в списке
      // источников группой nearby (пока она стояла в подсказке первой, модель называла её ответом).
      expect(sources[0]).toMatchObject({ type: 'quest', source_id: '1', group: 'match' })
      expect(sources.filter((s) => s.type === 'travel' && s.source_id === '816')).toEqual([expect.objectContaining({ group: 'nearby' })])
      expect(sources.slice(1).every((s) => s.group === 'nearby')).toBe(true)
      expect(seen[0].system).not.toContain(PAGE_MODE_RULE_RU)
      expect(seen[0].user.match(/^\[\d+\] /gm)).toEqual(['[1] '])
      expect(seen[0].user).toContain('[1] Квест «Квест по Гродно» — https://metravel.by/quests/1\n')
      expect(seen[0].user).not.toContain('https://metravel.by/travels/816')

      // Уточнение без своего места опирается на вопрос о Гродно — подбор остаётся общим.
      const followUp = await post(server, '/ai/ask', {
        q: 'А что там ещё есть?',
        locale: 'ru',
        source: page,
        history: [{ role: 'user', text: 'А что посмотреть в Гродно?' }, { role: 'assistant', text: 'Загляните в квест.' }],
      })
      const followUpSources = followUp.events[0].data.sources as { type: string; source_id: string; group?: string }[]
      expect(followUpSources.find((s) => s.source_id === '816')).toMatchObject({ group: 'nearby' })
      expect(followUpSources.every((s) => s.group !== 'page')).toBe(true)
      expect(seen[1].system).not.toContain(PAGE_MODE_RULE_RU)
      expect(seen[1].user).not.toContain('https://metravel.by/travels/816')

      // Страница квеста: «Сколько времени займёт?» — по строке фактов этого квеста, на локали запроса.
      const quest = await post(server, '/ai/ask', { q: 'Сколько времени займёт?', locale: 'ru', source: { type: 'quest', id: 1 } })
      expect(quest.events[0].data.sources[0]).toMatchObject({ type: 'quest', source_id: '1', group: 'page', title: 'Квест по Гродно' })
      expect(quest.events[0].data.sources[0].snippet).toBe('Городской квест по городу Гродно (Польша). Точек: 9. Длительность: 90 мин. Сложность: лёгкий. квест гродно замок фарный костёл задание')
      expect(seen[2].system.endsWith(PAGE_MODE_RULE_RU)).toBe(true)
      expect(seen[2].user.match(/^\[\d+\] /gm)).toEqual(['[1] '])
      const pl = await post(server, '/ai/ask', { q: 'Ile to potrwa?', locale: 'pl', source: { type: 'quest', id: 1 } })
      expect(pl.events[0].data.sources[0]).toMatchObject({ title: 'Quest po Grodnie', url: 'https://metravel.by/quests/1-pl', group: 'page' })
    } finally {
      await close(server)
    }
  })

  it('#3276: карточка квеста начинается с вида квеста, возраста и «Со взрослым»; при вопросе о детях детский квест города — первой карточкой подсказки', async () => {
    const prompts: string[] = []
    const generator = fakeGenerator((request) => {
      prompts.push(String(request.messages.at(-1)?.content ?? ''))
      return 'Загляните в [Фонари Бреста](https://metravel.by/quests/3)'
    })
    const chunks: Spec[] = [
      ...FIXTURE_CHUNKS,
      // В названии и тексте нет слова «дети»: наверх квест поднимают только теги каталога.
      { type: 'quest', sourceId: 3, title: 'Фонари Бреста', text: 'фонарщик улица советская зажигает фонари', city: 'Брест', tags: ['kids', 'family', 'age-8-10', 'adult-required'] },
      { type: 'quest', sourceId: 4, title: 'Набережная Гродно', text: 'неман набережная семейная прогулка', city: 'Гродно', tags: ['kids', 'age-5-7'] },
    ]
    const { server } = makeServer({ generator, chunks })
    await listen(server)
    try {
      const kids = await post(server, '/ai/ask', { q: 'Какой квест в Бресте подойдёт детям?', locale: 'ru' })
      expect(kids.status).toBe(200)
      const sources = kids.events[0].data.sources as { type: string; source_id: string; snippet: string }[]
      expect(sources[0]).toMatchObject({ type: 'quest', source_id: '3' })
      expect(sources[0].snippet).toBe('Детский городской квест по городу Брест (Польша). Возраст: 8–10 лет. Со взрослым. фонарщик улица советская зажигает фонари')
      // Обычный квест города несёт тот же зачин, что на экране; детский квест Гродно первым не становится.
      expect(sources.find((s) => s.type === 'quest' && s.source_id === '2')?.snippet).toBe('Городской квест по городу Брест (Польша). квест брест крепость задание дети')
      expect(sources.findIndex((s) => s.type === 'quest' && s.source_id === '4')).not.toBe(1)
      expect(sources.find((s) => s.type === 'travel')?.snippet).not.toMatch(/Городской квест/)
      // Та же карточка — первой в подсказке модели.
      expect(prompts[0]).toContain('[1] Квест «Фонари Бреста» — https://metravel.by/quests/3\nДетский городской квест по городу Брест (Польша). Возраст: 8–10 лет. Со взрослым.')

      // Без вопроса о детях порядок подбора не меняется: первым идёт не обязательно детский квест, зачин остаётся.
      const plain = await post(server, '/ai/ask', { q: 'фонарщик улица советская зажигает фонари', locale: 'ru' })
      const pinned = (plain.events[0].data.sources as { source_id: string; type: string; snippet: string }[]).find((s) => s.type === 'quest' && s.source_id === '3')
      expect(pinned?.snippet.startsWith('Детский городской квест по городу Брест (Польша). Возраст: 8–10 лет. Со взрослым. ')).toBe(true)
    } finally {
      await close(server)
    }
  })

  it('#3287: карточка службы начинается со строки фактов — число точек, длительность и сложность квеста, число дней и месяцы статьи; затем фрагмент текста', async () => {
    const prompts: string[] = []
    const generator = fakeGenerator((request) => {
      prompts.push(String(request.messages.at(-1)?.content ?? ''))
      return 'Загляните в [Квест по Гродно](https://metravel.by/quests/1)'
    })
    const facts: SourceFacts[] = [
      { type: 'quest', source_id: 1, points: 9, duration_min: 90, difficulty: 'easy', pet_friendly: true },
      { type: 'quest', source_id: 2, points: 12, duration_min: 150, difficulty: 'medium', pet_friendly: false, audience: 'kids', age: [8, 10], adult: true },
      { type: 'travel', source_id: 816, number_days: 3, months: [11, 12], transports: ['Машина'] },
    ]
    const { server } = makeServer({ generator, facts })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: 'Сколько времени занимает квест по Гродно и сколько в нём точек?', locale: 'ru' })
      expect(reply.status).toBe(200)
      const sources = reply.events[0].data.sources as { type: string; source_id: string; snippet: string }[]
      const snippetOf = (type: string, id: string) => sources.find((s) => s.type === type && s.source_id === id)?.snippet
      expect(snippetOf('quest', '1')).toBe('Городской квест по городу Гродно (Польша). Точек: 9. Длительность: 90 мин. Сложность: лёгкий. Можно с собакой. квест гродно замок фарный костёл задание')
      expect(snippetOf('quest', '2')).toBe(
        'Детский городской квест по городу Брест (Польша). Возраст: 8–10 лет. Со взрослым. Точек: 12. Длительность: 150 мин. Сложность: средний. квест брест крепость задание дети',
      )
      expect(snippetOf('travel', '816')).toMatch(/^Польша, Краков\. Дней: 3\. Месяцы: ноябрь, декабрь\. \S/)
      // У статьи без записи фактов строка — место из индекса, как на экране.
      expect(snippetOf('travel', '761')).toBe('Польша, Ойцув. замки скалы пещеры ойцув краков однодневная вылазка')
      // Числа доходят до модели: карточка квеста Гродно — в подсказке, строка фактов сразу под заголовком.
      expect(prompts[0]).toContain('Квест «Квест по Гродно» — https://metravel.by/quests/1\nГородской квест по городу Гродно (Польша). Точек: 9. Длительность: 90 мин. Сложность: лёгкий. Можно с собакой.')

      // Страница-источник (#2897) строится тем же построителем.
      const pinned = await post(server, '/ai/ask', { q: 'Сколько дней занимает поездка?', locale: 'ru', source: { type: 'travel', id: 816 } })
      expect(pinned.events[0].data.sources[0].snippet).toMatch(/^Польша, Краков\. Дней: 3\. Месяцы: ноябрь, декабрь\. /)
    } finally {
      await close(server)
    }
  })

  it('#3287: текстовый фрагмент карточки /ai/ask короче сниппета выдачи — по типу источника; длину задаёт окружение службы', async () => {
    const words = (seed: string) => Array.from({ length: 40 }, (_, i) => `${seed}${i}`).join(' ')
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 501, title: 'Длинная статья', text: words('замок'), city: 'Мир' },
      { type: 'quest', sourceId: 502, title: 'Длинный квест', text: words('башня'), city: 'Мир' },
    ]
    const facts: SourceFacts[] = [{ type: 'quest', source_id: 502, points: 9, duration_min: 90 }]
    const generator = fakeGenerator(() => 'Загляните в [Длинная статья](https://metravel.by/travels/501)')
    const snippets = async (server: http.Server) => {
      const reply = await post(server, '/ai/ask', { q: 'замок0 башня0', locale: 'ru' })
      const sources = reply.events[0].data.sources as { type: string; snippet: string }[]
      return { travel: sources.find((s) => s.type === 'travel')!.snippet, quest: sources.find((s) => s.type === 'quest')!.snippet }
    }
    const byDefault = makeServer({ generator, chunks, facts })
    const bare = makeServer({ generator, chunks, facts, askFragmentChars: { travel: 0, quest: 0 } })
    await Promise.all([listen(byDefault.server), listen(bare.server)])
    try {
      const cards = await snippets(byDefault.server)
      const travelText = cards.travel.replace('Польша, Мир. ', '')
      const questText = cards.quest.replace('Городской квест по городу Мир (Польша). Точек: 9. Длительность: 90 мин. ', '')
      expect(travelText).toMatch(/^замок0 замок1 .*…$/)
      expect(travelText.length).toBeLessThanOrEqual(ASK_FRAGMENT_CHARS.travel + 1)
      expect(travelText.length).toBeGreaterThan(ASK_FRAGMENT_CHARS.travel / 2)
      expect(questText).toMatch(/^башня0 башня1 .*…$/)
      expect(questText.length).toBeLessThanOrEqual(ASK_FRAGMENT_CHARS.quest + 1)
      // Сниппет выдачи `/ai/search` остаётся прежней длины.
      const found = await post(byDefault.server, '/ai/search', { q: 'замок0 башня0' })
      const searchSnippet = (found.json.items as { type: string; snippet: string }[]).find((item) => item.type === 'travel')!.snippet
      expect(searchSnippet.length).toBeGreaterThan(travelText.length)
      expect(searchSnippet.length).toBeLessThanOrEqual(SNIPPET_CHARS + 1)

      // Длина 0 — карточка из одной строки фактов.
      expect(await snippets(bare.server)).toEqual({ travel: 'Польша, Мир', quest: 'Городской квест по городу Мир (Польша). Точек: 9. Длительность: 90 мин' })
      const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv
      expect(loadConfig(env({})).askFragmentChars).toEqual(ASK_FRAGMENT_CHARS)
      expect(loadConfig(env({ AI_ASSIST_ASK_FRAGMENT_TRAVEL_CHARS: '160', AI_ASSIST_ASK_FRAGMENT_QUEST_CHARS: '0' })).askFragmentChars).toEqual({ travel: 160, quest: 0 })
      // #3289: новые строки подсказки включены, пока окружение их не выключит.
      expect(loadConfig(env({})).promptHints).toEqual({ whyFits: true, noPlace: true })
      expect(loadConfig(env({ AI_ASSIST_PROMPT_WHY_FITS: '0' })).promptHints).toEqual({ whyFits: false, noPlace: true })
      expect(loadConfig(env({ AI_ASSIST_PROMPT_NO_PLACE: '0' })).promptHints).toEqual({ whyFits: true, noPlace: false })
    } finally {
      await Promise.all([close(byDefault.server), close(bare.server)])
    }
  })

  it('#3287: «самый короткий квест в Бресте» — первой идёт карточка квеста города с наименьшей длительностью по фактам, даже когда подбор его не нашёл', async () => {
    const prompts: string[] = []
    const generator = fakeGenerator((request) => {
      prompts.push(String(request.messages.at(-1)?.content ?? ''))
      return 'Самый короткий — [Фонари](https://metravel.by/quests/11)'
    })
    const QUESTION = 'Самый короткий квест в Бресте'
    const FOLLOW_UP = ['Какие квесты есть в Бресте?', 'А какой из них самый короткий?']
    const chunks: Spec[] = [
      // Статьи, текст которых совпадает с запросом подбора: они занимают все восемь мест подбора.
      ...Array.from({ length: 9 }, (_, i): Spec => ({ type: 'travel', sourceId: 900 + i, title: `Статья ${i}`, text: QUESTION, city: 'Брест' })),
      ...Array.from({ length: 9 }, (_, i): Spec => ({ type: 'travel', sourceId: 950 + i, title: `Заметка ${i}`, text: FOLLOW_UP.join(' '), city: 'Брест' })),
      { type: 'quest', sourceId: 10, title: 'Крепость', text: 'холмские ворота казематы цитадель', city: 'Брест' },
      { type: 'quest', sourceId: 11, title: 'Фонари', text: 'фонарщик советская улица вечер', city: 'Брест' },
      { type: 'quest', sourceId: 11, locale: 'pl', title: 'Latarnie', text: 'latarnik ulica sowiecka wieczór', city: 'Brześć' },
      { type: 'quest', sourceId: 12, title: 'Тени Берестья', text: 'берестье раскоп срубы музей', city: 'Брест' },
      { type: 'quest', sourceId: 13, title: 'Без чисел', text: 'набережная мухавец прогулка', city: 'Брест' },
      // Короче всех, но в другом городе: ответом на вопрос о Бресте не становится.
      { type: 'quest', sourceId: 14, title: 'Набережная Гродно', text: 'неман набережная парк', city: 'Гродно' },
    ]
    const facts: SourceFacts[] = [
      { type: 'quest', source_id: 10, points: 12, duration_min: 120, difficulty: 'medium' },
      { type: 'quest', source_id: 11, points: 7, duration_min: 45, difficulty: 'easy' },
      { type: 'quest', source_id: 12, points: 5, duration_min: 90, difficulty: 'easy' },
      { type: 'quest', source_id: 13 },
      { type: 'quest', source_id: 14, points: 3, duration_min: 30, difficulty: 'easy' },
    ]
    const { server } = makeServer({ generator, chunks, facts })
    await listen(server)
    try {
      const keys = (reply: SseReply) => (reply.events[0].data.sources as { type: string; source_id: string }[]).map((s) => `${s.type}:${s.source_id}`)
      // Подбор сам квестов Бреста не находит: все восемь мест заняты статьями.
      const found = await post(server, '/ai/search', { q: QUESTION, limit: 8 })
      expect((found.json.items as { type: string }[]).map((item) => item.type)).toEqual(Array(8).fill('travel'))

      const shortest = await post(server, '/ai/ask', { q: QUESTION, locale: 'ru' })
      expect(shortest.status).toBe(200)
      expect(keys(shortest).slice(0, 3)).toEqual(['quest:11', 'quest:12', 'quest:10'])
      expect(keys(shortest)).toHaveLength(8)
      expect(keys(shortest)).not.toContain('quest:13')
      expect(keys(shortest)).not.toContain('quest:14')
      // В подсказку идут только три карточки-ответа; остальной подбор — группой nearby (живая модель при
      // восьми карточках называла статью, стоявшую последней).
      expect((shortest.events[0].data.sources as { group?: string }[]).map((s) => s.group)).toEqual(['match', 'match', 'match', 'nearby', 'nearby', 'nearby', 'nearby', 'nearby'])
      expect(prompts[0].match(/^\[\d+\] /gm)).toEqual(['[1] ', '[2] ', '[3] '])
      // Квесты города взяты из каталога, подбор их не нашёл — строки «материала о месте нет» быть не должно.
      expect(prompts[0]).not.toContain(NO_PLACE_NOTE_RU)
      // Та же карточка — первой в подсказке модели, с длительностью.
      expect(prompts[0]).toContain('[1] Квест «Фонари» — https://metravel.by/quests/11\nГородской квест по городу Брест (Польша). Точек: 7. Длительность: 45 мин. Сложность: лёгкий.')
      expect(prompts[0]).not.toContain('Набережная Гродно')

      // Уточнение берёт город из опоры диалога.
      const followUp = await post(server, '/ai/ask', {
        q: FOLLOW_UP[1],
        locale: 'ru',
        history: [{ role: 'user', text: FOLLOW_UP[0] }, { role: 'assistant', text: 'В Бресте есть квесты.' }],
      })
      expect(keys(followUp).slice(0, 3)).toEqual(['quest:11', 'quest:12', 'quest:10'])
      expect(prompts[1]).toContain('[1] Квест «Фонари»')

      // «Где меньше точек» — по числу точек; на польском — польская карточка того же квеста каталога.
      const fewest = await post(server, '/ai/ask', { q: 'В каком квесте Бреста меньше точек?', locale: 'ru' })
      expect(keys(fewest).slice(0, 3)).toEqual(['quest:12', 'quest:11', 'quest:10'])
      const pl = await post(server, '/ai/ask', { q: 'Który quest w Brześciu jest najkrótszy?', locale: 'pl' })
      expect(pl.events[0].data.sources[0]).toMatchObject({ type: 'quest', source_id: '11', title: 'Latarnie', url: 'https://metravel.by/quests/11-pl' })

      // Город без квестов в индексе и вопрос не о квесте подбор не переставляют.
      const elsewhere = await post(server, '/ai/ask', { q: 'Самый короткий квест в Витебске', locale: 'ru' })
      expect(keys(elsewhere).filter((key) => key.startsWith('quest:'))).toEqual([])
      const route = await post(server, '/ai/ask', { q: 'Самый короткий путь до Бреста', locale: 'ru' })
      expect(keys(route).slice(0, 3)).not.toEqual(['quest:11', 'quest:12', 'quest:10'])
    } finally {
      await close(server)
    }
  })

  it('#3287: артефакт без фактов — служба отвечает как прежде: зачин по тегам, подбор без перестановки', async () => {
    const { server } = makeServer({ generator: fakeGenerator(() => 'Загляните в [Квест по Бресту](https://metravel.by/quests/2)') })
    await listen(server)
    try {
      const order = (reply: SseReply) => (reply.events[0].data.sources as { type: string; source_id: string }[]).map((s) => `${s.type}:${s.source_id}`)
      const found = await post(server, '/ai/search', { q: 'Самый короткий квест в Бресте', limit: 8 })
      const shortest = await post(server, '/ai/ask', { q: 'Самый короткий квест в Бресте', locale: 'ru' })
      expect(shortest.status).toBe(200)
      // Без фактов превосходная степень ничего не переставляет; место и вид материала (#3289) — работают:
      // квест Бреста первым, квесты — раньше статей, внутри — порядок подбора.
      const foundKeys = (found.json.items as { type: string; source_id: number }[]).map((item) => `${item.type}:${item.source_id}`)
      expect(order(shortest)).toEqual(['quest:2', ...foundKeys.filter((key) => key !== 'quest:2')])
      expect((shortest.events[0].data.sources as { group?: string }[]).map((s) => s.group)).toEqual(['match', 'nearby', 'nearby', 'nearby', 'nearby'])
      const quests = (shortest.events[0].data.sources as { type: string; source_id: string; snippet: string }[]).filter((s) => s.type === 'quest')
      expect(quests.find((s) => s.source_id === '2')?.snippet).toBe('Городской квест по городу Брест (Польша). квест брест крепость задание дети')
      expect(quests.every((s) => !/Длительность|Точек/.test(s.snippet))).toBe(true)
    } finally {
      await close(server)
    }
  })

  it('#3291: эхо разметки подсказки и остаток из одного встречного вопроса — пустой ответ: последний text пуст, done несёт fallback и счётчик', async () => {
    const replies = [
      'Материалы сайта:\n[1] Статья [Ярмарки Польши](https://metravel.by/travels/816) — Польша, Краков.',
      'Сколько стоит квест — зависит от города: в Кракове — 60 злотых. Сколько летнему ребёнку, сколько взрослым?',
    ]
    const { server } = makeServer({ generator: fakeGenerator(() => replies.shift() ?? '') })
    await listen(server)
    try {
      const leaked = await post(server, '/ai/ask', { q: 'ярмарки краков', locale: 'ru' })
      expect(leaked.events.filter((event) => event.event === 'text').at(-1)!.data.text).toBe('')
      expect(leaked.events.at(-1)!.data).toMatchObject({ status: 'done', fallback: true, prompt_leaks: 2 })
      const question = await post(server, '/ai/ask', { q: 'Сколько стоит пройти квест в Гродно?', locale: 'ru' })
      expect(question.events.filter((event) => event.event === 'text').at(-1)!.data.text).toBe('')
      expect(question.events.at(-1)!.data).toMatchObject({ status: 'done', fallback: true, ungrounded_numbers: 1 })
      expect(question.events.at(-1)!.data).not.toHaveProperty('prompt_leaks')
    } finally {
      await close(server)
    }
  })

  it('#3291: страж содержания — подпись ссылки равна названию карточки, чужое пояснение и число без опоры убраны; done несёт счётчики', async () => {
    const raw = [
      'Вот что есть:',
      '- [Ярмарочный маршрут](https://metravel.by/travels/816) — зубры и велосипед в Беловежской пуще',
      '- [Квест по Гродно](https://metravel.by/quests/1) — городской квест: 9 точек, около 90 мин',
      'Кассы открыты до 18:00.',
    ].join('\n')
    const facts: SourceFacts[] = [{ type: 'quest', source_id: 1, points: 9, duration_min: 90, difficulty: 'easy' }]
    const { server } = makeServer({ generator: fakeGenerator(() => raw), facts, evalTrace: true })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: 'ярмарки краков', locale: 'ru' })
      expect(reply.status).toBe(200)
      const texts = reply.events.filter((event) => event.event === 'text')
      expect(texts.at(-1)!.data.text).toBe(
        ['Вот что есть:', '- [Ярмарки Польши](https://metravel.by/travels/816)', '- [Квест по Гродно](https://metravel.by/quests/1) — городской квест: 9 точек, около 90 мин'].join('\n'),
      )
      // Подпись исправлена уже в стриме: выдуманное название посетитель не видит ни на одном шаге.
      expect(texts.every((event) => !String(event.data.text).includes('Ярмарочный маршрут'))).toBe(true)
      expect(reply.events.at(-1)).toEqual({
        event: 'done',
        data: {
          status: 'done',
          removed_links: 0,
          relabeled: 1,
          dropped_descriptions: 1,
          ungrounded_numbers: 1,
          usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 },
          remaining: AI_ASK_DAILY_LIMIT - 1,
        },
      })
      // Контур оценки видит сырой ответ модели — до стража.
      expect(reply.events.find((event) => event.event === 'trace')!.data.raw_text).toBe(raw)
    } finally {
      await close(server)
    }
  })

  it('#3291: ответ — повтор вопроса без ссылки: последний text пуст, done со статусом done и fallback, источники и лимит как у обычного ответа', async () => {
    const question = 'Сколько стоит пройти квест по Гродно?'
    const { server, readLog } = makeServer({ generator: fakeGenerator(() => `${question}\n\nОтвет: Цены в карточках — в отдельных пунктах.`) })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: question, locale: 'ru' })
      expect(reply.status).toBe(200)
      expect(reply.events[0].event).toBe('sources')
      expect(reply.events[0].data.sources.length).toBeGreaterThan(0)
      expect(reply.events.filter((event) => event.event === 'text').at(-1)!.data.text).toBe('')
      expect(reply.events.at(-1)).toEqual({
        event: 'done',
        data: { status: 'done', removed_links: 0, fallback: true, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 }, remaining: AI_ASK_DAILY_LIMIT - 1 },
      })
      expect(readLog()).toEqual([])

      // Честное «в карточках этого нет» — ответ, а не пустышка: текст остаётся, флага нет.
      const honest = makeServer({ generator: fakeGenerator(() => 'В карточках цена квеста не указана.') })
      await listen(honest.server)
      try {
        const kept = await post(honest.server, '/ai/ask', { q: question, locale: 'ru' })
        expect(kept.events.filter((event) => event.event === 'text').at(-1)!.data.text).toBe('В карточках цена квеста не указана.')
        expect(kept.events.at(-1)!.data).not.toHaveProperty('fallback')
      } finally {
        await close(honest.server)
      }
    } finally {
      await close(server)
    }
  })

  it('#3315: в подсказку модели идут только карточки города из вопроса; список источников посетителя полный и без служебного поля места', async () => {
    const prompts: string[] = []
    const generator = fakeGenerator((request) => {
      prompts.push(String(request.messages.at(-1)?.content ?? ''))
      return 'Загляните в [Квест по Бресту](https://metravel.by/quests/2)'
    })
    const chunks: Spec[] = [
      ...FIXTURE_CHUNKS,
      { type: 'quest', sourceId: 4, title: 'Набережная Гродно', text: 'квест задание набережная неман', city: 'Гродно' },
    ]
    const { server } = makeServer({ generator, chunks })
    await listen(server)
    try {
      const result = await post(server, '/ai/ask', { q: 'Какие квесты есть в Бресте?', locale: 'ru' })
      expect(result.status).toBe(200)
      const sources = result.events[0].data.sources as { type: string; source_id: string; place?: unknown }[]
      // Посетитель видит весь подбор, включая квесты Гродно.
      expect(sources.some((s) => s.type === 'quest' && s.source_id === '2')).toBe(true)
      expect(sources.some((s) => s.type === 'quest' && s.source_id !== '2')).toBe(true)
      expect(sources.every((s) => !('place' in s))).toBe(true)
      // Модель — только карточки Бреста.
      expect(prompts[0]).toContain('Квест «Квест по Бресту» — https://metravel.by/quests/2')
      expect(prompts[0]).not.toContain('Гродно')

      // Уточнение без своего места берёт город из опоры диалога.
      const followUp = await post(server, '/ai/ask', {
        q: 'А какой из них самый короткий?',
        locale: 'ru',
        history: [{ role: 'user', text: 'Какие квесты есть в Бресте?' }, { role: 'assistant', text: 'В Бресте есть квест.' }],
      })
      expect(followUp.status).toBe(200)
      expect(prompts[1]).toContain('Квест «Квест по Бресту»')
      expect(prompts[1]).not.toContain('Гродно')
    } finally {
      await close(server)
    }
  })

  it('отказ модели на вопрос с признаком поездки (#3216) — done no_sources и строка в журнале спроса, без страйка', async () => {
    const requests: GenerateRequest[] = []
    const { server, limits, readLog } = makeServer({
      generator: fakeGenerator((request) => {
        requests.push(request)
        return OFFTOPIC_REPLY_RU
      }),
    })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: 'ярмарки в Кракове' }, { 'x-forwarded-for': '203.0.113.19' })
      expect(reply.events[0].data.sources.length).toBeGreaterThan(0)
      expect(reply.events.at(-1)!.data).toEqual({ status: 'no_sources' })
      expect(readLog()).toEqual([expect.objectContaining({ q: 'ярмарки в Кракове', reason: 'no_sources' })])
      expect(await limits.offTopicState('203.0.113.19')).toEqual({ strikes: 0, blocked: false })
      expect((await limits.quotaState('203.0.113.19')).used).toBe(1)
      // Служба, как и экран, просит генератор остановиться на четвёртой рекомендации.
      expect(requests[0].maxRecommendations).toBe(3)
    } finally {
      await close(server)
    }
  })

  it('#3286: с AI_ASSIST_EVAL_TRACE поток несёт перед done событие trace — карточки подсказки и сырой ответ до стража; без флага события нет', async () => {
    const prompts: string[] = []
    const answer = 'Загляните в [Квест по Бресту](https://metravel.by/quests/2) и на https://evil.example/x'
    const generator = () => fakeGenerator((request) => {
      prompts.push(String(request.messages.at(-1)?.content ?? ''))
      return answer
    })
    const chunks: Spec[] = [...FIXTURE_CHUNKS, { type: 'quest', sourceId: 4, title: 'Набережная Гродно', text: 'квест задание набережная неман', city: 'Гродно' }]
    const promptUrls = (prompt: string) => [...prompt.matchAll(/^\[\d+\] .* — (\S+)$/gm)].map((match) => match[1])
    const traced = makeServer({ generator: generator(), chunks, evalTrace: true })
    const plain = makeServer({ generator: generator(), chunks })
    await Promise.all([listen(traced.server), listen(plain.server)])
    try {
      const reply = await post(traced.server, '/ai/ask', { q: 'Какие квесты есть в Бресте?', locale: 'ru' })
      expect(reply.events.map((event) => event.event).filter((name) => name !== 'text')).toEqual(['sources', 'trace', 'done'])
      const trace = reply.events.find((event) => event.event === 'trace')!.data
      // Сырой ответ — с чужим адресом, который страж убрал из показанного текста.
      expect(trace.raw_text).toBe(answer)
      expect(reply.events.filter((event) => event.event === 'text').at(-1)!.data.text).not.toContain('evil.example')
      // Карточки события — ровно те, что стоят в сообщении модели: отбор по месту (#3315) оставил только Брест,
      // а посетитель получил полный подбор.
      const urls = trace.prompt_sources.map((source: { url: string }) => source.url)
      expect(urls).toEqual(promptUrls(prompts[0]))
      expect(urls).toEqual(['https://metravel.by/quests/2'])
      expect(reply.events[0].data.sources.length).toBeGreaterThan(urls.length)
      expect(trace.prompt_sources[0]).toMatchObject({ type: 'quest', source_id: '2', title: 'Квест по Бресту', path: '/quests/2' })
      expect(trace.prompt_sources.every((source: object) => !('place' in source))).toBe(true)

      // Закреплённая страница (#2897): отбора по месту нет, в событии — те же карточки, что в подсказке.
      const pinned = await post(traced.server, '/ai/ask', { q: 'квест гродно замок', locale: 'ru', source: { type: 'travel', id: 816 } })
      const pinnedTrace = pinned.events.find((event) => event.event === 'trace')!.data
      expect(pinnedTrace.prompt_sources.map((source: { url: string }) => source.url)).toEqual(promptUrls(prompts[1]))
      expect(pinnedTrace.prompt_sources[0].source_id).toBe('816')

      // Модель не вызывалась (фильтр тем) — события нет: карточек подсказки и ответа не существует.
      const offTopic = await post(traced.server, '/ai/ask', { q: 'как готовить кашу' })
      expect(offTopic.events.map((event) => event.event)).toEqual(['sources', 'done'])

      // Без флага — прежний поток, а /ai/health не называет адрес модели.
      const silent = await post(plain.server, '/ai/ask', { q: 'Какие квесты есть в Бресте?', locale: 'ru' })
      expect(silent.events.some((event) => event.event === 'trace')).toBe(false)
      expect(silent.events.at(-1)!.data.status).toBe('done')
      const health = (server: http.Server) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          http.get({ host: '127.0.0.1', port: (server.address() as AddressInfo).port, path: '/ai/health' }, (response) => {
            const chunks: Buffer[] = []
            response.on('data', (chunk) => chunks.push(chunk))
            response.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))))
          }).on('error', reject)
        })
      expect(await health(traced.server)).toMatchObject({ eval_trace: true, llm_url: 'http://127.0.0.1:8090' })
      const plainHealth = await health(plain.server)
      expect('eval_trace' in plainHealth || 'llm_url' in plainHealth).toBe(false)
    } finally {
      await Promise.all([close(traced.server), close(plain.server)])
    }
  })

  it('#3286: флаг трассировки читается только из AI_ASSIST_EVAL_TRACE=1, образ прода его не задаёт', () => {
    expect(loadConfig({}).evalTrace).toBe(false)
    expect(loadConfig({ AI_ASSIST_EVAL_TRACE: 'true' }).evalTrace).toBe(false)
    expect(loadConfig({ AI_ASSIST_EVAL_TRACE: '1' }).evalTrace).toBe(true)
    expect(readFileSync(join(process.cwd(), 'services/ai-assist/Dockerfile'), 'utf8')).not.toContain('AI_ASSIST_EVAL_TRACE')
  })

  it('отказ самой модели — done off_topic/model_refusal без страйка; лимит списан', async () => {
    const { server, limits } = makeServer({ generator: fakeGenerator(() => OFFTOPIC_REPLY_RU) })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: 'ярмарки краков' }, { 'x-forwarded-for': '203.0.113.9' })
      expect(reply.events.at(-1)!.data).toEqual({ status: 'off_topic', reason: 'model_refusal' })
      expect(await limits.offTopicState('203.0.113.9')).toEqual({ strikes: 0, blocked: false })
      expect((await limits.quotaState('203.0.113.9')).used).toBe(1)
    } finally {
      await close(server)
    }
  })

  it('дневной лимит на IP: сверх лимита — 429 limit с Retry-After до полуночи', async () => {
    const { server, limits } = makeServer({ dailyLimit: 1, now: () => MINSK_LATE })
    await listen(server)
    try {
      expect((await post(server, '/ai/ask', { q: 'ярмарки краков' })).status).toBe(200)
      const over = await post(server, '/ai/ask', { q: 'ярмарки краков' })
      expect(over.status).toBe(429)
      expect(over.headers['retry-after']).toBe('1')
      expect(over.json).toMatchObject({ error: 'limit', limit: 1, retry_after_sec: 1 })
      // Отклонённый вопрос счётчик не двигает: на лимите остаётся ровно принятое.
      expect((await limits.quotaState('127.0.0.1', MINSK_LATE)).used).toBe(1)
    } finally {
      await close(server)
    }
  })

  it('модель не настроена или не отвечает до первого токена — 503 generator_unavailable, вопрос возвращён, журнал generator_unavailable', async () => {
    const { server, limits, readLog } = makeServer({ generator: null })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: 'ярмарки краков' }, { 'x-forwarded-for': '203.0.113.5' })
      expect(reply.status).toBe(503)
      expect(reply.headers['retry-after']).toBe(String(GENERATOR_RETRY_AFTER_SEC))
      expect(reply.json.error).toBe('generator_unavailable')
      expect((await limits.quotaState('203.0.113.5')).used).toBe(0)
      expect(readLog().map((entry) => entry.reason)).toEqual(['generator_unavailable'])
    } finally {
      await close(server)
    }

    const down = makeServer({
      generator: {
        generate: async () => {
          throw new AiGeneratorError('unavailable', 'generator unreachable')
        },
      },
    })
    await listen(down.server)
    try {
      const reply = await post(down.server, '/ai/ask', { q: 'ярмарки краков' })
      expect(reply.status).toBe(503)
      expect(reply.json).toMatchObject({ error: 'generator_unavailable', detail: 'generator unreachable' })
    } finally {
      await close(down.server)
    }
  })

  it('занятая модель: второй вопрос не дождался очереди — 429 busy, лимит возвращён', async () => {
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const { server, limits } = makeServer({
      queueTimeoutMs: 50,
      generator: fakeGenerator(async () => {
        await gate
        return 'Смотрите https://metravel.by/travels/816'
      }),
    })
    await listen(server)
    try {
      const first = post(server, '/ai/ask', { q: 'ярмарки краков' }, { 'x-forwarded-for': '203.0.113.1' })
      await new Promise((resolve) => setTimeout(resolve, 20))
      const second = await post(server, '/ai/ask', { q: 'ярмарки краков' }, { 'x-forwarded-for': '203.0.113.2' })
      expect(second.status).toBe(429)
      expect(second.headers['retry-after']).toBe(String(GENERATOR_RETRY_AFTER_SEC))
      expect(second.json.error).toBe('busy')
      expect((await limits.quotaState('203.0.113.2')).used).toBe(0)
      releaseFirst()
      const done = await first
      expect(done.events.at(-1)!.data.status).toBe('done')
      expect((await limits.quotaState('203.0.113.1')).used).toBe(1)
    } finally {
      await close(server)
    }
  })

  it('посетитель закрыл соединение посреди ответа — генерация прервана, вопрос остаётся списанным (обрыв до done лимит не обходит)', async () => {
    let signal: AbortSignal | undefined
    const generator: Generator = {
      async generate(request) {
        signal = request.signal
        request.onDelta?.('Смотрите ', 'Смотрите ')
        await new Promise<void>((resolve) => request.signal?.addEventListener('abort', () => resolve(), { once: true }))
        throw new AiGeneratorError('aborted', 'generation aborted')
      },
    }
    const { server, limits } = makeServer({ generator })
    await listen(server)
    try {
      const { port } = server.address() as AddressInfo
      const payload = JSON.stringify({ q: 'ярмарки краков' })
      await new Promise<void>((resolve, reject) => {
        const request = http.request(
          { host: '127.0.0.1', port, method: 'POST', path: '/ai/ask', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.4' } },
          (response) => {
            response.once('data', () => {
              request.destroy()
              resolve()
            })
          },
        )
        request.on('error', reject)
        request.end(payload)
      })
      for (let i = 0; i < 50 && !signal?.aborted; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(signal?.aborted).toBe(true)
      expect((await limits.quotaState('203.0.113.4')).used).toBe(1)
    } finally {
      await close(server)
    }
  })

  it('посетитель ушёл до первого токена — вопрос возвращён', async () => {
    const generator: Generator = {
      async generate(request) {
        await new Promise<void>((resolve) => request.signal?.addEventListener('abort', () => resolve(), { once: true }))
        throw new AiGeneratorError('aborted', 'generation aborted')
      },
    }
    const { server, limits } = makeServer({ generator })
    await listen(server)
    try {
      const { port } = server.address() as AddressInfo
      const payload = JSON.stringify({ q: 'ярмарки краков' })
      await new Promise<void>((resolve, reject) => {
        const request = http.request(
          { host: '127.0.0.1', port, method: 'POST', path: '/ai/ask', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.6' } },
          () => {},
        )
        request.on('error', reject)
        request.end(payload, () => setTimeout(() => {
          request.destroy()
          resolve()
        }, 30))
      })
      for (let i = 0; i < 50 && (await limits.quotaState('203.0.113.6')).used !== 0; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect((await limits.quotaState('203.0.113.6')).used).toBe(0)
    } finally {
      await close(server)
    }
  })

  it('валидация: 400 на пустой q, чужую locale и кривую history; 405 на GET', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      expect((await post(server, '/ai/ask', { q: '  ' })).json).toMatchObject({ error: 'bad_request' })
      expect((await post(server, '/ai/ask', { q: 'ярмарки', locale: 'de' })).status).toBe(400)
      expect((await post(server, '/ai/ask', { q: 'ярмарки', history: [{ role: 'system', text: 'x' }] })).json.detail).toMatch(/history/)
      // Потолок истории совпадает с клиентским `ASK_HISTORY_TEXT_LIMIT`: клиент обрезает до него, сервер его принимает.
      const atLimit = [{ role: 'assistant', text: 'а'.repeat(ASK_HISTORY_TEXT_LIMIT) }]
      expect((await post(server, '/ai/ask', { q: 'ярмарки', history: atLimit })).status).not.toBe(400)
      const overLimit = [{ role: 'assistant', text: 'а'.repeat(ASK_HISTORY_TEXT_LIMIT + 1) }]
      expect((await post(server, '/ai/ask', { q: 'ярмарки', history: overLimit })).json.detail).toMatch(/history/)
      // #2897: кривой source — 400 (тип, id, строковая форма роута); лимит при этом не списывается.
      for (const source of [{ type: 'book', id: 1 }, { type: 'travel', id: 0 }, { type: 'travel' }, 'travel:816', [{ type: 'travel', id: 816 }]]) {
        const reply = await post(server, '/ai/ask', { q: 'ярмарки', source })
        expect([source, reply.status, reply.json?.error]).toEqual([source, 400, 'bad_request'])
        expect(reply.json.detail).toMatch(/source/)
      }
      const { port } = server.address() as AddressInfo
      const status = await new Promise<number>((resolve) => http.get({ host: '127.0.0.1', port, path: '/ai/ask' }, (response) => resolve(response.statusCode ?? 0)))
      expect(status).toBe(405)
    } finally {
      await close(server)
    }
  })
})

describe('metravel-assist: POST /ai/ask — условия вопроса (#3289)', () => {
  type SentSource = { type: string; source_id: string; title: string; snippet: string; group?: string; why?: string }
  const keyOf = (source: { type: string; source_id: string }) => `${source.type}:${source.source_id}`
  const WEEKEND = ['Самостоятельное путешествие', 'Тур выходного дня']

  /** Один ход через службу: карточки события `sources`, карточки подсказки из `trace` и текст подсказки. */
  async function ask(question: string, chunks: Spec[], facts: SourceFacts[], options: { locale?: string; promptHints?: PromptHints } = {}) {
    const seen: string[] = []
    const generator = fakeGenerator((request) => {
      seen.push(String(request.messages.at(-1)?.content ?? ''))
      return 'Посмотрите материалы сайта.'
    })
    const { server } = makeServer({ generator, chunks, facts, evalTrace: true, promptHints: options.promptHints })
    await listen(server)
    try {
      const reply = await post(server, '/ai/ask', { q: question, locale: options.locale ?? 'ru' })
      expect(reply.status).toBe(200)
      const sources = reply.events[0].data.sources as SentSource[]
      const prompt = reply.events.find((event) => event.event === 'trace')!.data.prompt_sources as SentSource[]
      const found = await post(server, '/ai/search', { q: question, locale: options.locale ?? 'ru', limit: 8 })
      const foundKeys = (found.json.items as { type: string; source_id: number }[]).map((item) => `${item.type}:${item.source_id}`)
      const inGroup = (group: string) => sources.filter((source) => source.group === group).map(keyOf)
      return { sources, prompt, user: seen[0], foundKeys, inGroup }
    } finally {
      await close(server)
    }
  }

  const P09: Spec[] = [
    { type: 'travel', sourceId: 672, title: 'Маршруты выходного дня из Минска: 13 поездок', text: 'куда поехать из минска на один день зимой и летом', city: 'Лысая гора', country: 'Беларусь' },
    { type: 'travel', sourceId: 135, title: 'Жемыславль: дворец Умястовских и маршрут из Минска', text: 'дворец умястовских жемыславль один день', city: 'Жемыславль', country: 'Беларусь' },
    { type: 'travel', sourceId: 155, title: 'Зимний маршрут: Польша, Германия, Чехия, Австрия', text: 'куда поехать зимой: выехали из Беларуси на две недели', city: 'Дрезден', country: 'Австрия, Германия, Польша, Чехия' },
    { type: 'travel', sourceId: 594, title: 'Блатня (Błatnia) — наш поход', text: 'поход на один день зимой в горы', city: 'Блатня', country: 'Польша' },
    { type: 'travel', sourceId: 187, title: 'Могилёв, усадьба Толстых и Быховский замок', text: 'могилёв быховский замок один день', city: 'Быхов', country: 'Беларусь' },
  ]
  const P09_FACTS: SourceFacts[] = [
    { type: 'travel', source_id: 672, categories: WEEKEND },
    { type: 'travel', source_id: 135, number_days: 1, months: [3], transports: ['Машина'] },
    { type: 'travel', source_id: 155, number_days: 14, months: [1, 2], transports: ['Машина'] },
    { type: 'travel', source_id: 594, number_days: 1, months: [5], transports: ['Машина'] },
    { type: 'travel', source_id: 187, number_days: 1, months: [8], transports: ['Машина'] },
  ]

  it('p09 «зимой в Беларуси на один день»: поездка на 14 дней и чужая страна — группой nearby и не в подсказке; подборка выходного дня первой со строкой «Почему подходит»', async () => {
    for (const question of ['Куда поехать зимой в Беларуси на один день?', 'Куда съездить по Беларуси в январе одним днём?']) {
      const { sources, prompt, user, inGroup } = await ask(question, P09, P09_FACTS)
      expect(inGroup('match')).toEqual(expect.arrayContaining(['travel:672', 'travel:135', 'travel:187']))
      expect(inGroup('match')).toHaveLength(3)
      expect(inGroup('nearby').sort()).toEqual(['travel:155', 'travel:594'])
      // Подходящие — первыми в списке источников, «рядом» — следом.
      expect(sources.map((source) => source.group)).toEqual(['match', 'match', 'match', 'nearby', 'nearby'])
      expect(keyOf(sources[0])).toBe('travel:672')
      // Подсказка: только прошедшие отбор; у подборки — строка с совпавшим условием.
      expect(prompt.map(keyOf)).toEqual(sources.slice(0, 3).map(keyOf))
      expect(prompt[0].why).toBe('тур выходного дня')
      expect(user).toContain('\nПочему подходит: тур выходного дня\n')
      expect(user).not.toContain('Зимний маршрут')
      expect(user).not.toContain(NO_PLACE_NOTE_RU)
      // Служебные поля отбора посетителю не уходят.
      for (const source of sources) {
        expect(source).not.toHaveProperty('facts')
        expect(source).not.toHaveProperty('why')
        expect(source).not.toHaveProperty('place')
      }
    }
  })

  it('строка «Почему подходит» выключается: порядок и группы те же, в подсказке и в trace её нет', async () => {
    const on = await ask('Куда поехать зимой в Беларуси на один день?', P09, P09_FACTS)
    const off = await ask('Куда поехать зимой в Беларуси на один день?', P09, P09_FACTS, { promptHints: { whyFits: false, noPlace: true } })
    expect(off.sources).toEqual(on.sources)
    expect(off.user).not.toContain('Почему подходит')
    expect(off.prompt.every((source) => source.why === undefined)).toBe(true)
    expect(off.user).toBe(on.user.replace(/\nПочему подходит: [^\n]+/g, ''))
  })

  it('p05 «с собакой недалеко от Варшавы»: квест Варшавы с пометкой каталога — первым, Хельская коса и Краков — nearby', async () => {
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 502, title: 'Варшавские Лазенки', text: 'где погулять в варшаве: парк лазенки дворец на воде', city: 'Pałac na Wyspie' },
      { type: 'travel', sourceId: 459, title: 'Хельская коса: три маяка и неделя на Балтике', text: 'где погулять с собакой у моря: хельская коса', city: 'Hel' },
      { type: 'travel', sourceId: 568, title: 'Краков: путеводитель по местам', text: 'где погулять в кракове', city: 'Краков' },
      { type: 'quest', sourceId: 129, title: 'Детский квест по Варшаве: знаки для базилишка', text: 'квест варшава старый город базилиск', city: 'Варшава', tags: ['kids', 'age-8-10'] },
      { type: 'quest', sourceId: 130, title: 'Квест по Варшаве: королевский тракт', text: 'квест варшава королевский тракт', city: 'Варшава' },
    ]
    const facts: SourceFacts[] = [
      { type: 'travel', source_id: 502, number_days: 1, months: [2], transports: ['Машина'] },
      { type: 'travel', source_id: 459, months: [4] },
      { type: 'quest', source_id: 129, points: 8, duration_min: 75, difficulty: 'easy', pet_friendly: true, audience: 'kids', age: [8, 10] },
      { type: 'quest', source_id: 130, points: 9, duration_min: 90, difficulty: 'easy', pet_friendly: false },
    ]
    for (const question of ['Где погулять с собакой недалеко от Варшавы?', 'Куда сходить с собакой в Варшаве?']) {
      const { sources, prompt, user, inGroup } = await ask(question, chunks, facts)
      expect(keyOf(sources[0])).toBe('quest:129')
      expect(prompt[0].why).toBe('можно с собакой')
      expect(user).toContain('Можно с собакой. квест варшава старый город базилиск\nПочему подходит: можно с собакой\n')
      // Квест «без собаки» остаётся в подсказке последним: нарушение без числа не убирает.
      expect(inGroup('match')).toEqual(['quest:129', 'travel:502', 'quest:130'])
      expect(inGroup('nearby').sort()).toEqual(['travel:459', 'travel:568'])
    }
  })

  it('p13 «з дітьми на вихідні у Польщі»: поездки на 4 и 7 дней — nearby, Energylandia в подсказке со строкой «1 день»', async () => {
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 178, title: 'Польша за 4 дня: маршрут из Минска в Гданьск', text: 'куда поехать с детьми в польше: гданьск мальборк', city: 'Elblag' },
      { type: 'travel', sourceId: 438, title: 'Нижняя Силезия за неделю', text: 'куда поехать на выходные в польше: вроцлав клодзко', city: 'Jawornica' },
      { type: 'travel', sourceId: 386, title: 'Energylandia - польский Диснейленд.', text: 'парк развлечений с детьми в польше', city: 'Затор' },
      { type: 'travel', sourceId: 637, title: 'Горы Польши: 19 пеших маршрутов', text: 'пешие маршруты в горах польши', city: 'Krzyż na Giewoncie' },
    ]
    const facts: SourceFacts[] = [
      { type: 'travel', source_id: 178, number_days: 4, months: [11], transports: ['Машина'] },
      { type: 'travel', source_id: 438, number_days: 7, months: [11], transports: ['Машина'] },
      { type: 'travel', source_id: 386, number_days: 1, months: [7], transports: ['Машина'], categories: WEEKEND },
    ]
    for (const question of ['Куда поехать с детьми на выходные в Польше?', 'Что посмотреть в Польше с ребёнком за выходные?']) {
      const { sources, prompt, user, inGroup } = await ask(question, chunks, facts)
      expect(keyOf(sources[0])).toBe('travel:386')
      expect(prompt.map(keyOf).sort()).toEqual(['travel:386', 'travel:637'])
      expect(prompt[0].why).toBe('1 день')
      expect(inGroup('nearby').sort()).toEqual(['travel:178', 'travel:438'])
      expect(user).not.toContain('Польша за 4 дня')
    }
  })

  it('p15 «замки Беларуси за выходные»: подборка без числа дней остаётся в подсказке по категории каталога, чужая страна — nearby', async () => {
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 635, title: 'Замки и усадьбы Беларуси: 19 маршрутов из Минска', text: 'замки беларуси: мир несвиж крево гольшаны', city: 'Несвиж', country: 'Беларусь' },
      { type: 'travel', sourceId: 196, title: 'Веломаршрут за день: Кревский замок и Гольшаны', text: 'кревский замок гольшаны веломаршрут', city: 'Ошмяны', country: 'Беларусь' },
      { type: 'travel', sourceId: 300, title: 'Замки Беларуси: большое кольцо за пять дней', text: 'замки беларуси за пять дней', city: 'Гродно', country: 'Беларусь' },
      { type: 'travel', sourceId: 421, title: 'Шклярска-Поремба за 3 дня: замки и Снежка', text: 'замки за выходные и снежка', city: 'Zamek Bolków' },
    ]
    const facts: SourceFacts[] = [
      { type: 'travel', source_id: 635, categories: WEEKEND },
      { type: 'travel', source_id: 196, number_days: 1, months: [9], transports: ['Машина', 'Велосипед'] },
      { type: 'travel', source_id: 300, number_days: 5, months: [7], transports: ['Машина'] },
      { type: 'travel', source_id: 421, number_days: 3, months: [10], transports: ['Машина'] },
    ]
    for (const question of ['Какие замки Беларуси можно объехать за выходные?', 'Замки в Беларуси на выходные']) {
      const { prompt, user, inGroup } = await ask(question, chunks, facts)
      expect(prompt.map(keyOf).sort()).toEqual(['travel:196', 'travel:635'])
      expect(prompt.find((source) => source.source_id === '635')?.why).toBe('тур выходного дня')
      expect(prompt.find((source) => source.source_id === '196')?.why).toBe('1 день')
      expect(inGroup('nearby').sort()).toEqual(['travel:300', 'travel:421'])
      expect(user).toContain('Замки и усадьбы Беларуси: 19 маршрутов из Минска')
    }
  })

  it('p08 «в Татрах без машины»: место — регион без своих карточек: маршрут по Люксембургу на автобусе условием не поднят, порядок подбора сохранён', async () => {
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 553, title: 'Закопане: лёгкая тропа Ścieżka nad Reglami', text: 'лёгкая тропа для новичков у подножия татр', city: 'Groń' },
      { type: 'travel', sourceId: 362, title: 'Морское око в мае: озеро в Татрах, Польша', text: 'маршрут к озеру морское око', city: 'Palenica Białczańska' },
      { type: 'travel', sourceId: 761, title: 'Mullerthal Trail: 112 км по Люксембургу за 6 дней', text: 'маршрут для новичков без машины на автобусе', city: 'Эхтернах', country: 'Люксембург' },
    ]
    const facts: SourceFacts[] = [
      { type: 'travel', source_id: 553, number_days: 1, months: [8], transports: ['Машина'] },
      { type: 'travel', source_id: 362, number_days: 1, months: [5], transports: ['Машина'] },
      { type: 'travel', source_id: 761, number_days: 6, months: [9, 10], transports: ['Автобус'] },
    ]
    const { sources, prompt, user, foundKeys } = await ask('Посоветуй маршрут в Татрах для новичков без машины', chunks, facts)
    expect(sources.map(keyOf)).toEqual(foundKeys)
    expect(sources.every((source) => source.group === undefined)).toBe(true)
    expect(prompt.every((source) => source.why === undefined)).toBe(true)
    expect(user).not.toContain('Почему подходит')
    // Татры упомянуты в карточках — строки «материала о месте нет» нет.
    expect(user).not.toContain(NO_PLACE_NOTE_RU)
    // Тот же вопрос без места: условие работает — автобусный маршрут первым.
    const anywhere = await ask('Посоветуй маршрут для новичков без машины', chunks, facts)
    expect(keyOf(anywhere.sources[0])).toBe('travel:761')
    expect(anywhere.prompt[0].why).toBe('без машины: автобус')
  })

  it('место, которого нет ни в одном источнике, — строка «материала о месте нет» перед вопросом; упоминание в тексте за пределами фрагмента карточки её снимает; строка выключается', async () => {
    const question = 'Что посмотреть в Исландии?'
    const chunks: Spec[] = [
      { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'что посмотреть на рождественских ярмарках', city: 'Краков' },
      { type: 'travel', sourceId: 761, title: 'Ойцувский парк', text: 'что посмотреть: замки скалы пещеры', city: 'Ойцув' },
    ]
    const missing = await ask(question, chunks, [])
    expect(missing.sources.every((source) => source.group === undefined)).toBe(true)
    expect(missing.user).toMatch(new RegExp(`\\n\\n${NO_PLACE_NOTE_RU.replace(/[.()]/g, '\\$&')}\\n\\nВопрос посетителя: ${question.replace('?', '\\?')}$`))

    const off = await ask(question, chunks, [], { promptHints: { whyFits: true, noPlace: false } })
    expect(off.user).not.toContain(NO_PLACE_NOTE_RU)
    expect(off.user).toBe(missing.user.replace(`${NO_PLACE_NOTE_RU}\n\n`, ''))

    // Слово «Исландии» стоит дальше 120 знаков фрагмента карточки, но в тексте источника оно есть.
    const tail = `${'что посмотреть на севере: водопады гейзеры ледники и чёрные пляжи, '.repeat(2)}всё это мы видели в Исландии`
    expect(tail.indexOf('Исландии')).toBeGreaterThan(ASK_FRAGMENT_CHARS.travel)
    const mentioned = await ask(question, [...chunks, { type: 'travel', sourceId: 900, title: 'Северные острова', text: tail, city: 'Вик' }], [])
    expect(mentioned.sources.find((source) => source.source_id === '900')?.snippet).not.toContain('Исландии')
    expect(mentioned.user).not.toContain(NO_PLACE_NOTE_RU)
  })

  it('числовое условие: квест длиннее названного времени — nearby; квест без длительности в каталоге остаётся в подсказке', async () => {
    const chunks: Spec[] = [
      { type: 'quest', sourceId: 1, title: 'Квест по Гродно: короткий', text: 'квест гродно замок', city: 'Гродно' },
      { type: 'quest', sourceId: 3, title: 'Квест по Гродно: длинный', text: 'квест гродно набережная', city: 'Гродно' },
      { type: 'quest', sourceId: 4, title: 'Квест по Гродно: без длительности', text: 'квест гродно костёл', city: 'Гродно' },
      { type: 'quest', sourceId: 2, title: 'Квест по Бресту', text: 'квест брест крепость', city: 'Брест' },
    ]
    const facts: SourceFacts[] = [
      { type: 'quest', source_id: 1, points: 6, duration_min: 45, difficulty: 'easy' },
      { type: 'quest', source_id: 3, points: 12, duration_min: 150, difficulty: 'medium' },
      { type: 'quest', source_id: 4, points: 8 },
      { type: 'quest', source_id: 2, points: 5, duration_min: 30, difficulty: 'easy' },
    ]
    const { sources, prompt, inGroup } = await ask('Квесты в Гродно до часа', chunks, facts)
    expect(keyOf(sources[0])).toBe('quest:1')
    expect(prompt.map(keyOf)).toEqual(['quest:1', 'quest:4'])
    expect(prompt.map((source) => source.why)).toEqual(['45 мин', undefined])
    // Длинный квест города и короткий квест чужого города — оба «рядом».
    expect(inGroup('nearby').sort()).toEqual(['quest:2', 'quest:3'])
  })
})
