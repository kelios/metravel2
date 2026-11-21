import { judgeCard, parseConditions } from '@/api/aiAssist/questionConditions'
import type { QuestFacts, TravelFacts } from '@/api/aiAssist/sourceFacts'

const quest = (facts: Partial<QuestFacts> = {}) => ({ type: 'quest' as const, facts: { type: 'quest' as const, source_id: 1, ...facts } })
const travel = (facts: Partial<TravelFacts> = {}) => ({ type: 'travel' as const, facts: { type: 'travel' as const, source_id: 1, ...facts } })

describe('условия вопроса (#3289): разбор на пяти языках', () => {
  it.each([
    ['Где погулять с собакой недалеко от Варшавы?', { dog: true }],
    ['З сабакам па Гродне ўвосень', { dog: true, months: [9, 10, 11] }],
    ['Куди піти з собакою у Львові взимку?', { dog: true, months: [1, 2, 12] }],
    ['Quest w Krakowie z psem do 90 minut', { dog: true, maxMinutes: 90, kind: 'quest' }],
    ['Dog-friendly walks near Vilnius in summer', { dog: true, months: [6, 7, 8] }],
  ])('с собакой: %s', (question, expected) => {
    expect(parseConditions(question)).toEqual(expected)
  })

  it.each([
    ['Посоветуй маршрут в Татрах для новичков без машины', { noCar: true, kind: 'travel', easy: true }],
    ['Куды паехаць без машыны на выхадныя?', { noCar: true, maxDays: 2 }],
    ['Куди поїхати громадським транспортом у травні?', { noCar: true, months: [5] }],
    ['Dokąd pojechać pociągiem w lutym?', { noCar: true, months: [2] }],
    ['Where to go without a car for a day?', { noCar: true, maxDays: 1 }],
  ])('без машины: %s', (question, expected) => {
    expect(parseConditions(question)).toEqual(expected)
  })

  it.each([
    ['Куда поехать зимой в Беларуси на один день?', { months: [1, 2, 12], maxDays: 1 }],
    ['Што паглядзець у Полацку за адзін дзень?', { maxDays: 1 }],
    ['Куди поїхати з дітьми на вихідні у Польщі?', { children: { ages: [] }, maxDays: 2 }],
    ['Какие замки Беларуси можно объехать за выходные?', { maxDays: 2 }],
    ['Co zobaczyć w Gdańsku w weekend z dziećmi?', { children: { ages: [] }, maxDays: 2 }],
    ['Is there anything to do in Brest with kids for half a day?', { children: { ages: [] }, maxMinutes: 300 }],
    ['Летом на неделю в Польшу', { months: [6, 7, 8], maxDays: 7 }],
    ['Куда поехать в мае на 3 дня?', { months: [5], maxDays: 3 }],
  ])('сезон, месяц и длительность: %s', (question, expected) => {
    expect(parseConditions(question)).toEqual(expected)
  })

  it.each([
    ['Квест в Минске для ребёнка девяти лет на час', { children: { ages: [9] }, maxMinutes: 75, kind: 'quest' }],
    ['Квесты в Минске до часа', { maxMinutes: 60, kind: 'quest' }],
    ['Квест не больше часа', { maxMinutes: 60, kind: 'quest' }],
    ['Квест часа на два', { maxMinutes: 150, kind: 'quest' }],
    ['A quest for a nine-year-old in Vilnius, up to 2 hours', { children: { ages: [9] }, maxMinutes: 120, kind: 'quest' }],
    ['Mamy 9-letnie dziecko, quest na godzinę', { children: { ages: [9] }, maxMinutes: 75, kind: 'quest' }],
    ['Дітям 6 і 10 років, квест на пів години', { children: { ages: [6, 10] }, maxMinutes: 38, kind: 'quest' }],
  ])('возраст и время в часах: %s', (question, expected) => {
    expect(parseConditions(question)).toEqual(expected)
  })

  it.each([
    ['Несложная тропа в Татрах для начинающих', { easy: true }],
    ['Лёгкі маршрут для пачаткоўцаў каля Мінска', { easy: true, kind: 'travel' }],
    ['Легка стежка для початківців у Карпатах', { easy: true }],
    ['Łatwy szlak dla początkujących w Tatrach', { easy: true }],
    ['Is there an easy hike in the Tatras for beginners?', { easy: true, route: 'foot' }],
  ])('лёгкий маршрут: %s', (question, expected) => {
    expect(parseConditions(question)).toEqual(expected)
  })

  it('похожие слова условием не становятся', () => {
    // «лет» — годы, а не лето; «Октябрьская» — площадь; BE «мая» — «моя», UK «маю» — «имею».
    expect(parseConditions('Городу 950 лет, что посмотреть в Полоцке?')).toEqual({})
    expect(parseConditions('Октябрьская площадь в Минске')).toEqual({})
    expect(parseConditions("мая сям'я хоча ў Гродна")).toEqual({})
    expect(parseConditions('Августовский канал: как добраться из Гродно?')).toEqual({})
    // Вопрос о длительности — не условие.
    expect(parseConditions('Сколько часов длится прогулка по Гродно?')).toEqual({})
    expect(parseConditions('Сколько дней занимает поездка?')).toEqual({})
    // «9-летний» — возраст, а не лето.
    expect(parseConditions('Куда сходить с 9-летним сыном?').months).toBeUndefined()
    expect(parseConditions('Что посмотреть в Несвиже?')).toEqual({})
    expect(parseConditions('')).toEqual({})
    expect(parseConditions(null)).toEqual({})
  })

  it('запрос подбора с опорой уточнения читается целиком', () => {
    expect(parseConditions('Квесты в Минске на час А с собакой?')).toEqual({ dog: true, maxMinutes: 75, kind: 'quest' })
  })
})

