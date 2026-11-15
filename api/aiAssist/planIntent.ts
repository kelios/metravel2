/**
 * Намерение «план по дням» (#3298): какой вопрос ассистента уходит в `POST /ai/plan`, а не в обычный
 * `/ai/ask`, и на сколько дней план. Правило узкое — ошибка в сторону плана показала бы расписание тому,
 * кто спрашивал совета:
 *
 *   - просьба составить: «спланируй два дня в Кракове», «составь маршрут по Гродно», «zaplanuj weekend w
 *     Gdańsku», «plan a trip to Vilnius»;
 *   - «план / маршрут / программа на N дней, на выходные, на неделю»;
 *   - названо число дней от двух и спрошено, что посмотреть: «что посмотреть в Кракове за два дня», «будем
 *     в Минске два дня, что посмотреть»; либо короткая фраза без вопроса с местом: «на 3 дня в Вильнюс».
 *
 * Не план: вопрос о самом числе дней («сколько дней нужно на Краков»); выбор места («куда съездить из
 * Минска на два дня», «куда съездить на выходные») и вопрос о наличии материалов («летим в Вильнюс на три
 * дня, есть у вас квесты?») — это просьба о совете; вопрос об одном дне без просьбы составить.
 *
 * Число дней читает тот же разбор условий, что у подбора (`parseConditions`): «два дня», «на 3 дня»,
 * «на выходные» — 2, «на неделю» — 7; не названо — 1. Модель число дней не выбирает.
 *
 * Модуль общий для экрана и службы, без `@/`-импортов.
 */

import { parseConditions } from './questionConditions.ts'
import { namedDestinations } from './topicGate.ts'
import { detectOwnPlacesQuestion } from './visitorContext.ts'

/** Больше дней в одном плане не бывает: материалов одного места на большее не хватает. */
export const PLAN_MAX_DAYS = 7

const WORD_START = '(?<![\\p{L}\\p{N}])'
const WORD_END = '(?![\\p{L}\\p{N}])'
const word = (pattern: string): string => `${WORD_START}(?:${pattern})${WORD_END}`
const any = (...patterns: string[]): RegExp => new RegExp(patterns.join('|'), 'iu')
/** До трёх слов между частями фразы: «составь мне подробный план». */
const GAP = "(?:[\\p{L}\\p{N}'’-]+\\s+){0,3}?"

/** Вопрос о самом числе дней или о времени — совет, а не план. */
const COUNT_QUESTION_RE = any(
  word('сколько|на\\s+сколько') + `\\s+${GAP}` + word('дней|дня|времени|суток|ночей'),
  word('колькі|на\\s+колькі') + `\\s+${GAP}` + word('дзён|дні|часу|сутак'),
  word('скільки|на\\s+скільки') + `\\s+${GAP}` + word('днів|дні|часу|діб'),
  word('ile|na\\s+ile') + `\\s+${GAP}` + word('dni|czasu|dób'),
  word('how\\s+(?:many|long)') + `\\s+${GAP}` + word('days?|time|nights?|do|should|is|does'),
  word('how\\s+long'),
  word('хватит\\s+ли|хопіць\\s+лі|чи\\s+вистачить|czy\\s+wystarcz\\p{L}*|is\\s+(?:it\\s+)?enough'),
)

/** Просьба составить план или маршрут. */
const PLAN_VERB_RE = any(
  word('спланируй\\p{L}*|распланируй\\p{L}*|запланируй\\p{L}*'),
  word('состав\\p{L}+|собер\\p{L}+|построй\\p{L}*|набросай\\p{L}*|распиши\\p{L}*|разбей\\p{L}*') + `\\s+${GAP}` + word('план\\p{L}*|маршрут\\p{L}*|программ\\p{L}+|по\\s+дням'),
  word('сплануй\\p{L}*|заплануй\\p{L}*|спланіруй\\p{L}*'),
  word('склад[зж]\\p{L}+|збяр\\p{L}+|пабудуй\\p{L}*|распішы\\p{L}*') + `\\s+${GAP}` + word('план\\p{L}*|маршрут\\p{L}*|праграм\\p{L}+|па\\s+днях'),
  word('склад\\p{L}+|збер\\p{L}+|побудуй\\p{L}*|розпиши\\p{L}*') + `\\s+${GAP}` + word('план\\p{L}*|маршрут\\p{L}*|програм\\p{L}+|по\\s+днях'),
  word('zaplanuj\\p{L}*|rozplanuj\\p{L}*'),
  word('ułóż\\p{L}*|uloz\\p{L}*|przygotuj\\p{L}*|stwórz\\p{L}*|rozpisz\\p{L}*') + `\\s+${GAP}` + word('plan\\p{L}*|tras\\p{L}+|program\\p{L}*'),
  word('plan') + `\\s+${GAP}` + word('trip|days?|weekend|week|visit|itinerary|route|holiday|vacation|getaway'),
  word('make|build|create|put\\s+together|draft|give\\s+me|write') + `\\s+${GAP}` + word('plan|itinerary|schedule'),
  word('itinerary'),
  word('day[\\s-]by[\\s-]day'),
)

