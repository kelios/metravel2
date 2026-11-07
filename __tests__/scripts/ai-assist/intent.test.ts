/**
 * @jest-environment node
 */
import http from 'http'
import type { AddressInfo } from 'net'

import { AiGeneratorError, type GenerateRequest, type Generator } from '@/api/aiAssist/generator'
import { AI_MAP_INTENT_DAILY_LIMIT, AI_MAP_INTENT_MAX_QUERY_CHARS } from '@/api/aiAssist/policy'
import { createApp } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { buildIntentMessages, INTENT_LIMITS_PREFIX, parseIntentAnswer } from '@/scripts/ai-assist/intent'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'

import { fakeEmbedQuery, loadFixtureIndex, MODEL } from './fixture'

// #2887: POST /ai/intent — описание → модель → JSON-фильтр карты по схеме.
interface Reply {
  status: number
  headers: http.IncomingHttpHeaders
  body: any
}

function post(server: http.Server, body: unknown, headers: Record<string, string> = {}): Promise<Reply> {
  const { port } = server.address() as AddressInfo
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method: 'POST', path: '/ai/intent', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers } },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolve({ status: response.statusCode ?? 0, headers: response.headers, body: raw ? JSON.parse(raw) : null })
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

function fakeGenerator(script: (request: GenerateRequest) => Promise<string> | string): Generator {
  return {
    async generate(request) {
      const text = await script(request)
      return { text, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } }
    },
  }
}

const GOOD_ANSWER = '```json\n{"categories": ["viewpoints", "history"], "radius_km": 50, "center": {"name": "Несвиж"}, "constraints": {"camper": true}}\n```'

function makeServer(overrides: { generator?: Generator | null; dailyLimit?: number; withLimits?: boolean } = {}) {
  const limits = new AskLimits({
    store: new MemoryCounterStore(),
    clock: createDayClock('Europe/Minsk'),
    dailyLimit: overrides.dailyLimit ?? AI_MAP_INTENT_DAILY_LIMIT,
    strikesToBlock: 3,
    prefix: INTENT_LIMITS_PREFIX,
  })
  const generator = overrides.generator === undefined ? fakeGenerator(() => GOOD_ANSWER) : overrides.generator
  const server = createApp({
    index: loadFixtureIndex(),
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: {
      generator,
      limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: 20, strikesToBlock: 3 }),
      demandLog: { path: '/dev/null', append: async () => {} },
      queueTimeoutMs: 200,
      trustProxy: true,
    },
    authorDraft: { limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: 5, strikesToBlock: 3 }) },
    ...(overrides.withLimits === false ? {} : { mapIntent: { limits } }),
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: () => {},
  })
  return { server, limits }
}

