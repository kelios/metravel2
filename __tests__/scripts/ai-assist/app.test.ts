/**
 * @jest-environment node
 */
import http from 'http'
import type { AddressInfo } from 'net'

import { createApp, MAX_BODY_BYTES } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import type { LexicalHit, LexicalSearch } from '@/scripts/ai-assist/lexical'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'

import { fakeEmbedQuery, loadFixtureIndex, MODEL } from './fixture'

interface Reply {
  status: number
  headers: http.IncomingHttpHeaders
  body: any
}

function call(server: http.Server, method: string, path: string, body?: unknown): Promise<Reply> {
  const { port } = server.address() as AddressInfo
  const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method, path, headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {} },
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
    if (payload) request.write(payload)
    request.end()
  })
}

const listen = (server: http.Server) => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const close = (server: http.Server) => new Promise<void>((resolve) => server.close(() => resolve()))

const lexicalOf = (hits: LexicalHit[] | null, calls: string[] = []): LexicalSearch => async (q) => {
  calls.push(q)
  return hits
}

function makeServer(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  const index = loadFixtureIndex()
  return createApp({
    index,
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: lexicalOf([]),
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: {
      generator: null,
      limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock(), dailyLimit: 20, strikesToBlock: 3 }),
      demandLog: { path: '/dev/null', append: async () => {} },
      queueTimeoutMs: 200,
      trustProxy: true,
    },
    log: () => {},
    ...overrides,
  })
}

describe('metravel-assist: /ai/health', () => {
  it('отдаёт модель, размер индекса и память', async () => {
    const server = makeServer()
    await listen(server)
    try {
      const reply = await call(server, 'GET', '/ai/health')
      expect(reply.status).toBe(200)
      expect(reply.body).toMatchObject({ ok: true, model: MODEL, dim: 8, count: 7, index_built_at: '2026-10-18T16:48:48.951Z' })
      expect(reply.body.rss_mb).toBeGreaterThan(0)
      expect(reply.body.cache).toEqual({ size: 0, hits: 0, misses: 0, redis: false })
      expect((await call(server, 'POST', '/ai/health')).status).toBe(405)
    } finally {
      await close(server)
    }
  })
})