describe('условия вопроса (#3289): проверка по фактам карточки', () => {
  it('неизвестно ≠ нарушено: карточка без нужного факта не совпала, не опущена и не убрана', () => {
    const everything = parseConditions('Квест с собакой для ребёнка 9 лет на час зимой без машины')
    expect(everything).toEqual({ children: { ages: [9] }, dog: true, noCar: true, months: [1, 2, 12], maxMinutes: 75, kind: 'quest' })
    // Запись фактов пустая либо её нет вовсе: условия не проверить.
    expect(judgeCard({ ...everything, kind: undefined }, quest())).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ ...everything, kind: undefined }, travel())).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ ...everything, kind: undefined }, { type: 'travel', facts: null })).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ ...everything, kind: undefined }, { type: 'quest' })).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    // Квест без пометки аудитории на вопрос о детях — не «не детский»: каталог этого не говорит.
    expect(judgeCard({ children: { ages: [9] } }, quest({ duration_min: 90, pet_friendly: true }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    // Статья с одним днём на вопрос «до часа»: часы по числу дней не сверить.
    expect(judgeCard({ maxMinutes: 60 }, travel({ number_days: 1 }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    // Месяцы и транспорт сверяются только там, где записаны.
    expect(judgeCard({ months: [1], noCar: true }, travel({ number_days: 2 }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
  })

  it('числовое условие нарушено явно — карточка убирается', () => {
    expect(judgeCard({ maxMinutes: 60 }, quest({ duration_min: 75 })).dropped).toBe(true)
    expect(judgeCard({ maxDays: 1 }, travel({ number_days: 14 })).dropped).toBe(true)
    expect(judgeCard({ maxDays: 2 }, travel({ number_days: 3 })).dropped).toBe(true)
    // «На полдня» — заведомо не многодневная поездка.
    expect(judgeCard({ maxMinutes: 300 }, travel({ number_days: 4 })).dropped).toBe(true)
    // Возраст вне диапазона квеста.
    expect(judgeCard({ children: { ages: [5] } }, quest({ audience: 'kids', age: [8, 10] })).dropped).toBe(true)
    // Один из двух детей подходит по возрасту — не убирается, но и возраст не совпал.
    expect(judgeCard({ children: { ages: [6, 9] } }, quest({ audience: 'kids', age: [8, 10] }))).toEqual({ reasons: ['детский'], score: 1, dropped: false, unfit: false })
  })

  it('нарушение без числа опускает карточку, но не убирает', () => {
    expect(judgeCard({ dog: true }, quest({ pet_friendly: false }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    expect(judgeCard({ months: [1, 2, 12] }, travel({ months: [5] }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    expect(judgeCard({ noCar: true }, travel({ transports: ['Машина'] }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    // Машина и велосипед — без машины не подтверждено, но и не «только на машине».
    expect(judgeCard({ noCar: true }, travel({ transports: ['Машина', 'Велосипед'] }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ kind: 'quest' }, travel({ number_days: 1 }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
  })

  it('совпавшее условие — балл и слова для строки «почему подходит»', () => {
    const asked = parseConditions('Квест с собакой для ребёнка девяти лет на час')
    expect(judgeCard(asked, quest({ audience: 'kids', age: [8, 10], duration_min: 75, pet_friendly: true }))).toEqual({
      reasons: ['детский', '8–10 лет', 'можно с собакой', '75 мин'],
      score: 5,
      dropped: false,
      unfit: false,
    })
    // Семейный квест весит меньше детского — как места `childrenRank` (#3276).
    expect(judgeCard({ children: { ages: [] } }, quest({ audience: 'family' }))).toEqual({ reasons: ['семейный'], score: 0.5, dropped: false, unfit: false })
    expect(judgeCard({ months: [1, 2, 12], maxDays: 1 }, travel({ number_days: 1, months: [1, 2, 7] }))).toEqual({
      reasons: ['месяцы: январь, февраль', '1 день'],
      score: 2,
      dropped: false,
      unfit: false,
    })
    expect(judgeCard({ months: [3] }, travel({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })).reasons).toEqual(['круглый год'])
    expect(judgeCard({ noCar: true }, travel({ transports: ['Автобус', 'Поезд', 'Машина'] })).reasons).toEqual(['без машины: автобус, поезд'])
    expect(judgeCard({ maxDays: 7 }, travel({ number_days: 5 })).reasons).toEqual(['5 дней'])
    expect(judgeCard({ maxDays: 3 }, travel({ number_days: 2 })).reasons).toEqual(['2 дня'])
    // Квест «на один день» укладывается в день; «на выходные» — не совпал и не нарушил.
    expect(judgeCard({ maxDays: 1 }, quest({ duration_min: 90 })).reasons).toEqual(['90 мин'])
    expect(judgeCard({ maxDays: 2 }, quest({ duration_min: 90 }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
  })

  it('подборка без числа дней подходит «на выходные» по категории каталога «Тур выходного дня»', () => {
    const roundup = travel({ categories: ['Самостоятельное путешествие', 'Тур выходного дня'] })
    expect(judgeCard({ maxDays: 2 }, roundup)).toEqual({ reasons: ['тур выходного дня'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ maxDays: 1 }, roundup).score).toBe(1)
    // На три дня и больше категория ничего не подтверждает.
    expect(judgeCard({ maxDays: 3 }, roundup)).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ maxDays: 2 }, travel({ categories: ['Поход'] }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
  })

  it('лёгкий маршрут: у квеста — факт сложности, у статьи — её собственные слова; без признака условие не совпало и не нарушено', () => {
    expect(judgeCard({ easy: true }, quest({ difficulty: 'easy' }))).toEqual({ reasons: ['лёгкий'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ easy: true }, quest({ difficulty: 'hard' }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    expect(judgeCard({ easy: true }, quest({ points: 9 }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    const trail = { ...travel({ number_days: 1 }), title: 'Закопане: лёгкая тропа Ścieżka nad Reglami', snippet: 'Польша, Groń. Дней: 1' }
    expect(judgeCard({ easy: true }, trail)).toEqual({ reasons: ['лёгкий маршрут'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ easy: true }, { ...travel(), title: 'Рысы со словацкой стороны', snippet: 'Сложность: лёгкая-средняя, перепады высот умеренные' }).reasons).toEqual(['лёгкий маршрут'])
    // Слова «легко» и «лёгкий» вне сочетания с маршрутом признаком не считаются; статья без признака — неизвестно.
    expect(judgeCard({ easy: true }, { ...travel(), title: 'Рысы: маршрут от Попрадского плеса', snippet: 'С лёгким рюкзаком идти легко' })).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
  })

  it('детский квест на вопрос с личным условием без детей — карточка другой аудитории; с детьми и без условий остаётся', () => {
    const kids = quest({ audience: 'kids', age: [8, 10], duration_min: 75, pet_friendly: true })
    for (const question of ['Где погулять с собакой недалеко от Варшавы?', 'Квест в Варшаве на час', 'Куда сходить в Варшаве зимой?', 'Лёгкий квест для новичков в Варшаве', 'Квест в Варшаве без машины']) {
      expect({ question, verdict: judgeCard(parseConditions(question), kids) }).toEqual({ question, verdict: { reasons: [], score: -1, dropped: true, unfit: true } })
    }
    // Дети названы — детский квест подходит; вопрос без личных условий детские квесты показывает как раньше.
    expect(judgeCard(parseConditions('Где погулять с собакой и детьми в Варшаве?'), kids)).toMatchObject({ reasons: ['детский', 'можно с собакой'], unfit: false, dropped: false })
    expect(judgeCard(parseConditions('Какие квесты есть в Варшаве?'), kids)).toEqual({ reasons: [], score: 1, dropped: false, unfit: false })
    expect(judgeCard(parseConditions('Самый короткий квест в Варшаве'), kids).unfit).toBe(false)
    // Семейный квест — не «только для детей»: остаётся.
    expect(judgeCard(parseConditions('Где погулять с собакой в Варшаве?'), quest({ audience: 'family', pet_friendly: true }))).toMatchObject({ reasons: ['можно с собакой'], unfit: false })
  })
})

// #3353: условие «длина маршрута» и вид маршрута. Пример владельца — «пеший маршрут не более 100 километров в ноябре».
describe('условия вопроса (#3353): длина маршрута и вид маршрута на пяти языках', () => {
  it.each([
    // Строгая верхняя граница: «не более», «до», «не длиннее», «короче».
    ['Пеший маршрут не более 100 километров в ноябре', { months: [11], kind: 'travel', maxKm: 100, route: 'foot' }],
    ['Пеший маршрут не более 20 км в Беларуси', { kind: 'travel', maxKm: 20, route: 'foot' }],
    ['поход до двадцати километров', { maxKm: 20, route: 'foot' }],
    ['Маршрут не длиннее ста километров', { kind: 'travel', maxKm: 100 }],
    ['Веломаршрут короче 30 км', { maxKm: 30, route: 'bike' }],
    ['Паход да пяцідзесяці кіламетраў', { maxKm: 50, route: 'foot' }],
    ['Похід до тридцяти кілометрів у Карпатах', { maxKm: 30, route: 'foot' }],
    ['Szlak pieszy do 30 km', { maxKm: 30, route: 'foot' }],
    ['A hike of no more than 15 km', { maxKm: 15, route: 'foot' }],
    // Примерная длина — с запасом 25 %, как у длительности.
    ['Поход около 50 км', { maxKm: 62.5, route: 'foot' }],
    ['a 100 km hike', { maxKm: 125, route: 'foot' }],
    ['20-километровый поход', { maxKm: 25, route: 'foot' }],
    ['Wędrówka na pięćdziesiąt kilometrów', { maxKm: 62.5, route: 'foot' }],
    ['поход на двадцать пять километров', { maxKm: 31.3, route: 'foot' }],
    // Диапазон и нижняя граница.
    ['Маршрут на велосипеде от 30 до 50 км', { kind: 'travel', maxKm: 50, minKm: 30, route: 'bike' }],
    ['Поход 10-15 км на день', { maxDays: 1, maxKm: 15, minKm: 10, route: 'foot' }],
    ['Хочу поход не короче 15 км', { minKm: 15, route: 'foot' }],
    ['Trasa piesza co najmniej 10 km', { kind: 'travel', minKm: 10, route: 'foot' }],
    ['hike longer than 20 km', { minKm: 20, route: 'foot' }],
  ])('длина: %s', (question, expected) => {
    expect(parseConditions(question)).toEqual(expected)
  })

  it('расстояние от места — не длина маршрута; вопрос без километров условия длины не несёт', () => {
    expect(parseConditions('Что посмотреть в 30 км от Минска?')).toEqual({})
    // #3416 п.2: место со строчной буквы — тоже расстояние, а не длина маршрута; ориентир — длина.
    expect(parseConditions('что посмотреть 50 км от минска')).toEqual({})
    expect(parseConditions('што паглядзець 50 км ад мінска')).toEqual({})
    expect(parseConditions('куди поїхати 40 км від львова')).toEqual({})
    expect(parseConditions('co zobaczyć 30 km od krakowa')).toEqual({})
    expect(parseConditions('what to see 30 km from krakow')).toEqual({})
    expect(parseConditions('маршрут 20 км от вокзала')).toEqual({ kind: 'travel', maxKm: 25 })
    expect(parseConditions('маршрут 20 км ад вакзала')).toEqual({ kind: 'travel', maxKm: 25 })
    expect(parseConditions('маршрут 20 км від зупинки')).toEqual({ kind: 'travel', maxKm: 25 })
    expect(parseConditions('trasa 20 km od dworca')).toEqual({ kind: 'travel', maxKm: 25 })
    expect(parseConditions('a 20 km hike from the station')).toEqual({ maxKm: 25, route: 'foot' })
    expect(parseConditions('поход 20 км от озера до деревни')).toEqual({ maxKm: 25, route: 'foot' })
    expect(parseConditions('Is there a hike within 20 km from Krakow?')).toEqual({ route: 'foot' })
    expect(parseConditions('Is there a hike within 30 km of Krakow?')).toEqual({ route: 'foot' })
    expect(parseConditions('Квест за 20 км від Львова')).toEqual({ kind: 'quest' })
    expect(parseConditions('Какие квесты есть в Гродно?')).toEqual({ kind: 'quest' })
    // «Сто» внутри слова числом не становится.
    expect(parseConditions('Сколько стоит квест и где километры считать?')).not.toHaveProperty('maxKm')
  })

  it('вид маршрута: пеший и вело; оба слова сразу вид не называют; похожие слова — не вид', () => {
    for (const question of ['Куда сходить пешком под Минском?', 'Хайкинг в Татрах', 'Піший маршрут у Карпатах', 'Pieszo wokół jeziora', 'Easy hiking near Zakopane', 'Вандроўка пешшу'])
      expect(parseConditions(question).route).toBe('foot')
    for (const question of ['Веломаршрут на день', 'Куда поехать на велосипеде?', 'Trasa rowerowa pod Krakowem', 'A bike ride near Vilnius', 'Куди поїхати на велосипеді?'])
      expect(parseConditions(question).route).toBe('bike')
    expect(parseConditions('Пешком или на велосипеде вокруг озера?').route).toBeUndefined()
    // «Походить по городу», «похоже» — не поход.
    expect(parseConditions('Где походить по магазинам в Минске?').route).toBeUndefined()
    expect(parseConditions('Что похоже на Несвиж?').route).toBeUndefined()
  })
})

describe('условия вопроса (#3353): длина и вид маршрута против фактов статьи', () => {
  const hike = (extra: Partial<TravelFacts> = {}) => travel({ categories: ['Поход', 'Хайкинг'], transports: ['Машина'], ...extra })

  it('длина в пределах — совпало и названо в «почему подходит»; длиннее верхней или короче нижней границы — убрать', () => {
    expect(judgeCard({ maxKm: 20 }, hike({ distance_km: 9.6 }))).toEqual({ reasons: ['9,6 км'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ maxKm: 100 }, hike({ distance_km: 96.6 }))).toEqual({ reasons: ['97 км'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ maxKm: 100 }, hike({ distance_km: 112 })).dropped).toBe(true)
    expect(judgeCard({ maxKm: 100 }, hike({ distance_km: 186.3 })).dropped).toBe(true)
    // «Поход около 50 км»: 60 км допустим, 120 км — нет.
    const around = parseConditions('Поход около 50 км')
    expect(judgeCard(around, hike({ distance_km: 60 }))).toMatchObject({ dropped: false, reasons: ['пеший маршрут', '60 км'] })
    expect(judgeCard(around, hike({ distance_km: 120 })).dropped).toBe(true)
    // Нижняя граница и диапазон.
    expect(judgeCard({ minKm: 15 }, hike({ distance_km: 9.6 })).dropped).toBe(true)
    expect(judgeCard({ minKm: 10, maxKm: 15 }, hike({ distance_km: 12 }))).toMatchObject({ dropped: false, reasons: ['12 км'] })
  })

  it('неизвестно ≠ нарушено: статья без факта длины и квест условие длины не нарушают и не совпадают', () => {
    expect(judgeCard({ maxKm: 20 }, hike())).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ maxKm: 20 }, travel())).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ maxKm: 20, children: { ages: [] } }, quest({ duration_min: 90, audience: 'family' }))).toMatchObject({ dropped: false })
  })

  it('вид маршрута: по категориям и транспорту каталога; не тот вид опускает, но не убирает; каталог молчит — не нарушено', () => {
    expect(judgeCard({ route: 'foot' }, hike())).toEqual({ reasons: ['пеший маршрут'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ route: 'bike' }, travel({ categories: ['Веломаршрут'] }))).toEqual({ reasons: ['веломаршрут'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ route: 'bike' }, travel({ categories: ['Автопутешествие'], transports: ['Велосипед'] }))).toMatchObject({ reasons: ['веломаршрут'] })
    expect(judgeCard({ route: 'foot' }, travel({ categories: ['Веломаршрут'] }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    expect(judgeCard({ route: 'bike' }, hike())).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    // У маршрута другого вида длина не сверяется: не совпала и не нарушена.
    expect(judgeCard({ route: 'foot', maxKm: 20 }, travel({ categories: ['Веломаршрут'], distance_km: 15 }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    expect(judgeCard({ route: 'foot', maxKm: 20 }, travel({ categories: ['Веломаршрут'], distance_km: 48.7 }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    // Статья не о маршруте («Автопутешествие») и статья без категорий — не совпало и не нарушено.
    expect(judgeCard({ route: 'foot' }, travel({ categories: ['Автопутешествие'], transports: ['Машина'] }))).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    expect(judgeCard({ route: 'foot' }, travel())).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
  })

  // #3416 п.3: у квеста вид маршрута — по тегу каталога (запись фактов) либо по названию.
  it('вид маршрута квеста: велоквест и автоквест на вопрос о пешем маршруте опускаются, поход совпадает, прогулка по городу — не нарушено', () => {
    const foot = parseConditions('Szlak pieszy do 30 km w Polsce')
    expect(foot).toMatchObject({ route: 'foot', maxKm: 30 })
    // Тег каталога в записи фактов.
    expect(judgeCard(foot, quest({ route: 'bike' }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    expect(judgeCard(foot, quest({ route: 'car' }))).toEqual({ reasons: [], score: -1, dropped: false, unfit: false })
    expect(judgeCard(foot, quest({ route: 'foot' }))).toEqual({ reasons: ['пеший маршрут'], score: 1, dropped: false, unfit: false })
    expect(judgeCard({ route: 'bike' }, quest({ route: 'bike' }))).toEqual({ reasons: ['веломаршрут'], score: 1, dropped: false, unfit: false })
    // Запись фактов старого индекса вида не несёт — вид читается из названия карточки на пяти языках.
    for (const title of ['Велоквест из Барановичей', 'Велаквэст з Баранавічаў', 'Велоквест із Кракова', 'Quest rowerowy z Baranowicz', 'Bike quest from Krakow']) {
      expect({ title, verdict: judgeCard(foot, { ...quest(), title }) }).toEqual({ title, verdict: { reasons: [], score: -1, dropped: false, unfit: false } })
      expect(judgeCard(foot, { type: 'quest', facts: null, title })).toMatchObject({ score: -1, dropped: false })
    }
    // Городской квест вида маршрута не называет: не совпал и не нарушил.
    expect(judgeCard(foot, { ...quest(), title: 'Квест по Кракову: легенды Вавеля' })).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
    // Название статьи вид не задаёт: у неё он только по каталогу.
    expect(judgeCard(foot, { ...travel(), title: 'Велоквест, который мы не прошли' })).toEqual({ reasons: [], score: 0, dropped: false, unfit: false })
  })

  it('детский квест на вопрос о длине маршрута без детей — карточка другой аудитории', () => {
    expect(judgeCard(parseConditions('Пеший маршрут не более 20 км'), quest({ audience: 'kids' }))).toEqual({ reasons: [], score: -1, dropped: true, unfit: true })
  })
})
