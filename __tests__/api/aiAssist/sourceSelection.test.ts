import { selectPromptSources } from '@/api/aiAssist/prompt'
import type { QuestFacts, TravelFacts } from '@/api/aiAssist/sourceFacts'
import { arrangeSources, isArranged, withoutNearby } from '@/api/aiAssist/sourceSelection'
import type { AiSource } from '@/api/aiAssist/types'

type TravelInput = { id: number; title: string; country: string; snippet?: string; facts?: Partial<TravelFacts> | null }
type QuestInput = { id: number; title: string; city: string; country: string; facts?: Partial<QuestFacts> | null }

const travel = ({ id, title, country, snippet = '', facts = {} }: TravelInput): AiSource => ({
  type: 'travel',
  source_id: String(id),
  title,
  url: `https://metravel.by/travels/${id}`,
  path: `/travels/${id}`,
  snippet,
  score: 1,
  place: { countries: [country] },
  facts: facts === null ? null : { type: 'travel', source_id: id, ...facts },
})

const quest = ({ id, title, city, country, facts = {} }: QuestInput): AiSource => ({
  type: 'quest',
  source_id: String(id),
  title,
  url: `https://metravel.by/quests/${id}`,
  path: `/quests/${id}`,
  snippet: `Городской квест по городу ${city} (${country})`,
  score: 1,
  place: { cities: [city], countries: [country] },
  facts: facts === null ? null : { type: 'quest', source_id: id, ...facts },
})

const ids = (sources: readonly AiSource[]) => sources.map((source) => `${source.type[0]}${source.source_id}`)
const groupOf = (sources: readonly AiSource[], group: AiSource['group']) => ids(sources.filter((source) => source.group === group))

const WEEKEND = ['Самостоятельное путешествие', 'Тур выходного дня']

// Карточки и факты — как в пробе пути службы 11.11.2026 (`.codex-temp/ai-review-20261111/probe.jsonl`) и `facts.jsonl` индекса.
const P05 = [
  travel({ id: 634, title: 'Голубые источники Niebieskie Źródła в Польше', country: 'Польша', facts: { number_days: 1, months: [4], transports: ['Машина'] } }),
  travel({ id: 568, title: 'Краков: путеводитель по местам', country: 'Польша', facts: { months: [6] } }),
  travel({ id: 502, title: 'Варшавские Лазенки', country: 'Польша', snippet: 'Парк Лазенки в Варшаве: дворец на воде и павлины', facts: { number_days: 1, months: [2], transports: ['Машина'] } }),
  travel({ id: 459, title: 'Хельская коса: три маяка и неделя на Балтике', country: 'Польша', facts: { months: [4] } }),
  quest({ id: 129, title: 'Детский квест по Варшаве: знаки для базилишка', city: 'Варшава', country: 'Польша', facts: { points: 8, duration_min: 75, difficulty: 'easy', pet_friendly: true, audience: 'kids', age: [8, 10] } }),
]

const P08 = [
  travel({ id: 600, title: 'Териева хата в Высоких Татрах: маршрут из Старого Смоковца', country: 'Словакия', facts: { number_days: 1, months: [6], transports: ['Машина'] } }),
  travel({ id: 451, title: 'Гора Турбач (1310 м): поход в Горце, Польша', country: 'Польша', facts: { number_days: 1, months: [2], transports: ['Машина'] } }),
  travel({ id: 553, title: 'Закопане: лёгкая тропа Ścieżka nad Reglami', country: 'Польша', snippet: 'Тропа идёт вдоль подножия Татр', facts: { number_days: 1, months: [8], transports: ['Машина'] } }),
  travel({ id: 761, title: 'Mullerthal Trail: 112 км по Люксембургу за 6 дней', country: 'Люксембург', facts: { number_days: 6, months: [9, 10], transports: ['Автобус'] } }),
  travel({ id: 362, title: 'Морское око в мае: озеро в Татрах, Польша', country: 'Польша', facts: { number_days: 1, months: [5], transports: ['Машина'] } }),
]

