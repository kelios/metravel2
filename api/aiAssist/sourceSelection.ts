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
 *      они, остальные уходят в группу «рядом».
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
import { matchPlaceSources, mentionsAnyPlace } from './promptPlace.ts'
import { judgeCard, parseConditions, type QuestionConditions } from './questionConditions.ts'
import { detectSuperlative, rankBySuperlative } from './sourceFacts.ts'
import { namedDestinations } from './topicGate.ts'
import type { AiSource } from './types'

export type ArrangeOptions = {
  /**
   * Кандидаты превосходной степени шире подбора — все квесты каталога карточками. Вызывается только
   * на вопрос с превосходной степенью.
   */
  pool?: () => readonly AiSource[]
  /**
   * Источник упоминает одно из названных мест. По умолчанию — название, фрагмент и место карточки;
   * служба смотрит весь текст источника в индексе (фрагмент карточки — 120 знаков).
   */
  mentions?: (source: AiSource, places: readonly string[]) => boolean
  /** `false` — только порядок, без групп: закреплённая страница (#2897), её карточки уже выбраны. */
  groups?: boolean
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

/** Карточки уже расставлены: режим страницы (#3290) или группы прошлого вызова. */
export const isArranged = (sources: readonly AiSource[]): boolean => sources.some((source) => source.group !== undefined)

/** Карточки, которые видит модель: всё, кроме группы «рядом». */
export const withoutNearby = <T extends AiSource>(sources: readonly T[]): T[] => sources.filter((source) => source.group !== 'nearby')

export const arrangeSources = (query: string | null | undefined, sources: readonly AiSource[], options: ArrangeOptions = {}): Arrangement => {
  const text = String(query ?? '')
  const conditions = parseConditions(text)
  if (!text.trim() || !sources.length || isArranged(sources)) return { sources: [...sources], conditions, noPlace: false }

  // 1. Место.
  const ofPlace = matchPlaceSources(text, sources)
  const candidates = ofPlace ?? sources
  const inPlace = new Set(candidates)
  const outside = sources.filter((source) => !inPlace.has(source))
  // Место названо, но отбор его не узнал (регион, место без своих карточек): кто его хотя бы упоминает.
  const destinations = ofPlace ? [] : namedDestinations(text)
  const mentions = options.mentions ?? mentionsInCard
  const about = destinations.length ? new Set(sources.filter((source) => mentions(source, destinations))) : null
  const noPlace = about !== null && about.size === 0

  // 2. Условия. Карточку, которая названного места не упоминает, условие не двигает и не поясняет: иначе
  // «без машины» ставило бы маршрут по Люксембургу первым на вопрос про Татры. Такие карточки остаются на
  // своих местах, по баллу переставляются только остальные.
  const movable = (source: AiSource): boolean => !about || about.has(source)
  const judge = (source: AiSource) => {
    const verdict = judgeCard(conditions, source)
    return movable(source) ? verdict : { reasons: [], score: 0, dropped: verdict.dropped }
  }
  const judged = candidates.map((source, index) => ({ source, index, ...judge(source) }))
  // Убирать можно, когда остаётся чем ответить — карточка, которая условий не нарушает. «Квесты в Гродно
  // до часа» при квестах от 90 минут: без них остались бы одни статьи (не тот вид материала), поэтому
  // квесты остаются как «ближайшее из того, что есть» — без строки «почему подходит».
  const canDrop = judged.some((entry) => !entry.dropped && entry.score >= 0)
  const withWhy = (source: AiSource, reasons: readonly string[]): AiSource => (reasons.length ? { ...source, why: reasons.join(', ') } : source)
  const staying = judged.filter((entry) => !canDrop || !entry.dropped)
  const ranked = staying.filter((entry) => movable(entry.source)).sort((a, b) => b.score - a.score || a.index - b.index)
  let next = 0
  const kept = staying
    .map((entry) => (movable(entry.source) ? ranked[next++] : entry))
    .map((entry) => withWhy(entry.source, entry.dropped ? [] : entry.reasons))
  const dropped = canDrop ? judged.filter((entry) => entry.dropped).map((entry) => entry.source) : []

  // 3. Превосходная степень. Карточки-ответы — единственные карточки подсказки: живая модель v7 при восьми
  // карточках называла статью, стоявшую последней («Самый короткий квест в Минске» — 1 из 3), при трёх
  // первых по сортировке — карточку-ответ (18 из 18 на шести формулировках, замер 11.11.2026).
  let ordered = kept
  let beyond: AiSource[] = []
  let placeInPool = false
  const superlative = detectSuperlative(text)
  if (superlative) {
    const ofPlaceInPool = options.pool ? matchPlaceSources(text, options.pool()) : null
    const passed = (ofPlaceInPool ?? kept).map((source) => ({ source, ...judge(source) })).filter((entry) => !entry.dropped)
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
