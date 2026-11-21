/**
 * Сводка посетителя в службе ассистента (#3354): откуда берётся токен, куда он уходит, что остаётся в памяти,
 * чем заканчивается любой отказ API. Сети нет — поддельный API из `visitorFixture.ts`.
 */
import { loadConfig } from '@/scripts/ai-assist/config'
import {
  buildVisitorContext,
  createVisitorProfile,
  DEFAULT_PROFILE_TIMEOUT_MS,
  DEFAULT_PROFILE_TTL_SECONDS,
  isPlainPublicBackend,
  MAX_PROFILE_RESPONSE_BYTES,
  readVisitorToken,
  tokenHash,
} from '@/scripts/ai-assist/visitorProfile'

import { BACKEND_URL, fakeBackend, SECRET_TITLE, TOKEN_A, TOKEN_B, TRIP_PLACE, USER_A, USER_B, USERS } from './visitorFixture'

const withToken = (token: string) => ({ headers: { authorization: `Token ${token}` } })
const withCookie = (token: string) => ({ headers: { cookie: `csrftoken=xyz; authToken=${token}; theme=dark` } })

function makeProfile(options: Parameters<typeof fakeBackend>[0] & { timeoutMs?: number; ttlSeconds?: number; capacity?: number; now?: () => number } = {}) {
  const backend = fakeBackend(options)
  const logs: string[] = []
  const profile = createVisitorProfile({
    backendUrl: BACKEND_URL,
    fetchImpl: backend.fetchImpl,
    timeoutMs: options.timeoutMs,
    ttlSeconds: options.ttlSeconds,
    capacity: options.capacity,
    now: options.now,
    log: (line) => logs.push(line),
  })
  return { profile, logs, calls: backend.calls }
}

describe('токен посетителя из запроса (#3354)', () => {
  it('берётся из заголовка Authorization: Token либо из cookie сессии; заголовок сильнее', () => {
    expect(readVisitorToken({ authorization: `Token ${TOKEN_A}` })).toBe(TOKEN_A)
    expect(readVisitorToken({ cookie: `a=1; authToken=${TOKEN_B}; b=2` })).toBe(TOKEN_B)
    expect(readVisitorToken({ authorization: `Token ${TOKEN_A}`, cookie: `authToken=${TOKEN_B}` })).toBe(TOKEN_A)
    expect(readVisitorToken({ cookie: `session=${TOKEN_B}` }, 'session')).toBe(TOKEN_B)
  })

  it('нет токена, чужая схема или мусор — гость', () => {
    expect(readVisitorToken({})).toBeNull()
    expect(readVisitorToken({ authorization: `Bearer ${TOKEN_A}` })).toBeNull()
    expect(readVisitorToken({ authorization: 'Token short' })).toBeNull()
    expect(readVisitorToken({ authorization: `Token ${TOKEN_A}\r\nX-Evil: 1` })).toBeNull()
    expect(readVisitorToken({ cookie: 'authToken=' })).toBeNull()
    expect(readVisitorToken({ cookie: 'authToken=%E0%A4%A' })).toBeNull()
    expect(readVisitorToken({ cookie: `otherToken=${TOKEN_A}` })).toBeNull()
  })
})