const P09 = [
  travel({ id: 672, title: 'Маршруты выходного дня из Минска: 13 поездок', country: 'Беларусь', facts: { categories: WEEKEND } }),
  travel({ id: 635, title: 'Замки и усадьбы Беларуси: 19 маршрутов из Минска', country: 'Беларусь', facts: { categories: WEEKEND } }),
  travel({ id: 135, title: 'Жемыславль: дворец Умястовских и маршрут из Минска', country: 'Беларусь', facts: { number_days: 1, months: [3], transports: ['Машина'] } }),
  travel({ id: 566, title: 'Куда поехать в Беларуси на выходные: 4 маршрута', country: 'Беларусь', facts: { months: [3, 4, 5, 6, 7, 8, 10, 11], transports: ['Велосипед', 'Машина'], categories: WEEKEND } }),
  travel({ id: 155, title: 'Зимний маршрут: Польша, Германия, Чехия, Австрия', country: 'Австрия, Германия, Польша, Чехия', snippet: 'Выехали из Беларуси в январе', facts: { number_days: 14, months: [1, 2], transports: ['Машина'] } }),
  travel({ id: 594, title: 'Блатня (Błatnia) — наш поход', country: 'Польша', facts: { number_days: 1, months: [5], transports: ['Машина'] } }),
  travel({ id: 187, title: 'Могилёв, усадьба Толстых и Быховский замок', country: 'Беларусь', facts: { number_days: 1, months: [8], transports: ['Машина'] } }),
]

const P13 = [
  travel({ id: 816, title: 'Рождественские ярмарки Польши 2026', country: 'Польша', facts: { months: [11, 12] } }),
  travel({ id: 178, title: 'Польша за 4 дня: маршрут из Минска в Гданьск', country: 'Польша', facts: { number_days: 4, months: [11], transports: ['Машина'] } }),
  travel({ id: 177, title: 'Польша. Варшава - Закопане - Морское Око - Краков.', country: 'Польша', facts: { number_days: 4, months: [3], transports: ['Машина'] } }),
  travel({ id: 637, title: 'Горы Польши: 19 пеших маршрутов', country: 'Польша, Словакия', facts: {} }),
  travel({ id: 386, title: 'Energylandia - польский Диснейленд.', country: 'Польша', facts: { number_days: 1, months: [7], transports: ['Машина'], categories: WEEKEND } }),
  travel({ id: 421, title: 'Шклярска-Поремба за 3 дня: замки и Снежка', country: 'Польша', facts: { number_days: 3, months: [10], transports: ['Машина'] } }),
  travel({ id: 438, title: 'Нижняя Силезия за неделю', country: 'Польша', facts: { number_days: 7, months: [11], transports: ['Машина'] } }),
  travel({ id: 263, title: 'Прогулка по парку «Орлиные гнёзда»: скалы и пещеры', country: 'Польша', facts: { number_days: 1, months: [1], transports: ['Машина'] } }),
]

const P15 = [
  travel({ id: 682, title: 'Заброшенные усадьбы и замки Беларуси: 38 мест', country: 'Беларусь', facts: { months: [5, 9], transports: ['Машина'] } }),
  travel({ id: 635, title: 'Замки и усадьбы Беларуси: 19 маршрутов из Минска', country: 'Беларусь', facts: { categories: WEEKEND } }),
  travel({ id: 566, title: 'Куда поехать в Беларуси на выходные: 4 маршрута', country: 'Беларусь', facts: { months: [3, 4, 5, 6, 7, 8, 10, 11], categories: WEEKEND } }),
  travel({ id: 196, title: 'Веломаршрут за день: Кревский замок и Гольшаны', country: 'Беларусь', facts: { number_days: 1, months: [9], transports: ['Машина', 'Велосипед'] } }),
  travel({ id: 339, title: 'Усадьба Новицких. Беларусь, Совейки.', country: 'Беларусь', facts: { number_days: 1, months: [8], transports: ['Машина'] } }),
  travel({ id: 421, title: 'Шклярска-Поремба за 3 дня: замки и Снежка', country: 'Польша', facts: { number_days: 3, months: [10], transports: ['Машина'] } }),
]

