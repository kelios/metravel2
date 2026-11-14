/**
 * Фикстура личного контекста (#3354): поддельный API сайта для службы ассистента. Два тестовых токена, два
 * пользователя с разными сводками; запросы записываются, чтобы тесты видели адрес, метод и заголовок каждого.
 */

export const BACKEND_URL = 'http://backend.test'
export const TOKEN_A = 'test-token-visitor-a-0001'
export const TOKEN_B = 'test-token-visitor-b-0002'
export const USER_A = 424242
export const USER_B = 535353
/** Материал из «хочу» пользователя A, которого нет в фикстурном индексе, — по нему ищутся утечки сводки. */
export const SECRET_TITLE = 'Секретные озёра Браславщины: маршрут на байдарке'
export const SECRET_ID = 5550
export const TRIP_PLACE = 'Вильнюс'

export interface BackendUser {
  id: number
  statuses: unknown
  favorites: unknown
  trips: unknown
  own: unknown
}

const travel = (id: number, name: string, countryName = 'Польша') => ({ id, name, slug: `t-${id}`, url: `/travels/t-${id}`, countryName })

export const USERS: Record<string, BackendUser> = {
  [TOKEN_A]: {
    id: USER_A,
    statuses: [
      { status: 'wishlist', travel_id: 761, planned_date: null, visited_date: null, travel: travel(761, 'Ойцувский парк') },
      { status: 'wishlist', travel_id: SECRET_ID, planned_date: null, visited_date: null, travel: travel(SECRET_ID, SECRET_TITLE, 'Беларусь') },
      { status: 'planned', travel_id: 791, planned_date: '2027-06-01', visited_date: null, travel: travel(791, 'Беловежская пуща', 'Беларусь') },
      { status: 'visited', travel_id: 816, planned_date: null, visited_date: '2025-12-20', travel: travel(816, 'Ярмарки Польши') },
    ],
    favorites: { count: 0, next: null, previous: null, results: [] },
    trips: [{ id: 59, title: 'Литва на майские', status: 'planned', start_date: '2027-05-01T00:00:00+00:00', end_date: '2027-05-04T00:00:00+00:00', start_point_name: TRIP_PLACE, route_geometry: { type: 'LineString', coordinates: [] } }],
    own: { count: 2, next: null, previous: null, results: [travel(900, 'Моя статья о Татрах'), travel(901, 'Моя статья о Вильнюсе', 'Литва')] },
  },
  [TOKEN_B]: {
    id: USER_B,
    statuses: [{ status: 'wishlist', travel_id: 791, planned_date: null, visited_date: null, travel: travel(791, 'Беловежская пуща', 'Беларусь') }],
    favorites: { count: 1, next: null, previous: null, results: [travel(816, 'Ярмарки Польши')] },
    trips: [],
    own: { count: 0, next: null, previous: null, results: [] },
  },
}

export interface BackendCall {
  url: string
  method: string
  authorization: string | null
  redirect: string | undefined
}

export interface FakeBackendOptions {
  users?: Record<string, BackendUser>
  /** Код ответа запросу по имени (`me`, `statuses`, `favorites`, `trips`, `own`) вместо 200. */
  fail?: Partial<Record<'me' | 'statuses' | 'favorites' | 'trips' | 'own', number>>
  /** Запрос с этим именем не отвечает, пока его не оборвут. */
  hang?: 'me' | 'statuses' | 'favorites' | 'trips' | 'own'
  /** Тело ответа запросу по имени вместо данных пользователя. */
  body?: Partial<Record<'me' | 'statuses' | 'favorites' | 'trips' | 'own', string>>
}

const nameOf = (pathname: string): 'me' | 'statuses' | 'favorites' | 'trips' | 'own' | null => {
  if (pathname === '/api/user/me/') return 'me'
  if (/^\/api\/user\/\d+\/travel-statuses\/$/.test(pathname)) return 'statuses'
  if (/^\/api\/user\/\d+\/favorite-travels\/$/.test(pathname)) return 'favorites'
  if (pathname === '/api/trips/planned/me/') return 'trips'
  if (pathname === '/api/travels/') return 'own'
  return null
}

const reply = (status: number, body: string): Response =>
  ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, text: async () => body }) as unknown as Response

export function fakeBackend(options: FakeBackendOptions = {}) {
  const users = options.users ?? USERS
  const calls: BackendCall[] = []
  const byId = (id: number): BackendUser | undefined => Object.values(users).find((user) => user.id === id)

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const headers = (init?.headers ?? {}) as Record<string, string>
    const authorization = headers.authorization ?? headers.Authorization ?? null
    calls.push({ url: String(input), method: String(init?.method ?? 'GET'), authorization, redirect: init?.redirect })
    const name = nameOf(url.pathname)
    if (!name) return reply(404, '{}')
    if (options.hang === name) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    }
    if (options.fail?.[name]) return reply(options.fail[name]!, '{"detail":"нет"}')
    if (options.body?.[name] !== undefined) return reply(200, options.body[name]!)

    if (name === 'own') {
      const where = JSON.parse(url.searchParams.get('where') ?? '{}') as { user_id?: number }
      return reply(200, JSON.stringify(byId(Number(where.user_id))?.own ?? { count: 0, results: [] }))
    }
    const token = /^Token (\S+)$/.exec(authorization ?? '')?.[1]
    const user = token ? users[token] : undefined
    if (!user) return reply(401, '{"detail":"Учётные данные не были предоставлены."}')
    if (name === 'me') return reply(200, JSON.stringify({ id: user.id, name: 'Имя Фамилия', email: 'visitor@example.test', is_superuser: false }))
    if (name === 'trips') return reply(200, JSON.stringify(user.trips))
    // Чужой id бэкенд не отдаёт — как `_ensure_self_or_superuser`.
    const requested = Number(url.pathname.split('/')[3])
    if (requested !== user.id) return reply(403, '{"detail":"forbidden"}')
    return reply(200, JSON.stringify(name === 'statuses' ? user.statuses : user.favorites))
  }) as typeof fetch

  return { fetchImpl, calls }
}
