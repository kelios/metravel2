/**
 * Страж содержания ответа (#3291) — поверх стража ссылок (`linkGuard.ts`).
 *
 * Адреса модель больше не выдумывает, но ответ с настоящими ссылками мог расходиться с
 * карточками (проба пути службы 11.11.2026 и приёмка v7):
 *   - пояснение у пункта от соседней карточки: у «Веломаршрута к усадьбе Новицких» —
 *     «Кревский замок и Гольшаны», у квеста по Каменцу — «маршрут вдоль Припяти и Ипы» (p15, p18);
 *   - числа, которых нет в карточке: «9 точек, около 45 минут» у статьи о Смолевуде (p14),
 *     «близько 18:00» там, где часы работы не названы нигде (q24);
 *   - пустой ответ: повтор вопроса и «Цены в карточках — в отдельных пунктах» (p10).
 *
 * Правила — одни для экрана, службы `/ai/ask` и контура оценки (`scripts/ai-assistant-eval/checks.mjs`):
 *   1. Пояснение пункта — фраза сразу за ссылкой после тире, двоеточия или скобки. Число с единицей
 *      в нём должно стоять в карточке ЭТОЙ ссылки (строка фактов `sourceFacts.ts` и фрагмент) или в
 *      вопросе. Слова считаются чужими, когда пояснение опирается на соседнюю карточку, а на свою —
 *      нет. Отсутствие опоры само по себе пояснение не срезает: ответ на BE/UK/PL/EN пересказывает
 *      русскую карточку другими словами. Неподтверждённое пояснение убирается, ссылка остаётся.
 *   2. Число с единицей вне пояснений должно стоять хотя бы в одной карточке подсказки или в
 *      вопросе; фраза с числом без опоры убирается. Если в этой фразе стоит ссылка, от фразы остаётся
 *      ссылка: «Пройдёте [Квест](…) за 2 часа.» → «[Квест](…).», в пункте списка — «- [Квест](…)».
 *   3. Ответ без ссылки на карточку, без признания «этого в материалах нет» и без подтверждённого
 *      числа, если он короткий или повторяет вопрос, — пустой: вызывающий показывает запасную фразу.
 *      В режиме страницы (#3290) короткий ответ пустым не считается: он о самой странице. Пустой и
 *      остаток после вырезаний, в котором одни вопросы: от «…в Кракове — 60 злотых. Сколько летнему
 *      ребёнку, сколько взрослым?» оставался один встречный вопрос.
 *      Дословный повтор вопроса посетителя в начале или хвосте ответа вырезается и у ответа со ссылками.
 *   5. Материал не из подсказки: страж ссылок снимает адрес, которого нет в карточках, но название и числа
 *      при нём оставались («• В поисках гномов — 8 точек, около 150 мин»). Пункт списка или предложение с
 *      такой ссылкой убирается целиком (если в нём есть и ссылка на карточку — остаётся она); строка-заголовок
 *      списка, под которой не осталось пунктов, уходит вместе с ними.
 *   4. Эхо разметки подсказки — заголовок «Материалы сайта:» и строка «Вопрос посетителя:» на любой из
 *      пяти локалей, фразы системного сообщения, номер карточки в квадратных скобках («карточка [2]») —
 *      вырезается: строка с заголовком карточки целиком, в остальном тексте — предложение вместе с его
 *      продолжением в скобках или со строчной буквы. Если после
 *      этого не осталось ни ссылки, ни признания, ответ пустой (кроме режима страницы, где утверждение
 *      о странице ссылки не требует). Детектор `leaksPrompt` — общий с проверкой `prompt_leak` контура оценки.
 *
 * Сверяются только единицы с однозначным значением: точки квеста, длительность (минуты и часы),
 * время суток и цена. Километры, дни и возраст карточка часто пишет словами («около двух с
 * половиной километров», «маршрут на два дня»), и цифра в ответе была бы ложной тревогой.
 *
 * Модуль без `@/`-импортов: его грузит служба (`node --experimental-strip-types`) и контур оценки.
 */

import { buildSourceByLinkKey, countKeptSourceLinks, enforceSourceLinks, type LinkGuardResult, normalizeLinkKey, REMOVED_LINK_MARK, tidyText } from './linkGuard.ts'
import type { AiSource } from './types'

