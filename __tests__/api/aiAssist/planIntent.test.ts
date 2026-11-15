/**
 * Намерение «план по дням» (#3298): какой вопрос уходит в `/ai/plan`, на сколько дней план и что отвечает
 * клиент службы на её отказы.
 */
import { detectPlanIntent, PLAN_MAX_DAYS, planDaysOf, requestedDaysOf } from '@/api/aiAssist/planIntent'
import { HttpPlanClient, parseTripPlan } from '@/api/aiAssist/planProvider'

describe('намерение «план по дням» (#3298)', () => {
  it.each([
    // RU
    ['Спланируй два дня в Кракове', 2],
    ['Составь план на три дня в Минске', 3],
    ['Что посмотреть в Кракове за два дня?', 2],
    ['Маршрут на выходные из Минска', 2],
    ['План на неделю в Польше', 7],
    ['На 3 дня в Вильнюс', 3],
    ['Будем в Минске два дня. Что посмотреть в первую очередь?', 2],
    ['я в кракове у меня 2 дня что мне посмотреть ?', 2],
    ['Spędzimy w Mińsku trzy dni. Co warto zobaczyć poza ścisłym centrum?', 3],
    ['Спланируй поездку в Гродно', 1],
    ['Спланируй пять дней в Лиде', 5],
    // BE
    ['Сплануй два дні ў Брэсце', 2],
    ['Складзі маршрут на выхадныя ў Гродне', 2],
    ['Што паглядзець у Мінску за тры дні?', 3],
    // UK
    ['Сплануй два дні у Кракові', 2],
    ['Склади план на три дні у Вільнюсі', 3],
    ['Що подивитися у Варшаві за два дні?', 2],
    ['Сплануй тиждень у Ліді', 7],
    // PL
    ['Zaplanuj dwa dni w Krakowie', 2],
    ['Ułóż plan na trzy dni w Warszawie', 3],
    ['Co zobaczyć w Wilnie przez dwa dni?', 2],
    ['Plan na weekend w Gdańsku', 2],
    // EN
    ['Plan two days in Krakow', 2],
    ['Make a three-day itinerary for Minsk', 3],
    ['What to see in Brest in two days?', 2],
    ['Plan a weekend in Grodno', 2],
  ])('«%s» — план на %i дн.', (question, days) => {
    expect(detectPlanIntent(question)).toBe(true)
    expect(requestedDaysOf(question)).toBe(days)
    expect(planDaysOf(question)).toBe(Math.min(days, PLAN_MAX_DAYS))
  })

  it.each([
    // Вопрос о самом числе дней — совет.
    'Сколько дней нужно на Краков?',
    'Хватит ли двух дней на Краков?',
    'Колькі дзён трэба на Гродна?',
    'Скільки днів потрібно на Львів?',
    'Ile dni potrzeba na Kraków?',
    'How many days do I need for Vilnius?',
    'How long should I stay in Krakow?',
    // Совет без слов «план» и «маршрут» и без числа дней.
    'Куда съездить на выходные в Беларуси?',
    'Что посмотреть в Кракове?',
    'Што паглядзець у Гродне?',
    'Що подивитися у Львові?',
    'Co zobaczyć w Krakowie?',
    'What to see in Brest?',
    'Что посмотреть в Гродно за один день?',
    // Выбор места и вопрос о наличии материалов при названном числе дней — совет, а не план.
    'Куда съездить из Минска на два дня с одной ночёвкой? Хочется замки или усадьбы.',
    'Mieszkamy w Krakowie. Dokąd pojechać na dwa dni, żeby odpocząć od miasta?',
    'Едем в Закопане на три дня, высоко в горы лезть не хотим. Что там есть кроме вершин?',
    'Будемо у Гданську три дні в серпні. Що порадиш?',
    'Летим в Вильнюс на три дня. Есть у вас квесты по городу?',
    'Which hiking trail can I walk in 4 days in June?',
    'Пеший маршрут в Нарнии на три дня',
    // Другое.
    'Квест в Гродно на 2 часа',
    'Какие квесты есть в Минске?',
    'Сколько стоит квест?',
    // Вопрос о своих планах отвечает личный подбор (#3354).
    'Что у меня в планах на поездки?',
    'Мои планы на выходные',
    'What are my plans for upcoming trips?',
    '',
  ])('«%s» — не план', (question) => {
    expect(detectPlanIntent(question)).toBe(false)
  })

  it('число дней — не больше потолка плана, а запрошенное сохраняется для фразы о нехватке', () => {
    expect(requestedDaysOf('Спланируй 14 дней в Польше')).toBe(14)
    expect(planDaysOf('Спланируй 14 дней в Польше')).toBe(PLAN_MAX_DAYS)
    expect(planDaysOf('')).toBe(1)
  })
})

