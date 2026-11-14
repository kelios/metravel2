/**
 * Подбор маршрутов мира под вопрос (#3357) — второй ярус ответа, блок «Ещё в мире».
 *
 * Внешний подбор включается только для вопроса о пешем маршруте (условие `route: 'foot'`, #3353) и идёт
 * после материалов сайта. Кандидаты — все карточки внешнего индекса (их сотни, перебор дешёвый):
 *   1. Условия вопроса сверяет тот же `judgeCard`, что у материалов сайта: длиннее названной границы,
 *      вне расчётного сезона, заметно дольше названного числа дней — карточка в блок не идёт.
 *   2. Место. Вопрос называет место («в Испании», «w Polsce») — в блок идут только маршруты, которые к нему
 *      относятся: страна на любом из пяти языков, название, псевдоним или описание. Таких нет — блока нет:
 *      на «поход в Беларуси» маршруты Шотландии не показываются. Часть света отбором не служит.
 *   3. Порядок: сколько условий совпало, затем смешанный ранг смысловой близости к вопросу и известности
 *      маршрута (число вики-статей) — тем же правилом слияния рангов, что гибрид «вектор + лексика».
 * В блок идут первые `AI_MAX_RECOMMENDATIONS`.
 *
 * Модуль общий для службы и тестов, без `@/`-импортов.
 */

import { AI_MAX_RECOMMENDATIONS } from './policy.ts'
import { mentionsAnyPlace } from './promptPlace.ts'
import { judgeCard, parseConditions, type QuestionConditions } from './questionConditions.ts'
import { namedDestinations } from './topicGate.ts'
import type { AiWorldTrail } from './trailFacts.ts'

export type WorldCandidate = {
  card: AiWorldTrail
  /** Близость вопроса к лучшему фрагменту маршрута, косинус. */
  similarity: number
  /** Число статей Википедии и Wikivoyage о маршруте — мера известности. */
  fame: number
  /** Названия, псевдонимы, описания и страны маршрута на всех языках индекса — для сверки места вопроса. */
  names: string
}

/** Внешний подбор нужен: вопрос о пешем маршруте. */
export const asksForWorldTrails = (conditions: QuestionConditions): boolean => conditions.route === 'foot'

/** Константа слияния рангов — та же, что у гибрида подбора (`RRF_K`, `scripts/ai-assist/search.ts`). */
const RANK_K = 60

/** Часть света и «весь мир» местом отбора не служат: «пеший маршрут в Европе» — вопрос без места. */
const BROAD_PLACE_RE = /^(?:европ|еўроп|європ|europ|ази|азі|asia|azj|америк|амерык|americ|ameryk|африк|афрык|afri|afry|мир|свет|світ|world|świat|swiat)/iu

const rankOf = <T>(items: readonly T[], value: (item: T) => number): Map<T, number> => {
  const sorted = [...items].sort((a, b) => value(b) - value(a))
  return new Map(sorted.map((item, index) => [item, index]))
}

export const selectWorldTrails = (query: string | null | undefined, candidates: readonly WorldCandidate[], limit: number = AI_MAX_RECOMMENDATIONS): AiWorldTrail[] => {
  const text = String(query ?? '')
  const conditions = parseConditions(text)
  if (!asksForWorldTrails(conditions) || !candidates.length) return []

  // «in June», «w lipcu»: название месяца после предлога места — условие сезона, а не место.
  const places = namedDestinations(text).filter((place) => !BROAD_PLACE_RE.test(place) && !parseConditions(place).months?.length)
  const pool = places.length ? candidates.filter((candidate) => mentionsAnyPlace(places, candidate.names)) : candidates
  if (!pool.length) return []

  const passed = pool
    .map((candidate) => ({ candidate, verdict: judgeCard(conditions, { type: candidate.card.type, trail: candidate.card }) }))
    .filter((entry) => !entry.verdict.dropped && !entry.verdict.unfit)
  const bySimilarity = rankOf(passed, (entry) => entry.candidate.similarity)
  const byFame = rankOf(passed, (entry) => entry.candidate.fame)
  const blended = (entry: (typeof passed)[number]): number => 1 / (RANK_K + (bySimilarity.get(entry) ?? 0)) + 1 / (RANK_K + (byFame.get(entry) ?? 0))
  return passed
    .sort((a, b) => b.verdict.score - a.verdict.score || blended(b) - blended(a) || a.candidate.card.source_id.localeCompare(b.candidate.card.source_id, 'en', { numeric: true }))
    .slice(0, limit)
    .map((entry) => entry.candidate.card)
}
