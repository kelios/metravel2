/**
 * Одна цепочка порядка карточек под вопрос (#3289): место → условия → превосходная степень.
 *
 * До неё порядок правили три места порознь: отбор по месту в подсказке (#3315), подъём детских
 * квестов города в службе (`liftForChildren`, #3276) и превосходная степень там же (#3287). Условия
 * вопроса кроме детей не проверял никто, а карточки чужих городов стояли в списке источников
 * вперемешку с подходящими.
 *
 * Шаги:
 *   1. Место (`matchPlaceSources`, #3315): названо место и у него есть карточки — дальше идут только
 *      они, остальные уходят в группу «рядом». В маршруте «из X в Y» место — Y (#3277). Город назван, а
 *      в подборе его карточек нет — кандидатами встают его квесты из каталога (`pool`) и найденные
 *      карточки, которые город упоминают: каталог знает написания города на всех локалях.
 *   2. Условия (`questionConditions.ts`): карточка с явным нарушением числового условия уходит в
 *      «рядом» (если после этого остаётся чем ответить); остальные встают по числу совпавших условий,
 *      при равенстве — в порядке подбора. Совпавшее записывается в `why` — строку «почему подходит»
 *      карточки подсказки.
 *   3. Превосходная степень (`detectSuperlative`, #3287): «самый короткий детский квест в Минске» —
 *      среди квестов места, прошедших условия, первыми встают до `AI_MAX_RECOMMENDATIONS` по факту.
 *      Служба отдаёт кандидатами все квесты индекса (`pool`): самого короткого может не быть в подборе.
 *      В подсказку идут только эти карточки-ответы, остальной подбор уходит в «рядом»: при восьми
 *      карточках модель называла не первую.
 *
 * Группы: подходящие карточки получают `match`, остальные — `nearby`; экран показывает вторые
 * отдельным блоком «Ещё по теме», в подсказку модели они не идут. Если отделять нечего, групп нет.
 *
 * Признак `noPlace`: вопрос называет место, которого нет ни в одной найденной карточке, — подсказка
 * получает строку «материала о месте нет». Условия тогда порядок не меняют: все карточки — «ближайшее».
 * То же для названного региона без своих карточек («в Татрах»): по условиям переставляются только
 * карточки, которые его упоминают, остальные стоят на своих местах.
 *
 * Модуль общий для экрана и службы, без `@/`-импортов.
 */

import { AI_MAX_RECOMMENDATIONS } from './policy.ts'
import { matchPlaceSources, mentionsAnyPlace, namesOnlyOrigin } from './promptPlace.ts'
import { judgeCard, parseConditions, type QuestionConditions } from './questionConditions.ts'
import { detectSuperlative, rankBySuperlative } from './sourceFacts.ts'
import { namedDestinations } from './topicGate.ts'
import type { AiSource } from './types'

export type ArrangeOptions = {
  /**
   * Кандидаты шире подбора — все квесты каталога карточками. Нужны превосходной степени («самый
   * короткий квест в Минске» может не попасть в подбор) и городу, который подбор не нашёл (#3277).
   * Вызывается только на такие вопросы.
   */
  pool?: () => readonly AiSource[]
  /**
   * Источник упоминает одно из названных мест. По умолчанию — название, фрагмент и место карточки;
   * служба смотрит весь текст источника в индексе (фрагмент карточки — 120 знаков). С проверкой по
   * всему тексту место, которого отбор #3315 не узнал («в Татрах», город без квеста), отбирает карточки:
   * не упоминающие его уходят в «рядом». По одному фрагменту карточки так отбирать нельзя — статья о
   * тропе в Закопане слова «Татры» в нём не несёт.
   */
  mentions?: (source: AiSource, places: readonly string[]) => boolean
  /** `false` — только порядок, без групп: закреплённая страница (#2897), её карточки уже выбраны. */
  groups?: boolean
  /**
   * `false` — не сокращать подсказку до карточек, выделенных условиями (служба выключает переменной
   * окружения для живого сравнения). По умолчанию сокращение включено.
   */
  focus?: boolean
}

export type Arrangement = {
  /** Карточки по порядку: подходящие, затем «рядом». */
  sources: AiSource[]
  conditions: QuestionConditions
  /** Вопрос называет место, которого нет ни в одной карточке. */
  noPlace: boolean
}

const keyOf = (source: Pick<AiSource, 'type' | 'source_id'>): string => `${source.type}:${source.source_id}`

const mentionsInCard = (source: AiSource, places: readonly string[]): boolean =>
  mentionsAnyPlace(places, [source.title, source.snippet, ...(source.place?.cities ?? []), ...(source.place?.countries ?? [])].filter(Boolean).join(' '))