export type GuardCheck = 'label_mismatch' | 'foreign_description' | 'ungrounded_number' | 'prompt_leak' | 'echo'
export type GuardFinding = { check: GuardCheck; detail: string }

export type AnswerGuardResult = LinkGuardResult & {
  /** Сколько пояснений пунктов убрано как не подтверждённых карточкой ссылки. */
  droppedDescriptions: number
  /** Сколько фраз убрано из-за числа, которого нет ни в одной карточке. */
  ungroundedNumbers: number
  /** Сколько строк и фраз с эхом разметки подсказки убрано. */
  promptLeaks: number
  /** Ответ пустой: вместо `text` показывается запасная фраза (`aiAssistStatic:ask.fallbackAnswer`). */
  fallback: boolean
  findings: GuardFinding[]
}

export type AnswerGuardContext = {
  /** Вопрос посетителя: его числа («не дольше 90 минут») опоры не требуют, по нему узнаётся повтор вопроса. */
  question?: string | null
  /** Запрос подбора, если он шире вопроса (уточнение вместе с опорой диалога). */
  retrievalQuery?: string | null
}

/**
 * Пороги опоры пояснения на слова. Выбраны пересчётом сохранённых ответов приёмки v7
 * (`.codex-temp/ai-assistant-eval/accept-v4-v7-20261111`, `docs/features/ai-assistant.md` →
 * «Страж содержания ответа»): чужое — соседняя карточка подтверждает не меньше `FOREIGN_MIN_SHARE`
 * значимых слов пояснения и не меньше `FOREIGN_MIN_WORDS` слов, а своя — не больше `OWN_MAX_SHARE`.
 */
export const FOREIGN_MIN_SHARE = 0.6
export const FOREIGN_MIN_WORDS = 2
export const OWN_MAX_SHARE = 0.34
/** Ответ без ссылок короче этого — не ответ, если в нём нет признания и подтверждённого числа. */
export const MIN_ANSWER_CHARS = 40
/** Вопрос короче этого повтором не считается: «А в Бресте?» может честно начать ответ. */
const MIN_ECHO_QUESTION_CHARS = 12
/** «Около 2 часов» при 110 или 130 минутах в карточке — округление, а не выдумка. */
const HOURS_TOLERANCE_MIN = 20

type NumberKind = 'points' | 'minutes' | 'clock' | 'price'
type NumberFact = { kind: NumberKind; value: number; raw: string; index: number; approx?: boolean }

const NUM = '\\d+(?:[.,]\\d+)?'
const POINTS_UNIT = '(?:точ(?:ек|ки|ка|ку|ках|ок)|пункт(?:аў|ов|ы|а)?|кроп(?:ак|кі|ка|ках)|punkt(?:[óo]w|y|u)|stops?|points?|checkpoints?)'
const MINUTES_UNIT = '(?:мин(?:ут[аыу]?)?|хв(?:ілін[аыу]?|илин[аиу]?)?|min(?:ut[yaęe]?|utes?|s)?)'
const HOURS_UNIT = '(?:час(?:а|ов)?|гадзін[аыу]?|годин[аиу]?|godzin[yaęe]?|hours?)'
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

