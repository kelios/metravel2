/**
 * Факты источника в карточке ассистента (#3287).
 *
 * Каталог знает о квесте число точек, длительность, сложность, «можно с собакой» и аудиторию, о
 * статье — число дней и месяцы поездки. До модели на пути службы `/ai/ask` это не доходило: формат
 * индекса хранил только текст, а карточку строили три места — экран (`questToSource`), служба
 * (`toSource`) и слепок обучения (`quest_card`). На «Сколько длится квест по Гродно?» модель
 * отвечала «точное время не указано», на «самый короткий квест в Минске» выдумывала название.
 *
 * Здесь одно правило для всех трёх:
 *   - запись фактов `SourceFacts` — строка `facts.jsonl` индекса (`scripts/ai-index/facts.ts`) и
 *     вход построителя; экран собирает её из каталога теми же `questFactsOf` / `travelFactsOf`;
 *   - строка фактов `questFactsLine` / `travelFactsLine` — начало карточки; слепок обучения строит
 *     её в `quest_card(facts=True)` / `travel_facts_line(facts=True)`
 *     (`scripts/ai-train/sets/rag_answers.py`), тест сверяет строки. Поля, на которых модель уже
 *     обучена, пишутся прежними словами и в прежнем порядке; новое только дописывается;
 *   - превосходная степень вопроса («самый короткий», «где меньше точек») решается сортировкой по
 *     фактам до модели: `detectSuperlative` и `rankBySuperlative`.
 *
 * Модуль без `@/`-импортов и без CommonJS — его грузит служба (`node --experimental-strip-types`).
 */

import { type QuestAudienceKind, questAudience, questAudienceLead } from './questAudience.ts'
import { detectIntent } from './retrievalQuery.ts'

export type QuestDifficulty = 'easy' | 'medium' | 'hard'

export type QuestFacts = {
  type: 'quest'
  source_id: number
  points?: number
  duration_min?: number
  difficulty?: QuestDifficulty
  /** `false` — каталог явно говорит «без собаки»; в строку карточки идёт только `true`. */
  pet_friendly?: boolean
  audience?: QuestAudienceKind
  /** Возраст по тегам `age-<от>-<до>`: общий диапазон. */
  age?: [number, number]
  /** Тег `adult-required`. */
  adult?: boolean
}

export type TravelFacts = {
  type: 'travel'
  source_id: number
  number_days?: number
  /** Месяцы поездки, 1–12, по возрастанию. */
  months?: number[]
  /** Названия из словаря каталога. В строку карточки не идут: список статей экрана их не отдаёт. */
  transports?: string[]
  categories?: string[]
}

export type SourceFacts = QuestFacts | TravelFacts

/** Ключ источника в индексе: `quest:13`, `travel:816`. */
export const factsKey = (facts: Pick<SourceFacts, 'type' | 'source_id'>): string => `${facts.type}:${facts.source_id}`

const positiveInt = (value: unknown): number | undefined => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const DIFFICULTIES: readonly QuestDifficulty[] = ['easy', 'medium', 'hard']

