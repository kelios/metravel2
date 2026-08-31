// api/questStepInaccuracy.ts
// Структурная отметка «точка изменилась» на шаге квеста (#1579, backend #1577).
//
// КОНТРАКТ ЭНДПОИНТА (`quests/views.py:559`, сервис
// `quests/services/step_accuracy_reporting.py`):
//
//   POST /api/quest-steps/{pk}/inaccuracy-reports/     тело не требуется
//     pk — числовой PK шага (QuestStep.id), а НЕ строковый `step_id`
//          вида "minsk-cmok-3", по которому шаг адресуется в UI.
//   Ответ: { step_id, created, report_count, needs_review }
//     201 — отметка создана, 200 — у этого игрока она уже была.
//
// Автор берётся только из авторизации (`IsAuthenticated`), уникальность пары
// (user, step) держит БД. Поэтому повтор безопасен, и различает случаи не
// HTTP-статус (тело ответа `apiClient.post` его не отдаёт), а поле `created`.
// При двух и более отметках сервер сам ставит шагу `needs_review`.

import { apiClient } from '@/api/client'
import { devError } from '@/utils/logger'

export type QuestStepInaccuracyReport = {
  /** PK шага, вокруг которого создана отметка. */
  stepId: number
  /** false — этот игрок уже отмечал точку раньше (ответ 200). */
  created: boolean
  reportCount: number
  needsReview: boolean
}

type ApiQuestStepInaccuracyReport = {
  step_id?: number | null
  created?: boolean | null
  report_count?: number | null
  needs_review?: boolean | null
}

/**
 * Отправляет структурную отметку о том, что точка не соответствует описанию.
 * Ошибку не глушит: вызывающий показывает её игроку, но состояние шага при этом
 * не меняет — отметка не часть прохождения.
 */
export const reportQuestStepInaccuracy = async (
  stepPk: number,
): Promise<QuestStepInaccuracyReport> => {
  if (!Number.isInteger(stepPk) || stepPk <= 0) {
    throw new Error('reportQuestStepInaccuracy: stepPk must be a positive integer')
  }

  try {
    const response = await apiClient.post<ApiQuestStepInaccuracyReport>(
      `/quest-steps/${stepPk}/inaccuracy-reports/`,
    )
    return {
      stepId: typeof response?.step_id === 'number' ? response.step_id : stepPk,
      // Отсутствие поля трактуем как «создано»: иначе первая же отметка на
      // старом бэкенде молча покажет «уже отмечено» и игрок решит, что его
      // сигнал потерян.
      created: response?.created !== false,
      reportCount: typeof response?.report_count === 'number' ? response.report_count : 0,
      needsReview: response?.needs_review === true,
    }
  } catch (error) {
    devError('Error reporting quest step inaccuracy:', error)
    throw error
  }
}
