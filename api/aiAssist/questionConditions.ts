/**
 * Условия вопроса и их проверка по фактам карточки (#3289).
 *
 * Посетитель спрашивает с условием: «с собакой под Варшавой», «зимой на один день», «с ребёнком
 * девяти лет на час», «без машины». Подбор отдавал восемь ближайших по смыслу карточек, а выбор
 * «подходящей» оставался модели на 4 млрд параметров: на «Куда поехать зимой в Беларуси на один
 * день?» первой рекомендацией шла поездка по четырём странам на 14 дней (проба 11.11.2026, p09).
 * Факты для проверки у карточки есть с #3287 — здесь они сверяются до модели.
 *
 * Модуль один для экрана и службы `/ai/ask`:
 *   - `parseConditions` — вопрос → структура условий на RU/BE/UK/PL/EN: дети и возраст, собака, без
 *     машины, сезон или месяц, сколько есть времени, вид материала. Слова о детях — словарь
 *     `questAudience.ts` (#3276), вид материала — `detectIntent`; место вопроса сюда не входит (#3315);
 *   - `judgeCard` — условия против фактов одной карточки: что совпало, балл для порядка и признак
 *     «убрать». Условие сверяется только с фактом, который у карточки ЕСТЬ: без факта карточка не
 *     совпала и не нарушила (неизвестно ≠ нарушено). Убирается карточка только при явном нарушении
 *     числового условия — длительность больше названной, возраст вне диапазона квеста. Нарушение
 *     без числа («без собаки», другой месяц, только на машине) карточку опускает, но не убирает.
 *
 * Порядок карточек и группы «подходит / рядом» собирает `sourceSelection.ts`.
 * Модуль без `@/`-импортов: службу грузит `node --experimental-strip-types`.
 */

import { asksAboutChildren } from './questAudience.ts'
import { detectIntent } from './retrievalQuery.ts'
import { MONTHS_RU, type SourceFacts } from './sourceFacts.ts'
import type { AiSourceType } from './types'

export type QuestionConditions = {
  /** Вопрос о детях; `ages` — названный возраст («ребёнку 9 лет», «6 и 10 лет»), может быть пустым. */
  children?: { ages: number[] }
  dog?: true
  noCar?: true
  /** Месяцы поездки 1–12 по возрастанию: названный месяц или сезон. */
  months?: number[]
  /** Сколько есть времени на квест или прогулку, мин («до часа», «на полдня»). */
  maxMinutes?: number
  /** Сколько есть дней на поездку («на один день», «на выходные», «на 3 дня»). */
  maxDays?: number
  /** Вид материала: «квесты…» или «статья, маршрут…». */
  kind?: AiSourceType
}

// `\b` не знает кириллицы: граница слова — по букве и цифре с обеих сторон.
const word = (...alternatives: string[]): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'iu')

const DOG_RE = word(
  // RU
  'собак\\p{L}*', 'собач\\p{L}+', 'пс(?:ом|а|у|ами|ов)', 'п[её]с', 'п[её]сик\\p{L}*', 'щен(?:ок|к\\p{L}+)', 'питом(?:ец|ц\\p{L}+)',
  // BE
  'сабак\\p{L}*', 'сабач\\p{L}+', 'гадаван\\p{L}+',
  // UK
  'песик\\p{L}*', 'улюбленц\\p{L}+', 'цуцен\\p{L}+',
  // PL
  'ps(?:em|a|u|y|ami|[óo]w)', 'pies(?:kiem|ek|ka|ki)?', 'piesk\\p{L}+', 'szczeniak\\p{L}*', 'zwierzak\\p{L}*',
  // EN
  'dogs?', 'dogg(?:y|ie)', 'pupp(?:y|ies)', 'pets?', 'pet-friendly', 'dog-friendly',
)

