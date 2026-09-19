import { queueAnalyticsEvent } from '@/utils/analytics'
import { getAnalyticsContext } from '@/utils/analyticsContext'
import { readConsent } from '@/utils/consent'

/**
 * Сквозная воронка прохождения квеста.
 *
 * Семь шагов, читаемых подряд в GA4 и в составной цели Метрики:
 *
 *   quest_view → quest_start → quest_point_1_done →
 *   quest_progress_25 → quest_progress_50 → quest_progress_75 →
 *   quest_completion_credited
 *
 * Шаги 2 и 7 — СУЩЕСТВУЮЩИЕ события, а не новые синонимы. `quest_start` живёт с
 * #1498, `quest_completion_credited` — с #1443, и оба уже могли попасть в цели
 * Метрики; заводить рядом `quest_completed` значило бы удвоить одно и то же
 * попадание и развести два ответа на вопрос «сколько дошло до конца». Поэтому
 * новыми заводятся только те шаги, которых действительно не было.
 *
 * `quest_finish` остаётся отдельной деталью «прохождение закончилось» — оно
 * стреляет и на досрочный выход (`early`), и на незачтённый порог (`partial`),
 * то есть НЕ равно «дошёл до конца» и дном воронки быть не может.
 *
 * Вехи 25/50/75 хранятся в localStorage на прохождение, а не в памяти
 * компонента. Квест идут пешком часами, с перезагрузками и возвратами: веха,
 * живущая в рефе, перевыстреливала бы на каждом заходе, и середина воронки
 * оказалась бы шире её старта.
 */

const RUN_STORAGE_PREFIX = 'metravel_quest_funnel_v1:'

export const QUEST_FUNNEL_EVENTS = {
  /** Шаг 1. Карточка квеста открыта — вершина воронки. */
  view: 'quest_view',
  /** Шаг 2. Игрок встал на первую настоящую точку. */
  start: 'quest_start',
  /** Шаг 3. Первая точка закрыта: главный обрыв воронки. */
  firstPoint: 'quest_point_1_done',
  /** Шаги 4–6. Пороги прохождения. */
  progress25: 'quest_progress_25',
  progress50: 'quest_progress_50',
  progress75: 'quest_progress_75',
  /** Шаг 7. Прохождение засчитано порогом политики (#1443). */
  completed: 'quest_completion_credited',
  /** Деталь: прохождение закончилось любым способом, включая досрочный выход. */
  finished: 'quest_finish',
} as const

/** Пороги в процентах закрытых точек и события, которыми они помечаются. */
const MILESTONES: Array<{ key: string; pct: number; event: string }> = [
  { key: 'point_1', pct: 0, event: QUEST_FUNNEL_EVENTS.firstPoint },
  { key: 'p25', pct: 25, event: QUEST_FUNNEL_EVENTS.progress25 },
  { key: 'p50', pct: 50, event: QUEST_FUNNEL_EVENTS.progress50 },
  { key: 'p75', pct: 75, event: QUEST_FUNNEL_EVENTS.progress75 },
]

type QuestFunnelRun = {
  runId: string
  /** Начало прохождения, ms. Источник `duration_sec`. */
  startedAt: number
  /** Уже отмеченные вехи: ключи из `MILESTONES`. */
  milestones: string[]
  /**
   * Сколько точек было закрыто на прошлом наблюдении. По приросту отличается
   * реальное прохождение точки от приехавшего прогресса — см. `trackQuestProgress`.
   */
  lastPassedCount: number
  /**
   * Прохождение было начато ДО появления воронки (или запись потерялась):
   * точки уже закрыты, а настоящего времени старта мы не знаем. Такие
   * прохождения не сообщают `duration_sec` вовсе — неверное число хуже, чем
   * отсутствующее.
   */
  backfilled?: boolean
}

type QuestFunnelParams = {
  questId?: string | null
  cityId?: string | null
  passedCount?: number
  stepsCount?: number
}

const isAnalyticsAllowed = () => readConsent()?.analytics === true

const storage = (): Storage | undefined => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

const runKey = (questId?: string | null) => `${RUN_STORAGE_PREFIX}${String(questId ?? 'unknown')}`

