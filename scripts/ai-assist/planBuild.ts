/**
 * Детерминированная часть плана по дням (#3298): что из плана решает код, а не модель.
 *
 *   - **Регион.** Кандидаты плана — карточки одного места: всё, что дальше `PLAN_REGION_KM` от их
 *     географической середины (медианы координат), в план не идёт. Если карточек мало и медиана встала между
 *     городами, регион — самое плотное скопление карточек. Статья «Варшава — Закопане» с точкой в
 *     Варшаве не попадёт в план по Кракову, даже если город в ней упомянут.
 *   - **Часы.** Время на материал берётся из фактов карточки (#3287): у квеста — длительность, у статьи на
 *     несколько дней — целый день. Такая статья стоит в своём дне одна, а в план на один день не берётся, пока
 *     есть другие кандидаты. У однодневной статьи часов в фактах нет: годится оценка модели в
 *     пределах схемы, иначе — `PLAN_DEFAULT_HOURS`.
 *   - **Доводка плана модели** (`refinePlan`): порядок внутри дня — по расстоянию между координатами, от
 *     первого материала к ближайшему; сумма часов дня — не больше `PLAN_DAY_MAX_HOURS` (с детьми —
 *     `PLAN_DAY_MAX_HOURS_KIDS`), материалов — не больше `PLAN_MAX_ITEMS_PER_DAY`; что не поместилось,
 *     переносится в день, где есть место.
 *   - **Сборник.** Статья-перечень («19 маршрутов из Минска») — не пункт дня: в план не идёт, пока без неё
 *     остаётся из чего собирать (`isCollection`).
 *   - **Сборка кодом** (`assemblePlan`): когда модель не ответила по схеме или выключена. Жадно: день
 *     начинает самый близкий к вопросу материал, к нему добавляются ближайшие по карте, пока хватает часов.
 *     Число дней — не больше запрошенного и не больше того, на сколько хватает материалов по часам.
 *
 * Чистые функции без сети и модели.
 */
import type { SourceFacts } from '../../api/aiAssist/sourceFacts.ts'
import { haversineKm } from '../../utils/geoDistance.ts'
import type { PlanSource, RawPlan } from './planSchema.ts'

/**
 * Кто собирает план по умолчанию: `false` — код; путь модели включается переменной службы `AI_PLAN_MODEL=1`
 * и остаётся рабочим (проверка схемы, доводка, запасная сборка кодом).
 *
 * Правило включения пути модели по умолчанию: по схеме не меньше 90 % ответов И содержание не беднее сборки
 * кодом на том же наборе — доля дней с 2–4 материалами и число покрытых дней не ниже кодовых. Замер
 * 15.11.2026 на модели продукта v7 (`.codex-temp/3298/plans-side-by-side.md`): по схеме 94 %, но дней с 2–4
 * материалами 18 из 36 против 37 из 41 у кода, покрыто дней 36 из 49 против 41 — правило не выполнено.
 * Навык «план по дням: 2–4 материала в дне, все запрошенные дни» — задача круга обучения #3358.
 */
export const PLAN_MODEL_DEFAULT = false

/** Радиус региона плана от середины карточек места, км: город и окрестности на день пути. */
export const PLAN_REGION_KM = 50
/** Сумма часов одного дня — не больше. */
export const PLAN_DAY_MAX_HOURS = 10
/**
 * То же для плана с детьми (#3431, В2): десять часов материалов в день ребёнок не проходит. Предел равен
 * `PLAN_DAY_TARGET_HOURS` — «полному дню»: материал на целый день по-прежнему стоит в своём дне один.
 */
export const PLAN_DAY_MAX_HOURS_KIDS = 6
/** Сколько часов материалов делает день полным: по этому числу код решает, на сколько дней хватает материалов. */
export const PLAN_DAY_TARGET_HOURS = 6
export const PLAN_MAX_ITEMS_PER_DAY = 4
/** Сколько карточек места уходит модели и в сборку. */
export const PLAN_CANDIDATES_LIMIT = 12
/** Время на материал, когда фактов нет и оценки модели нет: полдня на статью, два часа на квест. */
export const PLAN_DEFAULT_HOURS: Readonly<Record<PlanSource, number>> = { travel: 4, quest: 2 }
/** Статья на несколько дней занимает день плана целиком. */
export const PLAN_MULTI_DAY_HOURS = 8
export const PLAN_MIN_ITEM_HOURS = 0.5
export const PLAN_MAX_ITEM_HOURS = 8