const item = (patch: Record<string, unknown> = {}) => ({
  type: 'quest',
  source_id: 246,
  title: 'Квест по Кракову',
  url: 'https://metravel.by/quests/246',
  path: '/quests/246',
  hours: 2,
  lat: 50.054,
  lng: 19.935,
  cover: 'https://metravel.by/c.webp',
  city: 'Краков',
  country: 'Польша',
  ...patch,
})
const body = (days: unknown[][], patch: Record<string, unknown> = {}) => ({ days: days.map((items) => ({ items })), note: 'Два дня', days_requested: 2, assembled: 'code', remaining: 9, ...patch })
const reply = (status: number, payload: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => payload }) as unknown as Response

describe('клиент плана по дням (#3298)', () => {
  it('ответ службы разбирается в план: идентификаторы строками, путь из адреса, лишнее отбрасывается', () => {
    const plan = parseTripPlan(body([[item(), item({ type: 'travel', source_id: '568', title: 'Краков', url: 'https://metravel.by/travels/krakow', path: undefined, hours: 4, cover: null })], [item({ source_id: 13 })]]))
    expect(plan).toEqual({
      days: [
        {
          items: [
            { type: 'quest', source_id: '246', title: 'Квест по Кракову', url: 'https://metravel.by/quests/246', path: '/quests/246', hours: 2, lat: 50.054, lng: 19.935, cover: 'https://metravel.by/c.webp', city: 'Краков', country: 'Польша' },
            { type: 'travel', source_id: '568', title: 'Краков', url: 'https://metravel.by/travels/krakow', path: '/travels/krakow', hours: 4, lat: 50.054, lng: 19.935, cover: null, city: 'Краков', country: 'Польша' },
          ],
        },
        { items: [expect.objectContaining({ source_id: '13' })] },
      ],
      daysRequested: 2,
      assembled: 'code',
    })
  })

  it('кривые материалы и дни отбрасываются; план без материалов — не план', () => {
    const plan = parseTripPlan(
      body([[item(), item(), item({ type: 'help' }), item({ source_id: 0 }), item({ url: 'javascript:alert(1)' }), item({ hours: 0 }), item({ title: '' }), item({ source_id: 7, path: '//evil.example/x', lat: 'x', lng: 999 })], [], ['строка']], { days_requested: 5, assembled: 'model' }),
    )!
    expect(plan.days).toHaveLength(1)
    expect(plan.days[0].items.map((entry) => entry.source_id)).toEqual(['246', '7'])
    // Повтор материала не показывается дважды; чужой путь заменён путём из адреса, кривые координаты — нет точки.
    expect(plan.days[0].items[1]).toMatchObject({ path: '/quests/246', lat: null, lng: null })
    expect(plan).toMatchObject({ daysRequested: 5, assembled: 'model' })
    // Поле note ответа экран не читает: текста службы в плане нет.
    expect(plan).not.toHaveProperty('note')
    for (const broken of [null, 'план', {}, { days: 'нет' }, body([[]]), body([[item({ type: 'trail' })]])]) expect(parseTripPlan(broken)).toBeNull()
  })

  it('запрос несёт только вопрос и язык; ответ 200 — план', async () => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => reply(200, body([[item()]])))
    const client = new HttpPlanClient('https://site.example.test/', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const outcome = await client.plan({ question: 'Спланируй два дня в Кракове', locale: 'ru' })
    expect(outcome.aborted).toBe(false)
    expect(outcome.plan?.days[0].items[0].title).toBe('Квест по Кракову')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://site.example.test/ai/plan')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({ q: 'Спланируй два дня в Кракове', locale: 'ru' })
    expect(init).not.toHaveProperty('credentials')
  })

  it.each([404, 422, 429, 503, 500])('отказ службы %i — плана нет, вопрос уйдёт обычным путём', async (status) => {
    const client = new HttpPlanClient('', { fetchImpl: (async () => reply(status, { error: 'x' })) as unknown as typeof fetch })
    expect(await client.plan({ question: 'q', locale: 'ru' })).toEqual({ plan: null, aborted: false })
  })

  it('сеть, не-JSON и ответ не по форме — плана нет; отмена посетителем помечена', async () => {
    const down = new HttpPlanClient('', {
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof fetch,
    })
    expect(await down.plan({ question: 'q', locale: 'ru' })).toEqual({ plan: null, aborted: false })
    const notJson = new HttpPlanClient('', {
      fetchImpl: (async () => ({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('html')) })) as unknown as typeof fetch,
    })
    expect(await notJson.plan({ question: 'q', locale: 'ru' })).toEqual({ plan: null, aborted: false })
    const odd = new HttpPlanClient('', { fetchImpl: (async () => reply(200, { days: [] })) as unknown as typeof fetch })
    expect(await odd.plan({ question: 'q', locale: 'ru' })).toEqual({ plan: null, aborted: false })

    const controller = new AbortController()
    const hanging = new HttpPlanClient('', {
      fetchImpl: ((_: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch,
    })
    const pending = hanging.plan({ question: 'q', locale: 'ru', signal: controller.signal })
    controller.abort()
    expect(await pending).toEqual({ plan: null, aborted: true })
  })
})
