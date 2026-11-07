/**
 * @jest-environment node
 */
import http from 'http'
import type { AddressInfo } from 'net'

import { AiGeneratorError, type GenerateRequest, type Generator } from '@/api/aiAssist/generator'
import { AI_AUTHOR_DRAFT_DAILY_LIMIT, AI_AUTHOR_DRAFT_MAX_TEXT_CHARS, AI_AUTHOR_DRAFT_SHAPES } from '@/api/aiAssist/policy'
import { createApp } from '@/scripts/ai-assist/app'
import { AUTHOR_DRAFT_LIMITS_PREFIX, clampVariant, parseAuthorDraftVariants } from '@/scripts/ai-assist/authorDraft'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'

import { fakeEmbedQuery, loadFixtureIndex, MODEL } from './fixture'

const MINSK_LATE = new Date('2026-10-25T20:59:59Z')
const ARTICLE = 'Мы поехали в Гродно на два дня с детьми: старый замок, набережная Немана, кафе у фарного костёла и парк Жилибера. '.repeat(4)

interface Reply {
  status: number
  headers: http.IncomingHttpHeaders
  json: any
}

function post(server: http.Server, body: unknown, headers: Record<string, string> = {}): Promise<Reply> {
  const { port } = server.address() as AddressInfo
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method: 'POST', path: '/ai/author-draft', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers } },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolve({ status: response.statusCode ?? 0, headers: response.headers, json: raw ? JSON.parse(raw) : null })
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

function makeServer(overrides: { generator?: Generator | null; dailyLimit?: number } = {}) {
  const limits = new AskLimits({
    store: new MemoryCounterStore(),
    clock: createDayClock('Europe/Minsk'),
    dailyLimit: overrides.dailyLimit ?? AI_AUTHOR_DRAFT_DAILY_LIMIT,
    strikesToBlock: 3,
    prefix: AUTHOR_DRAFT_LIMITS_PREFIX,
  })
  const generator =
    overrides.generator === undefined
      ? fakeGenerator(() => '1. Гродно за два дня с детьми\n2. Замок, Неман и кафе: выходные в Гродно (https://evil.example/x)\n3. [Гродно](/travels/1) с детьми')
      : overrides.generator
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
      now: () => MINSK_LATE,
    },
    authorDraft: { limits },
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: () => {},
  })
  return { server, limits }
}

describe('metravel-assist: разбор вариантов /ai/author-draft', () => {
  it('нумерованный список → варианты без номеров, кавычек и адресов; повторы и пустые отбрасываются', () => {
    const raw = '<think>думаю</think>\n1. «Гродно за два дня»\n2) Гродно за два дня\n3. **Замок и Неман** — https://metravel.by/travels/816\n\n4. [Кафе Гродно](/travels/5)\n'
    expect(parseAuthorDraftVariants(raw, 'title')).toEqual(['Гродно за два дня', 'Замок и Неман', 'Кафе Гродно'])
  })

  it('без нумерации — абзацы; продолжение без номера приклеивается к варианту', () => {
    expect(parseAuthorDraftVariants('Первый лид про Гродно и детей.\nВторое предложение.\n\nВторой лид про замок и Неман.', 'lead')).toEqual([
      'Первый лид про Гродно и детей. Второе предложение.',
      'Второй лид про замок и Неман.',
    ])
    expect(parseAuthorDraftVariants('1. Лид про Гродно с детьми.\nИ его продолжение.\n2. Лид про замок над Неманом.', 'lead')).toEqual([
      'Лид про Гродно с детьми. И его продолжение.',
      'Лид про замок над Неманом.',
    ])
  })

  it('не больше вариантов, чем просит форма; мета режется до 160 знаков по предложению, заголовок — по слову', () => {
    const many = Array.from({ length: 6 }, (_, i) => `${i + 1}. Вариант номер ${i + 1} про Гродно`).join('\n')
    expect(parseAuthorDraftVariants(many, 'title')).toHaveLength(AI_AUTHOR_DRAFT_SHAPES.title.variants)
    const long = `${'Первое предложение про Гродно и замок у Немана. '.repeat(3)}Второе очень длинное предложение, которое уже не влезает в бюджет сниппета поиска целиком.`
    const [meta] = parseAuthorDraftVariants(`1. ${long}`, 'meta')
    expect(meta.length).toBeLessThanOrEqual(160)
    expect(meta.endsWith('.')).toBe(true)
    const title = clampVariant('Очень длинный заголовок, который сильно превышает разумный бюджет и повторяет слово Гродно много много раз подряд', 40)
    expect(title.length).toBeLessThanOrEqual(40)
    expect(title.endsWith('…')).toBe(true)
    expect(clampVariant('Короткий', 40)).toBe('Короткий')
  })
})

