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
 *     Детский квест на вопрос с личным условием, в котором детей нет, — карточка другой аудитории
 *     (`unfit`): в подсказку не идёт никогда.
 *
 * Порядок карточек и группы «подходит / рядом» собирает `sourceSelection.ts`.
 * Модуль без `@/`-импортов: службу грузит `node --experimental-strip-types`.
 */

import { asksAboutChildren } from './questAudience.ts'
import { asksAboutService } from './serviceIntent.ts'
import { detectIntent } from './retrievalQuery.ts'
import { formatKm, MONTHS_RU, type RouteKind, routeKindOf, type SourceFacts } from './sourceFacts.ts'
import type { AiCardType, AiSourceType } from './types'

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
  /** Лёгкий маршрут: «для новичков», «несложная тропа», «dla początkujących», «easy hike». */
  easy?: true
  /** Вопрос о самом сайте, а не о поездке (#3293, `serviceIntent.ts`): отвечает справка, а не материалы. */
  service?: true
  /**
   * Длина маршрута, км (#3353): «не более 100 км», «до двадцати километров» — граница строгая, «около 50 км»,
   * «поход на 20 км» — с запасом 25 %, как у длительности.
   */
  maxKm?: number
  /** Нижняя граница длины, км: «не короче 10 км», «от 15 км», «больше 20 км», «at least 10 km». */
  minKm?: number
  /** Вид маршрута: пеший («пешком», «поход», «hiking», «pieszo») или на велосипеде («веломаршрут», «rowerem»). */
  route?: RouteKind
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