/** «На N дней», «на выходные», «на неделю» — на пяти языках. */
const DAYS_SPAN =
  '(?:(?:\\d{1,2}|[\\p{L}]+)\\s+(?:дн(?:я|ей|і|ів)|дзён|дні|dni|days?)|(?:\\d{1,2})[-\\s]?(?:дневн\\p{L}+|дз[её]нн\\p{L}+|денн\\p{L}+|dniow\\p{L}+|day)|' +
  'выходн\\p{L}+|уик-?энд\\p{L}*|выхадн\\p{L}+|вихідн\\p{L}+|в?ікенд\\p{L}*|weekend\\p{L}*|недел\\p{L}+|тыдзень|тиждень|tydzie[ńn]|week)'

/** «План на два дня», «маршрут на выходные», «program na 3 dni», «3-day itinerary». */
const PLAN_NOUN_RE = any(
  word('план\\p{L}*|маршрут\\p{L}*|программ\\p{L}+|праграм\\p{L}+|програм\\p{L}+') + '\\s+' + word('на|за|по') + `\\s+${GAP}` + word(DAYS_SPAN),
  word('plan\\p{L}*|tras\\p{L}+|program\\p{L}*') + '\\s+' + word('na|w|we') + `\\s+${GAP}` + word(DAYS_SPAN),
  word('plan|route|schedule|program(?:me)?') + '\\s+' + word('for|over') + `\\s+${GAP}` + word(DAYS_SPAN),
  word(DAYS_SPAN) + `\\s+${GAP}` + word('plan|route|schedule|trip\\s+plan'),
)

/** Выходные и неделя — не «число дней»: «куда съездить на выходные» остаётся просьбой о совете. */
const SPAN_WORD_RE = any(word('выходн\\p{L}+|уик-?энд\\p{L}*|выхадн\\p{L}+|вихідн\\p{L}+|в?ікенд\\p{L}*|weekend\\p{L}*|недел\\p{L}+|тыдзень|тиждень|tydzie[ńn]|week'))

/** Неделя без предлога («сплануй тиждень у Ліді», «a week in Vilnius») и «three-day» — разбор условий подбора их не читает. */
const WEEK_WORD_RE = any(word('недел[юяи]|тыдзень|тиждень|tydzie[ńn]|week'))
const EN_DAY_WORDS: Readonly<Record<string, number>> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }
const EN_WORD_DAY_RE = new RegExp(word(`(${Object.keys(EN_DAY_WORDS).join('|')})[-\\s]day`), 'iu')

/** Сколько дней назвал посетитель (без потолка плана); не назвал — 1. */
export const requestedDaysOf = (question: string | null | undefined): number => {
  const text = String(question ?? '')
  const days = parseConditions(text).maxDays
  if (Number.isInteger(days) && (days as number) >= 1) return days as number
  const worded = EN_WORD_DAY_RE.exec(text)
  if (worded) return EN_DAY_WORDS[worded[1].toLowerCase()]
  return WEEK_WORD_RE.test(text) ? 7 : 1
}

/**
 * «Что посмотреть», «чем заняться» — вопрос о занятиях в месте. «Куда съездить на два дня» сюда не входит:
 * это выбор места, а не план внутри него; так же «есть ли у вас квесты», «какой маршрут пройти за 4 дня».
 */
const WHAT_TO_SEE_RE = any(
  word('что') + `\\s+${GAP}` + word('посмотреть|посетить|увидеть|делать|поделать'),
  word('чем') + `\\s+${GAP}` + word('заняться'),
  word('што') + `\\s+${GAP}` + word('паглядзець|наведаць|пабачыць|рабіць'),
  word('чым') + `\\s+${GAP}` + word('заняцца'),
  word('що') + `\\s+${GAP}` + word('подивитися|подивитись|відвідати|побачити|робити'),
  word('чим') + `\\s+${GAP}` + word('зайнятися'),
  word('co') + `\\s+${GAP}` + word('zobaczyć|zwiedzić|odwiedzić|robić'),
  word('what') + `\\s+${GAP}` + word('see|visit|do'),
)
/** Сколько слов в «голой» фразе «на N дней в Место», которая и без глагола читается просьбой о плане. */
const BARE_PHRASE_MAX_WORDS = 6

/** Число дней плана: из вопроса, не меньше одного и не больше `PLAN_MAX_DAYS`. */
export const planDaysOf = (question: string | null | undefined): number => Math.min(PLAN_MAX_DAYS, requestedDaysOf(question))

/** Вопрос просит план по дням — уходит в `/ai/plan`. */
export const detectPlanIntent = (question: string | null | undefined): boolean => {
  const text = String(question ?? '')
  if (!text.trim() || COUNT_QUESTION_RE.test(text)) return false
  // Вопрос о собственных планах и сохранённом (#3354) отвечает личный подбор `/ai/ask`, а не новый план.
  if (detectOwnPlacesQuestion(text)) return false
  if (PLAN_VERB_RE.test(text) || PLAN_NOUN_RE.test(text)) return true
  // Названо число дней (не «выходные»): план, если спрошено, что посмотреть, либо названо место.
  const days = parseConditions(text).maxDays ?? (EN_WORD_DAY_RE.test(text) ? requestedDaysOf(text) : undefined)
  if (days === undefined || days < 2 || SPAN_WORD_RE.test(text)) return false
  if (WHAT_TO_SEE_RE.test(text)) return true
  // Короткая фраза без вопроса: «На 3 дня в Вильнюс», «Краков на два дня».
  return !text.includes('?') && text.trim().split(/\s+/).length <= BARE_PHRASE_MAX_WORDS && namedDestinations(text).length > 0
}
