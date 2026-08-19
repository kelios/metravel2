import { useCallback, useEffect, useRef } from 'react'

import { queueAnalyticsEvent } from '@/utils/analytics'
import { flushQuestAnswerAttempts } from '@/utils/questAnswerTelemetry'

type QuestWizardAnalyticsParams = {
  questId?: string
  cityId?: string
  /** Игрок стоит на настоящей точке, а не на intro: с этого начинается прохождение. */
  onRealStep: boolean
  /** Индекс текущей точки среди настоящих (без intro). -1 — intro или пусто. */
  stepIndex: number
  /** Карточка шага реально на экране: гостевой гейт и режим финала подменяют её собой. */
  stepVisible: boolean
  /** Квест закончен: пройден целиком, пропущенные точки закрыты или финиш на месте. */
  questFinished: boolean
  /** Прохождение засчитано порогом политики (#1443). */
  questCompleted: boolean
  /** Прохождение не добрало порога: финал есть, награды нет. */
  partiallyCompleted: boolean
  /** Неполное прохождение по воле игрока: пропущенная далёкая точка или финиш на месте. */
  finishedEarly: boolean
  passedCount: number
  stepsCount: number
  /** Гость упёрся в лимит бесплатных точек. */
  guestGateActive: boolean
  guestAnsweredCount: number
  onGuestGate?: (passedCount: number) => void
}

type QuestWizardAnalyticsApi = {
  /** Одно нажатие «Проверить» на настоящей точке; `attemptNo` — номер попытки с 1 (#1498). */
  trackAnswerSubmitted: (attempt: { isCorrect: boolean; attemptNo: number }) => void
  /** Раскрытие подсказки; `attemptNo` — сколько неверных попыток было ДО неё (#1498). */
  trackHintOpened: (attempt: { attemptNo: number }) => void
  /** Игрок сбросил прогресс: следующий проход — новое прохождение со своей воронкой. */
  resetFunnelSession: () => void
}

/**
 * Воронка прохождения квеста. Живёт отдельно от `QuestWizard`: там это четыре
 * почти одинаковых эффекта со своими «выстрелить один раз» рефами, которые к
 * рендеру визарда отношения не имеют.
 */
