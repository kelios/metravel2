/**
 * Личный контекст в службе `/ai/ask` (#3354) на уровне HTTP: гость без изменений, вошедший получает строку
 * «О посетителе» и подбор по своему, а токен и сводка не выходят ни в поток, ни в журналы. Сети и модели нет:
 * фикстурный индекс, поддельный API сайта (`visitorFixture.ts`) и генератор, который запоминает подсказку.
 */
import { readFileSync } from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import { join } from 'path'

import type { Generator } from '@/api/aiAssist/generator'
import { AI_ASK_DAILY_LIMIT, AI_OFFTOPIC_STRIKES_TO_BLOCK } from '@/api/aiAssist/policy'
import type { AiChatMessage } from '@/api/aiAssist/types'
import { estimateTokens, VISITOR_BLOCK_LABEL_RU, VISITOR_BLOCK_MAX_TOKENS, VISITOR_RULE_RU } from '@/api/aiAssist/visitorContext'
import { createApp } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { createDemandLog } from '@/scripts/ai-assist/demandLog'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'
import { createVisitorProfile, tokenHash } from '@/scripts/ai-assist/visitorProfile'

import { makeTempDir } from '../cli-test-utils'
import { fakeEmbedQuery, loadFixtureIndex, MODEL } from './fixture'
import { BACKEND_URL, fakeBackend, type FakeBackendOptions, SECRET_ID, SECRET_TITLE, TOKEN_A, TOKEN_B, TRIP_PLACE, USER_A, USER_B } from './visitorFixture'

type SseEvent = { event: string; data: Record<string, unknown> }
type Reply = { status: number; headers: http.IncomingHttpHeaders; raw: string; events: SseEvent[] }

const post = (server: http.Server, body: unknown, headers: Record<string, string> = {}, ip = '203.0.113.9'): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo
    const payload = JSON.stringify(body)
    const request = http.request(
      { host: '127.0.0.1', port, path: '/ai/ask', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'x-forwarded-for': ip, ...headers } },
      (response) => {
        const parts: Buffer[] = []
        response.on('data', (chunk: Buffer) => parts.push(chunk))
        response.on('end', () => {
          const raw = Buffer.concat(parts).toString('utf8')
          const events = raw
            .split('\n\n')
            .filter((block) => block.startsWith('event:'))
            .map((block) => {
              const [head, ...rest] = block.split('\n')
              return { event: head.slice(6).trim(), data: JSON.parse(rest.join('\n').replace(/^data:\s*/, '')) as Record<string, unknown> }
            })
          resolve({ status: response.statusCode ?? 0, headers: response.headers, raw, events })
        })
      },
    )
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

const SITE_ANSWER = 'Загляните в [Ярмарки Польши](https://metravel.by/travels/816).'
const WHERE = 'Куда поехать на выходные?'
const MINE = 'Куда мне поехать из того, что я сохранила?'
const auth = (token: string) => ({ authorization: `Token ${token}` })

function makeServer(options: { profile?: boolean; backend?: FakeBackendOptions; text?: string; evalTrace?: boolean; profileTimeoutMs?: number } = {}) {
  const demandPath = join(makeTempDir('ai-visitor-demand-'), 'ai-demand.jsonl')
  const logs: string[] = []
  const prompts: AiChatMessage[][] = []
  const backend = fakeBackend(options.backend)
  const generator: Generator = {
    async generate(request) {
      prompts.push(request.messages)
      const text = options.text ?? SITE_ANSWER
      request.onDelta?.(text, text)
      return { text, usage: { prompt_tokens: 100, completion_tokens: 20, ttft_ms: 50, tokens_per_s: 40 } }
    },
  }
  const profile =
    options.profile === false ? null : createVisitorProfile({ backendUrl: BACKEND_URL, fetchImpl: backend.fetchImpl, timeoutMs: options.profileTimeoutMs, log: (line) => logs.push(line) })
  const server = createApp({
    index: loadFixtureIndex(),
    modelKey: MODEL,
    embedQuery: fakeEmbedQuery,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: {
      generator,
      limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: AI_ASK_DAILY_LIMIT, strikesToBlock: AI_OFFTOPIC_STRIKES_TO_BLOCK }),
      demandLog: createDemandLog({ path: demandPath }),
      queueTimeoutMs: 200,
      trustProxy: true,
      evalTrace: options.evalTrace === false ? null : { llmUrl: 'http://127.0.0.1:8090' },
      ...(profile ? { visitor: profile.resolve } : {}),
    },
    authorDraft: { limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock('Europe/Minsk'), dailyLimit: 5, strikesToBlock: 3 }) },
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: (line) => logs.push(line),
  })
  const demandText = (): string => {
    try {
      return readFileSync(demandPath, 'utf8')
    } catch {
      return ''
    }
  }
  return { server, logs, prompts, calls: backend.calls, demandText }
}