const NO_CAR_RE = word(
  // RU
  'без\\s+(?:сво(?:ей|его)\\s+|личн\\p{L}+\\s+)?(?:машин[ыи]|авто(?:мобил\\p{L}+)?)', 'не\\s+на\\s+машине', 'не\\s+за\\s+рул[её]м', 'без\\s+прав',
  'обществен\\p{L}+\\s+транспорт\\p{L}*', 'на\\s+(?:автобус\\p{L}*|поезд\\p{L}*|электричк\\p{L}+|маршрутк\\p{L}+)', 'поездом', 'автобусом', 'электричкой',
  // BE
  'без\\s+(?:сва[её]й\\s+|уласн\\p{L}+\\s+)?(?:машыны|а[ўу]то(?:мабіл\\p{L}+)?)', 'грамадск\\p{L}+\\s+транспарт\\p{L}*',
  'на\\s+(?:а[ўу]тобус\\p{L}*|цягнік\\p{L}*|электрычц\\p{L}+)', 'цягніком', 'а[ўу]тобусам',
  // UK
  'без\\s+(?:сво[єе]ї\\s+|власн\\p{L}+\\s+)?(?:машини|авто(?:мобіл\\p{L}+)?|автівки)', 'громадськ\\p{L}+\\s+транспорт\\p{L}*',
  'на\\s+(?:автобусі|потязі|поїзді|електричці)', 'потягом', 'поїздом', 'електричкою',
  // PL
  'bez\\s+(?:w[łl]asnego\\s+)?(?:samochodu|auta)', 'komunikacj[ąa]\\s+(?:publiczn[ąa]|miejsk[ąa])', 'transportem\\s+publicznym', 'poci[ąa]giem', 'autobusem', 'kolej[ąa]',
  // EN
  'without\\s+(?:a\\s+|my\\s+|our\\s+)?car', 'no\\s+car', 'car-?free', 'public\\s+trans(?:port|it)\\p{L}*', 'by\\s+(?:train|bus|rail)',
)

/** «9-летний», «9-letni» — возраст, а не лето. */
const NOT_AGE = '(?<!\\d[-–\\s]?)'
const EN_MONTH_CONTEXT = '(?:in|early|late|mid|during|this|next)[\\s-]+'

const SEASONS: ReadonlyArray<[readonly number[], RegExp]> = [
  [
    [12, 1, 2],
    word('зим(?:а|у|ой|ою|е|ы|н\\p{L}+)', 'зім\\p{L}+', '[уў]зімку', '[ву]зимку', 'зимов\\p{L}+', 'zim(?:a|[ąa]|ie|y|[ęe]|ow\\p{L}+)', 'winter\\p{L}*'),
  ],
  [
    [3, 4, 5],
    word(
      'весн(?:а|у|ой|ою|е|ы)', 'весенн\\p{L}+', 'вясн\\p{L}+', 'вясенн\\p{L}+', '[уў]весну', 'навесні', 'весня\\p{L}+',
      'wiosn(?:a|[ąa]|[ęe]|ie|y)', 'wiosenn\\p{L}+', `${EN_MONTH_CONTEXT}(?:the\\s+)?spring`, 'spring\\s+(?:trip|break|holiday|weekend)\\p{L}*', 'springtime',
    ),
  ],
  [
    [6, 7, 8],
    word(
      'лет(?:ом|о)', `${NOT_AGE}летн(?:ий|яя|ее|ие|его|ей|ем|им|их|юю|ими|і|яе|ія)`, '[уў]летку', 'летам', '[ву]літку', 'літ(?:о|ом)', `${NOT_AGE}літн\\p{L}+`,
      'lat(?:em|o)', `${NOT_AGE}letni\\p{L}*`, 'summer\\p{L}*',
    ),
  ],
  [
    [9, 10, 11],
    word('осен\\p{L}+', '[уў]?восен\\p{L}+', 'осін\\p{L}+', 'jesie[ńn]', 'jesieni[ąa]?', 'jesienn\\p{L}+', 'autumn\\p{L}*', '(?:in|this|next)\\s+(?:the\\s+)?fall'),
  ],
]

