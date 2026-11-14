/**
 * Карточка пешего маршрута мира (#3357) — второй ярус ответа ассистента, блок «Ещё в мире».
 *
 * Маршруты лежат во внешнем индексе (`scripts/ai-index/world/`), отдельном от материалов сайта: перечень —
 * Wikidata, геометрия и длина — OpenStreetMap, набор высоты — Copernicus DEM, месяцы — климатические нормы
 * NASA POWER. Карточка несёт только проверяемые факты; прозы в ней нет. Модель внешних карточек не видит:
 * служба `/ai/ask` отдаёт их событием `sources` с `group: 'world'`, экран рисует блок сам.
 *
 * Модуль без импортов: его грузят служба (`node --experimental-strip-types`), сборка индекса и экран.
 */

/** Шкала SAC по возрастанию — значения тега `sac_scale` OpenStreetMap; `strolling` — ниже T1. */
export const SAC_SCALE = ['strolling', 'hiking', 'mountain_hiking', 'demanding_mountain_hiking', 'alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking'] as const
export type SacScale = (typeof SAC_SCALE)[number]

/** Класс тропы короткой подписью: T1–T6. */
export const SAC_GRADE_LABEL: Record<SacScale, string> = {
  strolling: 'T1',
  hiking: 'T1',
  mountain_hiking: 'T2',
  demanding_mountain_hiking: 'T3',
  alpine_hiking: 'T4',
  demanding_alpine_hiking: 'T5',
  difficult_alpine_hiking: 'T6',
}

/** Ступени нагрузки по возрастанию; ступень считает сборка индекса (`scripts/ai-index/world/effort.ts`). */
export const LOAD_STEPS = ['walk', 'hike', 'trained', 'alpine'] as const
export type LoadStep = (typeof LOAD_STEPS)[number]

/** Русские подписи ступеней — для строки фактов и журналов; экран переводит ступень по ключу i18n. */
export const LOAD_STEP_RU: Record<LoadStep, string> = {
  walk: 'прогулка',
  hike: 'поход',
  trained: 'поход для подготовленных',
  alpine: 'нужен горный опыт',
}

export const WORLD_CARD_TYPE = 'trail'
export const WORLD_GROUP = 'world'

/**
 * Путь файла слоя OpenStreetMap на сайте: слой полей, полученных из OSM, выкладывается под ODbL как
 * производная база. Файл кладётся в `public/assets/data/` после полной сборки индекса; служба отдаёт его
 * адрес (`AI_WORLD_LAYER_URL`) в событии `sources`, и экран показывает ссылку под блоком «Ещё в мире».
 */
export const WORLD_OSM_LAYER_PUBLIC_PATH = '/assets/data/world-trails-osm.jsonl'

/** Факты маршрута, с которыми сверяются условия вопроса (`judgeCard`, `questionConditions.ts`). */
export type TrailFacts = {
  /** Длина по геометрии OpenStreetMap, км. */
  distance_km?: number
  days?: number
  /** `true` — дни оценены от усилия, а не взяты из этапов источника. */
  days_estimated?: boolean
  /** Месяцы без снега по климатической норме, 1–12; двенадцать — устойчивого снега нет круглый год. */
  months?: number[]
  effort?: LoadStep
}

/** Внешняя карточка в событии `sources` потока `/ai/ask` (Task Contract #3357). */
export type AiWorldTrail = TrailFacts & {
  type: typeof WORLD_CARD_TYPE
  group: typeof WORLD_GROUP
  /** Идентификатор элемента Wikidata: `Q24777`. */
  source_id: string
  title: string
  /** Статья Википедии или Wikivoyage — открывается вне сайта. */
  url: string
  country: string | null
  ascent_m?: number
  max_alt_m?: number
  /** Технический класс тропы — старший заметный класс `sac_scale`. */
  grade?: SacScale
  /** `true` — ступень задал класс тропы: экран подписывает её «по разметке OpenStreetMap». */
  effort_by_grade?: boolean
  /** Источники фактов карточки одной строкой: «OpenStreetMap, Wikidata, Copernicus DEM, NASA POWER». */
  attribution: string
}

const positive = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined)
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Внешний адрес карточки: только абсолютный https-адрес (статьи Википедии и Wikivoyage других не имеют). */
export const isWorldUrl = (value: string): boolean => /^https:\/\/[^\s/]+\.[^\s/]+\/\S*$/i.test(value)

/**
 * Карточка из события `sources`: незнакомое и кривое отбрасывается. Без названия, адреса или идентификатора
 * карточки нет; факт неверного вида в карточку не попадает — экран его просто не покажет.
 */