describe('metravel-assist: POST /ai/search', () => {
  it('контракт ответа: источники схлопнуты, поля карточки, took_ms, кэш на повторе', async () => {
    const embedCalls: string[] = []
    const server = makeServer({
      embedQuery: async (q) => {
        embedCalls.push(q)
        return fakeEmbedQuery(q)
      },
    })
    await listen(server)
    try {
      const first = await call(server, 'POST', '/ai/search', { q: 'рождественские ярмарки краков вроцлав гданьск', locale: 'ru' })
      expect(first.status).toBe(200)
      expect(first.body.degraded).toBe(false)
      expect(first.body.cached).toBe(false)
      expect(first.body.index_built_at).toBe('2026-10-18T16:48:48.951Z')
      expect(typeof first.body.took_ms).toBe('number')
      const items = first.body.items as Array<Record<string, unknown>>
      expect(items[0]).toMatchObject({ type: 'travel', source_id: 816, title: 'Ярмарки Польши', city: 'Краков', country: 'Польша', lat: 50.06, lng: 19.94 })
      expect(items[0].url).toBe('https://metravel.by/travels/816')
      expect(typeof items[0].snippet).toBe('string')
      expect(typeof items[0].score).toBe('number')
      // Два фрагмента статьи 816 → один элемент выдачи.
      expect(items.filter((item) => item.source_id === 816 && item.type === 'travel')).toHaveLength(1)
      const keys = items.map((item) => `${item.type}:${item.source_id}`)
      expect(new Set(keys).size).toBe(keys.length)

      const second = await call(server, 'POST', '/ai/search', { q: '  Рождественские ярмарки   КРАКОВ вроцлав гданьск ', locale: 'ru' })
      expect(second.body.cached).toBe(true)
      expect(second.body.items).toEqual(first.body.items)
      expect(embedCalls).toHaveLength(1)
    } finally {
      await close(server)
    }
  })

  it('limit и type сужают выдачу; для квестов лексика не вызывается', async () => {
    const lexicalCalls: string[] = []
    const server = makeServer({ lexical: lexicalOf([], lexicalCalls) })
    await listen(server)
    try {
      const quests = await call(server, 'POST', '/ai/search', { q: 'квест задание', type: 'quest', limit: 1 })
      expect(quests.status).toBe(200)
      expect(quests.body.items).toHaveLength(1)
      expect(quests.body.items[0].type).toBe('quest')
      expect(lexicalCalls).toHaveLength(0)

      const travels = await call(server, 'POST', '/ai/search', { q: 'квест задание', type: 'travel', limit: 2 })
      expect(travels.body.items.every((item: { type: string }) => item.type === 'travel')).toBe(true)
      expect(travels.body.items).toHaveLength(2)
      expect(lexicalCalls).toEqual(['квест задание'])
    } finally {
      await close(server)
    }
  })

  it('квест отдаётся фрагментом запрошенной локали, если она есть в индексе', async () => {
    const server = makeServer()
    await listen(server)
    try {
      const pl = await call(server, 'POST', '/ai/search', { q: 'квест гродно замок', type: 'quest', locale: 'pl' })
      const grodno = pl.body.items.find((item: { source_id: number }) => item.source_id === 1)
      expect(grodno).toMatchObject({ title: 'Quest po Grodnie', url: 'https://metravel.by/quests/1-pl' })
      // У квеста 2 локали pl нет — он остаётся в выдаче на ru.
      expect(pl.body.items.find((item: { source_id: number }) => item.source_id === 2)).toMatchObject({ title: 'Квест по Бресту' })

      const ru = await call(server, 'POST', '/ai/search', { q: 'квест гродно замок', type: 'quest', locale: 'ru' })
      expect(ru.body.items.find((item: { source_id: number }) => item.source_id === 1)).toMatchObject({ title: 'Квест по Гродно' })
    } finally {
      await close(server)
    }
  })

  it('лексика вливается через RRF: совпадение в обоих списках поднимается, чужая статья получает данные лексики', async () => {
    const lexical = lexicalOf([
      { source_id: 791, title: 'Беловежская пуща', url: 'https://metravel.by/travels/791', city: 'Каменюки', country: 'Беларусь' },
      { source_id: 999, title: 'Новая статья после сборки', url: 'https://metravel.by/travels/new', city: null, country: null },
    ])
    const server = makeServer({ lexical })
    await listen(server)
    try {
      const reply = await call(server, 'POST', '/ai/search', { q: 'зубры лес велосипед беловежская пуща дети', limit: 10 })
      expect(reply.body.degraded).toBe(false)
      const items = reply.body.items as Array<Record<string, unknown>>
      expect(items[0]).toMatchObject({ type: 'travel', source_id: 791 })
      expect(typeof items[0].score).toBe('number')
      const fresh = items.find((item) => item.source_id === 999)
      expect(fresh).toEqual({
        type: 'travel',
        source_id: 999,
        title: 'Новая статья после сборки',
        url: 'https://metravel.by/travels/new',
        snippet: '',
        score: null,
        city: null,
        country: null,
        lat: null,
        lng: null,
      })
    } finally {
      await close(server)
    }
  })

  it('упавший бэкенд → 200 с degraded: true, ответ не кэшируется', async () => {
    const embedCalls: string[] = []
    const server = makeServer({
      lexical: lexicalOf(null),
      embedQuery: async (q) => {
        embedCalls.push(q)
        return fakeEmbedQuery(q)
      },
    })
    await listen(server)
    try {
      const first = await call(server, 'POST', '/ai/search', { q: 'замки под краковом' })
      expect(first.status).toBe(200)
      expect(first.body.degraded).toBe(true)
      expect(first.body.items.length).toBeGreaterThan(0)
      const second = await call(server, 'POST', '/ai/search', { q: 'замки под краковом' })
      expect(second.body.cached).toBe(false)
      expect(embedCalls).toHaveLength(2)
    } finally {
      await close(server)
    }
  })

  it('занятая модель: ожидание дольше таймаута → 503 busy, первый запрос дожидается ответа', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const lexicalCalls: string[] = []
    const server = makeServer({
      queueTimeoutMs: 50,
      lexical: lexicalOf([], lexicalCalls),
      embedQuery: async (q) => {
        await gate
        return fakeEmbedQuery(q)
      },
    })
    await listen(server)
    try {
      const first = call(server, 'POST', '/ai/search', { q: 'первый' })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const others = await Promise.all([call(server, 'POST', '/ai/search', { q: 'второй' }), call(server, 'POST', '/ai/search', { q: 'третий' })])
      expect(others.map((reply) => reply.status)).toEqual([503, 503])
      expect(others[0].body.error).toBe('busy')
      release()
      expect((await first).status).toBe(200)
      // Лексика ушла в бэкенд только у запроса, получившего слот.
      expect(lexicalCalls).toEqual(['первый'])
    } finally {
      await close(server)
    }
  })

  it('валидация входа: 400 с причиной, 405 на GET, 413 на большое тело, 404 на чужой путь', async () => {
    const server = makeServer()
    await listen(server)
    try {
      expect((await call(server, 'POST', '/ai/search', {})).body).toMatchObject({ error: 'bad_request', detail: expect.stringContaining('q') })
      expect((await call(server, 'POST', '/ai/search', { q: '   ' })).status).toBe(400)
      expect((await call(server, 'POST', '/ai/search', { q: 'x', locale: 'de' })).body.detail).toContain('locale')
      expect((await call(server, 'POST', '/ai/search', { q: 'x', type: 'hotel' })).body.detail).toContain('type')
      expect((await call(server, 'POST', '/ai/search', { q: 'x', limit: 21 })).body.detail).toContain('limit')
      expect((await call(server, 'POST', '/ai/search', { q: 'x', limit: 0 })).status).toBe(400)
      expect((await call(server, 'POST', '/ai/search', { q: 'я'.repeat(501) })).status).toBe(400)
      expect((await call(server, 'POST', '/ai/search', '{not json')).status).toBe(400)
      expect((await call(server, 'GET', '/ai/search')).status).toBe(405)
      expect((await call(server, 'POST', '/ai/search', { q: 'x'.repeat(MAX_BODY_BYTES + 1) })).status).toBe(413)
      expect((await call(server, 'GET', '/ai/unknown')).status).toBe(404)
    } finally {
      await close(server)
    }
  })
})