const EASY_RE = word(
  // RU
  '(?:для\\s+)?новичк\\p{L}+', 'начинающ\\p{L}+', 'л[её]гк\\p{L}+\\s+(?:маршрут|троп|поход|прогулк|квест)\\p{L}*', 'несложн\\p{L}+', 'нетрудн\\p{L}+', 'без\\s+(?:особой\\s+|специальной\\s+)?подготовки',
  // BE
  'пачатко[ўу]ц\\p{L}+', 'л[её]гк\\p{L}+\\s+(?:маршрут|сцежк|паход|прагулк|квэст)\\p{L}*', 'няцяжк\\p{L}+', 'нескладан\\p{L}+',
  // UK
  'початківц\\p{L}+', 'легк\\p{L}+\\s+(?:маршрут|стежк|похід|поход|прогулянк|квест)\\p{L}*', 'нескладн\\p{L}+', 'неважк\\p{L}+',
  // PL
  'pocz[ąa]tkuj[ąa]c\\p{L}+', '[łl]atw\\p{L}+\\s+(?:tras|szlak|wycieczk|spacer|quest)\\p{L}*', 'niewymagaj[ąa]c\\p{L}+',
  // EN
  'beginners?', 'novices?', 'easy\\s+(?:hike|hikes|trail|trails|route|routes|walk|walks|quest|quests)', 'not\\s+too\\s+(?:hard|difficult)',
)
/** Признак лёгкого маршрута в названии или фрагменте статьи: у неё нет факта сложности, но карточка сама его называет. */
const EASY_SIGN_RE = word(
  'л[её]гк\\p{L}+\\s+(?:маршрут|троп|поход|прогулк)\\p{L}*', '(?:маршрут|тропа|поход|прогулка)\\s+л[её]гк\\p{L}+', 'для\\s+новичков', 'для\\s+начинающих', 'несложн\\p{L}+\\s+(?:маршрут|троп|поход|прогулк)\\p{L}*',
  'сложность\\s*[:—–-]\\s*л[её]гк\\p{L}+', '[łl]atw\\p{L}+\\s+(?:tras|szlak)\\p{L}*', 'easy\\s+(?:hike|trail|route|walk)',
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

const KM = '(?:км|km|километр\\p{L}*|кіламетр\\p{L}*|кілометр\\p{L}*|kilomet\\p{L}*)'
/** Числительные длины: десятки и сотни в падежах «до двадцати километров», «na pięćdziesiąt kilometrów». */
const KM_NUMBER_WORDS: ReadonlyArray<[number, string]> = [
  ...NUMBER_WORDS,
  [15, 'пятнадцат[ьи]|пятнаццац[ьі]|п[\'’ʼ]ятнадцят[ьи]|pi[ęe]tna[śs]cie|pi[ęe]tnastu|fifteen'],
  [20, 'двадцат[ьи]|дваццац[ьі]|двадцят[ьи]|dwadzie[śs]cia|dwudziestu|twenty'],
  [25, 'двадцат[ьи]\\s+пят[ьи]|twenty[\\s-]five'],
  [30, 'тридцат[ьи]|трыццац[ьі]|тридцят[ьи]|trzydzie[śs]ci|trzydziestu|thirty'],
  [40, 'сорок|сорока|сарака|czterdzie[śs]ci|czterdziestu|forty'],
  [50, 'пят(?:ь|и)десят(?:и)?|пяцьдзесят|пяцідзесяці|п[\'’ʼ]ят(?:и)?десят(?:и)?|pi[ęe][ćc]dziesi[ąa]t|pi[ęe][ćc]dziesi[ęe]ciu|fifty'],
  [60, 'шест(?:ь|и)десят(?:и)?|шэсцьдзесят|шасцідзесяці|шіст?десят(?:и)?|sze[śs][ćc]dziesi[ąa]t|sze[śs][ćc]dziesi[ęe]ciu|sixty'],
  [70, 'сем(?:ь|и)десят(?:и)?|семдзесят|сямідзесяці|сімдесят(?:и)?|siedemdziesi[ąa]t|siedemdziesi[ęe]ciu|seventy'],
  [80, 'восем(?:ь|и)десят(?:и)?|восемдзесят|васьмідзесяці|вісімдесят(?:и)?|osiemdziesi[ąa]t|osiemdziesi[ęe]ciu|eighty'],
  [90, 'девяност[оа]|дзевяност[аы]|дев[\'’ʼ]яност[оа]|dziewi[ęe][ćc]dziesi[ąa]t|ninety'],
  [100, 'сто|ста|сотн[июя]|stu|sto|(?:a|one)\\s+hundred|hundred'],
  [150, 'полутораста|полтораста'],
  [200, 'двести|двухсот|дзвесце|двісті|двохсот|dwie[śs]cie|dwustu|two\\s+hundred'],
]
const KM_NUMBER_WORD_RES: ReadonlyArray<[number, RegExp]> = KM_NUMBER_WORDS.map(([value, pattern]) => [value, new RegExp(`^(?:${pattern})$`, 'iu')])
// Длинные слова раньше коротких: «двадцать пять» не должно прочитаться как «двадцать».
const KM_NUM = `(\\d{1,4}(?:[.,]\\d)?|${[...KM_NUMBER_WORDS].reverse().map(([, pattern]) => pattern).join('|')})`
const kmNumberOf = (token: string | undefined): number | null => {
  const text = String(token ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return null
  if (/^\d/.test(text)) {
    const value = Number(text.replace(',', '.'))
    return Number.isFinite(value) && value > 0 ? value : null
  }
  return KM_NUMBER_WORD_RES.find(([, pattern]) => pattern.test(text))?.[0] ?? null
}
/** «10–15 км», «от 10 до 15 км» — диапазон; число перед единицей — «a 100 km hike», «на 20 км», «20-километровый». */
const KM_RE = new RegExp(`(?<![\\p{L}\\p{N}.,])${KM_NUM}(?:\\s*(?:[-–—]|до|да|do|to)\\s*${KM_NUM})?[\\s-]*${KM}(?![\\p{L}\\p{N}])`, 'giu')
const KM_TAIL = '\\s+(?:чем\\s+|за\\s+|ніж\\s+|than\\s+)?$'
const kmBefore = (...alternatives: string[]): RegExp => new RegExp(`(?<![\\p{L}])(?:${alternatives.join('|')})${KM_TAIL}`, 'iu')
/** Слова перед числом километров. Порядок проверки — в `kmOf`: отрицание читается раньше голого сравнения. */
const KM_NOT_SHORTER_RE = kmBefore(
  'не\\s+(?:короче|меньше|менее|карацей|менш|коротше|менше)', 'от', 'ад', 'від', 'минимум', 'мінімум', 'хотя\\s+бы', 'як\\s+мінімум', 'щонайменше',
  'od', 'co\\s+najmniej', 'minimum', 'nie\\s+kr[óo]tsz\\p{L}*\\s+ni[żz]', 'nie\\s+mniej\\s+ni[żz]', 'at\\s+least', 'not\\s+shorter\\s+than', 'no\\s+(?:less|shorter)\\s+than', 'from',
)
const KM_NOT_LONGER_RE = kmBefore(
  'не\\s+(?:длиннее|больше|более|дольше|даўжэй|больш|довше|більше)', 'до', 'да', 'максимум', 'в\\s+пределах', 'у\\s+межах',
  'do', 'maks(?:ymalnie)?', 'max(?:imum)?', 'nie\\s+d[łl]u[żz]sz\\p{L}*\\s+ni[żz]', 'nie\\s+wi[ęe]cej\\s+ni[żz]', 'up\\s+to', 'under', 'within', 'at\\s+most', '(?:no|not)\\s+(?:more|longer)\\s+than',
)
const KM_LONGER_RE = kmBefore('больше', 'более', 'длиннее', 'больш', 'даўжэй', 'більше', 'довше', 'ponad', 'powy[żz]ej', 'wi[ęe]cej\\s+ni[żz]', 'd[łl]u[żz]sz\\p{L}*\\s+ni[żz]', 'more\\s+than', 'over', 'longer\\s+than')
const KM_SHORTER_RE = kmBefore('короче', 'менее', 'меньше', 'карацей', 'менш', 'коротше', 'менше', 'kr[óo]tsz\\p{L}*\\s+ni[żz]', 'mniej\\s+ni[żz]', 'poni[żz]ej', 'shorter\\s+than', 'less\\s+than')
/** Расстояние от места, а не длина маршрута: «в 30 км от Минска», «30 km from Krakow», «за 20 км від Львова». */
const KM_FROM_PLACE_RE = /^\s*(?:от|ад|від|od|from)\s+\p{Lu}/u
const KM_AWAY_BEFORE_RE = /(?<![\p{L}])(?:в|у|ў|за|w|within)\s+$/iu

/**
 * Границы длины маршрута в вопросе. Число с километрами читается длиной маршрута, если это не расстояние
 * от места («в 30 км от Минска» — оно в условия не входит). Диапазон «10–15 км» — нижняя и верхняя
 * граница; «до» и «не больше» — строгая верхняя; «от» и «не короче» — нижняя; одно число без этих слов
 * («поход на 20 км», «около 50 км») — примерная длина с запасом 25 %, как у длительности.
 */
const kmOf = (text: string): { maxKm?: number; minKm?: number } => {
  const out: { maxKm?: number; minKm?: number } = {}
  for (const match of text.matchAll(KM_RE)) {
    const start = match.index ?? 0
    const before = text.slice(0, start)
    const after = text.slice(start + match[0].length)
    if (KM_FROM_PLACE_RE.test(after) || (KM_AWAY_BEFORE_RE.test(before) && /^\s*(?:от|ад|від|od|from|of)(?![\p{L}])/iu.test(after))) continue
    const first = kmNumberOf(match[1])
    const second = kmNumberOf(match[2])
    if (first === null) continue
    if (second !== null && second > first) {
      out.minKm ??= first
      out.maxKm ??= second
    } else if (KM_NOT_SHORTER_RE.test(before)) {
      out.minKm ??= first
    } else if (KM_NOT_LONGER_RE.test(before)) {
      out.maxKm ??= first
    } else if (KM_LONGER_RE.test(before)) {
      out.minKm ??= first
    } else if (KM_SHORTER_RE.test(before)) {
      out.maxKm ??= first
    } else {
      out.maxKm ??= Math.round(first * APPROXIMATE_FACTOR * 10) / 10
    }
  }
  return out
}

const FOOT_RE = word(
  // RU
  'пешком', 'пеш(?:ий|ая|ее|ие|его|ей|ую|им|их|ими|ем)', 'поход(?:а|у|е|ы|ов|ом|ах)?', 'хайкинг\\p{L}*', 'трек+инг\\p{L}*',
  // BE
  'пешшу', 'пеш(?:ы|ая|ае|ыя|ага|ую)', 'паход\\p{L}*', 'вандро[ўу]к\\p{L}*\\s+пешшу',
  // UK
  'пішки', 'піш(?:ий|а|е|і|ого|ої|у|им|их)', 'похід', 'походи', 'поход(?:у|ом|ів|ах)', 'пішохідн\\p{L}+',
  // PL
  'pieszo', 'piesz(?:y|a|e|ego|ej|[ąa]|ych|ymi)', 'w[ęe]dr[óo]wk\\p{L}*', 'trekking\\p{L}*',
  // EN
  'hik(?:e|es|ing)', 'on\\s+foot', 'walking\\s+(?:route|trail|tour|path)s?', 'trek(?:s|king)?',
)
const BIKE_RE = word(
  'вело\\p{L}+', 'на\\s+велосипед\\p{L}*', 'на\\s+веліку', 'на\\s+ровары', 'на\\s+велосипеді', 'велосипед\\p{L}*', 'ровар\\p{L}*',
  'rower\\p{L}*', 'na\\s+rowerze', 'cycl(?:e|ing)', 'bik(?:e|es|ing)', 'bicycle\\p{L}*', 'by\\s+bike',
)

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
  const { maxKm, minKm } = kmOf(text)
  // Вид маршрута: оба слова сразу («пешком или на велосипеде») вид не называют.
  const onFoot = FOOT_RE.test(text)
  const byBike = BIKE_RE.test(text)
  return {
    ...(aboutChildren ? { children: { ages } } : {}),
    ...(DOG_RE.test(text) ? { dog: true as const } : {}),
    ...(NO_CAR_RE.test(text) ? { noCar: true as const } : {}),
    ...(months.length ? { months } : {}),
    ...(maxMinutes !== undefined ? { maxMinutes } : {}),
    ...(maxDays !== undefined ? { maxDays } : {}),
    ...(kind ? { kind } : {}),
    ...(EASY_RE.test(text) ? { easy: true as const } : {}),
    ...(asksAboutService(text) ? { service: true as const } : {}),
    ...(maxKm !== undefined ? { maxKm } : {}),
    ...(minKm !== undefined ? { minKm } : {}),
    ...(onFoot !== byBike ? { route: onFoot ? ('foot' as const) : ('bike' as const) } : {}),
  }
}

export type CardVerdict = {
  /** Совпавшие условия словами фактов — строка «почему подходит»: `['детский', '8–10 лет', '75 мин']`. */
  reasons: string[]
  /** Балл для порядка: совпало +1, явно нарушено без числа −1, факта нет 0. */
  score: number
  /** Явное нарушение числового условия: карточка в подсказку не идёт. */
  dropped: boolean
  /**
   * Карточка адресована другой аудитории: детский квест на вопрос взрослого с условием («с собакой», «на
   * час», «зимой»), в котором детей нет. В подсказку не идёт никогда — даже если больше ответить нечем:
   * честное «подходящего нет» лучше детского квеста на вопрос «где погулять с собакой».
   */
  unfit: boolean
}

/** Детский квест под вопрос о детях весит больше семейного — как места `childrenRank` (#3276). */
const AUDIENCE_SCORE = { kids: 1, family: 0.5 } as const
const AUDIENCE_RU = { kids: 'детский', family: 'семейный' } as const
// Названия словаря транспорта каталога (`facts.jsonl`), в нижнем регистре.
const CAR_TRANSPORTS = new Set(['машина', 'такси'])
const PUBLIC_TRANSPORTS = new Set(['автобус', 'поезд', 'электричка', 'общественный транспорт'])
const WEEKEND_CATEGORY = 'тур выходного дня'

const ROUTE_RU: Record<RouteKind, string> = { foot: 'пеший маршрут', bike: 'веломаршрут' }

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
export const judgeCard = (
  conditions: QuestionConditions,
  card: { type: AiCardType; facts?: SourceFacts | null; title?: string | null; snippet?: string | null },
): CardVerdict => {
  const reasons: string[] = []
  let score = 0
  let dropped = false
  const match = (reason: string | null, weight = 1) => {
    score += weight
    if (reason) reasons.push(reason)
  }
  const quest = card.facts?.type === 'quest' ? card.facts : null
  const travel = card.facts?.type === 'travel' ? card.facts : null

  // Детский квест (аудитория «дети» по каталогу) на вопрос с личным условием, где детей нет, — не ответ:
  // «Где погулять с собакой недалеко от Варшавы?» получал детский квест, потому что он «можно с собакой».
  // Вопрос без условий («Какие квесты есть в Гродно?») детские квесты по-прежнему показывает.
  const personal =
    conditions.dog ||
    conditions.noCar ||
    conditions.easy ||
    conditions.months?.length ||
    conditions.maxMinutes !== undefined ||
    conditions.maxDays !== undefined ||
    conditions.maxKm !== undefined ||
    conditions.minKm !== undefined ||
    conditions.route !== undefined
  if (!conditions.children && personal && quest?.audience === 'kids') return { reasons: [], score: -1, dropped: true, unfit: true }

  if (conditions.kind) score += card.type === conditions.kind ? 1 : -1

  if (conditions.easy) {
    if (quest?.difficulty) {
      if (quest.difficulty === 'easy') match('лёгкий')
      else score -= 1
    } else if (card.type === 'travel' && EASY_SIGN_RE.test(`${card.title ?? ''}. ${card.snippet ?? ''}`)) {
      // У статьи факта сложности нет; признак — её собственные слова: «Закопане: лёгкая тропа…».
      match('лёгкий маршрут')
    }
  }

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

  // Вид маршрута (#3353): пеший или вело — по категориям и транспорту статьи; каталог молчит — не нарушено.
  const kind = travel ? routeKindOf(travel) : null
  const otherKind = conditions.route !== undefined && kind !== null && kind !== conditions.route
  if (conditions.route && kind === conditions.route) match(ROUTE_RU[kind])
  else if (otherKind) score -= 1

  // Длина маршрута (#3353): сверяется только у статьи с фактом длины; длиннее верхней границы или короче
  // нижней — явное нарушение числового условия. У маршрута другого вида длина не сверяется: веломаршрут на
  // 15 км — не ответ на «пеший маршрут до 20 км», и нарушением его длина тоже не становится.
  if (!otherKind && travel?.distance_km !== undefined && (conditions.maxKm !== undefined || conditions.minKm !== undefined)) {
    const tooLong = conditions.maxKm !== undefined && travel.distance_km > conditions.maxKm
    const tooShort = conditions.minKm !== undefined && travel.distance_km < conditions.minKm
    if (tooLong || tooShort) dropped = true
    else match(`${formatKm(travel.distance_km)} км`)
  }

  return { reasons, score, dropped, unfit: false }
}