describe('metravel-assist: POST /ai/intent (#2887)', () => {
  it('промпт — тот же INTENT_PROMPT набора osm_intents с системой ассистента', () => {
    const messages = buildIntentMessages('замки под Гродно')
    expect(messages[0].role).toBe('system')
    expect(messages[1]).toEqual({
      role: 'user',
      content: expect.stringContaining('Составь фильтр карты metravel.by в JSON по схеме {categories, radius_km, center, constraints}'),
    })
    expect(messages[1].content).toMatch(/для запроса:\n«замки под Гродно»$/)
  })

  it('возвращает валидный фильтр из ответа модели и считает запрос в квоту', async () => {
    const requests: GenerateRequest[] = []
    const { server, limits } = makeServer({
      generator: fakeGenerator((request) => {
        requests.push(request)
        return GOOD_ANSWER
      }),
    })
    await listen(server)
    try {
      const reply = await post(server, { q: 'Где рядом с Несвижем смотровые и парковка для кемпера?', locale: 'ru' })
      expect(reply.status).toBe(200)
      expect(reply.body).toEqual({ categories: ['viewpoints', 'history'], radius_km: 50, center: { name: 'Несвиж' }, constraints: { camper: true } })
      expect(requests).toHaveLength(1)
      expect(requests[0].messages[1].content).toContain('«Где рядом с Несвижем смотровые и парковка для кемпера?»')
      expect(requests[0].maxTokens).toBeLessThan(400)
      const quota = await limits.consumeQuestion('127.0.0.1', new Date())
      expect(quota.remaining).toBe(AI_MAP_INTENT_DAILY_LIMIT - 2)
    } finally {
      await close(server)
    }
  })

  it('constraints опущены моделью → пустой объект в ответе', async () => {
    const { server } = makeServer({ generator: fakeGenerator(() => '{"categories": ["religion"], "radius_km": 25, "center": null}') })
    await listen(server)
    try {
      const reply = await post(server, { q: 'храмы около Полоцка' })
      expect(reply.status).toBe(200)
      expect(reply.body).toEqual({ categories: ['religion'], radius_km: 25, center: null, constraints: {} })
    } finally {
      await close(server)
    }
  })

  it('400 — q короче 3 или длиннее 300 знаков, кривая locale', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      expect((await post(server, { q: 'ab' })).status).toBe(400)
      expect((await post(server, { q: 'x'.repeat(AI_MAP_INTENT_MAX_QUERY_CHARS + 1) })).status).toBe(400)
      expect((await post(server, { q: 'замки', locale: 'de' })).status).toBe(400)
      expect((await post(server, {})).status).toBe(400)
      expect((await post(server, { q: 'x'.repeat(AI_MAP_INTENT_MAX_QUERY_CHARS) })).status).toBe(200)
    } finally {
      await close(server)
    }
  })

  it('422 invalid_intent — ответ без JSON или не по схеме; квота не тратится', async () => {
    const answers = ['Не могу составить фильтр.', '{"categories": ["castles"], "radius_km": 30, "center": "Гродно"}']
    const { server, limits } = makeServer({ generator: fakeGenerator(() => answers.shift() ?? '') })
    await listen(server)
    try {
      const noJson = await post(server, { q: 'замки под Гродно' })
      expect(noJson.status).toBe(422)
      expect(noJson.body).toMatchObject({ error: 'invalid_intent', detail: 'no JSON object in answer' })
      const bad = await post(server, { q: 'замки под Гродно' })
      expect(bad.status).toBe(422)
      expect(bad.body.error).toBe('invalid_intent')
      expect(bad.body.detail).toContain("unknown categories ['castles']")
      expect(bad.body.detail).toContain('radius_km 30 not in')
      const quota = await limits.consumeQuestion('127.0.0.1', new Date())
      expect(quota.remaining).toBe(AI_MAP_INTENT_DAILY_LIMIT - 1)
    } finally {
      await close(server)
    }
  })

  it('503 generator_unavailable — модель не задана или упала', async () => {
    const { server: noModel } = makeServer({ generator: null })
    await listen(noModel)
    try {
      const reply = await post(noModel, { q: 'замки под Гродно' })
      expect(reply.status).toBe(503)
      expect(reply.body.error).toBe('generator_unavailable')
      expect(reply.headers['retry-after']).toBe('30')
    } finally {
      await close(noModel)
    }
    const { server: broken, limits } = makeServer({ generator: fakeGenerator(() => Promise.reject(new AiGeneratorError('unavailable', 'llama down'))) })
    await listen(broken)
    try {
      const reply = await post(broken, { q: 'замки под Гродно' })
      expect(reply.status).toBe(503)
      expect(reply.body).toMatchObject({ error: 'generator_unavailable', detail: 'llama down' })
      const quota = await limits.consumeQuestion('127.0.0.1', new Date())
      expect(quota.remaining).toBe(AI_MAP_INTENT_DAILY_LIMIT - 1)
    } finally {
      await close(broken)
    }
  })

  it('429 limit — суточный лимит на IP, отдельный от /ai/ask', async () => {
    const { server } = makeServer({ dailyLimit: 2 })
    await listen(server)
    try {
      expect((await post(server, { q: 'замки под Гродно' })).status).toBe(200)
      expect((await post(server, { q: 'замки под Гродно' })).status).toBe(200)
      const third = await post(server, { q: 'замки под Гродно' })
      expect(third.status).toBe(429)
      expect(third.body).toMatchObject({ error: 'limit', limit: 2 })
      expect(Number(third.headers['retry-after'])).toBeGreaterThan(0)
      const otherIp = await post(server, { q: 'замки под Гродно' }, { 'x-real-ip': '10.0.0.7' })
      expect(otherIp.status).toBe(200)
    } finally {
      await close(server)
    }
  })

  it('без зависимости mapIntent эндпоинт жив на счётчике в памяти с лимитом политики', async () => {
    const { server } = makeServer({ withLimits: false })
    await listen(server)
    try {
      expect((await post(server, { q: 'замки под Гродно' })).status).toBe(200)
    } finally {
      await close(server)
    }
  })

  it('parseIntentAnswer: ошибки валидатора попадают в detail', () => {
    expect(parseIntentAnswer('{"categories": [], "radius_km": 50, "center": null}')).toEqual({ intent: null, errors: ['categories must be a non-empty list'] })
    expect(parseIntentAnswer(GOOD_ANSWER).intent?.center).toEqual({ name: 'Несвиж' })
  })
})
