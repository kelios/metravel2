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

export type RouteKind = 'foot' | 'bike'
/** Вид маршрута квеста: кроме пешего и вело — автоквест (тег `roadtrip`), которого у статей нет. */
export type QuestRouteKind = RouteKind | 'car'

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
  /** Вид маршрута квеста по тегам каталога (#3416, `questRouteKindOf`): пеший поход, велоквест, автоквест. */
  route?: QuestRouteKind
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
  /** Длина маршрута статьи, км (#3353, `routeLengthKm`): только у статей о пеших и веломаршрутах. */
  distance_km?: number
}

export type SourceFacts = QuestFacts | TravelFacts

/** Ключ источника в индексе: `quest:13`, `travel:816`. */
export const factsKey = (facts: { type: string; source_id: number }): string => `${facts.type}:${facts.source_id}`

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

// Составные слова, а не начало: «Веласкес» и «вела» — не велоквест, «автограф» — не автоквест.
const BIKE_QUEST_TITLE_RE = /(?<![\p{L}\p{N}])(?:вел[оа](?:квест|квэст|маршрут|поход|паход|прогулк|прагулк|тур)\p{L}*|rowerow\p{L}*|(?:bike|bicycle|cycling)\s+(?:quest|tour|ride|route))(?![\p{L}\p{N}])/iu
const CAR_QUEST_TITLE_RE = /(?<![\p{L}\p{N}])(?:авто(?:квест|путешеств|маршрут|подорож)\p{L}*|аўта(?:квэст|вандроўк|маршрут)\p{L}*|samochod\p{L}*|road\s?trip|car\s+quest)(?![\p{L}\p{N}])/iu

/**
 * Вид маршрута квеста (#3416, п.3) — по тегам каталога, иначе по названию: тег `bike` и «Велоквест из
 * Барановичей», «Quest rowerowy z Baranowicz» — вело; тег `hiking` — пеший поход; тег `roadtrip` без `bike` и
 * «Автоквест…» — на машине. Городская прогулка (`citywalk`) вида маршрута не несёт: `null`, как у статьи, о
 * которой каталог молчит. Без этого велоквест стоял в подсказке на «Szlak pieszy do 30 km w Polsce» (lv106).
 */
export const questRouteKindOf = (tags: readonly string[] | null | undefined, title?: string | null): QuestRouteKind | null => {
  const own = new Set((tags ?? []).map((tag) => String(tag).trim().toLowerCase()))
  if (own.has('bike')) return 'bike'
  if (own.has('hiking')) return 'foot'
  if (own.has('roadtrip')) return 'car'
  const name = String(title ?? '')
  if (BIKE_QUEST_TITLE_RE.test(name)) return 'bike'
  return CAR_QUEST_TITLE_RE.test(name) ? 'car' : null
}

/** Запись фактов квеста из полей каталога; неизвестное и пустое в запись не попадает. */
export const questFactsOf = (sourceId: number, input: QuestFactsInput): QuestFacts => {
  const audience = questAudience(input.tags ?? [])
  const route = questRouteKindOf(input.tags)
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
    ...(route ? { route } : {}),
  }
}

export type TravelFactsInput = {
  number_days?: unknown
  /** Номера месяцев, как их отдаёт `/api/travels/`: `[6, 7, 8]`. */
  month?: unknown
  transports?: unknown
  categories?: unknown
  /** Готовая длина маршрута, км — её считает `routeLengthKm` по названию и файлам маршрута. */
  distance_km?: unknown
}

/** Категории каталога, у которых статья — маршрут: пеший или на велосипеде. В нижнем регистре. */
export const FOOT_ROUTE_CATEGORIES: ReadonlySet<string> = new Set(['поход', 'хайкинг', 'треккинг'])
export const BIKE_ROUTE_CATEGORIES: ReadonlySet<string> = new Set(['велопоход', 'веломаршрут'])
const BIKE_TRANSPORT = 'велосипед'