// Формы перечислены: «октябрьская площадь», «Августов», BE «мая сям'я» и UK «я маю» месяцем не считаются.
const MONTHS: readonly RegExp[] = [
  word('январ(?:ь|я|е|ю|[её]м)', 'студзен\\p{L}*', 'січ(?:ень|ня|ні|нем)', 'stycz(?:e[ńn]|nia|niu|niem)', 'january'),
  word('феврал(?:ь|я|е|ю|[её]м)', 'лют(?:ы|ага|ым|ий|ого|ому|им)', 'lut(?:y|ego|ym)', 'february'),
  word('март(?:а|е|у|ом)?', 'сакавік\\p{L}*', 'берез(?:ень|ня|ні|нем)', 'mar(?:zec|ca|cu|cem)', `${EN_MONTH_CONTEXT}march`),
  word('апрел(?:ь|я|е|ю|[её]м)', 'красавік\\p{L}*', 'квіт(?:ень|ня|ні|нем)', 'kwie(?:cie[ńn]|tnia|tniu|tniem)', 'april'),
  word(
    'май', '(?:в|у|ў)\\s+ма[еі]', 'майск\\p{L}+', '(?:начал\\p{L}+|конц\\p{L}+|середин\\p{L}+|\\d{1,2})\\s+мая',
    'трав(?:ень|ня|ні|нем)', 'maj(?:a|u|em)?', `${EN_MONTH_CONTEXT}may`,
  ),
  word('июн(?:ь|я|е|ю|ем)', 'чэрвен\\p{L}*', 'черв(?:ень|ня|ні|нем)', 'czerw(?:iec|ca|cu|cem)', 'june'),
  word('июл(?:ь|я|е|ю|ем)', 'ліпен\\p{L}*', 'лип(?:ень|ня|ні|нем)', 'lip(?:iec|ca|cu|cem)', 'july'),
  word('август(?:а|е|у|ом)?', 'жнів(?:ень|ня|ні|нем)', 'серп(?:ень|ня|ні|нем)', 'sierp(?:ie[ńn]|nia|niu|niem)', `${EN_MONTH_CONTEXT}august`),
  word('сентябр(?:ь|я|е|ю|[её]м)', 'верас(?:ень|ня|ні|нем)', 'верес(?:ень|ня|ні|нем)', 'wrze(?:sie[ńn]|[śs]nia|[śs]niu|[śs]niem)', 'september'),
  word('октябр(?:ь|я|е|ю|[её]м)', 'кастрычнік\\p{L}*', 'жовт(?:ень|ня|ні|нем)', 'pa[źz]dziernik\\p{L}*', 'october'),
  word('ноябр(?:ь|я|е|ю|[её]м)', 'лістапад\\p{L}*', 'листопад\\p{L}*', 'listopad\\p{L}*', 'november'),
  word('декабр(?:ь|я|е|ю|[её]м)', 'снеж(?:ань|ня|ні|нем)', 'груд(?:ень|ня|ні|нем)', 'grud(?:zie[ńn]|nia|niu|niem)', 'december'),
]

// Числительные вопроса: «на два часа», «девяти лет», «na trzy dni», «a couple of hours».
const NUMBER_WORDS: ReadonlyArray<[number, string]> = [
  [1, 'один|одну|одного|одной|адзін|адну|аднаго|одна|jeden|jedn[ąa]|jednego|one'],
  [2, 'два|две|двух|пару|дзве|двох|дві|dwa|dwie|dw[óo]ch|par[ęe]|two|(?:a\\s+)?couple(?:\\s+of)?'],
  [3, 'три|тр[её]х|тры|трох|трьох|trzy|trzech|three'],
  [4, 'четыре|четыр[её]х|чатыры|чатырох|чотири|чотирьох|cztery|czterech|four'],
  [5, 'пять|пяти|пяць|пяці|п[\'’ʼ]ять|п[\'’ʼ]яти|pi[ęe][ćc]|pi[ęe]ciu|five'],
  [6, 'шесть|шести|шэсць|шасці|шість|sze[śs][ćc]|sze[śs]ciu|six'],
  [7, 'семь|семи|сем|сямі|сім|siedem|siedmiu|seven'],
  [8, 'восемь|восьми|восем|васьмі|вісім|osiem|o[śs]miu|eight'],
  [9, 'девять|девяти|дзевяць|дзевяці|дев[\'’ʼ]ять|дев[\'’ʼ]яти|dziewi[ęe][ćc]|dziewi[ęe]ciu|nine'],
  [10, 'десять|десяти|дзесяць|дзесяці|dziesi[ęe][ćc]|dziesi[ęe]ciu|ten'],
  [11, 'одиннадцат[ьи]|адзінаццац[ьі]|одинадцят[ьи]|jedena[śs]cie|jedenastu|eleven'],
  [12, 'двенадцат[ьи]|дванаццац[ьі]|дванадцят[ьи]|dwana[śs]cie|dwunastu|twelve'],
]
const NUMBER_WORD_RES: ReadonlyArray<[number, RegExp]> = NUMBER_WORDS.map(([value, pattern]) => [value, new RegExp(`^(?:${pattern})$`, 'iu')])
const NUM = `(\\d{1,3}(?:[.,]\\d)?|${NUMBER_WORDS.map(([, pattern]) => pattern).join('|')})`

