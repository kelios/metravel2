/**
 * @jest-environment node
 */
import { mkdtempSync, readFileSync } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'

import { AiGeneratorError, type GenerateRequest, type Generator } from '@/api/aiAssist/generator'
import { OFFTOPIC_REPLY_RU } from '@/api/aiAssist/prompt'
import { AI_ASK_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK } from '@/api/aiAssist/policy'
import type { DemandEntry as ClientDemandEntry, DemandReason as ClientDemandReason } from '@/api/aiAssist/demandLog'
import { createApp } from '@/scripts/ai-assist/app'
import { clientIp, GENERATOR_RETRY_AFTER_SEC } from '@/scripts/ai-assist/ask'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { createDemandLog, type DemandEntry, type DemandReason } from '@/scripts/ai-assist/demandLog'
import { AskLimits, createCounterStore, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'

import { fakeEmbedQuery, loadFixtureIndex, MODEL } from './fixture'

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

function makeServer(overrides: { generator?: Generator | null; dailyLimit?: number; now?: () => Date; queueTimeoutMs?: number } = {}) {
  const logDir = mkdtempSync(join(tmpdir(), 'ai-demand-'))
  const demandPath = join(logDir, 'nested', 'ai-demand.jsonl')
  const limits = new AskLimits({
    store: new MemoryCounterStore(),
    clock: createDayClock('Europe/Minsk'),
    dailyLimit: overrides.dailyLimit ?? AI_ASK_DAILY_LIMIT,
    strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK,
  })
  const generator = overrides.generator === undefined ? fakeGenerator(() => 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816) и на https://evil.example/x') : overrides.generator
  const server = createApp({
    index: loadFixtureIndex(),
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: {
      generator,
      limits,
      demandLog: createDemandLog({ path: demandPath, now: overrides.now }),
      queueTimeoutMs: overrides.queueTimeoutMs ?? 200,
      trustProxy: true,
      now: overrides.now,
    },
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
      const { port } = server.address() as AddressInfo
      const status = await new Promise<number>((resolve) => http.get({ host: '127.0.0.1', port, path: '/ai/ask' }, (response) => resolve(response.statusCode ?? 0)))
      expect(status).toBe(405)
    } finally {
      await close(server)
    }
  })
})