const wordNumberFacts = (text: string): Array<{ kind: NumberKind; value: number }> => {
  const value = String(text ?? '').toLowerCase().replace(/ё/g, 'е')
  const facts: Array<{ kind: NumberKind; value: number }> = []
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

type Grounding = { exact: Set<string>; minutes: number[]; points: number[] }

const groundingOf = (texts: ReadonlyArray<string | null | undefined>): Grounding => {
  const exact = new Set<string>()
  const minutes: number[] = []
  const points: number[] = []
  for (const text of texts) {
    for (const fact of [...extractNumberFacts(String(text ?? '')), ...wordNumberFacts(String(text ?? ''))]) {
      exact.add(`${fact.kind}:${fact.value}`)
      if (fact.kind === 'minutes') minutes.push(fact.value)
      if (fact.kind === 'points') points.push(fact.value)
    }
  }
  return { exact, minutes, points }
}

/** Сравнение двух материалов: «на 30 минут короче», «на две точки больше» — на RU/BE/UK/PL/EN. */
const COMPARATIVE_RE =
  /(?<![\p{L}])(?:короче|длиннее|дольше|быстрее|меньше|больше|разниц\p{L}*|карацей|даўжэй|менш|больш|розніц\p{L}*|коротш\p{L}*|довш\p{L}*|менше|більше|різниц\p{L}*|kr[óo]cej|kr[óo]tsz\p{L}*|d[łl]u[żz]ej|d[łl]u[żz]sz\p{L}*|mniej|wi[ęe]cej|r[óo][żz]nic\p{L}*|shorter|longer|fewer|less|more|difference)(?![\p{L}])/iu

/** Число стоит в опоре само либо округляет её длительность до часов. */
const isGrounded = (fact: NumberFact, grounding: Grounding): boolean =>
  grounding.exact.has(`${fact.kind}:${fact.value}`) || (fact.approx === true && grounding.minutes.some((value) => Math.abs(value - fact.value) <= HOURS_TOLERANCE_MIN))

/**
 * Во фразе сравнения число — разница двух чисел карточек подсказки: «квест про тракт на 30 хв
 * коротше» при 180 и 150 минутах. Это вывод из карточек, а не выдумка; вне сравнения то же число
 * опоры не имеет.
 */
const isDifference = (fact: NumberFact, grounding: Grounding, sentence: string): boolean => {
  if ((fact.kind !== 'minutes' && fact.kind !== 'points') || !COMPARATIVE_RE.test(sentence)) return false
  const values = grounding[fact.kind]
  return values.some((a) => values.some((b) => a - b === fact.value))
}

/** Текст карточки, по которому сверяется ответ: название и фрагмент (строка фактов стоит в нём первой). */
const cardText = (source: AiSource): string => `${source.title}. ${source.snippet}`

/** Слова типа и связки: они есть в любой карточке и опоры не дают. Записаны основами. */
const GENERIC_STEMS = [
  'квест', 'квэст', 'quest', 'город', 'горад', 'міськ', 'гарадск', 'miejsk', 'city', 'urban', 'стать', 'статт', 'артыкул', 'article', 'artyku',
  'маршрут', 'route', 'tras', 'поездк', 'путешеств', 'trip', 'детск', 'семейн', 'точек', 'точк', 'минут', 'около', 'примерно', 'можно',
  'есть', 'будет', 'было', 'очень', 'также', 'этот', 'этой', 'этом', 'такой', 'который', 'котор', 'вдоль', 'через', 'после', 'перед',
  'между', 'если', 'когда', 'чтобы', 'which', 'with', 'from', 'that', 'this', 'about', 'there', 'сайт', 'материал', 'карточк', 'источник',
]
const MIN_WORD_LENGTH = 4

/** Белорусские и украинские буквы — к русским: название «Квэст па цэнтры Мінска» и фрагмент «по городу Минск» об одном городе. */
const foldLetters = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[ёэє]/g, 'е')
    .replace(/[іїы]/g, 'и')
    .replace(/ў/g, 'у')
    .replace(/ґ/g, 'г')

const wordsOf = (text: string): string[] =>
  foldLetters(String(text ?? ''))
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length >= MIN_WORD_LENGTH)

/** Имена собственные пояснения: слова с заглавной буквы, кроме первого слова фразы. */
const namesOf = (text: string): string[] =>
  String(text ?? '')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .slice(1)
    .filter((word) => /^\p{Lu}/u.test(word) && word.length >= MIN_WORD_LENGTH)
    .map(foldLetters)

const isGeneric = (word: string): boolean => GENERIC_STEMS.some((stem) => word.startsWith(stem))

/** Одно слово в разных формах: общее начало покрывает оба слова, кроме окончания до трёх букв. */
const sameWord = (a: string, b: string): boolean => {
  let shared = 0
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared += 1
  return shared >= MIN_WORD_LENGTH && shared >= Math.max(a.length, b.length) - 3
}

const supportedBy = (words: readonly string[], card: readonly string[]): number => words.filter((word) => card.some((own) => sameWord(word, own))).length