const readRun = (questId?: string | null): QuestFunnelRun | null => {
  try {
    const raw = storage()?.getItem(runKey(questId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<QuestFunnelRun>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.runId !== 'string' || typeof parsed.startedAt !== 'number') return null
    return {
      runId: parsed.runId,
      startedAt: parsed.startedAt,
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones.filter((m) => typeof m === 'string') : [],
      lastPassedCount: typeof parsed.lastPassedCount === 'number' ? parsed.lastPassedCount : 0,
      backfilled: parsed.backfilled === true,
    }
  } catch {
    return null
  }
}

const writeRun = (questId: string | null | undefined, run: QuestFunnelRun) => {
  try {
    storage()?.setItem(runKey(questId), JSON.stringify(run))
  } catch {
    // Переполненное или заблокированное хранилище не должно ронять прохождение.
  }
}

const newRunId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const passedPct = (passedCount?: number, stepsCount?: number) => {
  const passed = Number(passedCount ?? 0)
  const total = Number(stepsCount ?? 0)
  if (!Number.isFinite(passed) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((passed / total) * 100)))
}

/** Вехи, взятые при данном числе закрытых точек. */
const reachedMilestones = (passedCount?: number, stepsCount?: number): string[] => {
  const passed = Number(passedCount ?? 0)
  if (!Number.isFinite(passed) || passed <= 0) return []
  const pct = passedPct(passedCount, stepsCount)
  return MILESTONES.filter((m) => (m.key === 'point_1' ? passed >= 1 : pct >= m.pct)).map((m) => m.key)
}

const emit = (eventName: string, params: Record<string, unknown>) => {
  const compact = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
  queueAnalyticsEvent(eventName, compact)
}

const baseParams = (
  { questId, cityId, passedCount, stepsCount }: QuestFunnelParams,
  run?: QuestFunnelRun | null,
) => ({
  ...getAnalyticsContext(),
  quest_id: questId ?? undefined,
  city_id: cityId ?? undefined,
  run_id: run?.runId,
  passed_count: typeof passedCount === 'number' ? passedCount : undefined,
  steps_count: typeof stepsCount === 'number' ? stepsCount : undefined,
  progress_pct: typeof stepsCount === 'number' ? passedPct(passedCount, stepsCount) : undefined,
  ...durationParams(run),
})

/**
 * Время от старта до текущего шага. На восстановленном «слепом» прохождении не
 * сообщается вовсе (см. `backfilled`).
 */
const durationParams = (run?: QuestFunnelRun | null): { duration_sec?: number } => {
  if (!run || run.backfilled) return {}
  const seconds = Math.round((Date.now() - run.startedAt) / 1000)
  if (!Number.isFinite(seconds) || seconds < 0) return {}
  return { duration_sec: seconds }
}

/**
 * Шаг 1: карточка квеста открыта.
 *
 * `source` здесь — поверхность, с которой открыли карточку, ровно в том же
 * смысле, что у `quest_card_click` и остальных событий `growthFunnelAnalytics`.
 * Источник визита лежит в общем блоке измерений под именем `traffic_source` и с
 * ним не сталкивается.
 */
export const trackQuestView = (params: QuestFunnelParams & { source?: string }) => {
  if (!isAnalyticsAllowed()) return
  emit(QUEST_FUNNEL_EVENTS.view, {
    ...baseParams(params, readRun(params.questId)),
    source: params.source,
  })
}

/**
 * Шаг 2: игрок встал на первую настоящую точку. Здесь же заводится прохождение.
 *
 * Событие намеренно стреляет на каждый заход, а не один раз на прохождение:
 * воронка в обоих провайдерах считает уникальных пользователей/визиты, дошедших
 * до шага, а не число событий, и возврат к брошенному квесту — настоящий заход.
 * Отличить его позволяет `is_resumed`.
 *
 * Возвращает `false`, если прохождение не заведено (нет согласия на аналитику).
 * Вызывающий по этому признаку не защёлкивает «старт отправлен»: игрок мог
 * принять баннер уже внутри квеста, и следующая же закрытая точка заводит
 * воронку целиком, вместо того чтобы молчать до конца маршрута.
 */