describe('metravel-assist: kind trip (#2911)', () => {
  it('план поездки от 40 знаков: промпт про точки, даты и транспорт, варианты до 600 знаков', async () => {
    const requests: GenerateRequest[] = []
    const { server } = makeServer({
      generator: fakeGenerator((request) => {
        requests.push(request)
        return '1. Едем на машине из Минска в Гродно через Мир и Лиду 12–13 июня.\n2. Два дня по западу Беларуси: Мир, Лида, Гродно. См. https://evil.example\n3. Описание поездки: Минск — Гродно на выходные через Мир и Лиду.'
      }),
    })
    await listen(server)
    try {
      const plan = 'Точки: Минск, Мир, Лида, Гродно. Даты: 2026-06-12 – 2026-06-13. Транспорт: автомобиль.'
      const reply = await post(server, { text: plan, kind: 'trip', locale: 'ru' })
      expect(reply.status).toBe(200)
      expect(reply.json.variants).toEqual([
        'Едем на машине из Минска в Гродно через Мир и Лиду 12–13 июня.',
        'Два дня по западу Беларуси: Мир, Лида, Гродно. См.',
        'Минск — Гродно на выходные через Мир и Лиду.',
      ])
      expect(reply.json.variants.every((variant: string) => variant.length <= AI_AUTHOR_DRAFT_SHAPES.trip.maxChars)).toBe(true)
      expect(requests[0].maxTokens).toBe(AI_AUTHOR_DRAFT_SHAPES.trip.maxTokens)
      const system = requests[0].messages[0].content
      expect(system).toContain('план поездки')
      expect(system).toContain('не добавляй фактов')
      expect(requests[0].messages[1].content).toMatch(/^План поездки:/)
      // Порог вида: план короче 40 знаков — 400, а статья короче 200 — по-прежнему 400.
      expect((await post(server, { text: 'Минск — Гродно', kind: 'trip' })).status).toBe(400)
      expect((await post(server, { text: plan, kind: 'title' })).status).toBe(400)
    } finally {
      await close(server)
    }
  })
})

