/**
 * @jest-environment node
 */
import http from 'http'
import type { AddressInfo } from 'net'

import { AI_TAG_SUGGEST_MIN_TEXT_CHARS, AI_TAG_SUGGEST_NEIGHBOURS } from '@/api/aiAssist/policy'
import { createApp } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'
import {
  createTagCatalog,
  emptyTagValues,
  parseTagDictionary,
  parseTravelTags,
  type TagCatalog,
  type TagDictionary,
  type TagValues,
  voteTags,
  voteThreshold,
} from '@/scripts/ai-assist/suggestTags'

import { fakeEmbedQuery, loadFixtureIndex, MODEL } from './fixture'

const ARTICLE = 'Рождественские ярмарки Кракова: глинтвейн, пряники, рынок и замок, однодневная вылазка из Вроцлава на машине. '.repeat(4)

interface Reply {
  status: number
  json: any
}

function post(server: http.Server, body: unknown): Promise<Reply> {
  const { port } = server.address() as AddressInfo
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method: 'POST', path: '/ai/suggest-tags', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolve({ status: response.statusCode ?? 0, json: raw ? JSON.parse(raw) : null })
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

const values = (partial: Partial<TagValues>): TagValues => ({ ...emptyTagValues(), ...partial })

const dictionaryOf = (partial: Partial<Record<keyof TagValues, number[]>>): TagDictionary => ({
  countries: new Set(partial.countries ?? []),
  categories: new Set(partial.categories ?? []),
  transports: new Set(partial.transports ?? []),
  companions: new Set(partial.companions ?? []),
  over_nights_stay: new Set(partial.over_nights_stay ?? []),
})

function makeServer(catalog: TagCatalog) {
  const limits = () => new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock(), dailyLimit: 5, strikesToBlock: 3 })
  return createApp({
    index: loadFixtureIndex(),
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: { generator: null, limits: limits(), demandLog: { path: '/dev/null', append: async () => {} }, queueTimeoutMs: 200, trustProxy: true },
    authorDraft: { limits: limits() },
    suggestTags: { catalog },
    log: () => {},
  })
}

describe('suggest-tags: голосование', () => {
  it('порог — не меньше двух голосов и не меньше 30 % статей', () => {
    expect(voteThreshold(1)).toBe(2)
    expect(voteThreshold(3)).toBe(2)
    expect(voteThreshold(7)).toBe(3)
    expect(voteThreshold(10)).toBe(3)
  })

  it('берёт значения с порогом голосов, сортирует по голосам и считает уверенность', () => {
    const rows = [
      values({ countries: [1], categories: [10, 11] }),
      values({ countries: [1], categories: [10, 12] }),
      values({ countries: [2], categories: [10] }),
      values({ countries: [1], categories: [11] }),
    ]
    const { values: voted, confidence } = voteTags(rows, dictionaryOf({ countries: [1, 2], categories: [10, 11, 12] }))
    // k = 4 → порог 2: страна 1 (3 голоса), категории 10 (3) и 11 (2); 2 и 12 — по одному голосу.
    expect(voted.countries).toEqual([1])
    expect(voted.categories).toEqual([10, 11])
    expect(voted.transports).toEqual([])
    // Средняя доля голосов принятых: (3/4 + 3/4 + 2/4) / 3 ≈ 0.67.
    expect(confidence).toBe(0.67)
  })

  it('значение вне словаря не проходит даже с голосами; повторы внутри статьи — один голос', () => {
    const rows = [values({ categories: [10, 10, 99] }), values({ categories: [10, 99] }), values({ categories: [99] })]
    const { values: voted } = voteTags(rows, dictionaryOf({ categories: [10] }))
    expect(voted.categories).toEqual([10])
  })

  it('без статей — пусто и уверенность 0', () => {
    expect(voteTags([], dictionaryOf({ categories: [10] }))).toEqual({ values: emptyTagValues(), confidence: 0 })
  })
})