export interface PlanCandidate {
  type: PlanSource
  source_id: number
  title: string
  url: string
  path: string
  /** Строка фактов карточки — её видит модель. */
  facts_line: string
  lat: number | null
  lng: number | null
  cover: string | null
  city: string | null
  country: string | null
  facts: SourceFacts | null
}

export interface PlanItem {
  type: PlanSource
  source_id: number
  title: string
  url: string
  path: string
  hours: number
  lat: number | null
  lng: number | null
  cover: string | null
  city: string | null
  country: string | null
}

export interface PlanDay {
  items: PlanItem[]
}

export const candidateKey = (card: Pick<PlanCandidate, 'type' | 'source_id'>): string => `${card.type}:${card.source_id}`

const hasPoint = (card: Pick<PlanCandidate, 'lat' | 'lng'>): card is { lat: number; lng: number } =>
  typeof card.lat === 'number' && typeof card.lng === 'number' && Number.isFinite(card.lat) && Number.isFinite(card.lng) && !(card.lat === 0 && card.lng === 0)

const halfHours = (hours: number): number => Math.round(hours * 2) / 2
const clampHours = (hours: number): number => Math.min(PLAN_MAX_ITEM_HOURS, Math.max(PLAN_MIN_ITEM_HOURS, halfHours(hours)))

/** Часы материала по фактам карточки; `null` — в фактах времени нет. */
export const factHours = (card: Pick<PlanCandidate, 'facts'>): number | null => {
  const { facts } = card
  if (facts?.type === 'quest' && typeof facts.duration_min === 'number' && facts.duration_min > 0) return clampHours(facts.duration_min / 60)
  if (facts?.type === 'travel' && typeof facts.number_days === 'number' && facts.number_days >= 2) return PLAN_MULTI_DAY_HOURS
  return null
}

/** Часы материала в плане: факт карточки сильнее оценки модели; нет ни того ни другого — значение по умолчанию. */
export const itemHours = (card: PlanCandidate, modelHours?: number | null): number =>
  factHours(card) ?? (typeof modelHours === 'number' && Number.isFinite(modelHours) ? clampHours(modelHours) : PLAN_DEFAULT_HOURS[card.type])

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Середина карточек места — медиана координат: одна далёкая карточка её не сдвигает. */
export const regionCenter = (cards: ReadonlyArray<Pick<PlanCandidate, 'lat' | 'lng'>>): { lat: number; lng: number } | null => {
  const points = cards.filter(hasPoint)
  return points.length ? { lat: median(points.map((card) => card.lat)), lng: median(points.map((card) => card.lng)) } : null
}

/**
 * Карточки одного региона в прежнем порядке: без координат и дальше `radiusKm` от середины — вне плана.
 * Ни у одной карточки нет координат — порядок по карте невозможен, план не собирается (пустой список).
 *
 * Середина — медиана координат. Когда карточек мало и они далеко друг от друга, медиана встаёт между ними и
 * в радиус не попадает никто: у польского вопроса о Гданьске остались переведённый квест Гданьска и статья с
 * точкой во Вроцлаве — середина между городами, регион пуст. Тогда регион — самое плотное скопление: карточка,
 * вокруг которой в радиусе больше всего карточек (при равенстве — квест: его город — факт каталога, а статья
 * могла лишь упомянуть место; затем — более близкая к вопросу), и её соседи.
 */
export const regionCandidates = <T extends PlanCandidate>(cards: readonly T[], radiusKm: number = PLAN_REGION_KM): T[] => {
  const center = regionCenter(cards)
  if (!center) return []
  const located = cards.filter((card) => hasPoint(card))
  const around = (lat: number, lng: number): T[] => located.filter((card) => hasPoint(card) && haversineKm(lat, lng, card.lat, card.lng) <= radiusKm)
  const byMedian = around(center.lat, center.lng)
  if (byMedian.length) return byMedian
  let dense: T[] = []
  let denseQuest = false
  for (const anchor of located) {
    if (!hasPoint(anchor)) continue
    const cluster = around(anchor.lat, anchor.lng)
    const quest = anchor.type === 'quest'
    if (cluster.length > dense.length || (cluster.length === dense.length && quest && !denseQuest)) {
      dense = cluster
      denseQuest = quest
    }
  }
  return dense
}

const distanceKm = (a: Pick<PlanItem, 'lat' | 'lng'>, b: Pick<PlanItem, 'lat' | 'lng'>): number =>
  hasPoint(a) && hasPoint(b) ? haversineKm(a.lat, a.lng, b.lat, b.lng) : Number.POSITIVE_INFINITY