const numberOf = (token: string | undefined): number | null => {
  const text = String(token ?? '').trim()
  if (!text) return null
  if (/^\d/.test(text)) {
    const value = Number(text.replace(',', '.'))
    return Number.isFinite(value) ? value : null
  }
  return NUMBER_WORD_RES.find(([, pattern]) => pattern.test(text))?.[0] ?? null
}

const MAX_CHILD_AGE = 17
const AGE_UNIT =
  '(?:лет|летн\\p{L}+|год(?:а|ик\\p{L}*)?|гадо[ўу]|гадов\\p{L}+|гады|гадк\\p{L}+|рок(?:и|ів)|рочк\\p{L}+|річн\\p{L}+|lat(?:a|ek|ka)?|letni\\p{L}*|years?(?:[\\s-]olds?)?|year-olds?|yo|y\\.o\\.)'
const AGE_RE = new RegExp(`(?<![\\p{L}\\p{N}])${NUM}(?:\\s*(?:,|и|і|та|i|and|или|або|lub|or|[-–])\\s*${NUM})?[\\s-]*${AGE_UNIT}(?![\\p{L}\\p{N}])`, 'giu')

/** «Для 9-летнего», «a nine-year-old», «9-letnie dziecko»: возраст назван без слова «ребёнок». */
const AGED_PERSON_RE = new RegExp(`(?<![\\p{L}\\p{N}])${NUM}[\\s-]*(?:летн\\p{L}+|гадов\\p{L}+|річн\\p{L}+|letni\\p{L}*|year-olds?|years?[\\s-]olds?)(?![\\p{L}\\p{N}])`, 'iu')

const agesOf = (text: string): number[] => {
  const ages = new Set<number>()
  for (const match of text.matchAll(AGE_RE)) {
    for (const token of [match[1], match[2]]) {
      const age = numberOf(token)
      if (age !== null && Number.isInteger(age) && age >= 1 && age <= MAX_CHILD_AGE) ages.add(age)
    }
  }
  return [...ages].sort((a, b) => a - b)
}

/** «Не больше», «до» — граница строгая; «на час», «около двух часов» — примерная, с запасом. */
const UPTO_RE =
  /(?<![\p{L}])(?:до|да|не\s+больше|не\s+более|не\s+дольше|не\s+больш|не\s+більше|не\s+довше|максимум|в\s+пределах|do|maks(?:ymalnie)?|max|nie\s+d[łl]u[żz]ej\s+ni[żz]|up\s+to|under|within|less\s+than|no\s+(?:more|longer)\s+than|at\s+most)\s+(?:(?:an?|одного|одной|одну|jednej)\s+)?$/iu
const APPROXIMATE_FACTOR = 1.25
/** Полдня — до пяти часов на месте. */
const HALF_DAY_MINUTES = 300
/** Квест «на день» — любой, что укладывается в световой день. */
const DAY_MINUTES = 600