describe('цепочка порядка карточек (#3289): место → условия → превосходная степень', () => {
  it('без места и условий порядок подбора не меняется и групп нет', () => {
    const sources = [travel({ id: 1, title: 'Статья', country: 'Польша' }), quest({ id: 2, title: 'Квест', city: 'Гродно', country: 'Беларусь' })]
    const result = arrangeSources('Что нового на сайте?', sources)
    expect(result.sources).toEqual(sources)
    expect(result).toMatchObject({ conditions: {}, noPlace: false })
    expect(isArranged(result.sources)).toBe(false)
    expect(arrangeSources('', sources).sources).toEqual(sources)
    expect(arrangeSources(null, sources).sources).toEqual(sources)
  })

  it('место: карточки названного города — группа match, остальные — nearby и в подсказку не идут', () => {
    const sources = [
      quest({ id: 1, title: 'Квест по Бресту', city: 'Брест', country: 'Беларусь' }),
      quest({ id: 2, title: 'Квест по Гродно', city: 'Гродно', country: 'Беларусь' }),
      travel({ id: 3, title: 'Гродно за выходные', country: 'Беларусь' }),
      quest({ id: 4, title: 'Квест по Карловым Варам', city: 'Карловы Вары', country: 'Чехия' }),
    ]
    const { sources: arranged } = arrangeSources('Что посмотреть в Гродно?', sources)
    expect(groupOf(arranged, 'match')).toEqual(['q2', 't3'])
    expect(groupOf(arranged, 'nearby')).toEqual(['q1', 'q4'])
    expect(ids(withoutNearby(arranged))).toEqual(['q2', 't3'])
    expect(ids(selectPromptSources(sources, 8, 'Что посмотреть в Гродно?'))).toEqual(['q2', 't3'])
    // Уже расставленное повторно не переставляется.
    expect(arrangeSources('Что посмотреть в Бресте?', arranged).sources).toEqual(arranged)
    expect(ids(selectPromptSources(arranged, 8, 'Что посмотреть в Бресте?'))).toEqual(['q2', 't3'])
    // `groups: false` — только порядок: закреплённая страница (#2897).
    const plain = arrangeSources('Что посмотреть в Гродно?', sources, { groups: false }).sources
    expect(ids(plain)).toEqual(['q2', 't3', 'q1', 'q4'])
    expect(isArranged(plain)).toBe(false)
  })

  it('дети: детские, затем семейные квесты города встают первыми; чужой город уходит в nearby, просьба о статье квесты не поднимает (#3276)', () => {
    const sources = [
      travel({ id: 1, title: 'Несвижский замок Радзивиллов', country: 'Беларусь' }),
      quest({ id: 2, title: 'Квест по Несвижу', city: 'Несвиж', country: 'Беларусь' }),
      quest({ id: 3, title: 'Семейный квест', city: 'Несвиж', country: 'Беларусь', facts: { audience: 'family' } }),
      quest({ id: 4, title: 'Детский квест Бреста', city: 'Брест', country: 'Беларусь', facts: { audience: 'kids' } }),
      quest({ id: 5, title: 'Детский квест', city: 'Несвиж', country: 'Беларусь', facts: { audience: 'kids', age: [8, 10] } }),
    ]
    const children = arrangeSources('Что посмотреть в Несвиже? А какой из них подойдёт детям?', sources).sources
    expect(ids(children)).toEqual(['q5', 'q3', 't1', 'q2', 'q4'])
    // Условие выделило две карточки — подсказка сокращается до трёх: они и первая по порядку из остальных.
    expect(groupOf(children, 'match')).toEqual(['q5', 'q3', 't1'])
    expect(groupOf(children, 'nearby')).toEqual(['q2', 'q4'])
    expect(children[0].why).toBe('детский')
    expect(children[1].why).toBe('семейный')
    expect(children[2].why).toBeUndefined()
    expect(ids(arrangeSources('Что посмотреть в Несвиже?', sources).sources)).toEqual(['t1', 'q2', 'q3', 'q5', 'q4'])
    // «Статья про Несвиж с детьми»: статья первой, квесты ниже — детский и семейный впереди остальных.
    expect(ids(arrangeSources('Есть статья про Несвиж с детьми?', sources).sources)).toEqual(['t1', 'q5', 'q3', 'q2', 'q4'])
  })

  it('неизвестно ≠ нарушено: карточки без факта остаются в подсказке в порядке подбора; убирается только явное нарушение числа', () => {
    const sources = [
      quest({ id: 1, title: 'Без фактов', city: 'Минск', country: 'Беларусь', facts: null }),
      quest({ id: 2, title: 'Длинный', city: 'Минск', country: 'Беларусь', facts: { duration_min: 150 } }),
      quest({ id: 3, title: 'Без длительности', city: 'Минск', country: 'Беларусь', facts: { points: 9 } }),
      quest({ id: 4, title: 'Короткий', city: 'Минск', country: 'Беларусь', facts: { duration_min: 45 } }),
      travel({ id: 5, title: 'Минск за один день', country: 'Беларусь', facts: { number_days: 1 } }),
      travel({ id: 6, title: 'Минск и окрестности за 3 дня', country: 'Беларусь', facts: { number_days: 3 } }),
    ]
    const { sources: arranged } = arrangeSources('Что пройти в Минске до часа?', sources)
    // Без сокращения подсказки: совпавший — первым; без факта — следом в порядке подбора; нарушившие число — в nearby.
    const whole = arrangeSources('Что пройти в Минске до часа?', sources, { focus: false }).sources
    expect(groupOf(whole, 'match')).toEqual(['q4', 'q1', 'q3', 't5'])
    expect(groupOf(whole, 'nearby')).toEqual(['q2', 't6'])
    // Условие выделило одну карточку — подсказка сокращается до трёх: она и две первые по порядку. Четвёртая
    // карточка условий не нарушала: это предел размера подсказки, в списке источников она остаётся.
    expect(groupOf(arranged, 'match')).toEqual(['q4', 'q1', 'q3'])
    expect(groupOf(arranged, 'nearby')).toEqual(['t5', 'q2', 't6'])
    expect(arranged[0].why).toBe('45 мин')
    expect(arranged.slice(1).every((source) => source.why === undefined)).toBe(true)
  })

  it('если убирать нечем заменить, карточки остаются как ближайшее — без строки «почему подходит»', () => {
    const sources = [
      quest({ id: 1, title: 'Длинный', city: 'Минск', country: 'Беларусь', facts: { duration_min: 150 } }),
      quest({ id: 2, title: 'Ещё длиннее', city: 'Минск', country: 'Беларусь', facts: { duration_min: 240 } }),
    ]
    const { sources: arranged } = arrangeSources('Квесты в Минске до часа', sources)
    expect(ids(arranged)).toEqual(['q1', 'q2'])
    expect(isArranged(arranged)).toBe(false)
    expect(arranged.every((source) => source.why === undefined)).toBe(true)
    // Остались бы одни статьи на вопрос о квестах — квесты не убираются и идут первыми.
    const withArticle = [travel({ id: 3, title: 'Минск за один день', country: 'Беларусь', facts: { number_days: 1 } }), ...sources]
    const mixed = arrangeSources('Квесты в Минске до часа', withArticle).sources
    expect(ids(mixed)).toEqual(['q1', 'q2', 't3'])
    expect(isArranged(mixed)).toBe(false)
    expect(mixed.every((source) => source.why === undefined)).toBe(true)
    // Квест без длительности в каталоге условий не нарушает: длинные квесты уходят в nearby.
    const unknown = quest({ id: 4, title: 'Без длительности', city: 'Минск', country: 'Беларусь', facts: { points: 7 } })
    const withUnknown = arrangeSources('Квесты в Минске до часа', [...withArticle, unknown]).sources
    expect(groupOf(withUnknown, 'match')).toEqual(['q4', 't3'])
    expect(groupOf(withUnknown, 'nearby')).toEqual(['q1', 'q2'])
  })

  it('превосходная степень — после места и условий: «самый короткий детский квест в Минске»', () => {
    const found = [
      travel({ id: 1, title: 'Минск за выходные', country: 'Беларусь' }),
      quest({ id: 2, title: 'Квест Минска', city: 'Минск', country: 'Беларусь', facts: { duration_min: 40 } }),
      quest({ id: 3, title: 'Детский долгий', city: 'Минск', country: 'Беларусь', facts: { duration_min: 120, audience: 'kids' } }),
      quest({ id: 4, title: 'Детский Бреста', city: 'Брест', country: 'Беларусь', facts: { duration_min: 30, audience: 'kids' } }),
    ]
    // Самого короткого детского квеста города в подборе нет — он приходит из каталога.
    const pool = [...found.filter((source) => source.type === 'quest'), quest({ id: 5, title: 'Детский короткий', city: 'Минск', country: 'Беларусь', facts: { duration_min: 60, audience: 'kids' } })]
    const { sources: arranged } = arrangeSources('Самый короткий детский квест в Минске', found, { pool: () => pool })
    // Место: Минск; условия: детские; степень: по длительности. Короткий недетский и детский Бреста первыми не встают.
    expect(ids(arranged)).toEqual(['q5', 'q3', 'q2', 't1', 'q4'])
    // В подсказку идут только карточки-ответы: остальной подбор — «рядом» (живая модель при восьми
    // карточках называла статью, стоявшую последней).
    expect(groupOf(arranged, 'match')).toEqual(['q5', 'q3'])
    expect(groupOf(arranged, 'nearby')).toEqual(['q2', 't1', 'q4'])
    expect(ids(selectPromptSources(arranged, 8, null, true))).toEqual(['q5', 'q3'])
    expect(arranged[0].why).toBe('детский')
    // Без каталога (экран) кандидаты — найденные карточки места.
    expect(ids(arrangeSources('Самый короткий детский квест в Минске', found).sources)).toEqual(['q3', 'q2', 't1', 'q4'])
    // Без условий — прежнее правило #3287: самые короткие квесты города; их не больше трёх, статья города — «рядом».
    const shortest = arrangeSources('Самый короткий квест в Минске', found, { pool: () => pool }).sources
    expect(groupOf(shortest, 'match')).toEqual(['q2', 'q5', 'q3'])
    expect(groupOf(shortest, 'nearby')).toEqual(['t1', 'q4'])
    // С закреплённой страницей — только порядок, без групп.
    const plain = arrangeSources('Самый короткий квест в Минске', found, { pool: () => pool, groups: false }).sources
    expect(ids(plain)).toEqual(['q2', 'q5', 'q3', 't1', 'q4'])
    expect(isArranged(plain)).toBe(false)
    // Подбор не нашёл ни одной карточки города, а в каталоге его квесты есть: строки «материала о месте нет» быть не должно.
    const elsewhere = [quest({ id: 9, title: 'Квест по Бресту', city: 'Брест', country: 'Беларусь', facts: { duration_min: 30 } })]
    const fromPool = arrangeSources('Самый короткий квест в Минске', elsewhere, { pool: () => pool })
    expect(fromPool.noPlace).toBe(false)
    expect(groupOf(fromPool.sources, 'match')).toEqual(['q2', 'q5', 'q3'])
    expect(arrangeSources('Самый короткий квест в Минске', elsewhere).noPlace).toBe(true)
  })

  it('место названо, но в карточках его нет — признак noPlace; условие никого не поднимает', () => {
    const sources = [
      travel({ id: 1, title: 'Польша на машине', country: 'Польша', facts: { transports: ['Машина'] } }),
      travel({ id: 2, title: 'Люксембург на автобусе', country: 'Люксембург', facts: { transports: ['Автобус'] } }),
    ]
    const iceland = arrangeSources('Куда поехать в Исландии без машины?', sources)
    expect(iceland.noPlace).toBe(true)
    expect(ids(iceland.sources)).toEqual(['t1', 't2'])
    expect(iceland.sources.every((source) => source.why === undefined)).toBe(true)
    // Место не названо — условие работает как обычно.
    const anywhere = arrangeSources('Куда поехать без машины?', sources)
    expect(anywhere.noPlace).toBe(false)
    expect(ids(anywhere.sources)).toEqual(['t2', 't1'])
    expect(anywhere.sources[0].why).toBe('без машины: автобус')
    // Праздник и предлог темы местом не считаются.
    expect(arrangeSources('Куда поехать в Рождество?', sources).noPlace).toBe(false)
    expect(arrangeSources('Что почитать на Новый год?', sources).noPlace).toBe(false)
    // Служба смотрит весь текст источника: упоминание вне фрагмента карточки снимает признак.
    expect(arrangeSources('Куда поехать в Исландии?', sources, { mentions: (source) => source.source_id === '1' }).noPlace).toBe(false)
  })
})