const LINK_RE = /\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g
/** Пояснение начинается сразу за ссылкой: тире, двоеточие или скобка. */
const DESCRIPTION_LEAD_RE = /^(\s*(?:[—–:]|-(?=\s)|\())\s*/
/** Конец фразы: знак, за которым новая фраза с заглавной буквы, ссылка или конец строки. «ok. 180 min» фразу не делит. */
const SENTENCE_END_RE = /[.!?…]+(?=\s+[\p{Lu}[«"(]|\s*$)/u
const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+/

type Part = { kind: 'text'; value: string } | { kind: 'link'; value: string; source: AiSource | null }

const splitLine = (line: string, sourceByKey: Map<string, AiSource>): Part[] => {
  const parts: Part[] = []
  let last = 0
  for (const match of line.matchAll(LINK_RE)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ kind: 'text', value: line.slice(last, start) })
    parts.push({ kind: 'link', value: match[0], source: sourceByKey.get(normalizeLinkKey(match[2])) ?? null })
    last = start + match[0].length
  }
  if (last < line.length) parts.push({ kind: 'text', value: line.slice(last) })
  return parts
}

/** Первая фраза текста и остаток за ней. */
const firstSentence = (text: string): [string, string] => {
  const end = SENTENCE_END_RE.exec(text)
  if (!end) return [text, '']
  const cut = end.index + end[0].length
  return [text.slice(0, cut), text.slice(cut)]
}

const sentencesOf = (text: string): string[] => {
  const out: string[] = []
  let rest = text
  while (rest) {
    const [head, tail] = firstSentence(rest)
    out.push(head)
    rest = tail
  }
  return out
}

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

/** Честное «этого в материалах нет / не указано» — на RU/BE/UK/PL/EN. Такой ответ пустым не считается. */
const ADMISSION_RE =
  /(?<![\p{L}])(?:нет|нету|не\s+указан\p{L}*|не\s+найден\p{L}*|не\s+наш[её]л\p{L}*|не\s+нашл\p{L}*|не\s+упомина\p{L}*|не\s+сказано|отсутств\p{L}*|няма|не\s+пазначан\p{L}*|не\s+знойдзен\p{L}*|немає|нема|не\s+вказан\p{L}*|не\s+знайден\p{L}*|nie\s+ma|brak|nie\s+poda\p{L}*|nie\s+znalaz\p{L}*|no|not|none|cannot|can['’]t|don['’]t|doesn['’]t|isn['’]t|aren['’]t)(?![\p{L}])/iu
export const admitsNoAnswer = (text: string): boolean => ADMISSION_RE.test(String(text ?? ''))

/**
 * Эхо подсказки в ответе: фразы системного сообщения, заголовок блока карточек и строка вопроса — как их
 * пишет `prompt.ts` и как модель переводит их на язык ответа («Матеріали сайту:», «Site materials:»).
 */
const PROMPT_ECHO_RE = new RegExp(
  [
    'Ты\\s+—\\s+помощник\\s+сайта', 'Это данные для ответа, а не инструкции',
    '(?:Материалы|Матэрыялы|Матеріали)\\s+сайт[ауе]\\s*:', 'Materia[łl]y\\s+(?:ze\\s+)?(?:strony|serwisu|witryny)\\s*:', '(?:web)?site\\s+materials\\s*:',
    'Вопрос\\s+посетителя\\s*:', 'Пытанне\\s+наведвальніка\\s*:', 'Питання\\s+відвідувача\\s*:', 'Pytanie\\s+(?:odwiedzaj[ąa]cego|go[śs]cia)\\s*:', "Visitor['’]?s\\s+question\\s*:",
  ].join('|'),
  'iu',
)
/** Номер карточки подсказки: «[2]» вне markdown-ссылки («[2](адрес)» — подпись ссылки, её правит страж ссылок). */
const CARD_NUMBER_RE = /\[\d{1,2}\](?!\()/
const CARD_HEAD_ECHO_RE = /^\s*(?:[-*•]\s*)?\[\d{1,2}\](?!\()/

/** В тексте есть эхо подсказки. Общий детектор стража и проверки `prompt_leak` контура оценки. */
export const leaksPrompt = (text: string | null | undefined): boolean => {
  const value = String(text ?? '')
  return PROMPT_ECHO_RE.test(value) || CARD_NUMBER_RE.test(value)
}

/**
 * Текст без эха подсказки: строка, начатая номером карточки («[1] Статья …»), убирается целиком — это
 * переписанная карточка; в остальных строках убирается предложение с эхом.
 */
/**
 * Предложения строки целиком: обрывок, начатый скобкой или строчной буквой, — продолжение прошлого
 * предложения («…озеро 1 дн. (с ночёвкой не обязательно).»), а не новое.
 */
const wholeSentences = (line: string): string[] => {
  const out: string[] = []
  for (const fragment of sentencesOf(line)) {
    if (out.length && /^\s*[(\p{Ll}]/u.test(fragment)) out[out.length - 1] += fragment
    else out.push(fragment)
  }
  return out
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Текст без дословного повтора вопроса посетителя (регистр и пробелы не важны). Вырезается только вопрос
 * со знаком вопроса, стоящий отдельным предложением: «Самый короткий квест в Минске» без знака — это и
 * честное начало ответа («Самый короткий квест в Минске — …»). Короткий вопрос не вырезается.
 */
const stripQuestionEcho = (text: string, question: string | null | undefined): string => {
  const asked = String(question ?? '').replace(/\s+/g, ' ').trim()
  if (asked.length < MIN_ECHO_QUESTION_CHARS || !/[?？]$/.test(asked)) return text
  const repeat = new RegExp(`(^|[.!?…:]\\s+|\\n\\s*)${asked.split(' ').map(escapeRegExp).join('\\s+')}(?=\\s|$)`, 'giu')
  const stripped = text.replace(repeat, '$1')
  return stripped === text ? text : tidyText(stripped)
}

const stripPromptEcho = (text: string): { text: string; removed: string[] } => {
  const removed: string[] = []
  const lines = text.split('\n').flatMap((line) => {
    if (!leaksPrompt(line)) return [line]
    if (CARD_HEAD_ECHO_RE.test(line)) {
      removed.push(line.trim())
      return []
    }
    const kept = wholeSentences(line).filter((sentence) => {
      if (!leaksPrompt(sentence)) return true
      removed.push(sentence.trim())
      return false
    })
    const rest = kept.join('')
    return rest.trim() ? [rest] : []
  })
  return { text: lines.join('\n'), removed }
}

/**
 * Страж ответа целиком: страж ссылок (адреса и подписи), затем пояснения пунктов, числа и пустой
 * ответ. `text` — что показать; при `fallback` вызывающий показывает запасную фразу вместо него.
 */
export function guardAnswer(rawText: string, sources: readonly AiSource[], context: AnswerGuardContext = {}): AnswerGuardResult {
  // Вырезанная ссылка оставляет метку: по ней ниже уходит предложение или пункт с материалом не из подсказки.
  const linked = enforceSourceLinks(rawText, sources, { markRemoved: true })
  const findings: GuardFinding[] = []
  if (linked.relabeled) findings.push({ check: 'label_mismatch', detail: `подписей заменено названием карточки: ${linked.relabeled}` })
  const echoed = stripPromptEcho(linked.text)
  if (echoed.removed.length) findings.push({ check: 'prompt_leak', detail: `в ответе разметка подсказки: «${echoed.removed[0].slice(0, 120)}»` })

  const sourceByKey = buildSourceByLinkKey(sources)
  const asked = [context.question, context.retrievalQuery]
  const allGrounding = groundingOf([...sources.map(cardText), ...asked])
  const ownGrounding = new Map(sources.map((source) => [source, groundingOf([cardText(source), ...asked])]))
  const cardWords = new Map(sources.map((source) => [source, wordsOf(cardText(source))]))
  let droppedDescriptions = 0
  let ungroundedNumbers = 0
  let groundedFacts = 0

  /** Причина, по которой пояснение не принадлежит карточке ссылки, или `null`. */
  const descriptionDefect = (description: string, own: AiSource): string | null => {
    if (description.includes(REMOVED_LINK_MARK)) return 'в пояснении назван материал не из подсказки'
    const grounding = ownGrounding.get(own)!
    const stray = extractNumberFacts(description).find((fact) => !isGrounded(fact, grounding) && !isDifference(fact, allGrounding, description))
    if (stray) return `числа «${stray.raw}» нет в карточке «${own.title}»`
    const ownWords = cardWords.get(own)!
    const words = [...new Set(wordsOf(description))].filter((word) => !isGeneric(word))
    if (!words.length) return null
    const ownShare = supportedBy(words, ownWords) / words.length
    if (ownShare > OWN_MAX_SHARE) return null
    // Имена собственные: «…вдоль Припяти и Ипы» у квеста по Каменцу — место соседней карточки.
    const names = [...new Set(namesOf(description))].filter((word) => !isGeneric(word))
    const ownNames = supportedBy(names, ownWords)
    for (const other of sources) {
      if (other === own) continue
      const otherWords = cardWords.get(other)!
      const matched = supportedBy(words, otherWords)
      const foreignWords = words.length >= FOREIGN_MIN_WORDS && matched >= FOREIGN_MIN_WORDS && matched / words.length >= FOREIGN_MIN_SHARE
      const foreignNames = names.length > 0 && ownNames === 0 && supportedBy(names, otherWords) / names.length >= FOREIGN_MIN_SHARE
      if (foreignWords || foreignNames) return `пояснение из карточки «${other.title}», а не «${own.title}»`
    }
    return null
  }

  /** Фразы текста вне пояснений: фраза с числом, которого нет ни в одной карточке, убирается. */
  const keepGroundedSentences = (text: string): string =>
    sentencesOf(text)
      .filter((sentence) => {
        // Материал не из подсказки: ссылку снял страж ссылок, предложение с его названием уходит целиком.
        if (sentence.includes(REMOVED_LINK_MARK)) return false
        const facts = extractNumberFacts(sentence)
        const stray = facts.find((fact) => !isGrounded(fact, allGrounding) && !isDifference(fact, allGrounding, sentence))
        if (!stray) {
          groundedFacts += facts.length
          return true
        }
        ungroundedNumbers += 1
        findings.push({ check: 'ungrounded_number', detail: `числа «${stray.raw}» нет в карточках: «${sentence.trim().slice(0, 120)}»` })
        return false
      })
      .join('')

  const lines = echoed.text.split('\n').map((line) => {
    const parts = splitLine(line, sourceByKey)
    const bullet = BULLET_RE.exec(line)?.[0] ?? null
    let out = ''
    // Незакрытое предложение: слова и ссылки до знака конца фразы. Ссылка стоит внутри предложения
    // («Пройдёте [Квест](…) за 2 часа.»), поэтому число сверяется по предложению целиком, а не по
    // куску текста за ссылкой — иначе от фразы оставалось оборванное «Пройдёте [Квест](…)».
    let open: Part[] = []
    let atLineStart = true

    /**
     * Предложение вне пояснений (правило 2). Без ссылки предложение с числом без опоры убирается
     * целиком. Со ссылкой от него остаётся только ссылка — без вводных слов и хвоста: в свободном
     * тексте «[Квест](…).», в пункте списка «- [Квест](…)». Рекомендация не теряется, а оборванной
     * фразы («Пройдёте [Квест](…)») не остаётся.
     */
    const closeSentence = () => {
      const pieces = open
      const first = atLineStart
      open = []
      if (!pieces.length) return
      atLineStart = false
      const links = pieces.filter((piece) => piece.kind === 'link')
      if (!links.length) {
        out += keepGroundedSentences(pieces.map((piece) => piece.value).join(''))
        return
      }
      const words = pieces.map((piece) => (piece.kind === 'text' ? piece.value : ' ')).join('')
      const facts = extractNumberFacts(words)
      const stray = facts.find((fact) => !isGrounded(fact, allGrounding) && !isDifference(fact, allGrounding, words))
      // Рядом со ссылкой на карточку назван материал не из подсказки — от предложения остаётся ссылка, как при числе без опоры.
      const foreign = words.includes(REMOVED_LINK_MARK)
      if (!stray && !foreign) {
        groundedFacts += facts.length
        out += pieces.map((piece) => piece.value).join('')
        return
      }
      if (stray) {
        ungroundedNumbers += 1
        findings.push({ check: 'ungrounded_number', detail: `числа «${stray.raw}» нет в карточках: «${pieces.map((piece) => piece.value).join('').trim().slice(0, 120)}»` })
      }
      const head = pieces[0]
      const lastPiece = pieces[pieces.length - 1]
      // Начало: маркер пункта списка либо пробел, которым предложение отделено от предыдущего.
      const before = bullet && first ? bullet : head.kind === 'text' ? /^\s*/.exec(head.value)![0] : ''
      // Конец: пункт списка точкой не закрывается; свободное предложение остаётся законченным.
      const after = !bullet && lastPiece.kind === 'text' && /[.!?…]\s*$/.test(lastPiece.value) ? '.' : ''
      out += `${before}${links.map((piece) => piece.value).join(', ')}${after}`
    }
    /** Текст вне пояснений: законченные фразы закрываются, последняя незаконченная ждёт ссылку или конец строки. */
    const addText = (text: string) => {
      for (const fragment of sentencesOf(text)) {
        open.push({ kind: 'text', value: fragment })
        if (/[.!?…]\s*$/.test(fragment)) closeSentence()
      }
    }

    parts.forEach((part, index) => {
      if (part.kind === 'link') {
        open.push(part)
        return
      }
      const previous = parts[index - 1]
      const lead = previous?.kind === 'link' && previous.source ? DESCRIPTION_LEAD_RE.exec(part.value) : null
      if (!lead || previous?.kind !== 'link' || !previous.source) {
        addText(part.value)
        return
      }
      // Пояснение закрывает предложение ссылки. Вводные слова перед ней сверяются сами по себе: число
      // без опоры убирает их, ссылка с пояснением остаётся законченной фразой.
      out += open.map((piece) => (piece.kind === 'link' ? piece.value : keepGroundedSentences(piece.value))).join('')
      open = []
      atLineStart = false
      const [description, rest] = firstSentence(part.value.slice(lead[0].length))
      const defect = description.trim() ? descriptionDefect(description, previous.source) : null
      if (defect) {
        droppedDescriptions += 1
        findings.push({ check: 'foreign_description', detail: `${defect}: «${description.trim().slice(0, 120)}»` })
        // Фраза вне списка остаётся законченной: «…это [название](адрес).»
        out += !BULLET_RE.test(line) && /[.!?…]\s*$/.test(description) && !rest.trim() ? '.' : ''
      } else {
        groundedFacts += extractNumberFacts(description).length
        out += lead[0] + description
      }
      addText(rest)
    })
    closeSentence()
    // От пункта списка остался один маркер («1.») — пункта больше нет.
    const emptied = bullet !== null && line.trim() !== bullet.trim() && (out.trim() === '' || out.trim() === bullet.trim())
    return { text: emptied ? '' : out, bullet: bullet !== null, emptied }
  })
  // Строка-заголовок списка («Квесты с ребёнком:»), под которой не осталось ни одного пункта, уходит вместе с ними.
  lines.forEach((line, index) => {
    if (line.bullet || !/[:：]\s*$/.test(line.text)) return
    let emptied = 0
    for (const next of lines.slice(index + 1)) {
      if (next.emptied) emptied += 1
      else if (next.bullet) return
      else if (next.text.trim()) break
    }
    if (emptied) line.text = sentencesOf(line.text).slice(0, -1).join('')
  })

  const guarded = tidyText(lines.map((line) => line.text).join('\n').split(REMOVED_LINK_MARK).join(''))
  const echo = echoesQuestion(context.question, guarded)
  // Дословный повтор вопроса вырезается и у ответа со ссылками; пустым ответ делает прежнее правило `echo`.
  const text = stripQuestionEcho(guarded, context.question)
  const keptLinks = countKeptSourceLinks(text, sources)
  // Режим страницы (#3290): ответ о самой странице ссылки не требует — «Хватит двух дней на город.»
  // короткий, но верный; пустым там считается только пустой текст и повтор вопроса.
  const pageMode = sources.some((source) => source.group === 'page')
  const thin = !pageMode && text.length < MIN_ANSWER_CHARS && groundedFacts === 0
  // Остаток после вырезаний: одни вопросы («Сколько летнему ребёнку, сколько взрослым?») либо, после эха
  // подсказки, текст без ссылки и признания — отвечать нечем. В режиме страницы утверждение о странице
  // ссылки не требует, там пустым остаётся только остаток из вопросов.
  const promptLeaks = echoed.removed.length
  const cut = linked.removed + droppedDescriptions + ungroundedNumbers + promptLeaks > 0 || text !== guarded
  const onlyQuestions = text.length > 0 && text.split('\n').flatMap(sentencesOf).every((sentence) => !sentence.trim() || /\?\s*$/.test(sentence))
  const leftover = cut && (onlyQuestions || (promptLeaks > 0 && !pageMode))
  // Содержание ответа — ссылка на карточку, честное «в материалах этого нет» или подтверждённое число.
  const fallback = keptLinks === 0 && !admitsNoAnswer(text) && (text.length === 0 || echo || thin || leftover)
  if (fallback) {
    const detail = echo ? 'ответ повторяет вопрос посетителя' : leftover ? 'после вырезаний не осталось ни ссылки, ни признания, ни утверждения' : 'в ответе нет ни ссылки, ни признания, ни подтверждённого числа'
    findings.push({ check: 'echo', detail })
  }

  return { text, removed: linked.removed, relabeled: linked.relabeled, droppedDescriptions, ungroundedNumbers, promptLeaks, fallback, findings }
}