const HOUR = '(?:час(?:а|ов|ик|ика|ок)?|гадзін[аыу]?|годин[аиу]?|godzin[ęeya]?|hours?|hrs?)'
const ONE_HOUR = '(?:час(?:а|ик|ок)?|гадзін[ыу]|годин[иу]|godzin[ęey]|hour)'
const MINUTE = '(?:мин(?:ут[аыу]?)?|хв(?:илин[аиу]?)?|хвілін[аыу]?|minut[yęea]?|min(?:ute)?s?)'
const NOT_LONGER = '(?:не\\s+(?:больше|более|дольше|більше|довше|больш|даўжэй)|nie\\s+d[łl]u[żz]ej\\s+ni[żz]|no\\s+(?:more|longer)\\s+than)'
const BEFORE_HOUR = '(?:на|за|до|да|около|примерно|максимум|каля|близько|na|w|do|oko[łl]o|for|about|around|in|under|within)'

const MINUTE_RULES: ReadonlyArray<[RegExp, (match: RegExpMatchArray) => number | null]> = [
  [word('полчаса', 'пол\\s+часа', 'па[ўу]гадзіны', 'пів\\s?години', 'p[óo][łl]\\s+godziny', 'half\\s+an\\s+hour'), () => 30],
  [word('полтора\\s+часа', 'па[ўу]тары\\s+гадзіны', 'півтори\\s+години', 'p[óo][łl]torej\\s+godziny', '(?:an?\\s+|one\\s+)?hour\\s+and\\s+a\\s+half', 'one\\s+and\\s+a\\s+half\\s+hours?'), () => 90],
  [word(`${NUM}\\s*${HOUR}`), (match) => scaled(match[1], 60)],
  // «часа на два», «часа два».
  [word(`час(?:а|ов|ика)\\s+(?:на\\s+)?${NUM}`), (match) => scaled(match[1], 60)],
  [word(`(?:${BEFORE_HOUR}|${NOT_LONGER})\\s+(?:(?:an?|one|одну|адну|jedn[ąa])\\s+)?${ONE_HOUR}`), () => 60],
  [word(`${NUM}\\s*${MINUTE}\\.?`), (match) => scaled(match[1], 1)],
]

function scaled(token: string | undefined, unit: number): number | null {
  const value = numberOf(token)
  return value !== null && value > 0 ? value * unit : null
}

const HALF_DAY_RE = word('пол\\s?-?дня', 'половин[ау]\\s+дня', 'па[ўу]\\s?-?дня', 'палов[ау]\\s+дня', 'пів\\s?-?дня', 'p[óo][łl]\\s+dnia', 'po[łl]ow[ęea]\\s+dnia', 'half(?:\\s+(?:a|of\\s+a|the))?[\\s-]+day')
const DAYS_RE = word(`${NUM}\\s*(?:дн(?:я|ей|і|ів|ями)|дзён|дні|dni|days?)`, '(\\d{1,2})[-\\s]?(?:дневн\\p{L}+|дз[её]нн\\p{L}+|денн\\p{L}+|dniow\\p{L}+|day)')
const ONE_DAY_RE = word(
  '(?:1|один|адзін|jeden|one)\\s+(?:день|дзень|dzie[ńn]|day)',
  '(?:на|за)\\s+(?:весь\\s+|целый\\s+|увесь\\s+|цэлы\\s+|цілий\\s+)?(?:день|дзень)', 'одним\\s+дн[её]м', 'однодневн\\p{L}+', 'аднадз[её]нн\\p{L}+', 'одноденн\\p{L}+',
  'na\\s+(?:ca[łl]y\\s+)?dzie[ńn]', 'jednodniow\\p{L}+', '(?:for|in)\\s+(?:a|the|a\\s+single)\\s+day', 'day[\\s-]?trips?', 'one-day', 'single[\\s-]day', 'full[\\s-]day',
)
const WEEKEND_RE = word(
  'выходн(?:ые|ых|ым|ыми|ого\\s+дня)', 'уик-?энд\\p{L}*', 'выхадн(?:ыя|ых|ым|ымі|ога\\s+дня)', '[уў]ікэнд\\p{L}*', 'вихідн(?:і|их|им|ими|ого\\s+дня)', 'в?ікенд\\p{L}*', 'weekend\\p{L}*',
)
const WEEK_RE = word(
  '(?:на|за)\\s+(?:одну\\s+)?недел[юи]', 'недельн\\p{L}+', '(?:на|за)\\s+тыдзень', '(?:на|за)\\s+тиждень', '(?:na|w)\\s+tydzie[ńn]', '(?:for\\s+)?a\\s+week', 'one\\s+week', 'week-?long',
)
const WEEKEND_DAYS = 2
const WEEK_DAYS = 7
const MAX_TRIP_DAYS = 60