const lowerNames = (values: readonly string[] | undefined): string[] => (values ?? []).map((value) => String(value).trim().toLowerCase())

/**
 * Вид маршрута статьи по категориям и транспорту каталога; `null` — статья не о маршруте либо каталог
 * этого не говорит. Статья с категориями обоих видов («Озеро Гарда: велодорожка и треккинг») — пешая:
 * пеший маршрут в ней есть.
 */
export const routeKindOf = (facts: Pick<TravelFacts, 'categories' | 'transports'> | null | undefined): RouteKind | null => {
  const categories = lowerNames(facts?.categories)
  if (categories.some((name) => FOOT_ROUTE_CATEGORIES.has(name))) return 'foot'
  if (categories.some((name) => BIKE_ROUTE_CATEGORIES.has(name)) || lowerNames(facts?.transports).includes(BIKE_TRANSPORT)) return 'bike'
  return null
}

/** Больше этого за день пешком и на велосипеде не проходят: длиннее — файл не о маршруте статьи. */
const MAX_KM_PER_DAY: Record<RouteKind, number> = { foot: 45, bike: 200 }
const TITLE_KM_RE = /(?<![\p{L}\p{N}.,])(\d{1,4}(?:[.,]\d)?)\s*(?:км|km)(?![\p{L}\p{N}])/giu

const roundKm = (value: number): number => Math.round(value * 10) / 10

/**
 * Длина маршрута статьи, км (#3353) — или `undefined`, когда надёжного числа нет. Замер 14.11.2026 по 434
 * статьям слепка индекса (`.codex-temp/3353/`): готового поля у статьи в API нет, число в тексте ненадёжно
 * («Расстояние около 180 км» — дорога из Минска, «длиной около 160 км» — вся сеть троп, несколько отрезков
 * в одной статье). Надёжных источника два, оба — только у статьи о пешем или веломаршруте (`routeKindOf`):
 *   1. число километров в названии — слова автора о своём маршруте («Mullerthal Trail: 112 км по Люксембургу»,
 *      «Паневники: петля от Чёрного Става, 8 км»); два разных числа в названии — числа нет;
 *   2. файл маршрута статьи (`/api/travels/<id>/routes/`, длину считает бэкенд по треку) — когда файл один.
 *      Несколько файлов — отрезки одного пути (три файла Mullerthal Trail: 37 + 39 + 37 км) либо варианты
 *      («46,7 км из Кракова или 18 км по долине»): без числа в названии длины нет. Файл длиннее дневного
 *      предела на число дней статьи — не её маршрут: «Веломаршрут вдоль Вислы» на день несёт файл всей
 *      трассы на 235 км, «Португальский путь» — трек на 4893 км с переездами.
 * На слепке индекса от 12.11.2026 длина находится у 27 из 125 статей о пеших маршрутах (22 %) и у 8 из 28
 * о веломаршрутах (29 %); у остальных условия длины не нарушены и не совпали.
 */
export const routeLengthKm = (input: { title?: string | null; kind: RouteKind | null; number_days?: unknown; routeFilesKm?: readonly unknown[] | null }): number | undefined => {
  if (!input.kind) return undefined
  const named = [...new Set(Array.from(String(input.title ?? '').matchAll(TITLE_KM_RE), (match) => Number(match[1].replace(',', '.'))).filter((value) => value > 0))]
  if (named.length === 1) return roundKm(named[0])
  if (named.length > 1) return undefined
  const files = (input.routeFilesKm ?? []).map(Number).filter((value) => Number.isFinite(value) && value > 0)
  if (files.length !== 1) return undefined
  const days = positiveInt(input.number_days) ?? 1
  return files[0] <= MAX_KM_PER_DAY[input.kind] * days ? roundKm(files[0]) : undefined
}