/**
 * Карточки города, который подбор не нашёл (#3277): его квесты из каталога и те найденные карточки,
 * которые к городу относятся. С квестами каталога отбор по месту знает написания города на всех
 * локалях и находит статью по названию и фрагменту («Несвижский замок»); служба добавляет источники,
 * упоминающие город где-либо в тексте.
 */
const withCatalogPlace = (query: string, quests: readonly AiSource[], sources: readonly AiSource[], mentions: ArrangeOptions['mentions']): AiSource[] => {
  const ofPlace = new Set(matchPlaceSources(query, [...quests, ...sources], ['cities'], { strict: true }) ?? quests)
  const spellings = [...new Set(quests.flatMap((source) => source.place?.cities ?? []).filter((name): name is string => Boolean(name)))]
  return [...quests, ...sources.filter((source) => ofPlace.has(source) || mentions?.(source, spellings) === true)]
}

/** Карточки уже расставлены: режим страницы (#3290) или группы прошлого вызова. */
export const isArranged = (sources: readonly AiSource[]): boolean => sources.some((source) => source.group !== undefined)

/** Карточки, которые видит модель: всё, кроме группы «рядом». */
export const withoutNearby = <T extends AiSource>(sources: readonly T[]): T[] => sources.filter((source) => source.group !== 'nearby')