describe('сбор сводки посетителя (#3354)', () => {
  it('личность — из ответа API на токен; дальше четыре запроса GET только на BACKEND_URL', async () => {
    const { profile, calls } = makeProfile()
    const context = await profile.resolve(withToken(TOKEN_A))
    expect(context).toMatchObject({
      own: { count: 2, countries: ['Польша', 'Литва'], ids: [900, 901] },
      wishlist: [{ id: 761, title: 'Ойцувский парк' }, { id: 5550, title: SECRET_TITLE }],
      planned: [{ id: 791, title: 'Беловежская пуща', date: '2027-06-01' }],
      visited: [{ id: 816, title: 'Ярмарки Польши', date: '2025-12-20' }],
      favorites: [],
      trips: [{ place: TRIP_PLACE, start: '2027-05-01', end: '2027-05-04' }],
    })
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/api/user/me/',
      `/api/user/${USER_A}/travel-statuses/`,
      `/api/user/${USER_A}/favorite-travels/`,
      '/api/trips/planned/me/',
      '/api/travels/',
    ])
    expect(calls.every((call) => call.url.startsWith(`${BACKEND_URL}/api/`) && call.method === 'GET' && call.redirect === 'error')).toBe(true)
    // Токен не уходит в адрес и не нужен открытому каталогу статей.
    expect(calls.some((call) => call.url.includes(TOKEN_A))).toBe(false)
    expect(calls.slice(0, 4).every((call) => call.authorization === `Token ${TOKEN_A}`)).toBe(true)
    expect(calls[4].authorization).toBeNull()
    expect(JSON.parse(new URL(calls[4].url).searchParams.get('where')!)).toEqual({ user_id: USER_A, publish: 1, moderation: 1 })
  })

  it('cookie сессии web-клиента уходит API тем же заголовком', async () => {
    const { profile, calls } = makeProfile()
    expect(await profile.resolve(withCookie(TOKEN_B))).toMatchObject({ favorites: [{ id: 816 }], wishlist: [{ id: 791 }] })
    expect(calls[0].authorization).toBe(`Token ${TOKEN_B}`)
  })

  it('сводка одного пользователя не выдаётся другому', async () => {
    const { profile } = makeProfile()
    const first = await profile.resolve(withToken(TOKEN_A))
    const second = await profile.resolve(withToken(TOKEN_B))
    // Оба в кэше: повторные запросы отдают каждому своё.
    const again = await Promise.all([profile.resolve(withToken(TOKEN_B)), profile.resolve(withCookie(TOKEN_A)), profile.resolve(withToken(TOKEN_B))])
    expect(first!.wishlist.map((place) => place.id)).toEqual([761, 5550])
    expect(second!.wishlist.map((place) => place.id)).toEqual([791])
    expect(again[0]).toEqual(second)
    expect(again[1]).toEqual(first)
    expect(again[2]).toEqual(second)
    expect(JSON.stringify(second)).not.toContain(SECRET_TITLE)
    expect(JSON.stringify(second)).not.toContain(TRIP_PLACE)
    expect(profile.stats()).toMatchObject({ size: 2, hits: 3, misses: 2 })
  })

  it('токен перешёл к другому пользователю — старая сводка по нему не достаётся', async () => {
    let time = 1_000_000
    const users = { [TOKEN_A]: USERS[TOKEN_A] }
    const { profile } = makeProfile({ users, ttlSeconds: 60, now: () => time })
    expect((await profile.resolve(withToken(TOKEN_A)))!.wishlist).toHaveLength(2)
    users[TOKEN_A] = { ...USERS[TOKEN_B] }
    time += 61_000
    const next = await profile.resolve(withToken(TOKEN_A))
    expect(next!.wishlist.map((place) => place.id)).toEqual([791])
    expect(JSON.stringify(next)).not.toContain(SECRET_TITLE)
    expect(profile.stats().size).toBe(1)
  })

  it('в памяти — sha256 токена: повтор в пределах срока к API не ходит, по истечении — ходит снова', async () => {
    let time = 5_000_000
    const { profile, calls } = makeProfile({ ttlSeconds: DEFAULT_PROFILE_TTL_SECONDS, now: () => time })
    await profile.resolve(withToken(TOKEN_A))
    await profile.resolve(withToken(TOKEN_A))
    expect(calls).toHaveLength(5)
    time += (DEFAULT_PROFILE_TTL_SECONDS + 1) * 1000
    await profile.resolve(withToken(TOKEN_A))
    expect(calls).toHaveLength(10)
    expect(tokenHash(TOKEN_A)).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenHash(TOKEN_A)).not.toContain(TOKEN_A)
  })

  it('потолок числа записей: самая старая вытесняется', async () => {
    const third = 'c'.repeat(40)
    const users = { ...USERS, [third]: { ...USERS[TOKEN_B], id: 646464 } }
    const { profile, calls } = makeProfile({ users, capacity: 2 })
    await profile.resolve(withToken(TOKEN_A))
    await profile.resolve(withToken(TOKEN_B))
    await profile.resolve(withToken(third))
    expect(profile.stats().size).toBe(2)
    const before = calls.length
    await profile.resolve(withToken(TOKEN_B))
    expect(calls).toHaveLength(before)
    await profile.resolve(withToken(TOKEN_A))
    expect(calls.length).toBeGreaterThan(before)
  })

  it('два вопроса подряд с одним токеном ждут один сбор сводки', async () => {
    const { profile, calls } = makeProfile()
    const [first, second] = await Promise.all([profile.resolve(withToken(TOKEN_A)), profile.resolve(withToken(TOKEN_A))])
    expect(first).toEqual(second)
    expect(calls).toHaveLength(5)
  })

  // #3431 Б2: сводка лежит в памяти до четырёх минут, но достаётся только по токену. Выход на сайте снимает
  // cookie сессии и удаляет токен на бэкенде — запрос вышедшего посетителя идёт без токена и получает ход гостя.
  it('после выхода из аккаунта запрос без токена — гость сразу, хотя сводка ещё в памяти', async () => {
    const { profile, calls } = makeProfile()
    expect(await profile.resolve(withCookie(TOKEN_A))).not.toBeNull()
    expect(profile.stats().size).toBe(1)
    const before = calls.length
    for (const request of [{ headers: {} }, { headers: { cookie: 'csrftoken=xyz; theme=dark' } }, { headers: { cookie: 'authToken=' } }]) {
      expect(await profile.resolve(request)).toBeNull()
    }
    // К API за гостя служба не ходит, а запись прежнего токена чужому запросу недоступна.
    expect(calls).toHaveLength(before)
    expect(await profile.resolve(withToken(TOKEN_B))).not.toEqual(await profile.resolve(withCookie(TOKEN_A)))
  })

  it('без токена к API не ходит', async () => {
    const { profile, calls } = makeProfile()
    expect(await profile.resolve({ headers: {} })).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it.each([
    ['401 на «кто я»', { fail: { me: 401 } }],
    ['403 на отметки', { fail: { statuses: 403 } }],
    ['401 на избранное', { fail: { favorites: 401 } }],
    ['500 на поездки', { fail: { trips: 500 } }],
    ['502 на свои статьи', { fail: { own: 502 } }],
    ['не JSON', { body: { statuses: '<html>502</html>' } }],
    ['ответ без id', { body: { me: '{"name":"x"}' } }],
    ['ответ больше потолка', { body: { trips: `[${' '.repeat(MAX_PROFILE_RESPONSE_BYTES)}]` } }],
  ] as const)('%s → гость, и отказ не запоминается', async (_name, options) => {
    const { profile, calls } = makeProfile(options as Parameters<typeof makeProfile>[0])
    expect(await profile.resolve(withToken(TOKEN_A))).toBeNull()
    expect(profile.stats().size).toBe(0)
    const before = calls.length
    expect(await profile.resolve(withToken(TOKEN_A))).toBeNull()
    expect(calls.length).toBeGreaterThan(before)
  })

  it('неизвестный токен → гость', async () => {
    const { profile } = makeProfile()
    expect(await profile.resolve(withToken('d'.repeat(40)))).toBeNull()
  })

  it.each(['me', 'statuses', 'own'] as const)('API молчит (%s) → гость по истечении общего бюджета, без ожидания сверх него', async (hang) => {
    const { profile } = makeProfile({ hang, timeoutMs: 60 })
    const started = Date.now()
    expect(await profile.resolve(withToken(TOKEN_A))).toBeNull()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('вошедший без статей, отметок и поездок — ход гостя, а запросы не повторяются', async () => {
    const users = { [TOKEN_A]: { id: USER_A, statuses: [], favorites: { results: [] }, trips: [], own: { count: 0, results: [] } } }
    const { profile, calls } = makeProfile({ users })
    expect(await profile.resolve(withToken(TOKEN_A))).toBeNull()
    expect(await profile.resolve(withToken(TOKEN_A))).toBeNull()
    expect(calls).toHaveLength(5)
  })

  it('в журнале службы нет ни токена, ни id, ни содержимого сводки', async () => {
    const failing = makeProfile({ fail: { statuses: 500 } })
    await failing.profile.resolve(withToken(TOKEN_A))
    const hanging = makeProfile({ hang: 'trips', timeoutMs: 40 })
    await hanging.profile.resolve(withToken(TOKEN_A))
    const healthy = makeProfile()
    await healthy.profile.resolve(withToken(TOKEN_A))
    const lines = [...failing.logs, ...hanging.logs, ...healthy.logs].join('\n')
    expect(failing.logs).toEqual(['профиль посетителя: ответ как гостю — statuses: HTTP 500'])
    expect(hanging.logs).toEqual(['профиль посетителя: ответ как гостю — trips: таймаут'])
    expect(healthy.logs).toEqual([])
    for (const secret of [TOKEN_A, tokenHash(TOKEN_A), String(USER_A), String(USER_B), SECRET_TITLE, TRIP_PLACE, 'visitor@example.test', 'Имя Фамилия']) expect(lines).not.toContain(secret)
  })
})

describe('разбор ответов API и настройки (#3354)', () => {
  it('сводка собирается из разных форм ответа и не берёт лишнего', () => {
    const context = buildVisitorContext({
      statuses: { results: [{ status: 'visited', travel_id: 7, travel: { name: 'Без своего id' } }, { status: 'dropped', travel: { id: 8, name: 'Чужой статус' } }, { status: 'wishlist', travel: { id: 0, name: 'Плохой id' } }] },
      favorites: [{ id: 9, name: ' Избранное\nс переносом ', countryName: 'Чехия' }, { id: 10 }],
      trips: [{ start_point_name: 'Прага', start_date: '2027-02-03T10:00:00+00:00' }, { title: 'Без места', start_date: '2027-02-03' }, { start_point_name: 'Без даты' }],
      own: { total: 40, data: [{ id: 1, countryName: 'Польша, Чехия' }, { id: 2, countryName: 'Польша' }] },
    })
    expect(context).toEqual({
      own: { count: 40, countries: ['Польша', 'Чехия'], ids: [1, 2] },
      visited: [{ id: 7, title: 'Без своего id' }],
      wishlist: [],
      planned: [],
      favorites: [{ id: 9, title: 'Избранное с переносом', country: 'Чехия' }],
      trips: [{ place: 'Прага', start: '2027-02-03' }],
    })
    expect(buildVisitorContext({ statuses: null, favorites: 'x', trips: 5, own: undefined })).toEqual({ own: { count: 0, countries: [], ids: [] }, visited: [], wishlist: [], planned: [], favorites: [], trips: [] })
  })

  it('выключатель и бюджеты читаются из окружения', () => {
    expect(loadConfig({})).toMatchObject({ promptProfile: true, profileTimeoutMs: DEFAULT_PROFILE_TIMEOUT_MS, profileTtlSeconds: DEFAULT_PROFILE_TTL_SECONDS, authCookieName: 'authToken' })
    expect(loadConfig({ AI_ASSIST_PROMPT_PROFILE: '0' }).promptProfile).toBe(false)
    expect(loadConfig({ AI_ASSIST_PROFILE_TIMEOUT_MS: '900', AI_ASSIST_PROFILE_TTL_SECONDS: '180', AI_ASSIST_PROFILE_CACHE_SIZE: '50', AI_ASSIST_AUTH_COOKIE: 'sid' })).toMatchObject({
      profileTimeoutMs: 900,
      profileTtlSeconds: 180,
      profileCacheSize: 50,
      authCookieName: 'sid',
    })
    // Срок сводки по умолчанию — в пределах 3–5 минут, бюджет — 1,5–2 с.
    expect(DEFAULT_PROFILE_TTL_SECONDS).toBeGreaterThanOrEqual(180)
    expect(DEFAULT_PROFILE_TTL_SECONDS).toBeLessThanOrEqual(300)
    expect(DEFAULT_PROFILE_TIMEOUT_MS).toBeGreaterThanOrEqual(1500)
    expect(DEFAULT_PROFILE_TIMEOUT_MS).toBeLessThanOrEqual(2000)
  })

  it('открытый http к чужому хосту считается небезопасным для токена, своя сеть и https — нет', () => {
    expect(isPlainPublicBackend('http://api.example.com')).toBe(true)
    for (const url of ['https://metravel.by', 'http://127.0.0.1:8000', 'http://localhost:8000', 'http://app:8000', 'http://192.168.50.36', 'http://10.0.0.5:8000', 'http://[::1]:8000', 'не адрес']) {
      expect(isPlainPublicBackend(url)).toBe(false)
    }
  })
})