/** Длина маршрута словами карточки: «86», «9,6» — целое от двадцати километров, иначе до десятых. */
export const formatKm = (value: number): string => {
  const rounded = value >= 20 ? Math.round(value) : roundKm(value)
  return String(rounded).replace('.', ',')
}

export const travelFactsOf = (sourceId: number, input: TravelFactsInput): TravelFacts => {
  const days = positiveInt(input.number_days)
  const months = Array.isArray(input.month)
    ? [...new Set(input.month.map(positiveInt).filter((month): month is number => month !== undefined && month <= 12))].sort((a, b) => a - b)
    : []
  const transports = names(input.transports)
  const categories = names(input.categories)
  const distance = Number(input.distance_km)
  return {
    type: 'travel',
    source_id: sourceId,
    ...(days ? { number_days: days } : {}),
    ...(months.length ? { months } : {}),
    ...(transports ? { transports } : {}),
    ...(categories ? { categories } : {}),
    ...(typeof input.distance_km === 'number' && Number.isFinite(distance) && distance > 0 ? { distance_km: roundKm(distance) } : {}),
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

/**
 * Строка фактов карточки статьи: «Польша. Дней: 3. Месяцы: ноябрь, декабрь»; у статьи о маршруте с известной
 * длиной (#3353) — «Люксембург. Дней: 6. Длина: 112 км. Месяц: май». Прежние поля стоят теми же словами и в
 * том же порядке, длина — после числа дней.
 *
 * Место статьи — только страна (#3347). Города у статьи в каталоге нет: поле `cityName` API — подпись
 * первой точки маршрута (бэкенд, `travels/serializers.py` → `get_city_name` → `_first_travel_address`),
 * в слепке индекса от 12.11.2026 оно равно ей у 434 статей из 434. Строка «Испания, Madrid» у тура
 * Барселона — Мадрид — Ронда — Толедо, «Польша, Palenica Białczańska» у «Морского ока», «Беларусь,
 * Лысая гора (342 м)» у подборки тринадцати поездок выдавала точку маршрута за место статьи, и модель
 * переносила её в ответ. Страна — список стран каталога, он надёжен; город статьи стоит в её названии.
 * Поэтому построитель города не принимает вовсе: передать подпись точки сюда нельзя.
 */
export const travelFactsLine = (facts: Omit<TravelFacts, 'type' | 'source_id'> | null | undefined, place: Pick<FactsPlace, 'country'> = {}): string => {
  const months = (facts?.months ?? []).map((month) => MONTHS_RU[month - 1]).filter(Boolean)
  return joinParts([
    String(place.country ?? '').trim(),
    facts?.number_days ? `Дней: ${facts.number_days}` : '',
    facts?.distance_km ? `Длина: ${formatKm(facts.distance_km)} км` : '',
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
const COUNT_FILLER = '(?:\\s+(?:всего|число|количество|усяго|за\\s+[ўу]с[ёе]|колькасць|всього|за\\s+все|кількість|liczb[aęe]|number\\s+of))?\\s+'
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

const SUPERLATIVE_RU: Record<SuperlativeField, Record<Superlative['order'], string>> = {
  duration_min: { asc: 'самый короткий', desc: 'самый длинный' },
  points: { asc: 'меньше всего точек', desc: 'больше всего точек' },
  difficulty: { asc: 'самый лёгкий', desc: 'самый сложный' },
}

/**
 * Строка «почему подходит» карточки-ответа на превосходную степень (#3369): «самый длинный: 300 мин»,
 * «меньше всего точек: 6», «самый лёгкий». Слова русские, как вся карточка; `null` — у квеста нет факта.
 */
export const superlativeReason = (ask: Superlative, facts: QuestFacts): string | null => {
  const label = SUPERLATIVE_RU[ask.field][ask.order]
  if (ask.field === 'difficulty') return facts.difficulty ? label : null
  const value = facts[ask.field]
  if (!value) return null
  return ask.field === 'duration_min' ? `${label}: ${value} мин` : `${label}: ${value}`
}