/** Порядок обхода: от первого материала к ближайшему ещё не взятому; равные расстояния — в исходном порядке. */
export const orderByNearest = <T extends Pick<PlanItem, 'lat' | 'lng'>>(items: readonly T[]): T[] => {
  if (items.length < 3) return [...items]
  const rest = [...items]
  const ordered = [rest.shift() as T]
  while (rest.length) {
    const last = ordered[ordered.length - 1]
    let best = 0
    for (let index = 1; index < rest.length; index += 1) if (distanceKm(last, rest[index]) < distanceKm(last, rest[best])) best = index
    ordered.push(rest.splice(best, 1)[0])
  }
  return ordered
}

const toItem = (card: PlanCandidate, hours: number): PlanItem => ({
  type: card.type,
  source_id: card.source_id,
  title: card.title,
  url: card.url,
  path: card.path,
  hours,
  lat: card.lat,
  lng: card.lng,
  cover: card.cover,
  city: card.city,
  country: card.country,
})

const hoursOf = (items: readonly PlanItem[]): number => items.reduce((sum, item) => sum + item.hours, 0)

/**
 * Материал занимает день целиком: по фактам карточки (#3287) он рассчитан на два дня и больше. Рядом с ним код
 * других материалов в этот день не ставит — «Гродно-августовский канал» на два дня и квест в тот же день
 * вместе не проходятся (живая QA 15.11.2026).
 */
export const isWholeDay = (card: Pick<PlanCandidate, 'facts'>): boolean => card.facts?.type === 'travel' && typeof card.facts.number_days === 'number' && card.facts.number_days >= 2

/** Какие материалы занимают день целиком — ключами `type:id`. */
const wholeDayKeys = (cards: readonly PlanCandidate[]): ReadonlySet<string> => new Set(cards.filter(isWholeDay).map(candidateKey))
const keyOfItem = (item: Pick<PlanItem, 'type' | 'source_id'>): string => `${item.type}:${item.source_id}`

/** Материал помещается в день: день пуст либо в нём нет и не появится материала на целый день, хватает часов и мест. */
const fitsDay = (day: readonly PlanItem[], item: PlanItem, whole: ReadonlySet<string>, maxHours: number): boolean =>
  day.length === 0 ||
  (!whole.has(keyOfItem(item)) && !day.some((placed) => whole.has(keyOfItem(placed))) && day.length < PLAN_MAX_ITEMS_PER_DAY && hoursOf(day) + item.hours <= maxHours)

const COLLECTION_TITLE_RE = /(?<![\p{L}\p{N}.,])(\d{1,3})\s+(?:[\p{L}-]+\s+){0,2}?(?:маршрут\p{L}*|мест(?:а|о)?|поезд(?:ок|ки|ка))(?![\p{L}\p{N}])/iu
/** Сколько маршрутов или мест в названии делает статью сборником. */
const COLLECTION_MIN_COUNT = 3

/**
 * Статья-сборник (#3431, В2): «Замки и усадьбы Беларуси: 19 маршрутов из Минска», «Что посмотреть вокруг
 * Кракова: 18 маршрутов», «Отдых у воды в Беларуси: 33 проверенных места», «Маршруты выходного дня из
 * Минска: 13 поездок». Это перечень поездок, а не место на карте: числа дней у неё в каталоге нет, и в плане
 * она вставала одним пунктом на четыре часа. Признак — статья без числа дней, в названии которой стоит число
 * маршрутов, мест или поездок от трёх (на слепке индекса 12.11.2026 таких семь из 434).
 */
export const isCollection = (card: Pick<PlanCandidate, 'type' | 'title' | 'facts'>): boolean => {
  if (card.type !== 'travel' || (card.facts?.type === 'travel' && card.facts.number_days !== undefined)) return false
  const count = Number(COLLECTION_TITLE_RE.exec(card.title)?.[1])
  return Number.isInteger(count) && count >= COLLECTION_MIN_COUNT
}

/** Меньше материалов план по дням не образуют (тот же порог, что у отказа `422 invalid_plan`). */
const PLAN_MIN_CARDS = 2

/**
 * Карточки, из которых собирается план. Статья-сборник в план не идёт, пока без неё остаётся из чего
 * собирать. Материал на целый день не берётся в план на один день, пока есть другие кандидаты: однодневный
 * план из одной статьи «на два дня» не план. Других нет — карточки остаются как есть.
 */
