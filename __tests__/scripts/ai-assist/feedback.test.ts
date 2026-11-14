/**
 * #3296: оценка ответа ассистента — идентификатор хода в `done`, `POST /ai/feedback`, строка журнала на
 * ход и срок хранения. Раньше журнал получал только вопросы без материала и блокировки: ответ «не того
 * города» в нём не был виден вовсе.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import { join } from 'path'

import type { Generator } from '@/api/aiAssist/generator'
import { AI_ASK_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK } from '@/api/aiAssist/policy'
import { createApp } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { createDemandLog, DEMAND_QUESTION_MAX_LENGTH, DEMAND_RETENTION_DAYS, isExpired } from '@/scripts/ai-assist/demandLog'
import { TurnRegistry } from '@/scripts/ai-assist/feedback'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'

import { makeTempDir } from '../cli-test-utils'
import { fakeEmbedQuery, loadFixtureIndex, MODEL, type Spec, writeFixtureIndex } from './fixture'

type Reply = { status: number; events: { event: string; data: any }[]; json: any }

function request(server: http.Server, path: string, body: unknown, headers: Record<string, string> = {}, method = 'POST'): Promise<Reply> {
  const { port } = server.address() as AddressInfo
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers } },
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
                  return { event: lines.find((line) => line.startsWith('event: '))!.slice(7), data: JSON.parse(lines.find((line) => line.startsWith('data: '))!.slice(6)) }
                })
            : []
          resolve({ status: response.statusCode ?? 0, events, json: sse || !raw ? null : JSON.parse(raw) })
        })
      },
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

const listen = (server: http.Server) => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const close = (server: http.Server) => new Promise<void>((resolve) => server.close(() => resolve()))
const generatorOf = (text: string): Generator => ({
  async generate(input) {
    input.onDelta?.(text, text)
    return { text, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } }
  },
})

const NOW = new Date('2026-11-14T10:00:00.000Z')
const IP = { 'x-real-ip': '203.0.113.7' }
const HELP: Spec[] = [
  { type: 'help', sourceId: 1, title: 'Сколько стоит пройти квест?', text: 'Сколько стоит пройти квест?', answer: 'Бесплатно. Покупать ничего не нужно.', page: '/quests', city: null, lat: null, lng: null },
]

function makeServer(options: { answer?: string; dailyLimit?: number; feedbackLimit?: number; now?: () => Date; chunks?: Spec[] } = {}) {
  const demandPath = join(makeTempDir('ai-feedback-'), 'ai-demand.jsonl')
  const limits = (dailyLimit: number, prefix?: string) =>
    new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit, strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK, ...(prefix ? { prefix } : {}) })
  const now = options.now ?? (() => NOW)
  const server = createApp({
    index: options.chunks ? loadFixtureIndex(writeFixtureIndex(MODEL, options.chunks)) : loadFixtureIndex(),
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: {
      generator: generatorOf(options.answer ?? 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816).'),
      limits: limits(options.dailyLimit ?? AI_ASK_DAILY_LIMIT),
      demandLog: createDemandLog({ path: demandPath, now }),
      queueTimeoutMs: 200,
      trustProxy: true,
      now,
    },
    authorDraft: { limits: limits(5) },
    feedback: options.feedbackLimit === undefined ? {} : { limits: limits(options.feedbackLimit, 'ai-feedback-test') },
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: () => {},
  })
  const readLog = (): Record<string, unknown>[] => {
    try {
      return readFileSync(demandPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }
  return { server, readLog, demandPath }
}

const askTurn = async (server: http.Server, q: string, headers = IP, locale = 'ru') => {
  const reply = await request(server, '/ai/ask', { q, locale }, headers)
  return { reply, done: reply.events.find((item) => item.event === 'done')?.data as Record<string, any> }
}

describe('metravel-assist: оценка ответа — ход в журнале и POST /ai/feedback (#3296)', () => {
  it('ход, дошедший до ответа: `done` несёт turn_id, в журнале строка без IP — язык, вопрос, статус, карточки подсказки, длина ответа, флаги стража', async () => {
    const { server, readLog } = makeServer({ answer: 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816) и на https://evil.example/x' })
    await listen(server)
    try {
      const { reply, done } = await askTurn(server, 'ярмарки Польши')
      expect(reply.status).toBe(200)
      expect(done).toMatchObject({ status: 'done', removed_links: 1 })
      expect(done.turn_id).toMatch(/^[0-9a-f-]{36}$/)
      const log = readLog()
      expect(log).toHaveLength(1)
      expect(log[0]).toEqual({
        ts: NOW.toISOString(),
        turn: done.turn_id,
        locale: 'ru',
        q: 'ярмарки Польши',
        status: 'done',
        source_ids: expect.arrayContaining(['travel:816']),
        answer_chars: expect.any(Number),
        guard: { removed_links: 1 },
      })
      // Ни IP, ни текста ответа, ни идентификатора пользователя в строке нет.
      expect(JSON.stringify(log[0])).not.toContain('203.0.113.7')
      expect(Object.keys(log[0]).sort()).toEqual(['answer_chars', 'guard', 'locale', 'q', 'source_ids', 'status', 'ts', 'turn'])
    } finally {
      await close(server)
    }
  })

  it('статус хода: признание «отдельного материала нет» — partial_no_material, запасной ответ стража — fallback, справка — help', async () => {
    const partial = makeServer({ answer: 'Отдельного материала про зимние ярмарки на сайте пока нет. Из того, что нашлось: [Ярмарки Польши](https://metravel.by/travels/816).' })
    await listen(partial.server)
    try {
      await askTurn(partial.server, 'ярмарки Польши')
      expect(partial.readLog()[0]).toMatchObject({ status: 'partial_no_material' })
    } finally {
      await close(partial.server)
    }

    const fallback = makeServer({ answer: 'ярмарки Польши?' })
    await listen(fallback.server)
    try {
      const { done } = await askTurn(fallback.server, 'ярмарки Польши')
      expect(done).toMatchObject({ fallback: true })
      expect(fallback.readLog()[0]).toMatchObject({ status: 'fallback', answer_chars: 0, turn: done.turn_id })
    } finally {
      await close(fallback.server)
    }

    const help = makeServer({ chunks: HELP })
    await listen(help.server)
    try {
      const { done } = await askTurn(help.server, 'Сколько стоит пройти квест?')
      expect(help.readLog()).toEqual([expect.objectContaining({ status: 'help', turn: done.turn_id, source_ids: ['help:1'], guard: {} })])
    } finally {
      await close(help.server)
    }
  })

  it('ход без ответа строки хода не получает: вопрос не по теме — без записи и без turn_id; вопрос обрезается до 300 знаков', async () => {
    const { server, readLog } = makeServer()
    await listen(server)
    try {
      const offTopic = await askTurn(server, 'как готовить кашу')
      expect(offTopic.done).toEqual(expect.not.objectContaining({ turn_id: expect.anything() }))
      expect(readLog()).toEqual([])
      // Длиннее 300 знаков, но в пределах лимита запроса (500).
      const long = `ярмарки Польши ${'очень '.repeat(55)}интересно`
      expect((await askTurn(server, long)).reply.status).toBe(200)
      const [line] = readLog()
      expect(String(line.q)).toHaveLength(DEMAND_QUESTION_MAX_LENGTH)
      expect(long.startsWith(String(line.q))).toBe(true)
    } finally {
      await close(server)
    }
  })

  it('голос: 204 и запись в журнал; один голос на ход — повтор и смена голоса не пишутся; причина уточняется один раз', async () => {
    const { server, readLog } = makeServer()
    await listen(server)
    try {
      const up = await askTurn(server, 'ярмарки Польши')
      const vote = (body: Record<string, unknown>, headers = IP) => request(server, '/ai/feedback', body, headers)
      expect((await vote({ turn_id: up.done.turn_id, vote: 'up' })).status).toBe(204)
      // Повтор и попытка сменить голос — 204, но второй записи нет.
      expect((await vote({ turn_id: up.done.turn_id, vote: 'up' })).status).toBe(204)
      expect((await vote({ turn_id: up.done.turn_id, vote: 'down', reason: 'facts' })).status).toBe(204)
      expect(readLog().filter((line) => 'vote' in line)).toEqual([{ ts: NOW.toISOString(), turn: up.done.turn_id, vote: 'up' }])

      // «Не помогло», затем причина — одна оценка в двух записях: вторая уточняет первую.
      const down = await askTurn(server, 'ярмарки Польши зимой')
      expect((await vote({ turn_id: down.done.turn_id, vote: 'down' })).status).toBe(204)
      expect((await vote({ turn_id: down.done.turn_id, vote: 'down', reason: 'place' })).status).toBe(204)
      // Вторая причина уже не принимается.
      expect((await vote({ turn_id: down.done.turn_id, vote: 'down', reason: 'facts' })).status).toBe(204)
      expect(readLog().filter((line) => line.turn === down.done.turn_id && 'vote' in line)).toEqual([
        { ts: NOW.toISOString(), turn: down.done.turn_id, vote: 'down' },
        { ts: NOW.toISOString(), turn: down.done.turn_id, vote: 'down', reason: 'place' },
      ])
      // В записи голоса нет ни вопроса, ни IP.
      expect(JSON.stringify(readLog().filter((line) => 'vote' in line))).not.toMatch(/203\.0\.113|ярмарки/)
    } finally {
      await close(server)
    }
  })

  it('отказы: кривое тело — 400, неизвестный и чужой ход — 404, не POST — 405; лимит голосов на IP — 429 с Retry-After', async () => {
    const { server, readLog } = makeServer({ feedbackLimit: 2 })
    await listen(server)
    try {
      const { done } = await askTurn(server, 'ярмарки Польши')
      const vote = (body: unknown, headers = IP, method = 'POST') => request(server, '/ai/feedback', body, headers, method)
      for (const body of [{}, { turn_id: 'x', vote: 'up' }, { turn_id: done.turn_id, vote: 'maybe' }, { turn_id: done.turn_id, vote: 'down', reason: 'other' }, { turn_id: done.turn_id, vote: 'up', reason: 'place' }, []]) {
        const reply = await vote(body, { 'x-real-ip': '198.51.100.1' })
        expect({ body, status: reply.status, error: reply.json?.error }).toEqual({ body, status: 400, error: 'bad_request' })
      }
      expect((await vote({ turn_id: done.turn_id, vote: 'up' }, IP, 'GET')).status).toBe(405)
      // Чужой IP оценить ход не может; идентификатор, которого служба не выдавала, — тоже 404.
      expect((await vote({ turn_id: done.turn_id, vote: 'up' }, { 'x-real-ip': '198.51.100.2' })).status).toBe(404)
      expect((await vote({ turn_id: '00000000-0000-4000-8000-000000000000', vote: 'up' })).status).toBe(404)
      expect(readLog().filter((line) => 'vote' in line)).toEqual([])
      // Лимит: два запроса с IP прошли (404 и голос), третий — 429.
      expect((await vote({ turn_id: done.turn_id, vote: 'up' })).status).toBe(204)
      const limited = await vote({ turn_id: done.turn_id, vote: 'up' })
      expect(limited.status).toBe(429)
      expect(limited.json).toMatchObject({ error: 'limit', retry_after_sec: expect.any(Number) })
    } finally {
      await close(server)
    }
  })

  it('без оценки (`feedback: false`): `done` без turn_id, строки хода нет, адрес отвечает 404', async () => {
    const demandPath = join(makeTempDir('ai-feedback-off-'), 'ai-demand.jsonl')
    const limits = () => new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: AI_ASK_DAILY_LIMIT, strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK })
    const server = createApp({
      index: loadFixtureIndex(),
      modelKey: MODEL,
      embedQuery: fakeEmbedQuery,
      lexical: async () => [],
      cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
      queueTimeoutMs: 200,
      ask: { generator: generatorOf('Загляните в [Ярмарки Польши](https://metravel.by/travels/816).'), limits: limits(), demandLog: createDemandLog({ path: demandPath }), queueTimeoutMs: 200, trustProxy: true },
      authorDraft: { limits: limits() },
      feedback: false,
      suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
      log: () => {},
    })
    await listen(server)
    try {
      const { done } = await askTurn(server, 'ярмарки Польши')
      expect(done).not.toHaveProperty('turn_id')
      expect((await request(server, '/ai/feedback', { turn_id: '00000000-0000-4000-8000-000000000000', vote: 'up' })).status).toBe(404)
    } finally {
      await close(server)
    }
  })
})

describe('реестр ходов (#3296)', () => {
  it('ход живёт сутки и только у своего IP; старые ходы вытесняются по ёмкости', () => {
    const turns = new TurnRegistry({ capacity: 2, ttlMs: 1000 })
    const start = new Date('2026-11-14T10:00:00.000Z')
    const first = turns.open('ip-a', start)
    expect(turns.vote(first, 'ip-b', 'up', null, start)).toBe('unknown')
    expect(turns.vote(first, 'ip-a', 'down', null, start)).toBe('recorded')
    expect(turns.vote(first, 'ip-a', 'down', 'facts', start)).toBe('recorded')
    expect(turns.vote(first, 'ip-a', 'down', 'place', start)).toBe('repeated')
    expect(turns.vote(first, 'ip-a', 'up', null, start)).toBe('repeated')
    // Причина у «Помогло» не хранится; уточнить её потом нельзя.
    const liked = turns.open('ip-a', start)
    expect(turns.vote(liked, 'ip-a', 'up', null, start)).toBe('recorded')
    expect(turns.vote(liked, 'ip-a', 'down', 'facts', start)).toBe('repeated')
    // Третий ход вытесняет первый.
    turns.open('ip-a', start)
    expect(turns.size).toBe(2)
    expect(turns.vote(first, 'ip-a', 'down', 'facts', start)).toBe('unknown')
    // Просроченный ход оценить нельзя.
    const stale = turns.open('ip-a', start)
    expect(turns.vote(stale, 'ip-a', 'up', null, new Date(start.getTime() + 1001))).toBe('unknown')
  })
})

describe('журнал спроса: срок хранения (#3296)', () => {
  const day = 24 * 60 * 60 * 1000
  const now = new Date('2026-11-14T10:00:00.000Z')
  const line = (daysAgo: number, extra: Record<string, unknown> = {}) => JSON.stringify({ ts: new Date(now.getTime() - daysAgo * day).toISOString(), q: 'вопрос', locale: 'ru', reason: 'no_sources', ...extra })

  it('запись старше 90 дней — просрочена; строка без даты и не-JSON остаются', () => {
    expect(DEMAND_RETENTION_DAYS).toBe(90)
    expect(isExpired(line(91), now, DEMAND_RETENTION_DAYS)).toBe(true)
    expect(isExpired(line(89), now, DEMAND_RETENTION_DAYS)).toBe(false)
    expect(isExpired('{"q":"без даты"}', now, DEMAND_RETENTION_DAYS)).toBe(false)
    expect(isExpired('не json', now, DEMAND_RETENTION_DAYS)).toBe(false)
  })

  it('чистка удаляет просроченные записи всех трёх видов и не чаще раза в сутки без `force`', async () => {
    const dir = makeTempDir('ai-demand-prune-')
    const path = join(dir, 'logs', 'ai-demand.jsonl')
    mkdirSync(join(dir, 'logs'), { recursive: true })
    const fresh = [line(1), line(30, { status: 'done', turn: 't1' }), JSON.stringify({ ts: new Date(now.getTime() - 2 * day).toISOString(), turn: 't1', vote: 'down', reason: 'place' })]
    writeFileSync(path, `${[line(200), line(91, { status: 'done', turn: 't0' }), ...fresh].join('\n')}\n`)
    let clock = now
    const journal = createDemandLog({ path, now: () => clock })
    expect(await journal.prune()).toBe(2)
    expect(readFileSync(path, 'utf8').trim().split('\n')).toEqual(fresh)
    // Запись после чистки дописывается в тот же файл.
    await journal.appendVote({ turn: 't1', vote: 'up' })
    expect(readFileSync(path, 'utf8').trim().split('\n')).toHaveLength(4)
    // В те же сутки без `force` чистка не идёт; через сутки — идёт снова.
    writeFileSync(path, `${line(120)}\n`)
    expect(await journal.prune()).toBe(0)
    expect(await journal.prune(true)).toBe(1)
    writeFileSync(path, `${line(120)}\n`)
    clock = new Date(now.getTime() + day + 1)
    expect(await journal.prune()).toBe(1)
    // Журнала нет — чистить нечего.
    expect(await createDemandLog({ path: join(dir, 'нет', 'ai-demand.jsonl'), now: () => now }).prune(true)).toBe(0)
  })
})