const minutesOf = (text: string): number | undefined => {
  for (const [pattern, read] of MINUTE_RULES) {
    const match = pattern.exec(text)
    const minutes = match ? read(match) : null
    if (!match || minutes === null) continue
    const strict = UPTO_RE.test(text.slice(0, match.index)) || /^(?:до|да|do|under|within|максимум|не|nie|no)(?![\p{L}])/iu.test(match[0])
    return Math.round(minutes * (strict ? 1 : APPROXIMATE_FACTOR))
  }
  return HALF_DAY_RE.test(text) ? HALF_DAY_MINUTES : undefined
}

const daysOf = (text: string): number | undefined => {
  const counted = DAYS_RE.exec(text)
  const days = counted ? numberOf(counted[1] ?? counted[2]) : null
  if (days !== null && Number.isInteger(days) && days >= 1 && days <= MAX_TRIP_DAYS) return days
  if (ONE_DAY_RE.test(text)) return 1
  if (WEEKEND_RE.test(text)) return WEEKEND_DAYS
  if (WEEK_RE.test(text)) return WEEK_DAYS
  return undefined
}

const monthsOf = (text: string): number[] => {
  const months = new Set<number>()
  for (const [season, pattern] of SEASONS) if (pattern.test(text)) season.forEach((month) => months.add(month))
  MONTHS.forEach((pattern, index) => {
    if (pattern.test(text)) months.add(index + 1)
  })
  return [...months].sort((a, b) => a - b)
}

/** Условия вопроса; запрос подбора с опорой уточнения («Квесты в Минске. А с собакой?») читается целиком. */
export const parseConditions = (query: string | null | undefined): QuestionConditions => {
  const text = String(query ?? '')
  if (!text.trim()) return {}
  const months = monthsOf(text)
  const maxMinutes = minutesOf(text)
  const maxDays = daysOf(text)
  const kind = detectIntent(text)
  const ages = agesOf(text)
  const aboutChildren = asksAboutChildren(text) || (ages.length > 0 && AGED_PERSON_RE.test(text))
  return {
    ...(aboutChildren ? { children: { ages } } : {}),
    ...(DOG_RE.test(text) ? { dog: true as const } : {}),
    ...(NO_CAR_RE.test(text) ? { noCar: true as const } : {}),
    ...(months.length ? { months } : {}),
    ...(maxMinutes !== undefined ? { maxMinutes } : {}),
    ...(maxDays !== undefined ? { maxDays } : {}),
    ...(kind ? { kind } : {}),
  }
}

export type CardVerdict = {
  /** Совпавшие условия словами фактов — строка «почему подходит»: `['детский', '8–10 лет', '75 мин']`. */
  reasons: string[]
  /** Балл для порядка: совпало +1, явно нарушено без числа −1, факта нет 0. */
  score: number
  /** Явное нарушение числового условия: карточка в подсказку не идёт. */
  dropped: boolean
}

/** Детский квест под вопрос о детях весит больше семейного — как места `childrenRank` (#3276). */
const AUDIENCE_SCORE = { kids: 1, family: 0.5 } as const
const AUDIENCE_RU = { kids: 'детский', family: 'семейный' } as const
// Названия словаря транспорта каталога (`facts.jsonl`), в нижнем регистре.
const CAR_TRANSPORTS = new Set(['машина', 'такси'])
const PUBLIC_TRANSPORTS = new Set(['автобус', 'поезд', 'электричка', 'общественный транспорт'])
const WEEKEND_CATEGORY = 'тур выходного дня'

