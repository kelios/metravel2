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
    ['Посоветуй маршрут в Татрах для новичков без машины', { noCar: true, kind: 'travel' }],
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
    expect(judgeCard({ ...everything, kind: undefined }, quest())).toEqual({ reasons: [], score: 0, dropped: false })
    expect(judgeCard({ ...everything, kind: undefined }, travel())).toEqual({ reasons: [], score: 0, dropped: false })
    expect(judgeCard({ ...everything, kind: undefined }, { type: 'travel', facts: null })).toEqual({ reasons: [], score: 0, dropped: false })
    expect(judgeCard({ ...everything, kind: undefined }, { type: 'quest' })).toEqual({ reasons: [], score: 0, dropped: false })
    // Квест без пометки аудитории на вопрос о детях — не «не детский»: каталог этого не говорит.
    expect(judgeCard({ children: { ages: [9] } }, quest({ duration_min: 90, pet_friendly: true }))).toEqual({ reasons: [], score: 0, dropped: false })
    // Статья с одним днём на вопрос «до часа»: часы по числу дней не сверить.
    expect(judgeCard({ maxMinutes: 60 }, travel({ number_days: 1 }))).toEqual({ reasons: [], score: 0, dropped: false })
    // Месяцы и транспорт сверяются только там, где записаны.
    expect(judgeCard({ months: [1], noCar: true }, travel({ number_days: 2 }))).toEqual({ reasons: [], score: 0, dropped: false })
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
    expect(judgeCard({ children: { ages: [6, 9] } }, quest({ audience: 'kids', age: [8, 10] }))).toEqual({ reasons: ['детский'], score: 1, dropped: false })
  })

  it('нарушение без числа опускает карточку, но не убирает', () => {
    expect(judgeCard({ dog: true }, quest({ pet_friendly: false }))).toEqual({ reasons: [], score: -1, dropped: false })
    expect(judgeCard({ months: [1, 2, 12] }, travel({ months: [5] }))).toEqual({ reasons: [], score: -1, dropped: false })
    expect(judgeCard({ noCar: true }, travel({ transports: ['Машина'] }))).toEqual({ reasons: [], score: -1, dropped: false })
    // Машина и велосипед — без машины не подтверждено, но и не «только на машине».
    expect(judgeCard({ noCar: true }, travel({ transports: ['Машина', 'Велосипед'] }))).toEqual({ reasons: [], score: 0, dropped: false })
    expect(judgeCard({ kind: 'quest' }, travel({ number_days: 1 }))).toEqual({ reasons: [], score: -1, dropped: false })
  })

  it('совпавшее условие — балл и слова для строки «почему подходит»', () => {
    const asked = parseConditions('Квест с собакой для ребёнка девяти лет на час')
    expect(judgeCard(asked, quest({ audience: 'kids', age: [8, 10], duration_min: 75, pet_friendly: true }))).toEqual({
      reasons: ['детский', '8–10 лет', 'можно с собакой', '75 мин'],
      score: 5,
      dropped: false,
    })
    // Семейный квест весит меньше детского — как места `childrenRank` (#3276).
    expect(judgeCard({ children: { ages: [] } }, quest({ audience: 'family' }))).toEqual({ reasons: ['семейный'], score: 0.5, dropped: false })
    expect(judgeCard({ months: [1, 2, 12], maxDays: 1 }, travel({ number_days: 1, months: [1, 2, 7] }))).toEqual({
      reasons: ['месяцы: январь, февраль', '1 день'],
      score: 2,
      dropped: false,
    })
    expect(judgeCard({ months: [3] }, travel({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })).reasons).toEqual(['круглый год'])
    expect(judgeCard({ noCar: true }, travel({ transports: ['Автобус', 'Поезд', 'Машина'] })).reasons).toEqual(['без машины: автобус, поезд'])
    expect(judgeCard({ maxDays: 7 }, travel({ number_days: 5 })).reasons).toEqual(['5 дней'])
    expect(judgeCard({ maxDays: 3 }, travel({ number_days: 2 })).reasons).toEqual(['2 дня'])
    // Квест «на один день» укладывается в день; «на выходные» — не совпал и не нарушил.
    expect(judgeCard({ maxDays: 1 }, quest({ duration_min: 90 })).reasons).toEqual(['90 мин'])
    expect(judgeCard({ maxDays: 2 }, quest({ duration_min: 90 }))).toEqual({ reasons: [], score: 0, dropped: false })
  })

  it('подборка без числа дней подходит «на выходные» по категории каталога «Тур выходного дня»', () => {
    const roundup = travel({ categories: ['Самостоятельное путешествие', 'Тур выходного дня'] })
    expect(judgeCard({ maxDays: 2 }, roundup)).toEqual({ reasons: ['тур выходного дня'], score: 1, dropped: false })
    expect(judgeCard({ maxDays: 1 }, roundup).score).toBe(1)
    // На три дня и больше категория ничего не подтверждает.
    expect(judgeCard({ maxDays: 3 }, roundup)).toEqual({ reasons: [], score: 0, dropped: false })
    expect(judgeCard({ maxDays: 2 }, travel({ categories: ['Поход'] }))).toEqual({ reasons: [], score: 0, dropped: false })
  })
})