export const arrangeSources = (query: string | null | undefined, sources: readonly AiSource[], options: ArrangeOptions = {}): Arrangement => {
  const text = String(query ?? '')
  const conditions = parseConditions(text)
  if (!text.trim() || !sources.length || isArranged(sources)) return { sources: [...sources], conditions, noPlace: false }

  // 1. Место.
  const found = matchPlaceSources(text, sources)
  // Город назван, а среди найденного его карточек нет (#3277): смысловой подбор не узнал написание —
  // «да Нясвіжа» при русских текстах о Несвиже отдавал маршруты из Минска. Каталог знает город на всех
  // локалях: его квесты встают кандидатами, из найденного к ним идут карточки, которые город упоминают.
  // По всему каталогу город узнаётся строго: только по слову с заглавной буквы (названий сотни, слово со
  // строчной после предлога совпало бы с чьим-нибудь городом — «километров на сорок» и Сороки, lv23) и только
  // как место, куда едут: «недалеко от Минска» квестов Минска не просит. Подбор нашёл только город
  // отправления («из Минска в Заславль» — квесты Минска, Заславля нет) — место назначения тоже ищется в каталоге.
  const rescued =
    (found && !namesOnlyOrigin(text, sources)) || !options.pool ? null : matchPlaceSources(text, options.pool(), ['cities'], { strict: true })?.slice(0, AI_MAX_RECOMMENDATIONS)
  const ofPlace = rescued?.length ? withCatalogPlace(text, rescued, sources, options.mentions) : found
  // Место названо, но отбор его не узнал (регион, место без своих карточек): кто его хотя бы упоминает.
  const destinations = ofPlace ? [] : namedDestinations(text)
  const mentions = options.mentions ?? mentionsInCard
  const about = destinations.length ? new Set(sources.filter((source) => mentions(source, destinations))) : null
  const noPlace = about !== null && about.size === 0
  // Проверка по всему тексту источника (служба) надёжна настолько, чтобы отбирать: упоминающие место — кандидаты.
  const byMention = options.mentions && about?.size ? sources.filter((source) => about.has(source)) : null
  const candidates = ofPlace ?? byMention ?? sources
  const inPlace = new Set(candidates)
  const outside = sources.filter((source) => !inPlace.has(source))

  // 2. Условия. Карточку, которая названного места не упоминает, условие не двигает и не поясняет: иначе
  // «без машины» ставило бы маршрут по Люксембургу первым на вопрос про Татры. Такие карточки остаются на
  // своих местах, по баллу переставляются только остальные.
  const movable = (source: AiSource): boolean => !about || about.has(source)
  const judge = (source: AiSource) => {
    const verdict = judgeCard(conditions, source)
    return movable(source) ? verdict : { reasons: [], score: 0, dropped: verdict.dropped, unfit: verdict.unfit }
  }
  const judged = candidates.map((source, index) => ({ source, index, ...judge(source) }))
  // Убирать можно, когда остаётся чем ответить — карточка, которая условий не нарушает. «Квесты в Гродно
  // до часа» при квестах от 90 минут: без них остались бы одни статьи (не тот вид материала), поэтому
  // квесты остаются как «ближайшее из того, что есть» — без строки «почему подходит».
  // Карточка другой аудитории (`unfit`: детский квест на вопрос без детей) уходит всегда — пусть в
  // подсказке не останется ничего: модель честно скажет «подходящего нет», соседние карточки — «рядом».
  const canDrop = judged.some((entry) => !entry.dropped && entry.score >= 0)
  const gone = (entry: { dropped: boolean; unfit: boolean }): boolean => entry.unfit || (canDrop && entry.dropped)
  const withWhy = (source: AiSource, reasons: readonly string[]): AiSource => (reasons.length ? { ...source, why: reasons.join(', ') } : source)
  const staying = judged.filter((entry) => !gone(entry))
  const ranked = staying.filter((entry) => movable(entry.source)).sort((a, b) => b.score - a.score || a.index - b.index)
  let next = 0
  const kept = staying
    .map((entry) => (movable(entry.source) ? ranked[next++] : entry))
    .map((entry) => withWhy(entry.source, entry.dropped ? [] : entry.reasons))
  const dropped = judged.filter(gone).map((entry) => entry.source)

  // 3. Превосходная степень. Карточки-ответы — единственные карточки подсказки: живая модель v7 при восьми
  // карточках называла статью, стоявшую последней («Самый короткий квест в Минске» — 1 из 3), при трёх
  // первых по сортировке — карточку-ответ (18 из 18 на шести формулировках, замер 11.11.2026).
  let ordered = kept
  let beyond: AiSource[] = []
  let placeInPool = false
  const superlative = detectSuperlative(text)
  if (superlative) {
    const ofPlaceInPool = options.pool ? matchPlaceSources(text, options.pool()) : null
    const passed = (ofPlaceInPool ?? kept).map((source) => ({ source, ...judge(source) })).filter((entry) => !entry.dropped && !entry.unfit)
    // Среди прошедших — те, у кого совпало больше всего условий: «самый короткий детский» ищется среди детских.
    const top = Math.max(...passed.map((entry) => entry.score))
    const best = passed.filter((entry) => entry.score === top)
    const reasonsOf = new Map(best.map((entry) => [entry.source, entry.reasons]))
    // Квест, который нашёл и подбор, идёт его карточкой: фрагмент там подобран под вопрос.
    const found = new Map(kept.map((source) => [keyOf(source), source]))
    const lead = rankBySuperlative(
      superlative,
      best.map((entry) => entry.source),
      (source) => (source.facts?.type === 'quest' ? source.facts : null),
    )
      .slice(0, AI_MAX_RECOMMENDATIONS)
      .map((source) => found.get(keyOf(source)) ?? withWhy(source, reasonsOf.get(source) ?? []))
    if (lead.length) {
      const taken = new Set(lead.map(keyOf))
      ordered = lead
      beyond = kept.filter((source) => !taken.has(keyOf(source)))
      placeInPool = ofPlaceInPool !== null
    }
  }

  // Условия выделили немного карточек — не больше `AI_MAX_RECOMMENDATIONS` несут строку «почему подходит»:
  // подсказка сокращается до них с добором до трёх первыми по порядку. Это предел размера подсказки, а не
  // отсев: карточка без факта условий не нарушала и остаётся в списке источников группой «рядом». При семи
  // карточках живая модель v7 называла те, в названии которых стоит место вопроса, а не выделенную условием
  // («Закопане: лёгкая тропа» на «Татры для новичков» — 0 из 3; при трёх — 3 из 3, замер 12.11.2026).
  const singled = ordered.filter((source) => source.why)
  if (options.focus !== false && !beyond.length && singled.length > 0 && singled.length <= AI_MAX_RECOMMENDATIONS && ordered.length > AI_MAX_RECOMMENDATIONS) {
    const fill = ordered.filter((source) => !source.why).slice(0, AI_MAX_RECOMMENDATIONS - singled.length)
    const taken = new Set([...singled, ...fill])
    beyond = ordered.filter((source) => !taken.has(source))
    ordered = ordered.filter((source) => taken.has(source))
  }

  const rest = [...beyond, ...dropped, ...outside]
  const mark = options.groups !== false && rest.length > 0
  return {
    sources: mark
      ? [...ordered.map((source): AiSource => ({ ...source, group: 'match' })), ...rest.map((source): AiSource => ({ ...source, group: 'nearby' }))]
      : [...ordered, ...rest],
    conditions,
    // Первые места заняли квесты названного места из каталога — материал о месте есть, хотя подбор его не нашёл.
    noPlace: noPlace && !placeInPool,
  }
}