export const trackQuestStart = (params: QuestFunnelParams): boolean => {
  if (!isAnalyticsAllowed()) return false

  const existing = readRun(params.questId)
  const alreadyPassed = Number(params.passedCount ?? 0)

  const run: QuestFunnelRun = existing ?? {
    runId: newRunId(),
    startedAt: Date.now(),
    // Прохождение уже идёт, а записи нет: точки, закрытые до появления воронки,
    // помечаем взятыми молча. Иначе первый же заход выстрелил бы очередью
    // «первая точка + 25% + 50%» и нарисовал всплеск, которого не было.
    milestones: alreadyPassed > 0 ? reachedMilestones(params.passedCount, params.stepsCount) : [],
    lastPassedCount: alreadyPassed > 0 ? alreadyPassed : 0,
    backfilled: alreadyPassed > 0,
  }

  if (!existing) writeRun(params.questId, run)

  emit(QUEST_FUNNEL_EVENTS.start, {
    ...baseParams(params, run),
    is_resumed: Boolean(existing) || run.backfilled === true,
  })
  return true
}

/**
 * Шаги 3–6: первая точка и пороги 25/50/75.
 *
 * Идемпотентно по прохождению: каждая веха уходит один раз, даже если игрок
 * перезагрузил страницу или вернулся через неделю.
 *
 * Прогресс приезжает АСИНХРОННО — сначала AsyncStorage, потом ответ бэкенда, и
 * у квеста без intro визард успевает встать на первую точку раньше них обоих.
 * Поэтому «взял веху» отличается от «увидели чужие точки» не флагом загрузки
 * (его порядок не гарантирован ни одним из трёх источников), а приростом:
 * игрок закрывает точки по одной, и скачок больше чем на одну точку за тик —
 * это восстановленный прогресс, а не прохождение. Такие вехи записываются
 * молча, а прохождение помечается `backfilled`: раз точки старше этой записи,
 * её время старта не является настоящим и `duration_sec` из него считать
 * нельзя.
 */
export const trackQuestProgress = (params: QuestFunnelParams) => {
  if (!isAnalyticsAllowed()) return

  const run = readRun(params.questId)
  if (!run) return

  const passed = Number(params.passedCount ?? 0)
  if (!Number.isFinite(passed) || passed < 0) return
  if (passed === run.lastPassedCount) return

  const reached = reachedMilestones(params.passedCount, params.stepsCount)
  const fresh = reached.filter((key) => !run.milestones.includes(key))
  const restored = passed - run.lastPassedCount > 1

  const nextRun: QuestFunnelRun = {
    ...run,
    milestones: [...run.milestones, ...fresh],
    lastPassedCount: passed,
    backfilled: run.backfilled || (restored && fresh.length > 0),
  }
  writeRun(params.questId, nextRun)

  if (restored || !fresh.length) return

  for (const key of fresh) {
    const milestone = MILESTONES.find((m) => m.key === key)
    if (!milestone) continue
    emit(milestone.event, baseParams(params, nextRun))
  }
}

/** Шаг 7: прохождение засчитано. `duration_sec` здесь — время от старта до финиша. */
export const trackQuestCompleted = (params: QuestFunnelParams) => {
  if (!isAnalyticsAllowed()) return
  emit(QUEST_FUNNEL_EVENTS.completed, baseParams(params, readRun(params.questId)))
}

/** Деталь вне воронки: прохождение закончилось, возможно досрочно или без зачёта. */
export const trackQuestFinished = (
  params: QuestFunnelParams & { early?: boolean; partial?: boolean },
) => {
  if (!isAnalyticsAllowed()) return
  emit(QUEST_FUNNEL_EVENTS.finished, {
    ...baseParams(params, readRun(params.questId)),
    early: Boolean(params.early),
    partial: Boolean(params.partial),
  })
}

/**
 * Снимает записи прохождений всех квестов. Зовётся при отзыве согласия на
 * аналитику: без этого `run_id` и время старта пережили бы отказ.
 */
export const clearQuestFunnelRuns = () => {
  const store = storage()
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key && key.startsWith(RUN_STORAGE_PREFIX)) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  } catch {
    // Заблокированное хранилище: чистить нечего.
  }
}

/**
 * Игрок сбросил прогресс: следующий проход — новое прохождение со своим
 * `run_id`, своим временем старта и заново пустыми вехами.
 */
export const resetQuestFunnelRun = (questId?: string | null) => {
  try {
    storage()?.removeItem(runKey(questId))
  } catch {
    // noop
  }
}