const names = (values: unknown): string[] | undefined => {
  if (!Array.isArray(values)) return undefined
  const list = [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
  return list.length ? list : undefined
}

export type QuestFactsInput = {
  points?: unknown
  duration_min?: unknown
  difficulty?: unknown
  pet_friendly?: unknown
  /** Включённые теги каталога — уже списком слагов (`enabledQuestTags` экрана, `questTags` индекса). */
  tags?: readonly string[]
}

/** Запись фактов квеста из полей каталога; неизвестное и пустое в запись не попадает. */
export const questFactsOf = (sourceId: number, input: QuestFactsInput): QuestFacts => {
  const audience = questAudience(input.tags ?? [])
  const points = positiveInt(input.points)
  const duration = positiveInt(input.duration_min)
  const difficulty = DIFFICULTIES.find((value) => value === input.difficulty)
  return {
    type: 'quest',
    source_id: sourceId,
    ...(points ? { points } : {}),
    ...(duration ? { duration_min: duration } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(typeof input.pet_friendly === 'boolean' ? { pet_friendly: input.pet_friendly } : {}),
    ...(audience ? { audience: audience.kind } : {}),
    ...(audience?.age ? { age: [audience.age[0], audience.age[1]] as [number, number] } : {}),
    ...(audience?.adult ? { adult: true } : {}),
  }
}

export type TravelFactsInput = {
  number_days?: unknown
  /** Номера месяцев, как их отдаёт `/api/travels/`: `[6, 7, 8]`. */
  month?: unknown
  transports?: unknown
  categories?: unknown
}

export const travelFactsOf = (sourceId: number, input: TravelFactsInput): TravelFacts => {
  const days = positiveInt(input.number_days)
  const months = Array.isArray(input.month)
    ? [...new Set(input.month.map(positiveInt).filter((month): month is number => month !== undefined && month <= 12))].sort((a, b) => a - b)
    : []
  const transports = names(input.transports)
  const categories = names(input.categories)
  return {
    type: 'travel',
    source_id: sourceId,
    ...(days ? { number_days: days } : {}),
    ...(months.length ? { months } : {}),
    ...(transports ? { transports } : {}),
    ...(categories ? { categories } : {}),
  }
}

export type FactsPlace = { city?: string | null; country?: string | null }

const joinParts = (parts: ReadonlyArray<string | null | undefined>): string =>
  parts.map((part) => String(part ?? '').trim()).filter(Boolean).join('. ')

/** Слова сложности — те же, что видела модель в обучении (`DIFFICULTY_RU` слепка). */
const DIFFICULTY_RU: Record<QuestDifficulty, string> = { easy: 'лёгкий', medium: 'средний', hard: 'сложный' }
export const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

/**
 * Строка фактов карточки квеста: «Детский городской квест по городу Несвиж (Беларусь). Возраст:
 * 8–10 лет. Со взрослым. Точек: 9. Длительность: 90 мин. Сложность: лёгкий. Можно с собакой».
 * Слова русские, как весь фрагмент: модель обучена на RU-карточках, ответ переводит сама.
 */
export const questFactsLine = (facts: Omit<QuestFacts, 'type' | 'source_id'> | null | undefined, place: FactsPlace = {}): string => {
  const audience = facts?.audience ? { kind: facts.audience, age: facts.age ?? null, adult: facts.adult === true } : null
  return joinParts([
    ...questAudienceLead(audience, place.city, place.country),
    facts?.points ? `Точек: ${facts.points}` : '',
    facts?.duration_min ? `Длительность: ${facts.duration_min} мин` : '',
    facts?.difficulty ? `Сложность: ${DIFFICULTY_RU[facts.difficulty]}` : '',
    facts?.pet_friendly === true ? 'Можно с собакой' : '',
  ])
}

/** Строка фактов карточки статьи: «Польша, Краков. Дней: 3. Месяцы: ноябрь, декабрь». */
export const travelFactsLine = (facts: Omit<TravelFacts, 'type' | 'source_id'> | null | undefined, place: FactsPlace = {}): string => {
  const months = (facts?.months ?? []).map((month) => MONTHS_RU[month - 1]).filter(Boolean)
  return joinParts([
    [place.country, place.city].map((value) => String(value ?? '').trim()).filter(Boolean).join(', '),
    facts?.number_days ? `Дней: ${facts.number_days}` : '',
    months.length === MONTHS_RU.length ? 'Месяцы: круглый год' : months.length ? `${months.length > 1 ? 'Месяцы' : 'Месяц'}: ${months.join(', ')}` : '',
  ])
}

export type SuperlativeField = 'duration_min' | 'points' | 'difficulty'
export type Superlative = { field: SuperlativeField; order: 'asc' | 'desc' }

// `\b` не знает кириллицы: граница слова — по букве. Диакритика польского необязательна («najkrotszy»).
const phrase = (...alternatives: string[]): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}])`, 'iu')

const VERY_RU = 'сам(?:ый|ая|ое|ые|ого|ую|ым|ой|ых)'
const VERY_BE = 'сам(?:ы|ая|ае|ыя|ага|ую|ым|ай|ых)'
const POINTS = '(?:точ(?:ек|ки|ках)|кроп(?:ак|кі|ках)|точок|punkt(?:[óo]w|y|ach)|points|stops)'
// «не больше пяти точек» — условие, а не превосходная степень: число между словами не допускается.
const COUNT_FILLER = '(?:\\s+(?:всего|число|количество|усяго|колькасць|всього|кількість|liczb[aęe]|number\\s+of))?\\s+'
const NOT_NEGATED = '(?<!(?:не|ня|nie|not|no)\\s+)'

const SUPERLATIVES: ReadonlyArray<[Superlative, RegExp]> = [
  [
    { field: 'points', order: 'asc' },
    phrase(`${NOT_NEGATED}(?:меньше|менее|наименьш\\p{L}*|минимум|менш|найменш\\p{L}*|мінімум|менше|mniej|najmniej|fewe(?:r|st)|least|less)${COUNT_FILLER}${POINTS}`),
  ],
  [
    { field: 'points', order: 'desc' },
    phrase(`${NOT_NEGATED}(?:больше|наибольш\\p{L}*|максимум|больш|найбольш\\p{L}*|більше|найбільш\\p{L}*|wi[ęe]cej|najwi[ęe]cej|most|more)${COUNT_FILLER}${POINTS}`),
  ],
  [
    { field: 'duration_min', order: 'asc' },
    phrase(
      `${VERY_RU}\\s+(?:коротк|быстр)\\p{L}*`, 'покороче', 'короче\\s+(?:всех|всего|других|остальных)', '(?:какой|который|что)\\s+(?:из\\s+них\\s+)?короче',
      'быстрее\\s+всего', 'меньше\\s+всего\\s+времени',
      `${VERY_BE}\\s+(?:каротк|хутк)\\p{L}*`, 'найкарацейш\\p{L}*', 'найкоротш\\p{L}*', 'найшвидш\\p{L}*',
      'najkr[óo]tsz\\p{L}*', 'najszybsz\\p{L}*', 'shortest', 'quickest', 'fastest', 'least\\s+time',
    ),
  ],
  [
    { field: 'duration_min', order: 'desc' },
    phrase(
      `${VERY_RU}\\s+(?:длинн|долг|продолжительн)\\p{L}*`, 'дольше\\s+всего', `${VERY_BE}\\s+(?:доўг|працягл)\\p{L}*`, 'найдаўжэйш\\p{L}*',
      'найдовш\\p{L}*', 'najd[łl]u[żz]sz\\p{L}*', 'longest',
    ),
  ],
  [
    { field: 'difficulty', order: 'asc' },
    phrase(
      `${VERY_RU}\\s+(?:л[её]гк|прост)\\p{L}*`, '(?:легче|проще)\\s+(?:всех|всего)', 'полегче', 'попроще',
      `${VERY_BE}\\s+(?:л[её]гк|прост)\\p{L}*`, 'найлягчэйш\\p{L}*', 'найпрасцейш\\p{L}*', 'найлегш\\p{L}*', 'найпростіш\\p{L}*',
      'naj[łl]atwiejsz\\p{L}*', 'najprostsz\\p{L}*', 'easiest', 'simplest',
    ),
  ],
  [
    { field: 'difficulty', order: 'desc' },
    phrase(
      `${VERY_RU}\\s+(?:сложн|трудн|тяж[её]л)\\p{L}*`, `${VERY_BE}\\s+(?:складан|цяжк)\\p{L}*`, 'найскладанейш\\p{L}*', 'найскладніш\\p{L}*', 'найважч\\p{L}*',
      'najtrudniejsz\\p{L}*', 'hardest', 'toughest', 'most\\s+(?:difficult|challenging)',
    ),
  ],
]

/**
 * Превосходная степень в запросе подбора — на RU/BE/UK/PL/EN. Число точек есть только у квеста;
 * «самый короткий» и «самый лёгкий» считаются вопросом о квесте, когда запрос называет квест
 * (`detectIntent`): «самый короткий путь из Минска в Гродно» карточки не переставляет.
 */
export const detectSuperlative = (query: string): Superlative | null => {
  const text = String(query ?? '')
  const found = SUPERLATIVES.find(([, pattern]) => pattern.test(text))?.[0]
  if (!found) return null
  return found.field === 'points' || detectIntent(text) === 'quest' ? found : null
}

const DIFFICULTY_RANK: Record<QuestDifficulty, number> = { easy: 1, medium: 2, hard: 3 }

const superlativeValue = (facts: QuestFacts, field: SuperlativeField): number | null => {
  if (field === 'difficulty') return facts.difficulty ? DIFFICULTY_RANK[facts.difficulty] : null
  return facts[field] ?? null
}

/**
 * Квесты с известным фактом по порядку ответа: первым — «самый короткий» (или длинный, с
 * наименьшим числом точек…). Без факта квест ответом быть не может и в список не входит. При
 * равной сложности впереди более короткий («самый лёгкий») или длинный («самый сложный»);
 * остальные равные сохраняют исходный порядок.
 */
export const rankBySuperlative = <T>(ask: Superlative, items: readonly T[], factsOf: (item: T) => QuestFacts | null | undefined): T[] => {
  const direction = ask.order === 'asc' ? 1 : -1
  const ranked: { item: T; index: number; value: number; tie: number }[] = []
  items.forEach((item, index) => {
    const facts = factsOf(item)
    const value = facts ? superlativeValue(facts, ask.field) : null
    if (!facts || value === null) return
    ranked.push({ item, index, value, tie: ask.field === 'difficulty' ? (facts.duration_min ?? Number.MAX_SAFE_INTEGER * (direction === 1 ? 1 : -1)) : 0 })
  })
  return ranked.sort((a, b) => direction * (a.value - b.value) || direction * (a.tie - b.tie) || a.index - b.index).map((entry) => entry.item)
}