describe('цепочка порядка карточек: город, которого подбор не нашёл (#3277)', () => {
  // lv21 прогона живых вопросов 12.11.2026: «да Нясвіжа» при русских текстах о Несвиже — в подборе маршруты из
  // Минска и квест Заславля, ни одной карточки Несвижа; модель назвала «Маршруты выходного дня из Минска».
  const found = [
    travel({ id: 672, title: 'Маршруты выходного дня из Минска: 13 поездок', country: 'Беларусь', facts: { categories: WEEKEND } }),
    quest({ id: 232, title: 'Квэст па Заслаўі: Рагнеда, Ізяслаў і горад, пабудаваны для выгнанніцы', city: 'Заслаўе', country: 'Беларусь', facts: { points: 9, duration_min: 120 } }),
    travel({ id: 635, title: 'Замки и усадьбы Беларуси: 19 маршрутов из Минска', country: 'Беларусь', snippet: 'Беларусь. Несвижский замок Радзивиллов и Мирский замок за один день', facts: { categories: WEEKEND } }),
    travel({ id: 646, title: 'Минск за выходные: путеводитель по столице Беларуси', country: 'Беларусь', facts: { number_days: 2 } }),
  ]
  const nesvizh = { ...quest({ id: 90, title: 'Квэст па Нясвіжы: скарб Радзівілаў', city: 'Нясвіж', country: 'Беларусь', facts: { points: 9, duration_min: 90 } }), place: { cities: ['Нясвіж', 'Несвиж', 'Nieśwież', 'Nesvizh'], countries: ['Беларусь'] } }
  const minsk = { ...quest({ id: 4, title: 'Квэст па цэнтры Мінска', city: 'Мінск', country: 'Беларусь', facts: { points: 10, duration_min: 45 } }), place: { cities: ['Мінск', 'Минск', 'Mińsk', 'Minsk'], countries: ['Беларусь'] } }
  const pool = () => [minsk, nesvizh]
  const question = 'Як даехаць з Мінска да Нясвіжа без машыны і што там паглядзець за дзень?'

  it('lv21: квест Несвижа из каталога встаёт первым, из найденного остаётся карточка, которая город упоминает', () => {
    const arranged = arrangeSources(question, found, { pool })
    expect(groupOf(arranged.sources, 'match')).toEqual(['q90', 't635'])
    expect(groupOf(arranged.sources, 'nearby').sort()).toEqual(['q232', 't646', 't672'])
    expect(arranged.noPlace).toBe(false)
    expect(ids(selectPromptSources(arranged.sources, 8, null, true))).toEqual(['q90', 't635'])
    // Служба смотрит весь текст источника: карточка, упоминающая город дальше фрагмента, тоже остаётся.
    const mentions = (source: AiSource, places: readonly string[]) => source.source_id === '672' && places.includes('Несвиж')
    expect(groupOf(arrangeSources(question, found, { pool, mentions }).sources, 'match')).toEqual(['q90', 't672', 't635'])
    // Без каталога (экран) подбор прежний: место не узнано, квест Несвижа взять неоткуда.
    const screen = arrangeSources(question, found).sources
    expect(ids(screen)).not.toContain('q90')
    expect(ids(screen).sort()).toEqual(ids(found).sort())
  })

  it('lv23 (регресс замера r1): «километров на сорок-пятьдесят» — квест Сорок из каталога в подсказку не идёт, подбор остаётся целым', () => {
    const question = 'Посоветуй веломаршрут на день недалеко от Минска, километров на сорок-пятьдесят.'
    const bikes = [1, 2, 3, 4, 5, 6, 7].map((id) => travel({ id, title: `Веломаршрут из Минска №${id}`, country: 'Беларусь', facts: { number_days: 1 } }))
    const soroki = { ...quest({ id: 148, title: 'Квест по Сорокам: круглая крепость и цыганская гора', city: 'Сороки', country: 'Молдова', facts: { points: 10, duration_min: 180 } }), place: { cities: ['Сороки', 'Soroki', 'Soroca'], countries: ['Молдова'] } }
    const arranged = arrangeSources(question, bikes, { pool: () => [soroki, minsk] })
    expect(ids(arranged.sources)).not.toContain('q148')
    expect(ids(withoutNearby(arranged.sources))).toEqual(ids(bikes))
    expect(ids(selectPromptSources(arranged.sources, 8, null, true))).toHaveLength(7)
    // «Недалеко от Минска» — место отправления: квесты Минска из каталога в подсказку не добавляются.
    expect(ids(arranged.sources)).not.toContain('q4')
    // То же семейство: «Квест на сорок минут».
    expect(ids(arrangeSources('Квест на сорок минут', bikes, { pool: () => [soroki, minsk] }).sources)).not.toContain('q148')
    // Город каталога со строчной буквы после предлога из каталога не добирается (названий сотни) — только с заглавной.
    expect(ids(arrangeSources('что есть в сороках?', bikes, { pool: () => [soroki] }).sources)).not.toContain('q148')
    expect(ids(arrangeSources('Что есть в Сороках?', bikes, { pool: () => [soroki] }).sources)[0]).toBe('q148')
  })

  it('город найден подбором — каталог не нужен; город отправления без назначения в каталоге — тоже', () => {
    let calls = 0
    const counted = () => {
      calls += 1
      return pool()
    }
    // Квест Несвижа уже среди найденного: место берётся из подбора.
    const arranged = arrangeSources(question, [...found, nesvizh], { pool: counted })
    expect(groupOf(arranged.sources, 'match')).toEqual(['t635', 'q90'])
    expect(calls).toBe(0)
    // Места в вопросе нет — из каталога ничего не добавляется.
    const plain = arrangeSources('Куды паехаць на выхадныя без машыны?', found, { pool: counted })
    expect(ids(plain.sources).sort()).toEqual(ids(found).sort())
    // Назван только город каталога — его квесты; не больше трёх.
    const many = () => [minsk, ...[5, 6, 7, 8].map((id) => ({ ...minsk, source_id: String(id), url: `https://metravel.by/quests/${id}` })), nesvizh]
    const onlyTravels = found.filter((source) => source.type === 'travel').map((source) => ({ ...source, title: source.title.replace(/Минск\p{L}*/gu, 'столицы'), snippet: '' }))
    const fromMinsk = arrangeSources('Якія квэсты ёсць у Мінску?', onlyTravels, { pool: many })
    expect(groupOf(fromMinsk.sources, 'match')).toEqual(['q4', 'q5', 'q6'])
  })

  it('подбор нашёл только город отправления: «з Мінска да Нясвіжа» с квестом Минска среди найденного — место назначения из каталога', () => {
    // Смысловой подбор на «з Мінска …» почти всегда приносит квесты Минска: без этого правила отбор по месту
    // держался за них, и в подсказку уходил город отправления (#3277).
    const arranged = arrangeSources(question, [...found, minsk], { pool })
    expect(groupOf(arranged.sources, 'match')).toEqual(['q90', 't635'])
    expect(groupOf(arranged.sources, 'nearby')).toContain('q4')
    // Места назначения в каталоге нет — город отправления остаётся местом вопроса, как раньше.
    const weekend = (options = {}) => arrangeSources('Якія квэсты ёсць, калі ехаць з Мінска?', [...found, minsk], options).sources
    expect(weekend({ pool })).toEqual(weekend())
  })
})