const daysLabel = (days: number): string => {
  const tail = days % 10
  const teen = days % 100 >= 11 && days % 100 <= 14
  return `${days} ${!teen && tail === 1 ? 'день' : !teen && tail >= 2 && tail <= 4 ? 'дня' : 'дней'}`
}

const lower = (values: readonly string[] | undefined): string[] => (values ?? []).map((value) => String(value).trim().toLowerCase())

/**
 * Условия вопроса против фактов одной карточки. Вид материала сверяется с типом карточки, остальное —
 * с записью фактов (#3287); у карточки без записи или без нужного поля условие не совпало и не нарушено.
 */
export const judgeCard = (conditions: QuestionConditions, card: { type: AiSourceType; facts?: SourceFacts | null }): CardVerdict => {
  const reasons: string[] = []
  let score = 0
  let dropped = false
  const match = (reason: string | null, weight = 1) => {
    score += weight
    if (reason) reasons.push(reason)
  }
  const quest = card.facts?.type === 'quest' ? card.facts : null
  const travel = card.facts?.type === 'travel' ? card.facts : null

  if (conditions.kind) score += card.type === conditions.kind ? 1 : -1

  if (conditions.children && quest?.audience) {
    match(AUDIENCE_RU[quest.audience], AUDIENCE_SCORE[quest.audience])
    const { ages } = conditions.children
    if (ages.length && quest.age) {
      const [from, to] = quest.age
      const inside = ages.filter((age) => age >= from && age <= to)
      if (inside.length === ages.length) match(`${from}–${to} лет`)
      else if (!inside.length) dropped = true
    }
  }

  if (conditions.dog && quest && typeof quest.pet_friendly === 'boolean') {
    if (quest.pet_friendly) match('можно с собакой')
    else score -= 1
  }

  if (conditions.noCar && travel?.transports?.length) {
    const transports = lower(travel.transports)
    const shared = transports.filter((name) => PUBLIC_TRANSPORTS.has(name))
    if (shared.length) match(`без машины: ${shared.join(', ')}`)
    else if (transports.every((name) => CAR_TRANSPORTS.has(name))) score -= 1
  }

  if (conditions.months?.length && travel?.months?.length) {
    const shared = travel.months.filter((month) => conditions.months!.includes(month))
    if (travel.months.length === MONTHS_RU.length) match('круглый год')
    else if (shared.length) match(`${shared.length > 1 ? 'месяцы' : 'месяц'}: ${shared.map((month) => MONTHS_RU[month - 1]).join(', ')}`)
    else score -= 1
  }

  const { maxMinutes, maxDays } = conditions
  if (quest?.duration_min) {
    // Квест «на выходные» или «на неделю» не совпал и не нарушил: его длительность — про часы.
    const limit = maxMinutes ?? (maxDays === 1 ? DAY_MINUTES : undefined)
    if (limit !== undefined) {
      if (quest.duration_min <= limit) match(`${quest.duration_min} мин`)
      else if (maxMinutes !== undefined) dropped = true
    }
  }
  if (travel) {
    // Время в часах («до часа», «на полдня») — заведомо не многодневная поездка; «Дней: 1» под часы не сверить.
    const limit = maxDays ?? (maxMinutes !== undefined ? 1 : undefined)
    if (limit !== undefined) {
      if (travel.number_days !== undefined) {
        if (travel.number_days > limit) dropped = true
        else if (maxDays !== undefined) match(daysLabel(travel.number_days))
      } else if (maxDays !== undefined && maxDays <= WEEKEND_DAYS && lower(travel.categories).includes(WEEKEND_CATEGORY)) {
        // Подборка без числа дней («19 маршрутов из Минска») с категорией каталога «Тур выходного дня».
        match(WEEKEND_CATEGORY)
      }
    }
  }

  return { reasons, score, dropped }
}