describe('suggest-tags: разбор каталога', () => {
  it('читает id из ответа статьи и словаря, страны — country_id', () => {
    expect(parseTravelTags({ countries: [5, '7'], categories: [{ id: 3 }], transports: null, companions: [0, -1], over_nights_stay: [2] })).toEqual(
      values({ countries: [5, 7], categories: [3], over_nights_stay: [2] }),
    )
    const dictionary = parseTagDictionary(
      { categories: [{ id: 1, name: 'Горы' }], transports: [{ id: 2 }], companions: [], over_nights_stay: [{ id: 4 }], month: [] },
      [{ country_id: 9, title_ru: 'Польша' }],
    )
    expect(dictionary && [...dictionary.countries]).toEqual([9])
    expect(dictionary && [...dictionary.categories]).toEqual([1])
    expect(parseTagDictionary({ categories: [] }, [])).toBeNull()
    expect(parseTravelTags('nope')).toBeNull()
  })

  it('кэширует словарь и статьи на час, отказ не кэширует', async () => {
    let clock = 1_000
    const calls: string[] = []
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/api/travels/404/')) return new Response('', { status: 404 })
      if (url.endsWith('/api/getFiltersTravel/')) return Response.json({ categories: [{ id: 1 }], transports: [], companions: [], over_nights_stay: [] })
      if (url.endsWith('/api/countriesforsearch/')) return Response.json([{ country_id: 9 }])
      return Response.json({ categories: [1], countries: [9] })
    }) as typeof fetch
    const catalog = createTagCatalog({ backendUrl: 'http://backend/', timeoutMs: 100, fetchImpl, now: () => clock })

    expect(await catalog.travelTags(816)).toEqual(values({ categories: [1], countries: [9] }))
    expect(await catalog.travelTags(816)).toEqual(values({ categories: [1], countries: [9] }))
    expect(calls.filter((url) => url.endsWith('/api/travels/816/'))).toHaveLength(1)

    expect(await catalog.travelTags(404)).toBeNull()
    expect(await catalog.travelTags(404)).toBeNull()
    expect(calls.filter((url) => url.endsWith('/api/travels/404/'))).toHaveLength(2)

    await Promise.all([catalog.dictionary(), catalog.dictionary()])
    expect(calls.filter((url) => url.endsWith('/api/getFiltersTravel/'))).toHaveLength(1)

    clock += 60 * 60 * 1000 + 1
    await catalog.travelTags(816)
    await catalog.dictionary()
    expect(calls.filter((url) => url.endsWith('/api/travels/816/'))).toHaveLength(2)
    expect(calls.filter((url) => url.endsWith('/api/getFiltersTravel/'))).toHaveLength(2)
  })
})

describe('POST /ai/suggest-tags', () => {
  it('отдаёт значения голосованием соседей из индекса, только из словаря', async () => {
    const asked: number[] = []
    const catalog: TagCatalog = {
      dictionary: async () => dictionaryOf({ countries: [1], categories: [10, 11], transports: [20] }),
      travelTags: async (id) => {
        asked.push(id)
        return values({ countries: [1, 2], categories: [10, 11, 99], transports: id === 816 ? [20] : [] })
      },
    }
    const server = makeServer(catalog)
    await listen(server)
    try {
      const reply = await post(server, { text: ARTICLE, locale: 'ru' })
      expect(reply.status).toBe(200)
      // В фикстуре три статьи: все соседи — travel, квесты не голосуют.
      expect(asked.sort()).toEqual([761, 791, 816])
      expect(asked.length).toBeLessThanOrEqual(AI_TAG_SUGGEST_NEIGHBOURS)
      expect(reply.json).toMatchObject({ countries: [1], categories: [10, 11], transports: [], companions: [], over_nights_stay: [], degraded: false, neighbours: 3 })
      expect(reply.json.confidence).toBe(1)
      expect(typeof reply.json.took_ms).toBe('number')
    } finally {
      await close(server)
    }
  })

  it('400 на короткий текст и кривую локаль, 405 на GET', async () => {
    const server = makeServer({ dictionary: async () => null, travelTags: async () => null })
    await listen(server)
    try {
      const short = await post(server, { text: 'x'.repeat(AI_TAG_SUGGEST_MIN_TEXT_CHARS - 1) })
      expect(short.status).toBe(400)
      expect(short.json.error).toBe('bad_request')
      expect((await post(server, { text: ARTICLE, locale: 'de' })).status).toBe(400)
      expect((await post(server, {})).status).toBe(400)
      const { port } = server.address() as AddressInfo
      const get = await new Promise<number>((resolve) => http.get(`http://127.0.0.1:${port}/ai/suggest-tags`, (res) => resolve(res.statusCode ?? 0)))
      expect(get).toBe(405)
    } finally {
      await close(server)
    }
  })

  it('без словаря или без единой статьи — 200 с пустыми списками и degraded', async () => {
    const noDictionary = makeServer({ dictionary: async () => null, travelTags: async () => values({ countries: [1] }) })
    await listen(noDictionary)
    try {
      const reply = await post(noDictionary, { text: ARTICLE })
      expect(reply.status).toBe(200)
      expect(reply.json).toMatchObject({ ...emptyTagValues(), confidence: 0, degraded: true, neighbours: 3 })
    } finally {
      await close(noDictionary)
    }
    const noTravels = makeServer({ dictionary: async () => dictionaryOf({ countries: [1] }), travelTags: async () => null })
    await listen(noTravels)
    try {
      const reply = await post(noTravels, { text: ARTICLE })
      expect(reply.status).toBe(200)
      expect(reply.json).toMatchObject({ ...emptyTagValues(), confidence: 0, degraded: true, neighbours: 0 })
    } finally {
      await close(noTravels)
    }
  })

  it('часть статей не ответила — голосуют оставшиеся, degraded: false', async () => {
    const catalog: TagCatalog = {
      dictionary: async () => dictionaryOf({ categories: [10] }),
      travelTags: async (id) => (id === 816 ? null : values({ categories: [10] })),
    }
    const server = makeServer(catalog)
    await listen(server)
    try {
      const reply = await post(server, { text: ARTICLE })
      expect(reply.json).toMatchObject({ categories: [10], degraded: false, neighbours: 2, confidence: 1 })
    } finally {
      await close(server)
    }
  })
})