export const parseWorldTrail = (value: unknown): AiWorldTrail | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (raw.type !== WORLD_CARD_TYPE || raw.group !== WORLD_GROUP) return null
  const title = text(raw.title)
  const url = text(raw.url)
  const sourceId = text(raw.source_id)
  if (!title || !sourceId || !isWorldUrl(url)) return null
  const months = Array.isArray(raw.months) ? [...new Set(raw.months.filter((month): month is number => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b) : []
  const grade = SAC_SCALE.find((scale) => scale === raw.grade)
  const effort = LOAD_STEPS.find((step) => step === raw.effort)
  const distance = positive(raw.distance_km)
  const days = positive(raw.days)
  const ascent = positive(raw.ascent_m)
  const maxAlt = positive(raw.max_alt_m)
  return {
    type: WORLD_CARD_TYPE,
    group: WORLD_GROUP,
    source_id: sourceId,
    title,
    url,
    country: text(raw.country) || null,
    ...(distance !== undefined ? { distance_km: distance } : {}),
    ...(days !== undefined ? { days: Math.round(days) } : {}),
    ...(days !== undefined && raw.days_estimated === true ? { days_estimated: true } : {}),
    ...(ascent !== undefined ? { ascent_m: Math.round(ascent) } : {}),
    ...(maxAlt !== undefined ? { max_alt_m: Math.round(maxAlt) } : {}),
    ...(grade ? { grade } : {}),
    ...(months.length ? { months } : {}),
    ...(effort ? { effort } : {}),
    ...(effort && raw.effort_by_grade === true ? { effort_by_grade: true } : {}),
    attribution: text(raw.attribution),
  }
}

/** Набор высоты на экране и в строке фактов: до сотни метров — расчёт по рельефу точнее не знает. */
export const roundClimb = (meters: number): number => (meters >= 1000 ? Math.round(meters / 100) * 100 : Math.round(meters / 10) * 10)
/** Высшая точка: до десяти метров. */
export const roundAltitude = (meters: number): number => Math.round(meters / 10) * 10

/** Соседние месяцы — диапазоном: `[[6, 10]]`, сезон через Новый год — `[[12, 3]]`. Двенадцать месяцев — пусто. */
export const monthRanges = (months: readonly number[] | null | undefined): Array<[number, number]> => {
  const own = [...new Set(months ?? [])].filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b)
  if (!own.length || own.length === 12) return []
  const ranges: Array<[number, number]> = []
  for (const month of own) {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === month - 1) last[1] = month
    else ranges.push([month, month])
  }
  // Декабрь и январь — один сезон: [1..3] и [12] читаются как «декабрь–март».
  if (ranges.length > 1 && ranges[0][0] === 1 && ranges[ranges.length - 1][1] === 12) {
    const tail = ranges.pop()!
    ranges[0] = [tail[0], ranges[0][1]]
  }
  return ranges
}

const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

/** Месяцы словами строки фактов: «июнь–октябрь», «декабрь–март». */
export const monthsLabelRu = (months: readonly number[] | null | undefined): string =>
  monthRanges(months)
    .map(([from, to]) => (from === to ? MONTHS_RU[from - 1] : `${MONTHS_RU[from - 1]}–${MONTHS_RU[to - 1]}`))
    .join(', ')

const kmRu = (value: number): string => String(value >= 20 ? Math.round(value) : Math.round(value * 10) / 10).replace('.', ',')
const spaced = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/**
 * Строка фактов карточки маршрута — по-русски, как строки фактов материалов сайта (`sourceFacts.ts`):
 * «Франция, Италия, Швейцария. Длина: 166 км. Дней: около 9 (оценка). Набор высоты: около 9 900 м. Высшая
 * точка: 2 540 м. Нагрузка: поход для подготовленных. Без снега по климатической норме: июль–август».
 * Идёт в событие `trace` контура оценки и в журналы; экран собирает подписи сам, по ключам i18n.
 */
export const trailFactsLine = (card: Omit<AiWorldTrail, 'type' | 'group' | 'source_id' | 'title' | 'url' | 'attribution'>): string =>
  [
    card.country ?? '',
    card.distance_km ? `Длина: ${kmRu(card.distance_km)} км` : '',
    card.days ? (card.days_estimated ? `Дней: около ${card.days} (оценка)` : `Дней: ${card.days}`) : '',
    card.ascent_m ? `Набор высоты: около ${spaced(roundClimb(card.ascent_m))} м` : '',
    card.max_alt_m ? `Высшая точка: ${spaced(roundAltitude(card.max_alt_m))} м` : '',
    card.effort ? `Нагрузка: ${LOAD_STEP_RU[card.effort]}${card.effort_by_grade ? ' (по разметке OpenStreetMap)' : ''}` : '',
    card.months?.length === 12 ? 'Без устойчивого снега круглый год (по норме)' : card.months?.length ? `Без снега по климатической норме: ${monthsLabelRu(card.months)}` : '',
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('. ')
