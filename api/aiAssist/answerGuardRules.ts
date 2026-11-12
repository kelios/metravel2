/**
 * Правила стража содержания ответа (#3291, #3345) — части, из которых `guardAnswer` (`answerGuard.ts`)
 * собирает проверку ответа. Описание набора правил по единицам ответа — в шапке `answerGuard.ts`.
 *
 *   - Предложения текста: границы фраз (`sentencesOf`, `wholeSentences`).
 *   - Опора чисел: числа с единицей в тексте (точки, минуты и часы, время суток, цена, километры, годы),
 *     числительные словами, возраст из вопроса, сверка с карточками (`groundingOf`, `isGrounded`,
 *     `isDifference`) и поиск чисел без опоры без вырезания (`findUngroundedNumbers` — общий для стража
 *     и слоя модели контура оценки).
 *   - Вопросы в ответе: повтор вопроса посетителя (`echoesQuestion`, `stripQuestionEcho`,
 *     `stripQuestionSentences`) и
 *     вопросительные предложения, которые ответом не являются (`stripQuestions`).
 *   - Оборванные фразы карточки (`cutTailMatcher`) и подводка к списку без списка (`stripOrphanLeadIns`).
 *
 * Голые адреса карточек правит страж ссылок (`nameBareSourceLinks`, `linkGuard.ts`).
 * Модуль без `@/`-импортов: его грузит служба (`node --experimental-strip-types`) и контур оценки.
 */

import { tidyText } from './linkGuard.ts'
import { asksAboutChildren } from './questAudience.ts'
import { parseConditions } from './questionConditions.ts'
import type { AiSource } from './types'


export type AnswerGuardContext = {
  /** Вопрос посетителя: его числа («не дольше 90 минут») опоры не требуют, по нему узнаётся повтор вопроса. */
  question?: string | null
  /** Запрос подбора, если он шире вопроса (уточнение вместе с опорой диалога). */
  retrievalQuery?: string | null
  /**
   * Карточки, которые видела модель (#3345, lv35): число вне пояснений сверяется с ними, а не со всем
   * списком источников. Ссылки ответа по-прежнему могут вести на любую карточку списка — `sources`.
   * Не задано — подсказкой считаются все `sources`.
   */
  promptSources?: readonly AiSource[]
}