export function useQuestWizardAnalytics({
  questId,
  cityId,
  onRealStep,
  stepIndex,
  stepVisible,
  questFinished,
  questCompleted,
  partiallyCompleted,
  finishedEarly,
  passedCount,
  stepsCount,
  guestGateActive,
  guestAnsweredCount,
  onGuestGate,
}: QuestWizardAnalyticsParams): QuestWizardAnalyticsApi {
  const startTrackedRef = useRef(false)
  useEffect(() => {
    if (startTrackedRef.current || !onRealStep) return
    startTrackedRef.current = true
    queueAnalyticsEvent('quest_start', { quest_id: questId, city: cityId })
  }, [cityId, onRealStep, questId])

  // Просмотр точки. Считается один раз за прохождение на каждый `step_index`:
  // возврат к пройденной точке — не новый просмотр, иначе навигация назад
  // размывала бы кривую доходимости, ради которой событие и заводится (#1498).
  //
  // `stepVisible` обязателен: гость, упёршийся в гейт регистрации, стоит на
  // ещё не открытой точке, но видит вместо неё гейт. Без этой проверки просмотр
  // засчитывался бы вопросу, который игроку не показали, и провал на гейте стал
  // бы неотличим от провала на самом вопросе — индекс в этом случае в множество
  // не кладётся, чтобы настоящий просмотр после логина посчитался.
  const viewedStepsRef = useRef(new Set<number>())
  useEffect(() => {
    if (!onRealStep || !stepVisible || stepIndex < 0) return
    if (viewedStepsRef.current.has(stepIndex)) return
    viewedStepsRef.current.add(stepIndex)
    queueAnalyticsEvent('quest_step_view', { quest_id: questId, step_index: stepIndex })
  }, [onRealStep, questId, stepIndex, stepVisible])

  // Попытка ответа. В отличие от просмотра и подсказки не схлопывается: смысл
  // события — распределение неверных попыток по `step_index`.
  const trackAnswerSubmitted = useCallback(
    ({ isCorrect, attemptNo }: { isCorrect: boolean; attemptNo: number }) => {
      if (stepIndex < 0) return
      queueAnalyticsEvent('quest_answer_submit', {
        quest_id: questId,
        step_index: stepIndex,
        is_correct: isCorrect,
        attempt_no: attemptNo,
      })
    },
    [questId, stepIndex],
  )

  // Подсказка. Один раз на точку: подсказку сворачивают и разворачивают обратно,
  // и метрика «доля точек, где взяли подсказку» не должна зависеть от числа
  // нажатий на один и тот же аккордеон.
  const hintedStepsRef = useRef(new Set<number>())
  const trackHintOpened = useCallback(
    ({ attemptNo }: { attemptNo: number }) => {
      if (stepIndex < 0 || hintedStepsRef.current.has(stepIndex)) return
      hintedStepsRef.current.add(stepIndex)
      queueAnalyticsEvent('quest_hint', {
        quest_id: questId,
        step_index: stepIndex,
        attempt_no: attemptNo,
      })
    },
    [questId, stepIndex],
  )

  const finishTrackedRef = useRef(false)
  useEffect(() => {
    if (!questFinished || finishTrackedRef.current) return
    finishTrackedRef.current = true
    // `early` отличает неполное прохождение (пропущенная далёкая точка или финиш
    // на месте) от обычного: иначе они неразличимо сливаются в воронку
    // завершений. `partial` отделяет незасчитанное прохождение от засчитанного
    // (#1443): без него в воронке завершений слились бы и они.
    queueAnalyticsEvent('quest_finish', {
      quest_id: questId,
      early: finishedEarly,
      partial: partiallyCompleted,
      passed_count: passedCount,
      steps_count: stepsCount,
    })
    void flushQuestAnswerAttempts()
  }, [finishedEarly, partiallyCompleted, passedCount, questFinished, questId, stepsCount])

  // Игрок вернулся с частичного финала и добрал точки до порога (#1443).
  // `quest_finish` стреляет один раз за сессию и уже улетел с `partial: true`,
  // поэтому без отдельного события воронка расходилась бы с бэкендом, куда в
  // этот момент уходит `completed: true`.
  const creditedTrackedRef = useRef(false)
  useEffect(() => {
    if (!questCompleted || creditedTrackedRef.current) return
    creditedTrackedRef.current = true
    queueAnalyticsEvent('quest_completion_credited', {
      quest_id: questId,
      passed_count: passedCount,
      steps_count: stepsCount,
    })
  }, [passedCount, questCompleted, questId, stepsCount])

  const guestGateTrackedRef = useRef(false)
  useEffect(() => {
    if (!guestGateActive || guestGateTrackedRef.current) return
    guestGateTrackedRef.current = true
    queueAnalyticsEvent('quest_guest_gate_view', {
      quest_id: questId,
      city: cityId,
      passed_count: guestAnsweredCount,
    })
    onGuestGate?.(guestAnsweredCount)
  }, [cityId, guestAnsweredCount, guestGateActive, onGuestGate, questId])

  // «Сбросить прогресс» не размонтирует визард, поэтому одноразовые рефы
  // переживают сброс, а `quest_point_done` и `quest_answer_submit` дедупа не
  // имеют и уходят на второй проход как ни в чём не бывало. Молчал бы ровно
  // тот конец воронки, по которому её и читают: засчитанные точки без
  // просмотров и без старта. Поэтому переигровка начинает воронку заново
  // целиком (#1498).
  const resetFunnelSession = useCallback(() => {
    startTrackedRef.current = false
    viewedStepsRef.current.clear()
    hintedStepsRef.current.clear()
    finishTrackedRef.current = false
    creditedTrackedRef.current = false
    guestGateTrackedRef.current = false
  }, [])

  return { trackAnswerSubmitted, trackHintOpened, resetFunnelSession }
}