describe('цепочка порядка карточек (#3289): случаи пробы 11.11.2026', () => {
  it('p05 «с собакой недалеко от Варшавы»: детский квест на вопрос без детей в подсказку не идёт; с детьми — первым', () => {
    for (const question of ['Где погулять с собакой недалеко от Варшавы?', 'Куда сходить с собакой в Варшаве?', 'Gdzie na spacer z psem w Warszawie?']) {
      // PL-вопрос называет город латиницей — у квеста в каталоге есть и это написание.
      const cards = P05.map((card) => (card.type === 'quest' ? { ...card, place: { cities: ['Варшава', 'Warszawa'], countries: ['Польша'] } } : card))
      const { sources } = arrangeSources(question, cards)
      expect(sources.find((source) => source.source_id === '129')).toMatchObject({ group: 'nearby' })
      expect(sources.find((source) => source.source_id === '129')?.why).toBeUndefined()
      expect(groupOf(sources, 'nearby')).toEqual(expect.arrayContaining(['q129', 't634', 't568', 't459']))
    }
    const ru = arrangeSources('Где погулять с собакой недалеко от Варшавы?', P05).sources
    expect(groupOf(ru, 'match')).toEqual(['t502'])
    // Кроме детского квеста о Варшаве ничего нет — подсказка пуста: модель честно скажет «подходящего нет».
    const only = arrangeSources('Где погулять с собакой недалеко от Варшавы?', P05.filter((card) => card.source_id !== '502')).sources
    expect(groupOf(only, 'match')).toEqual([])
    expect(ids(selectPromptSources(only, 8, null, true))).toEqual([])
    expect(groupOf(only, 'nearby')).toEqual(['q129', 't634', 't568', 't459'])
    // В вопросе есть дети — тот же квест подходит и встаёт первым.
    const withKids = arrangeSources('Где погулять с собакой и детьми в Варшаве?', P05).sources
    expect(withKids[0]).toMatchObject({ source_id: '129', group: 'match', why: 'детский, можно с собакой' })
    // Вопрос без личных условий детский квест показывает, как раньше.
    expect(groupOf(arrangeSources('Какие квесты есть в Варшаве?', P05).sources, 'match')).toEqual(['q129', 't502'])
  })

  it('p08 «в Татрах для новичков без машины»: лёгкая тропа встаёт первой среди карточек Татр, маршрут по Люксембургу не поднимается', () => {
    const { sources, noPlace } = arrangeSources('Посоветуй маршрут в Татрах для новичков без машины', P08)
    expect(noPlace).toBe(false)
    // По условиям переставляются только карточки, упоминающие Татры (600, 553, 362): лёгкая тропа — первая из них.
    expect(ids(sources)).toEqual(['t553', 't451', 't600', 't761', 't362'])
    expect(sources[0].why).toBe('лёгкий маршрут')
    expect(sources.find((source) => source.source_id === '761')?.why).toBeUndefined()
    // Условие выделило одну карточку — в подсказке она и две первые по порядку; по названию и фрагменту
    // карточки место не отбирает, поэтому добор идёт по порядку подбора.
    expect(groupOf(sources, 'match')).toEqual(['t553', 't451', 't600'])
    expect(groupOf(sources, 'nearby')).toEqual(['t761', 't362'])
    expect(isArranged(arrangeSources('Посоветуй маршрут в Татрах для новичков без машины', P08, { focus: false }).sources)).toBe(false)
    const plain = arrangeSources('Куда сходить в Татрах без машины?', P08).sources
    expect(ids(plain)).toEqual(ids(P08))
    // Служба сверяет место по всему тексту источника — тогда не упоминающие его карточки уходят в nearby.
    const inText = new Set(['600', '451', '553', '362'])
    const service = arrangeSources('Посоветуй маршрут в Татрах для новичков без машины', P08, { mentions: (source) => inText.has(source.source_id) }).sources
    expect(groupOf(service, 'match')).toEqual(['t553', 't600', 't451'])
    expect(groupOf(service, 'nearby')).toEqual(['t362', 't761'])
    const unfocused = arrangeSources('Посоветуй маршрут в Татрах для новичков без машины', P08, { mentions: (source) => inText.has(source.source_id), focus: false }).sources
    expect(groupOf(unfocused, 'match')).toEqual(['t553', 't600', 't451', 't362'])
    expect(groupOf(unfocused, 'nearby')).toEqual(['t761'])
    // Ни один источник место не упоминает — отбирать нечем: все карточки остаются, подсказка получает строку о месте.
    const nowhere = arrangeSources('Посоветуй маршрут в Татрах для новичков без машины', P08, { mentions: () => false })
    expect(nowhere.noPlace).toBe(true)
    expect(ids(nowhere.sources)).toEqual(ids(P08))
  })

  it('p09 «зимой в Беларуси на один день»: поездка на 14 дней по четырём странам убрана, подборки выходного дня — первыми', () => {
    for (const question of ['Куда поехать зимой в Беларуси на один день?', 'Куда съездить по Беларуси в январе одним днём?', 'Куды паехаць па Беларусі ўзімку на адзін дзень?']) {
      const { sources } = arrangeSources(question, P09)
      expect(ids(withoutNearby(sources)).slice(0, 2)).toEqual(['t672', 't635'])
      expect(groupOf(sources, 'nearby')).toEqual(expect.arrayContaining(['t155', 't594']))
      expect(sources[0].why).toBe('тур выходного дня')
    }
    // Мартовская однодневная поездка под «зимой» не убирается: месяц — не число.
    expect(groupOf(arrangeSources('Куда поехать зимой в Беларуси на один день?', P09).sources, 'match')).toEqual(['t672', 't635', 't135', 't566', 't187'])
  })

  it('p13 «з дітьми на вихідні у Польщі»: поездки на 3–7 дней убраны, Energylandia — первой', () => {
    for (const question of ['Куди поїхати з дітьми на вихідні у Польщі?', 'Куда поехать с детьми на выходные в Польше?', 'Where to go in Poland with kids for the weekend?']) {
      const cards = P13.map((card) => ({ ...card, place: { countries: [...(card.place?.countries ?? []), 'Poland', 'Польща'] } }))
      const { sources } = arrangeSources(question, cards)
      expect(sources[0]).toMatchObject({ source_id: '386', group: 'match', why: '1 день' })
      // Условие «на выходные» выделило две однодневные поездки — в подсказке они и первая по порядку из остальных.
      expect(groupOf(sources, 'match')).toEqual(['t386', 't263', 't816'])
      expect(groupOf(sources, 'nearby')).toEqual(['t637', 't178', 't177', 't421', 't438'])
    }
  })

  it('p15 «замки Беларуси за выходные»: подборка «19 маршрутов из Минска» остаётся среди первых, чужая страна — в nearby', () => {
    for (const question of ['Какие замки Беларуси можно объехать за выходные?', 'Замки в Беларуси на выходные', 'Якія замкі Беларусі можна аб’ехаць за выхадныя?']) {
      const { sources } = arrangeSources(question, P15)
      expect(ids(withoutNearby(sources))).toEqual(['t635', 't566', 't196', 't339', 't682'])
      expect(groupOf(sources, 'nearby')).toEqual(['t421'])
      expect(sources[0].why).toBe('тур выходного дня')
    }
  })
})
