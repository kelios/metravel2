import { useEffect, useRef } from 'react'

import { queueAnalyticsEvent } from '@/utils/analytics'
import { flushQuestAnswerAttempts } from '@/utils/questAnswerTelemetry'

type QuestWizardAnalyticsParams = {
  questId?: string
  cityId?: string
  /** Игрок стоит на настоящей точке, а не на intro: с этого начинается прохождение. */
  onRealStep: boolean
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

/**
 * Воронка прохождения квеста. Живёт отдельно от `QuestWizard`: там это четыре
 * почти одинаковых эффекта со своими «выстрелить один раз» рефами, которые к
 * рендеру визарда отношения не имеют.
 */
export function useQuestWizardAnalytics({
  questId,
  cityId,
  onRealStep,
  questFinished,
  questCompleted,
  partiallyCompleted,
  finishedEarly,
  passedCount,
  stepsCount,
  guestGateActive,
  guestAnsweredCount,
  onGuestGate,
}: QuestWizardAnalyticsParams): void {
  const startTrackedRef = useRef(false)
  useEffect(() => {
    if (startTrackedRef.current || !onRealStep) return
    startTrackedRef.current = true
    queueAnalyticsEvent('quest_start', { quest_id: questId, city: cityId })
  }, [cityId, onRealStep, questId])

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
}