describe('metravel-assist: GET /ai/similar', () => {
  it('похожие без самого источника, с лимитом и фильтром типа результата', async () => {
    const server = makeServer()
    await listen(server)
    try {
      const reply = await call(server, 'GET', '/ai/similar?type=travel&id=816&limit=2')
      expect(reply.status).toBe(200)
      expect(reply.headers['cache-control']).toBe('public, max-age=3600')
      expect(reply.body.items).toHaveLength(2)
      expect(reply.body.items.some((item: { type: string; source_id: number }) => item.type === 'travel' && item.source_id === 816)).toBe(false)
      expect(typeof reply.body.took_ms).toBe('number')
      expect(reply.body.index_built_at).toBe('2026-10-18T16:48:48.951Z')

      const quests = await call(server, 'GET', '/ai/similar?type=travel&id=816&limit=5&result_type=quest')
      expect(quests.body.items.length).toBeGreaterThan(0)
      expect(quests.body.items.every((item: { type: string }) => item.type === 'quest')).toBe(true)

      const pl = await call(server, 'GET', '/ai/similar?type=quest&id=2&locale=pl&result_type=quest')
      expect(pl.body.items.map((item: { source_id: number; title: string }) => [item.source_id, item.title])).toEqual([[1, 'Quest po Grodnie']])
    } finally {
      await close(server)
    }
  })

  it('ошибки параметров: 400 без type/id, 404 для источника вне индекса', async () => {
    const server = makeServer()
    await listen(server)
    try {
      expect((await call(server, 'GET', '/ai/similar?id=816')).status).toBe(400)
      expect((await call(server, 'GET', '/ai/similar?type=travel&id=abc')).status).toBe(400)
      expect((await call(server, 'GET', '/ai/similar?type=travel&id=816&limit=99')).status).toBe(400)
      const missing = await call(server, 'GET', '/ai/similar?type=travel&id=424242')
      expect(missing.status).toBe(404)
      expect(missing.body.error).toBe('not_found')
    } finally {
      await close(server)
    }
  })
})