const forDays = (cards: readonly PlanCandidate[], days: number): readonly PlanCandidate[] => {
  const single = cards.filter((card) => !isCollection(card))
  const usable = single.length >= PLAN_MIN_CARDS ? single : cards
  if (days !== 1) return usable
  const regular = usable.filter((card) => !isWholeDay(card))
  return regular.length ? regular : usable
}

export interface BuildOptions {
  /** Запрошенное число дней: план не длиннее. */
  days: number
  /** Предел часов одного дня; по умолчанию `PLAN_DAY_MAX_HOURS`, для плана с детьми — `PLAN_DAY_MAX_HOURS_KIDS`. */
  maxDayHours?: number
}

/**
 * Доводка плана модели. Материалы остаются в днях, куда их поставила модель, пока день не переполнен по
 * часам или числу материалов; лишнее переносится в первый день с местом, а если запрошенных дней ещё
 * нет — в новый день. Материал на целый день (`isWholeDay`) стоит в своём дне один; в план на один день он
 * не берётся, если есть другие кандидаты. Пустых дней в ответе нет.
 */
export function refinePlan(plan: RawPlan, cards: readonly PlanCandidate[], options: BuildOptions): PlanDay[] {
  const allowed = forDays(cards, options.days)
  const byKey = new Map(allowed.map((card) => [candidateKey(card), card]))
  const whole = wholeDayKeys(allowed)
  const maxHours = options.maxDayHours ?? PLAN_DAY_MAX_HOURS
  const days: PlanItem[][] = []
  const spill: PlanItem[] = []
  for (const day of plan.days.slice(0, options.days)) {
    const kept: PlanItem[] = []
    for (const raw of day.items) {
      const card = byKey.get(`${raw.source}:${raw.id}`)
      if (!card) continue
      const item = toItem(card, itemHours(card, raw.hours))
      if (fitsDay(kept, item, whole, maxHours)) kept.push(item)
      else spill.push(item)
    }
    days.push(kept)
  }
  for (const item of spill) {
    const target = days.find((day) => day.length > 0 && fitsDay(day, item, whole, maxHours))
    if (target) target.push(item)
    else if (days.filter((day) => day.length > 0).length < options.days) days.push([item])
  }
  return days.filter((day) => day.length > 0).slice(0, options.days).map((day) => ({ items: orderByNearest(day) }))
}

/**
 * Сборка плана кодом из карточек в порядке близости к вопросу. Сколько дней — по часам: материалов на
 * `PLAN_DAY_TARGET_HOURS` в день; меньше — план короче запрошенного. Каждый день начинает самый близкий к
 * вопросу из оставшихся, дальше — ближайшие к нему по карте, пока хватает часов и мест в дне. Материал на
 * целый день (`isWholeDay`) начинает свой день и остаётся в нём один; в план на один день он не берётся,
 * если есть другие кандидаты.
 */
export function assemblePlan(cards: readonly PlanCandidate[], options: BuildOptions): PlanDay[] {
  const allowed = forDays(cards, options.days)
  const whole = wholeDayKeys(allowed)
  const maxHours = options.maxDayHours ?? PLAN_DAY_MAX_HOURS
  const pool = allowed.map((card) => toItem(card, itemHours(card)))
  if (!pool.length) return []
  const total = hoursOf(pool)
  const dayCount = Math.max(1, Math.min(options.days, pool.length, Math.ceil(total / PLAN_DAY_TARGET_HOURS)))
  // Материалы на целый день в расчёт «сколько в день» не входят: каждый из них — отдельный день.
  const regularCount = pool.filter((item) => !whole.has(keyOfItem(item))).length
  const regularDays = Math.max(1, dayCount - (pool.length - regularCount))
  const perDay = Math.min(PLAN_MAX_ITEMS_PER_DAY, Math.max(1, Math.ceil(regularCount / regularDays)))
  const days: PlanDay[] = []
  const rest = [...pool]
  while (days.length < dayCount && rest.length) {
    const day = [rest.shift() as PlanItem]
    while (day.length < perDay && rest.length) {
      const last = day[day.length - 1]
      // Ближайший по карте из тех, что помещаются по часам.
      let best = -1
      for (let index = 0; index < rest.length; index += 1) {
        if (!fitsDay(day, rest[index], whole, maxHours)) continue
        if (best < 0 || distanceKm(last, rest[index]) < distanceKm(last, rest[best])) best = index
      }
      if (best < 0) break
      day.push(rest.splice(best, 1)[0])
    }
    days.push({ items: orderByNearest(day) })
  }
  return days
}