const eventOf = (reply: Reply, name: string): Record<string, unknown> | undefined => reply.events.filter((event) => event.event === name).at(-1)?.data
const idsOf = (reply: Reply): string[] => ((eventOf(reply, 'sources')?.sources as Array<{ source_id: string }> | undefined) ?? []).map((card) => card.source_id)
/** Поток без изменчивого: идентификатор хода свой у каждого ответа. */
const comparable = (reply: Reply): string => JSON.stringify(reply.events.map((event) => (event.event === 'done' ? { ...event, data: { ...event.data, turn_id: null } } : event)))
const userMessage = (messages: AiChatMessage[]): string => messages.at(-1)!.content

const SECRETS = [TOKEN_A, TOKEN_B, tokenHash(TOKEN_A), String(USER_A), String(USER_B), SECRET_TITLE, String(SECRET_ID), TRIP_PLACE, 'visitor@example.test', 'Имя Фамилия', VISITOR_BLOCK_LABEL_RU]

describe('metravel-assist: личный контекст в /ai/ask (#3354)', () => {
  it('гость — без изменений: поток и подсказка совпадают со службой без личного контекста', async () => {
    const plain = makeServer({ profile: false, evalTrace: false })
    const personal = makeServer({ evalTrace: false })
    await Promise.all([listen(plain.server), listen(personal.server)])
    try {
      for (const body of [{ q: WHERE, locale: 'ru' }, { q: MINE, locale: 'ru' }, { q: 'квест гродно замок', locale: 'pl' }]) {
        const before = await post(plain.server, body)
        const after = await post(personal.server, body)
        expect(after.status).toBe(200)
        expect(comparable(after)).toBe(comparable(before))
        expect(eventOf(after, 'done')).not.toHaveProperty('profile')
      }
      expect(JSON.stringify(personal.prompts)).toBe(JSON.stringify(plain.prompts))
      expect(JSON.stringify(personal.prompts)).not.toContain(VISITOR_BLOCK_LABEL_RU)
      // Гость к API сайта за сводкой не ходит.
      expect(personal.calls).toHaveLength(0)
    } finally {
      await Promise.all([close(plain.server), close(personal.server)])
    }
  })

  it('вошедший: строка «О посетителе» не длиннее 120 токенов стоит в подсказке, done и trace несут только признак', async () => {
    const { server, prompts } = makeServer()
    await listen(server)
    try {
      const reply = await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_A))
      expect(reply.status).toBe(200)
      const user = userMessage(prompts[0])
      const block = user.split('\n').find((line) => line.startsWith(`${VISITOR_BLOCK_LABEL_RU}: `))!
      expect(block).toContain('Статей на сайте: 2 (Польша, Литва)')
      expect(block).toContain('Хочет посетить: «Ойцувский парк»')
      expect(block).toContain('Запланировано: «Беловежская пуща» (июнь 2027)')
      expect(block).toContain(`Ближайшие поездки: ${TRIP_PLACE} (май 2027)`)
      expect(block).toContain('Уже посещено: «Ярмарки Польши»')
      expect(estimateTokens(block)).toBeLessThanOrEqual(VISITOR_BLOCK_MAX_TOKENS)
      // Ни имени, ни почты, ни идентификаторов.
      expect(block).not.toMatch(/Имя|Фамилия|@|424242|\b(761|791|816|5550|900|901)\b/)
      expect(user.indexOf(block)).toBeGreaterThan(user.indexOf('Материалы сайта:'))
      expect(user.indexOf(block)).toBeLessThan(user.indexOf('Вопрос посетителя:'))
      expect(prompts[0][0].content.endsWith(VISITOR_RULE_RU)).toBe(true)
      expect(eventOf(reply, 'done')).toMatchObject({ status: 'done', profile: true })
      expect(eventOf(reply, 'trace')).toMatchObject({ profile: true })
    } finally {
      await close(server)
    }
  })

  it('сводка и токен не попадают в sources, text, done, trace, журнал спроса и журнал службы', async () => {
    const { server, logs, demandText, calls } = makeServer()
    await listen(server)
    try {
      const replies = [
        await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_A)),
        await post(server, { q: MINE, locale: 'ru' }, { cookie: `authToken=${TOKEN_A}` }),
        await post(server, { q: 'рецепт борща', locale: 'ru' }, auth(TOKEN_A)),
        await post(server, { q: 'квест гродно замок', locale: 'ru', source: { type: 'travel', id: 816 } }, auth(TOKEN_A)),
      ]
      expect(calls.length).toBeGreaterThan(0)
      expect(demandText()).not.toBe('')
      const outside = [...replies.map((reply) => reply.raw), ...replies.map((reply) => JSON.stringify(reply.headers)), demandText(), logs.join('\n')].join('\n')
      for (const secret of SECRETS) expect(outside).not.toContain(secret)
      // Журнал хода — прежние поля, без признака личности.
      for (const line of demandText().trim().split('\n')) expect(Object.keys(JSON.parse(line)).some((key) => /profile|visitor|user|token/i.test(key))).toBe(false)
    } finally {
      await close(server)
    }
  })

  it('ответ не кэшируется и не отражает заголовки личности', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const reply = await post(server, { q: WHERE, locale: 'ru' }, { ...auth(TOKEN_A), cookie: `authToken=${TOKEN_A}` })
      expect(reply.headers['cache-control']).toBe('no-store')
      expect(reply.headers).not.toHaveProperty('set-cookie')
      expect(reply.headers).not.toHaveProperty('authorization')
      expect(reply.headers).not.toHaveProperty('access-control-allow-origin')
      expect(reply.headers).not.toHaveProperty('access-control-allow-credentials')
    } finally {
      await close(server)
    }
  })

  it('идентификатор пользователя из тела запроса не читается: личность — только из ответа API на токен', async () => {
    const { server, calls, prompts } = makeServer()
    await listen(server)
    try {
      const forged = { q: MINE, locale: 'ru', user_id: USER_A, userId: USER_A, user: { id: USER_A }, profile: true, visitor: { wishlist: [{ id: 761, title: 'Ойцувский парк' }] } }
      // Без токена чужой id в теле ничего не даёт: ни запроса к API, ни сводки.
      const guest = await post(server, forged)
      expect(calls).toHaveLength(0)
      expect(eventOf(guest, 'done')).not.toHaveProperty('profile')
      expect(JSON.stringify(prompts)).not.toContain(VISITOR_BLOCK_LABEL_RU)
      // С токеном пользователя B тот же id в теле не подменяет личность: запросы идут только за B.
      const other = await post(server, forged, auth(TOKEN_B))
      expect(calls.map((call) => new URL(call.url).pathname).filter((path) => /\/user\/\d+\//.test(path))).toEqual([`/api/user/${USER_B}/travel-statuses/`, `/api/user/${USER_B}/favorite-travels/`])
      expect(calls.some((call) => call.url.includes(String(USER_A)))).toBe(false)
      expect(idsOf(other)).toEqual(['791', '816'])
      expect(other.raw).not.toContain('Ойцувский')
    } finally {
      await close(server)
    }
  })

  it('два аккаунта: каждый видит только своё', async () => {
    const { server, prompts } = makeServer()
    await listen(server)
    try {
      const first = await post(server, { q: MINE, locale: 'ru' }, auth(TOKEN_A))
      const second = await post(server, { q: MINE, locale: 'ru' }, auth(TOKEN_B))
      const again = await post(server, { q: MINE, locale: 'ru' }, auth(TOKEN_A))
      expect(idsOf(first)).toEqual(['761', '791'])
      expect(idsOf(second)).toEqual(['791', '816'])
      expect(idsOf(again)).toEqual(['761', '791'])
      expect(userMessage(prompts[1])).not.toMatch(/Ойцув|Вильнюс|Секретные/)
      expect(userMessage(prompts[1])).toContain('В избранном: «Ярмарки Польши»')
      expect(userMessage(prompts[2])).toContain('Хочет посетить: «Ойцувский парк»')
    } finally {
      await close(server)
    }
  })

  it('вопрос о своём: карточками становятся сохранённые и запланированные материалы, которые есть в индексе', async () => {
    const { server, prompts } = makeServer()
    await listen(server)
    try {
      const saved = await post(server, { q: MINE, locale: 'ru' }, auth(TOKEN_A))
      expect(idsOf(saved)).toEqual(['761', '791'])
      const plans = await post(server, { q: 'Что у меня в планах на поездки?', locale: 'ru' }, auth(TOKEN_A))
      // Вопрос о планах — только запланированное: «хочу посетить» планом не называется.
      expect(idsOf(plans)).toEqual(['791'])
      // Карточки подсказки — те же материалы; посещённое и материал вне индекса карточками не стали.
      expect(userMessage(prompts[0])).toMatch(/\[1\] Статья «Ойцувский парк»[\s\S]*\[2\] Статья «Беловежская пуща»/)
      expect(userMessage(prompts[0])).not.toContain('[3]')
      expect(eventOf(saved, 'done')).toMatchObject({ status: 'done', profile: true })
    } finally {
      await close(server)
    }
  })

  it('«куда поехать»: посещённое понижается, но не удаляется', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const guest = await post(server, { q: WHERE, locale: 'ru' })
      const visitor = await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_A))
      expect(idsOf(guest)).toContain('816')
      expect([...idsOf(visitor)].sort()).toEqual([...idsOf(guest)].sort())
      expect(idsOf(visitor).at(-1)).toBe('816')
      expect(idsOf(visitor).filter((id) => id !== '816')).toEqual(idsOf(guest).filter((id) => id !== '816'))
    } finally {
      await close(server)
    }
  })

  it.each([
    ['названием без ссылки', `${SITE_ANSWER} Ещё вам подойдёт «${SECRET_TITLE}» — он у вас в списке желаний.`, 0],
    ['ссылкой', `${SITE_ANSWER} А ещё [${SECRET_TITLE}](https://metravel.by/travels/t-${SECRET_ID}) из вашего списка.`, 1],
  ])('обход стража %s: материал из сведений о посетителе, которого нет среди карточек, из ответа вырезается', async (_name, text, removed) => {
    const { server } = makeServer({ text })
    await listen(server)
    try {
      const reply = await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_A))
      const shown = String(eventOf(reply, 'text')!.text)
      expect(shown).toContain('https://metravel.by/travels/816')
      expect(shown).not.toMatch(/Секретные|Браславщин|t-5550/)
      expect(eventOf(reply, 'done')).toMatchObject({ status: 'done', removed_links: removed })
    } finally {
      await close(server)
    }
  })

  it.each([
    ['401 на «кто я»', { fail: { me: 401 } }],
    ['403 на отметки', { fail: { statuses: 403 } }],
    ['500 на поездки', { fail: { trips: 500 } }],
  ] as const)('%s → ответ как гостю, без 5xx', async (_name, backend) => {
    const plain = makeServer({ profile: false })
    const failing = makeServer({ backend: backend as FakeBackendOptions })
    await Promise.all([listen(plain.server), listen(failing.server)])
    try {
      const guest = await post(plain.server, { q: MINE, locale: 'ru' })
      const reply = await post(failing.server, { q: MINE, locale: 'ru' }, auth(TOKEN_A))
      expect(reply.status).toBe(200)
      expect(idsOf(reply)).toEqual(idsOf(guest))
      expect(eventOf(reply, 'text')).toEqual(eventOf(guest, 'text'))
      expect(eventOf(reply, 'done')).not.toHaveProperty('profile')
      expect(eventOf(reply, 'trace')).toMatchObject({ profile: false })
      expect(JSON.stringify(failing.prompts)).toBe(JSON.stringify(plain.prompts))
    } finally {
      await Promise.all([close(plain.server), close(failing.server)])
    }
  })

  it('API молчит → ответ как гостю не позже общего бюджета сводки', async () => {
    const { server, prompts } = makeServer({ backend: { hang: 'statuses' }, profileTimeoutMs: 80 })
    await listen(server)
    try {
      const started = Date.now()
      const reply = await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_A))
      expect(Date.now() - started).toBeLessThan(1500)
      expect(reply.status).toBe(200)
      expect(eventOf(reply, 'done')).toMatchObject({ status: 'done' })
      expect(eventOf(reply, 'done')).not.toHaveProperty('profile')
      expect(JSON.stringify(prompts)).not.toContain(VISITOR_BLOCK_LABEL_RU)
    } finally {
      await close(server)
    }
  })

  it('выключатель: служба без личного контекста токен не читает и к API не ходит', async () => {
    const off = makeServer({ profile: false })
    const on = makeServer()
    await Promise.all([listen(off.server), listen(on.server)])
    try {
      const reply = await post(off.server, { q: MINE, locale: 'ru' }, { ...auth(TOKEN_A), cookie: `authToken=${TOKEN_A}` })
      expect(off.calls).toHaveLength(0)
      expect(eventOf(reply, 'done')).not.toHaveProperty('profile')
      expect(eventOf(reply, 'trace')).not.toHaveProperty('profile')
      expect(JSON.stringify(off.prompts)).not.toContain(VISITOR_BLOCK_LABEL_RU)
      expect(await getJson(off.server, '/ai/health')).not.toHaveProperty('profile')
      const health = await getJson(on.server, '/ai/health')
      expect(health.profile).toBe(true)
      expect(JSON.stringify(health)).not.toMatch(/token|424242/i)
    } finally {
      await Promise.all([close(off.server), close(on.server)])
    }
  })

  it('вопрос не по теме и режим страницы сводку в подсказку не несут; чужая тема к API не ходит', async () => {
    const { server, calls, prompts } = makeServer()
    await listen(server)
    try {
      const offTopic = await post(server, { q: 'рецепт борща', locale: 'ru' }, auth(TOKEN_A))
      expect(eventOf(offTopic, 'done')).toEqual({ status: 'off_topic', reason: 'offtopic_warning', strikes: 1, strikes_to_block: 3 })
      expect(calls).toHaveLength(0)
      const page = await post(server, { q: 'квест гродно замок', locale: 'ru', source: { type: 'travel', id: 816 } }, auth(TOKEN_A))
      expect(page.status).toBe(200)
      expect(JSON.stringify(prompts)).not.toContain(VISITOR_BLOCK_LABEL_RU)
    } finally {
      await close(server)
    }
  })

  it('лимит остаётся на IP: два аккаунта с одного адреса расходуют один счётчик, свой адрес — свой счётчик', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      const first = await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_A), '198.51.100.7')
      const second = await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_B), '198.51.100.7')
      const elsewhere = await post(server, { q: WHERE, locale: 'ru' }, auth(TOKEN_A), '198.51.100.8')
      expect(eventOf(first, 'done')!.remaining).toBe(AI_ASK_DAILY_LIMIT - 1)
      expect(eventOf(second, 'done')!.remaining).toBe(AI_ASK_DAILY_LIMIT - 2)
      expect(eventOf(elsewhere, 'done')!.remaining).toBe(AI_ASK_DAILY_LIMIT - 1)
    } finally {
      await close(server)
    }
  })
})