/** Конец фразы: знак, за которым новая фраза с заглавной буквы, ссылка или конец строки. «ok. 180 min» фразу не делит. */
const SENTENCE_END_RE = /[.!?…]+(?=\s+[\p{Lu}[«"(]|\s*$)/u

/** Первая фраза текста и остаток за ней. */
export const firstSentence = (text: string): [string, string] => {
  const end = SENTENCE_END_RE.exec(text)
  if (!end) return [text, '']
  const cut = end.index + end[0].length
  return [text.slice(0, cut), text.slice(cut)]
}

export const sentencesOf = (text: string): string[] => {
  const out: string[] = []
  let rest = text
  while (rest) {
    const [head, tail] = firstSentence(rest)
    out.push(head)
    rest = tail
  }
  return out
}

/**
 * Предложения строки целиком: обрывок, начатый скобкой или строчной буквой, — продолжение прошлого
 * предложения («…озеро 1 дн. (с ночёвкой не обязательно).»), а не новое.
 */
export const wholeSentences = (line: string): string[] => {
  const out: string[] = []
  for (const fragment of sentencesOf(line)) {
    if (out.length && /^\s*[(\p{Ll}]/u.test(fragment)) out[out.length - 1] += fragment
    else out.push(fragment)
  }
  return out
}

/** «Около 2 часов» при 110 или 130 минутах в карточке — округление, а не выдумка. */
const HOURS_TOLERANCE_MIN = 20

type NumberKind = 'points' | 'minutes' | 'clock' | 'price' | 'km' | 'years'
type NumberFact = {
  kind: NumberKind
  value: number
  raw: string
  index: number
  approx?: boolean
  /** Диапазон лет целиком («8–10 лет»): возраст внутри него — тоже из карточки. */
  span?: [number, number]
}

const NUM = '\\d+(?:[.,]\\d+)?'
const POINTS_UNIT = '(?:точ(?:ек|ки|ка|ку|ках|ок)|пункт(?:аў|ов|ы|а)?|кроп(?:ак|кі|ка|ках)|punkt(?:[óo]w|y|u)|stops?|points?|checkpoints?)'
const MINUTES_UNIT = '(?:мин(?:ут[аыу]?)?|хв(?:ілін[аыу]?|илин[аиу]?)?|min(?:ut[yaęe]?|utes?|s)?)'
const HOURS_UNIT = '(?:час(?:а|ов)?|гадзін[аыу]?|годин[аиу]?|godzin[yaęe]?|hours?)'
const KM_UNIT = '(?:км|km|кіламетр\\p{L}*|километр\\p{L}*|кілометр\\p{L}*|kilomet\\p{L}*)'
const YEARS_UNIT = '(?:лет(?:н\\p{L}+)?|год(?:а|ик\\p{L}*)?|гадо[ўу]|гады|рок(?:и|ів)|річн\\p{L}+|lat(?:a|ek)?|letni\\p{L}*|years?(?:[\\s-]olds?)?|year-olds?)'
const PRICE_UNIT = '(?:руб(?:л\\p{L}*)?|byn|z[łl]|зл(?:от\\p{L}*)?|pln|евро|eur(?:o)?|€|\\$|usd|доллар\\p{L}*|грн|гривен\\p{L}*|uah)'
const SEP = '[\\s\\u00a0\\u2011-]*'
const AFTER = '(?![\\p{L}\\p{N}])'
const BEFORE = '(?<![\\p{L}\\p{N}.,:])'

const toNumber = (value: string): number => Number.parseFloat(value.replace(',', '.'))

const NUMBER_PATTERNS: Array<[RegExp, (match: RegExpExecArray) => Array<Omit<NumberFact, 'raw' | 'index'>>]> = [
  // «2 часа 30 минут» — одно значение, а не 120 и 30.
  [
    new RegExp(`${BEFORE}(${NUM})${SEP}${HOURS_UNIT}\\.?${SEP}(?:и${SEP}|i${SEP}|and${SEP})?(${NUM})${SEP}${MINUTES_UNIT}${AFTER}`, 'giu'),
    (m) => [{ kind: 'minutes', value: Math.round(toNumber(m[1]) * 60 + toNumber(m[2])) }],
  ],
  // Время суток: «18:00», «с 10:00 до 18:00».
  [/(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu, (m) => [{ kind: 'clock', value: Number(m[1]) * 60 + Number(m[2]) }]],
  // «8 точек», «85–130 мин», «75-minute», «1,5 часа», «20 zł».
  [
    new RegExp(`${BEFORE}(${NUM})(?:\\s*[–—-]\\s*(${NUM}))?${SEP}(?:(${POINTS_UNIT})|(${MINUTES_UNIT})|(${HOURS_UNIT})|(${PRICE_UNIT}))${AFTER}`, 'giu'),
    (m) => {
      const values = [m[1], m[2]].filter(Boolean).map(toNumber)
      if (m[3]) return values.map((value) => ({ kind: 'points' as const, value }))
      if (m[4]) return values.map((value) => ({ kind: 'minutes' as const, value }))
      if (m[5]) return values.map((value) => ({ kind: 'minutes' as const, value: Math.round(value * 60), approx: true }))
      return values.map((value) => ({ kind: 'price' as const, value }))
    },
  ],
  // Единица раньше числа: «Точек: 9» строки фактов, «пунктаў — 10», «точок — 12», «пунктаў маршруту — 11».
  [
    new RegExp(`(?<![\\p{L}\\p{N}])${POINTS_UNIT}(?:\\s+\\p{L}+)?\\s*[—–:-]\\s*(${NUM})(?![\\p{L}\\p{N}]|[.,:]\\d)`, 'giu'),
    (m) => [{ kind: 'points', value: toNumber(m[1]) }],
  ],
  [/(?<![\p{L}\p{N}])(?:€|\$)\s?(\d+(?:[.,]\d+)?)(?![\p{L}\p{N}])/gu, (m) => [{ kind: 'price', value: toNumber(m[1]) }]],
  // Расстояние: «2,5 км», «30–50 км», «4 kilometres».
  [
    new RegExp(`${BEFORE}(${NUM})(?:\\s*[–—-]\\s*(${NUM}))?${SEP}${KM_UNIT}${AFTER}`, 'giu'),
    (m) => [m[1], m[2]].filter(Boolean).map((value) => ({ kind: 'km' as const, value: toNumber(value) })),
  ],
  // Годы и возраст: «12 лет», «8–10 лет», «9-летний», «6 year old». Четырёхзначный год («2026 год») сюда не попадает.
  [
    new RegExp(`${BEFORE}(\\d{1,3})(?:\\s*[–—-]\\s*(\\d{1,3}))?${SEP}${YEARS_UNIT}${AFTER}`, 'giu'),
    (m) => {
      const values = [m[1], m[2]].filter(Boolean).map(toNumber)
      const span: [number, number] = [Math.min(...values), Math.max(...values)]
      return values.map((value) => ({ kind: 'years' as const, value, span }))
    },
  ],
]

/** Числа с единицей в тексте. Составное «2 часа 30 минут» закрывает свои части от повторного чтения. */
export const extractNumberFacts = (text: string): NumberFact[] => {
  // Адрес — не текст: «…/krakow-za-90-minut» числом с единицей не считается.
  const value = String(text ?? '').replace(/https?:\/\/\S+|(?<![\w/.])(?:www\.)?metravel\.by\/\S+/gi, (url) => ' '.repeat(url.length))
  const facts: NumberFact[] = []
  const taken: Array<[number, number]> = []
  for (const [pattern, read] of NUMBER_PATTERNS) {
    for (const match of value.matchAll(pattern)) {
      const start = match.index ?? 0
      const end = start + match[0].length
      if (taken.some(([from, to]) => start < to && end > from)) continue
      taken.push([start, end])
      for (const fact of read(match as RegExpExecArray)) if (Number.isFinite(fact.value)) facts.push({ ...fact, raw: match[0].trim(), index: start })
    }
  }
  return facts.sort((a, b) => a.index - b.index)
}

/**
 * Числительные словами — только для опоры: вопрос «у меня полтора часа» и ответ «90 минут», карточка
 * «не больше восьми точек» и ответ «8 точек» говорят об одном. В ответе слова не проверяются.
 */
const WORD_NUMBERS: Array<[RegExp, number]> = [
  [/^(?:один|одна|одну|одного|одной|адзін|адна|адну|jeden|jedna|jedn[ąa]|one|an?)$/, 1],
  [/^(?:полтора|полутора|паўтары|паўтара|півтори|півтора|p[óo][łl]torej|p[óo][łl]tora)$/, 1.5],
  [/^(?:два|две|двух|двум|дзве|дзвюх|дві|двох|dwa|dwie|dw[óo]ch|two)$/, 2],
  [/^(?:три|тр[её]х|тры|трох|трьох|trzy|trzech|three)$/, 3],
  [/^(?:четыре|четыр[её]х|чатыры|чотири|cztery|four)$/, 4],
  [/^(?:пять|пяти|пяць|п['’ʼ]ять|pi[ęe][ćc]|five)$/, 5],
  [/^(?:шесть|шести|шэсць|шість|sze[śs][ćc]|six)$/, 6],
  [/^(?:семь|семи|сем|сім|siedem|seven)$/, 7],
  [/^(?:восемь|восьми|восем|вісім|osiem|eight)$/, 8],
  [/^(?:девять|девяти|дзевяць|дев['’ʼ]ять|dziewi[ęe][ćc]|nine)$/, 9],
  [/^(?:десять|десяти|дзесяць|dziesi[ęe][ćc]|ten)$/, 10],
  [/^(?:двенадцать|двенадцати|twelve)$/, 12],
  [/^(?:пятнадцать|пятнадцати|fifteen)$/, 15],
  [/^(?:двадцать|двадцати|twenty)$/, 20],
  [/^(?:тридцать|тридцати|thirty)$/, 30],
  [/^(?:сорок|сорока|forty)$/, 40],
  [/^(?:пятьдесят|пятидесяти|fifty)$/, 50],
  [/^(?:шестьдесят|шестидесяти|sixty)$/, 60],
  [/^(?:девяносто|девяноста|ninety)$/, 90],
]
const WORD_NUMBER_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])([\\p{L}'’ʼ]+)\\s+(с\\s+половиной\\s+|з\\s+паловай\\s+|з\\s+половиною\\s+|and\\s+a\\s+half\\s+)?(?:(${POINTS_UNIT})|(${MINUTES_UNIT})|(${HOURS_UNIT}))${AFTER}`,
  'giu',
)
const HALF_HOUR_RE = /(?<![\p{L}])(?:полчаса|получаса|паўгадзіны|півгодини|p[óo][łl]\s+godziny|half\s+an\s+hour)(?![\p{L}])/iu
const HOUR_AND_HALF_RE = /(?<![\p{L}])hours?\s+and\s+a\s+half(?![\p{L}])/iu
const BARE_HOUR_RE = new RegExp(`(?<![\\p{L}\\p{N}])${HOURS_UNIT}${AFTER}`, 'iu')

/** Расстояние словами: «около двух с половиной километров», «сорок-пятьдесят километров», «километров на сорок-пятьдесят». */
const WORD_KM_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])([\\p{L}'’ʼ]+)(?:\\s*[–—-]\\s*([\\p{L}'’ʼ]+))?\\s+(с\\s+половиной\\s+|з\\s+паловай\\s+|з\\s+половиною\\s+|and\\s+a\\s+half\\s+)?${KM_UNIT}${AFTER}`,
  'giu',
)
const KM_THEN_WORD_RE = new RegExp(`(?<![\\p{L}\\p{N}])${KM_UNIT}\\s+(?:на\\s+|по\\s+|в\\s+|у\\s+|about\\s+)?([\\p{L}'’ʼ]+)(?:\\s*[–—-]\\s*([\\p{L}'’ʼ]+))?${AFTER}`, 'giu')

const wordNumberFacts = (text: string): Array<{ kind: NumberKind; value: number }> => {
  const value = String(text ?? '').toLowerCase().replace(/ё/g, 'е')
  const facts: Array<{ kind: NumberKind; value: number }> = []
  const numberOf = (word: string | undefined): number | undefined => (word ? WORD_NUMBERS.find(([pattern]) => pattern.test(word))?.[1] : undefined)
  for (const match of value.matchAll(WORD_KM_RE)) {
    for (const word of [match[1], match[2]]) {
      const base = numberOf(word)
      if (base !== undefined) facts.push({ kind: 'km', value: base + (match[3] ? 0.5 : 0) })
    }
  }
  for (const match of value.matchAll(KM_THEN_WORD_RE)) {
    for (const word of [match[1], match[2]]) {
      const base = numberOf(word)
      if (base !== undefined) facts.push({ kind: 'km', value: base })
    }
  }
  for (const match of value.matchAll(WORD_NUMBER_RE)) {
    const base = WORD_NUMBERS.find(([pattern]) => pattern.test(match[1]))?.[1]
    if (base === undefined) continue
    const amount = base + (match[2] ? 0.5 : 0)
    if (match[3]) facts.push({ kind: 'points', value: amount })
    else facts.push({ kind: 'minutes', value: match[4] ? amount : Math.round(amount * 60) })
  }
  if (HALF_HOUR_RE.test(value)) facts.push({ kind: 'minutes', value: 30 })
  if (HOUR_AND_HALF_RE.test(value)) facts.push({ kind: 'minutes', value: 90 })
  // «до часа», «за час», «an hour» — час без числа.
  if (BARE_HOUR_RE.test(value)) facts.push({ kind: 'minutes', value: 60 })
  return facts
}

type Grounding = { exact: Set<string>; minutes: number[]; points: number[]; years: Array<[number, number]> }

/** Числительные 1–12 основами: возраст в вопросе называют слитно — «шестилетка», «дев’ятирічним», «ośmiolatkiem», «six-year-old». */
const AGE_STEMS: ReadonlyArray<[number, string]> = [
  [1, 'одно|адна|jedno|one'], [2, 'двух|дзвюх|дво|dwu|two'], [3, 'тр[её]х|трох|трьох|trzy|three'], [4, 'четыр[её]х|чатырох|чотирьох|cztero|four'], [5, "пяти|пяці|п['’ʼ]яти|pi[ęe]cio|five"],
  [6, 'шести|шасці|шести|sze[śs]cio|six'], [7, 'семи|сямі|семи|siedmio|seven'], [8, 'восьми|васьмі|o[śs]mio|eight'],
  [9, "девяти|дзевяці|дев['’ʼ]яти|dziewi[ęe]cio|nine"], [10, 'десяти|дзесяці|dziesi[ęe]cio|ten'], [11, 'одиннадцати|адзінаццаці|одинадцяти|jedenasto|eleven'], [12, 'двенадцати|дванаццаці|дванадцяти|dwunasto|twelve'],
]
const AGE_TAIL = '(?:лет|літ|гадов|гадк|річ|рок|lat|letn|year)'
const COMPOUND_AGES: ReadonlyArray<[number, RegExp]> = AGE_STEMS.map(([age, stems]) => [age, new RegExp(`(?<![\\p{L}])(?:${stems})[\\s-]?${AGE_TAIL}`, 'iu')])

/** Возраст, названный в вопросе: числом и словом (`parseConditions`) либо слитным словом. */
export const askedAges = (asked: string): number[] => [...(parseConditions(asked).children?.ages ?? []), ...COMPOUND_AGES.filter(([, pattern]) => pattern.test(asked)).map(([age]) => age)]

/** Опора чисел: тексты карточек и вопроса; `ages` — возраст из вопроса. */
export const groundingOf = (texts: ReadonlyArray<string | null | undefined>, ages: readonly number[] = []): Grounding => {
  const exact = new Set<string>()
  const minutes: number[] = []
  const points: number[] = []
  const years: Array<[number, number]> = ages.map((age) => [age, age])
  for (const text of texts) {
    for (const fact of [...extractNumberFacts(String(text ?? '')), ...wordNumberFacts(String(text ?? ''))]) {
      exact.add(`${fact.kind}:${fact.value}`)
      if (fact.kind === 'minutes') minutes.push(fact.value)
      if (fact.kind === 'points') points.push(fact.value)
      if (fact.kind === 'years') years.push((fact as NumberFact).span ?? [fact.value, fact.value])
    }
  }
  return { exact, minutes, points, years }
}

/** Сравнение двух материалов: «на 30 минут короче», «на две точки больше» — на RU/BE/UK/PL/EN. */
const COMPARATIVE_RE =
  /(?<![\p{L}])(?:короче|длиннее|дольше|быстрее|меньше|больше|разниц\p{L}*|карацей|даўжэй|менш|больш|розніц\p{L}*|коротш\p{L}*|довш\p{L}*|менше|більше|різниц\p{L}*|kr[óo]cej|kr[óo]tsz\p{L}*|d[łl]u[żz]ej|d[łl]u[żz]sz\p{L}*|mniej|wi[ęe]cej|r[óo][żz]nic\p{L}*|shorter|longer|fewer|less|more|difference)(?![\p{L}])/iu

/** Число стоит в опоре само либо округляет её длительность до часов. */
export const isGrounded = (fact: NumberFact, grounding: Grounding): boolean =>
  grounding.exact.has(`${fact.kind}:${fact.value}`) ||
  (fact.approx === true && grounding.minutes.some((value) => Math.abs(value - fact.value) <= HOURS_TOLERANCE_MIN)) ||
  // Возраст внутри диапазона карточки («Возраст: 8–10 лет» — «ребёнку 9 лет») либо названный в вопросе.
  (fact.kind === 'years' && grounding.years.some(([from, to]) => fact.value >= from && fact.value <= to))

/**
 * Во фразе сравнения число — разница двух чисел карточек подсказки: «квест про тракт на 30 хв
 * коротше» при 180 и 150 минутах. Это вывод из карточек, а не выдумка; вне сравнения то же число
 * опоры не имеет.
 */
export const isDifference = (fact: NumberFact, grounding: Grounding, sentence: string): boolean => {
  if ((fact.kind !== 'minutes' && fact.kind !== 'points') || !COMPARATIVE_RE.test(sentence)) return false
  const values = grounding[fact.kind]
  return values.some((a) => values.some((b) => a - b === fact.value))
}

/** Текст карточки, по которому сверяется ответ: название и фрагмент (строка фактов стоит в нём первой). */
export const cardText = (source: AiSource): string => `${source.title}. ${source.snippet}`

/**
 * Числа с единицей, которых нет ни в одной карточке и в вопросе, — тем же правилом опоры, что у стража,
 * но без вырезания (#3277). Нужны слою модели контура оценки: страж убирает выдуманные «120 минут» и
 * «60 злотых» из показанного ответа, и автопроверка засчитывала ход, хотя модель число выдумала.
 */
export const findUngroundedNumbers = (text: string, sources: readonly AiSource[], context: AnswerGuardContext = {}): string[] => {
  const asked = [context.question, context.retrievalQuery]
  const grounding = groundingOf([...(context.promptSources ?? sources).map(cardText), ...asked], askedAges(asked.filter(Boolean).join(' ')))
  const stray: string[] = []
  for (const line of String(text ?? '').split('\n')) {
    for (const sentence of sentencesOf(line)) {
      for (const fact of extractNumberFacts(sentence)) if (!isGrounded(fact, grounding) && !isDifference(fact, grounding, sentence)) stray.push(fact.raw)
    }
  }
  return stray
}

/** Вопрос короче этого повтором не считается: «А в Бресте?» может честно начать ответ. */
const MIN_ECHO_QUESTION_CHARS = 12

const normalizeForEcho = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Ответ начинается с вопроса посетителя или почти целиком из него состоит. */
export const echoesQuestion = (question: string | null | undefined, answer: string): boolean => {
  const asked = normalizeForEcho(question ?? '')
  const said = normalizeForEcho(answer)
  if (asked.length < MIN_ECHO_QUESTION_CHARS || !said) return false
  return said.startsWith(asked) || (said.includes(asked) && asked.length * 2 >= said.length)
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Текст без дословного повтора вопроса посетителя (регистр и пробелы не важны). Вырезается только вопрос
 * со знаком вопроса, стоящий отдельным предложением: «Самый короткий квест в Минске» без знака — это и
 * честное начало ответа («Самый короткий квест в Минске — …»). Короткий вопрос не вырезается. Сравнивайте
 * результат с `text`: другая строка — повтор вырезан.
 */
export const stripQuestionEcho = (text: string, question: string | null | undefined): string => {
  const asked = String(question ?? '').replace(/\s+/g, ' ').trim()
  if (asked.length < MIN_ECHO_QUESTION_CHARS || !/[?？]$/.test(asked)) return text
  const repeat = new RegExp(`(^|[.!?…:]\\s+|\\n\\s*)${asked.split(' ').map(escapeRegExp).join('\\s+')}(?=\\s|$)`, 'giu')
  const stripped = text.replace(repeat, '$1')
  return stripped === text ? text : tidyText(stripped)
}

/**
 * Текст без предложений, дословно повторяющих предложения вопроса посетителя (#3345, lv35). Повтор вопроса
 * режется как единица-предложение, остальное остаётся: от «…візьмо близько 120 хв. Скільки часу потрібно на
 * квест у Тракаї? Хочемо ще встигнути в замок.» — первое предложение с числом карточки. Вопрос из двух
 * предложений (второе — без знака вопроса) правило целого вопроса не снимало, и ответ уходил в запасной.
 * Короткое предложение вопроса повтором не считается; предложение со ссылкой на карточку не трогается.
 * Вопрос, повторённый подводкой к списку («А куди звідти з'їздити на день до моря: ⏎ - [Хельская коса…]»),
 * остаётся: без неё от ответа остался бы голый пункт.
 */
export const stripQuestionSentences = (text: string, question: string | null | undefined): { text: string; removed: string[] } => {
  const asked = new Set(
    String(question ?? '')
      .split('\n')
      .flatMap(wholeSentences)
      .map(normalizeForEcho)
      .filter((sentence) => sentence.length >= MIN_ECHO_QUESTION_CHARS),
  )
  const removed: string[] = []
  if (!asked.size) return { text, removed }
  const repeats = (sentence: string): boolean => !HAS_LINK_RE.test(sentence) && SENTENCE_CLOSED_RE.test(sentence) && asked.has(normalizeForEcho(sentence))
  const lines = text.split('\n').flatMap((line) => {
    const sentences = wholeSentences(line)
    if (!sentences.some(repeats)) return [line]
    const rest = sentences.filter((sentence) => !repeats(sentence) || (removed.push(sentence.trim()), false)).join('')
    // От пункта списка остался один маркер — пункта больше нет.
    return rest.trim() && !/^\s*(?:[-*•]|\d+[.)])\s*$/.test(rest) ? [rest] : []
  })
  return removed.length ? { text: tidyText(lines.join('\n')), removed } : { text, removed }
}

const BULLET_LINE_RE = /^\s*(?:[-*•]|\d+[.)])\s+/
const SENTENCE_CLOSED_RE = /[.!?…]["»”’')\]]*\s*$/

/**
 * Текст без подводки к списку, под которой списка нет (#3345, lv22 и lv45 замеров r3–r4): фраза кончается
 * двоеточием, а после неё до конца ответа — ничего либо только строки-названия («Rozkłady jazdy pociągów w
 * Polsce: ⏎ Miasto Malbork — Karta turystyczna», «…Ближайшее из найденного:» последней фразой). Название —
 * строка без ссылки, маркера и законченной фразы, в которой нет содержания карточек (`carriesCardContent`:
 * число из карточки подсказки или её слова): это материал, которого нет в подсказке. Строка с фактом
 * карточки названием не считается — «Время прохождения квеста по Гродно: ⏎ 120 мин» и «Что взять с собой:
 * ⏎ удобную обувь ⏎ воду» остаются целиком; остаётся и подводка, в которой самой стоит число карточки.
 * Подводка, после которой стоит ссылка, пункт списка, законченная фраза или другая подводка, тоже остаётся.
 * `pageMode` — режим страницы: строки под подводкой там пересказ страницы; уходит только подводка, после
 * которой пусто. `removed` — что вырезано: подводка и строки под ней (для находки стража).
 */
export const stripOrphanLeadIns = (
  text: string,
  options: { pageMode?: boolean; carriesCardContent: (line: string) => boolean; hasCardNumber: (line: string) => boolean },
): { text: string; removed: string[] } => {
  const lines = text.split('\n')
  const dropped = new Set<number>()
  const removed: string[] = []
  lines.forEach((line, index) => {
    const lead = sentencesOf(line).at(-1) ?? ''
    if (dropped.has(index) || BULLET_LINE_RE.test(line) || !/[:：]\s*$/.test(lead) || HAS_LINK_RE.test(lead) || options.hasCardNumber(lead)) return
    const block = lines.map((_, row) => row).filter((row) => row > index && lines[row].trim())
    const isTitle = (row: number): boolean =>
      !HAS_LINK_RE.test(lines[row]) && !BULLET_LINE_RE.test(lines[row]) && !/[.!?…:：]["»”’')\]]*\s*$/.test(lines[row]) && !options.carriesCardContent(lines[row])
    if ((options.pageMode && block.length) || !block.every(isTitle)) return
    lines[index] = line.slice(0, line.length - lead.length)
    removed.push(lead.trim(), ...block.map((row) => lines[row].trim()))
    block.forEach((row) => dropped.add(row))
  })
  return removed.length ? { text: tidyText(lines.filter((_, index) => !dropped.has(index)).join('\n')), removed } : { text, removed }
}

/** Вопрос модели о возрасте ребёнка — на RU/BE/UK/PL/EN: «Сколько лет ребёнку?», «Ile lat ma dziecko?», «How old is the child?». */
const AGE_ASK_RE = /(?<![\p{L}])(?:сколько\s+(?:же\s+)?лет|колькі\s+гадоў|скільки\s+років|ile\s+lat|how\s+old)(?![\p{L}])/iu
const QUESTION_END_RE = /[?？]["»”’')\]]*\s*$/
const HAS_LINK_RE = /\]\(/

/**
 * Текст без вопросительных предложений, которые ответом не являются (#3345). Остаётся только уточнение
 * возраста ребёнка — когда вопрос посетителя о детях и возраст в нём не назван (`asked` — вопрос вместе
 * с опорой уточнения). Предложение со ссылкой на карточку не трогается: это рекомендация.
 */
export const stripQuestions = (text: string, asked: string): { text: string; removed: string[] } => {
  const children = parseConditions(asked).children
  const clarifiesAge = (sentence: string): boolean => children !== undefined && children.ages.length === 0 && AGE_ASK_RE.test(sentence) && asksAboutChildren(sentence)
  const removed: string[] = []
  const lines = text.split('\n').flatMap((line) => {
    if (!line.includes('?') && !line.includes('？')) return [line]
    const kept = wholeSentences(line).filter((sentence) => {
      if (!QUESTION_END_RE.test(sentence) || HAS_LINK_RE.test(sentence) || clarifiesAge(sentence)) return true
      removed.push(sentence.trim())
      return false
    })
    const rest = kept.join('')
    // От пункта списка остался один маркер — пункта больше нет.
    return rest.trim() && !/^\s*(?:[-*•]|\d+[.)])\s*$/.test(rest) ? [rest] : []
  })
  return removed.length ? { text: tidyText(lines.join('\n')), removed } : { text, removed }
}

/** Сколько последних слов оборванной фразы карточки узнаётся в ответе и сколько в них должно быть букв. */
const CUT_TAIL_WORDS = 3
const MIN_CUT_TAIL_LETTERS = 12

const plainWords = (text: string): string[] =>
  String(text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/**
 * Концы оборванных фраз карточки: фрагмент обрезан по длине и кончается многоточием, последняя его
 * фраза не закончена. Ключ — её последние слова (без строки фактов: та состоит из законченных пунктов).
 */
const cutTailsOf = (source: AiSource): string[] => {
  const tails: string[] = []
  const pieces = String(source.snippet ?? '').split(/…|\.{3}/)
  // Кусок после последнего многоточия оборванным не считается: фрагмент закончился сам.
  for (const piece of pieces.slice(0, -1)) {
    const unfinished = piece.split(/[.!?]\s+/).pop() ?? ''
    const words = plainWords(unfinished)
    const tail = words.slice(-CUT_TAIL_WORDS)
    if (words.length > CUT_TAIL_WORDS && tail.join('').length >= MIN_CUT_TAIL_LETTERS) tails.push(` ${tail.join(' ')} `)
  }
  return tails
}

/**
 * Проверка «фраза обрывается там же, где оборван фрагмент карточки» для набора карточек: такая фраза
 * утверждением не является. Пустой набор (режим страницы) — правило выключено.
 */
export const cutTailMatcher = (sources: readonly AiSource[]): ((phrase: string) => boolean) => {
  const cutTails = sources.flatMap(cutTailsOf)
  return (phrase) => {
    if (!cutTails.length) return false
    const words = ` ${plainWords(phrase).join(' ')} `
    return cutTails.some((tail) => words.endsWith(tail))
  }
}