describe('metravel-assist: POST /ai/author-draft', () => {
  it('варианты без адресов, язык и вид в промпте, лимит токенов по форме, remaining', async () => {
    const requests: GenerateRequest[] = []
    const { server } = makeServer({
      generator: fakeGenerator((request) => {
        requests.push(request)
        return '1. Гродно за два дня с детьми\n2. Замок, Неман и кафе: выходные в Гродно (https://evil.example/x)\n3. [Гродно](/travels/1) с детьми'
      }),
    })
    await listen(server)
    try {
      const reply = await post(server, { text: ARTICLE, kind: 'title', locale: 'pl' })
      expect(reply.status).toBe(200)
      expect(reply.json).toEqual({
        variants: ['Гродно за два дня с детьми', 'Замок, Неман и кафе: выходные в Гродно', 'Гродно с детьми'],
        remaining: AI_AUTHOR_DRAFT_DAILY_LIMIT - 1,
      })
      expect(JSON.stringify(reply.json)).not.toMatch(/https?:|\/travels/)
      expect(requests).toHaveLength(1)
      expect(requests[0].maxTokens).toBe(AI_AUTHOR_DRAFT_SHAPES.title.maxTokens)
      const [system, user] = requests[0].messages
      expect(system.role).toBe('system')
      expect(system.content).toMatch(/заголовка/)
      expect(system.content).toMatch(/Язык ответа: polski/)
      expect(system.content).toMatch(/без ссылок/)
      expect(user.content).toContain('Гродно на два дня')

      const lead = await post(server, { text: ARTICLE, kind: 'lead' })
      expect(lead.status).toBe(200)
      expect(requests[1].maxTokens).toBe(AI_AUTHOR_DRAFT_SHAPES.lead.maxTokens)
      expect(requests[1].messages[0].content).toMatch(/лида/)
      expect(requests[1].messages[0].content).toMatch(/Язык ответа: русский/)
    } finally {
      await close(server)
    }
  })

  it('400: текст короче 200 знаков, не строка, неизвестный kind, кривая locale', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      for (const body of [
        { text: 'Короткий текст', kind: 'title' },
        { text: 42, kind: 'title' },
        { text: ARTICLE, kind: 'poem' },
        { text: ARTICLE },
        { text: ARTICLE, kind: 'meta', locale: 'de' },
      ]) {
        const reply = await post(server, body)
        expect(reply.status).toBe(400)
        expect(reply.json.error).toBe('bad_request')
      }
    } finally {
      await close(server)
    }
  })

  it('текст длиннее бюджета не отклоняется — модели уходит обрезанный хвост', async () => {
    const requests: GenerateRequest[] = []
    const { server } = makeServer({
      generator: fakeGenerator((request) => {
        requests.push(request)
        return '1. Гродно за два дня с детьми'
      }),
    })
    await listen(server)
    try {
      const long = await post(server, { text: 'word '.repeat(AI_AUTHOR_DRAFT_MAX_TEXT_CHARS / 4), kind: 'title' })
      expect(long.status).toBe(200)
      const sent = requests[0].messages[1].content.replace(/^Текст статьи:\n\n/, '')
      expect(sent).toHaveLength(AI_AUTHOR_DRAFT_MAX_TEXT_CHARS)
    } finally {
      await close(server)
    }
  })

  it('429 limit после дневного лимита на IP; отказы лимит не тратят; другой IP считается отдельно', async () => {
    const { server, limits } = makeServer({ dailyLimit: 2 })
    await listen(server)
    try {
      expect((await post(server, { text: ARTICLE, kind: 'title' }, { 'x-real-ip': '1.1.1.1' })).json.remaining).toBe(1)
      expect((await post(server, { text: ARTICLE, kind: 'meta' }, { 'x-real-ip': '1.1.1.1' })).json.remaining).toBe(0)
      const third = await post(server, { text: ARTICLE, kind: 'lead' }, { 'x-real-ip': '1.1.1.1' })
      expect(third.status).toBe(429)
      expect(third.json).toMatchObject({ error: 'limit', limit: 2, retry_after_sec: 1 })
      expect(third.headers['retry-after']).toBe('1')
      expect(await limits.quotaState('1.1.1.1', MINSK_LATE)).toEqual({ used: 2, remaining: 0, exceeded: false })
      expect((await post(server, { text: ARTICLE, kind: 'title' }, { 'x-real-ip': '2.2.2.2' })).status).toBe(200)
    } finally {
      await close(server)
    }
  })

  it('503 generator_unavailable: AI_LLM_URL не задан, модель упала или не дала ни одного варианта; запрос возвращается в квоту', async () => {
    const none = makeServer({ generator: null })
    await listen(none.server)
    try {
      const reply = await post(none.server, { text: ARTICLE, kind: 'meta' }, { 'x-real-ip': '3.3.3.3' })
      expect(reply.status).toBe(503)
      expect(reply.json.error).toBe('generator_unavailable')
      expect(reply.headers['retry-after']).toBe('30')
      expect(await none.limits.quotaState('3.3.3.3', MINSK_LATE)).toMatchObject({ used: 0 })
    } finally {
      await close(none.server)
    }

    const broken = makeServer({ generator: fakeGenerator(() => Promise.reject(new AiGeneratorError('unavailable', 'llama down'))) })
    await listen(broken.server)
    try {
      const reply = await post(broken.server, { text: ARTICLE, kind: 'title' }, { 'x-real-ip': '3.3.3.3' })
      expect(reply.status).toBe(503)
      expect(reply.json).toMatchObject({ error: 'generator_unavailable', detail: 'llama down' })
      expect(await broken.limits.quotaState('3.3.3.3', MINSK_LATE)).toMatchObject({ used: 0 })
    } finally {
      await close(broken.server)
    }

    const empty = makeServer({ generator: fakeGenerator(() => 'см. https://evil.example/only-link') })
    await listen(empty.server)
    try {
      const reply = await post(empty.server, { text: ARTICLE, kind: 'title' }, { 'x-real-ip': '3.3.3.3' })
      expect(reply.status).toBe(503)
      expect(reply.json.error).toBe('generator_unavailable')
      expect(await empty.limits.quotaState('3.3.3.3', MINSK_LATE)).toMatchObject({ used: 0 })
    } finally {
      await close(empty.server)
    }
  })

  it('429 busy, когда модель занята другим ответом дольше очереди; запрос в квоту возвращается', async () => {
    let release: () => void = () => {}
    const { server, limits } = makeServer({
      generator: fakeGenerator(() => new Promise<string>((resolve) => { release = () => resolve('1. Гродно за выходные') })),
    })
    await listen(server)
    try {
      const first = post(server, { text: ARTICLE, kind: 'title' }, { 'x-real-ip': '4.4.4.4' })
      await new Promise((resolve) => setTimeout(resolve, 20))
      const second = await post(server, { text: ARTICLE, kind: 'title' }, { 'x-real-ip': '4.4.4.4' })
      expect(second.status).toBe(429)
      expect(second.json.error).toBe('busy')
      release()
      expect((await first).status).toBe(200)
      expect(await limits.quotaState('4.4.4.4', MINSK_LATE)).toMatchObject({ used: 1 })
    } finally {
      await close(server)
    }
  })

  it('GET — 405', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const { port } = server.address() as AddressInfo
      const status = await new Promise<number>((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: '/ai/author-draft' }, (response) => {
          response.resume()
          resolve(response.statusCode ?? 0)
        }).on('error', reject)
      })
      expect(status).toBe(405)
    } finally {
      await close(server)
    }
  })
})
