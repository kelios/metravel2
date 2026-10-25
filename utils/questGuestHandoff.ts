// Серверный перенос гостевого прогресса квеста при регистрации по письму
// (#2739, бэкенд — #2749).
//
// Гостевой прогресс живёт в хранилище конкретного браузера (guestQuestProgress),
// а ссылку из письма подтверждения почтовое приложение открывает своим
// браузером — там локальной копии нет, и игрок начинал квест с нуля (#590).
// Поэтому перед отправкой формы регистрации снимок уходит на сервер под
// `session_key` телеметрии попыток, регистрация несёт тот же ключ, а
// подтверждение создаёт прохождение аккаунта и называет квест, куда вернуть.
//
// Деградация: пока бэкенд не принимает снимок (401/404) или ответ подтверждения
// без `quest_handoff`, поведение прежнее — локальная миграция в том же браузере.
//
// Модуль лёгкий: форма регистрации грузит его всегда, а api/quests и очередь
// телеметрии подтягиваются лениво, только когда переносить есть что.

const QUEST_HANDOFF_PATH_RE = /^\/quests\/([\w-]+)\/([\w-]+)$/

/** Путь квеста, в который можно вернуть игрока: только `/quests/<city>/<quest>`. */
export function isQuestHandoffPath(value: unknown): value is string {
  return typeof value === 'string' && QUEST_HANDOFF_PATH_RE.test(value)
}

export type QuestHandoffResult = {
  questId: string
  redirectPath: string
  answered: number
}

/** `quest_handoff` из ответа `confirm-registration`; всё, что не по контракту, — `null`. */
export function parseQuestHandoff(raw: unknown): QuestHandoffResult | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const questId = typeof value.quest_id === 'string' ? value.quest_id.trim() : ''
  if (!questId || !isQuestHandoffPath(value.redirect_path)) return null
  const answered = Number(value.answered)
  return {
    questId,
    redirectPath: value.redirect_path,
    answered: Number.isFinite(answered) && answered > 0 ? Math.floor(answered) : 0,
  }
}

/**
 * Отправляет снимок гостевого прогресса квеста из `redirect` формы регистрации.
 * Возвращает `session_key` для поля регистрации `quest_handoff_session_key`,
 * если снимок принят; иначе `null` — регистрация идёт как раньше.
 */
export async function prepareQuestGuestHandoff(redirect: string | undefined | null): Promise<string | null> {
  const match = typeof redirect === 'string' ? QUEST_HANDOFF_PATH_RE.exec(redirect) : null
  if (!match) return null
  const redirectPath = match[0]
  const questId = match[2]

  try {
    const { loadGuestQuestProgress } = await import('@/utils/guestQuestProgress')
    const progress = await loadGuestQuestProgress(questId)
    if (!progress) return null
    const { countAnsweredSteps, normalizeQuestProgressSnapshot, toQuestProgressServerPayload } =
      await import('@/utils/questProgressMerge')
    if (countAnsweredSteps(progress.answers) === 0) return null

    const { getQuestAttemptSessionKey } = await import('@/utils/questAnswerTelemetry')
    const { sendQuestGuestHandoff } = await import('@/api/quests')
    const sessionKey = await getQuestAttemptSessionKey()
    const snapshot = normalizeQuestProgressSnapshot(progress)
    await sendQuestGuestHandoff({
      session_key: sessionKey,
      quest_id: questId,
      redirect_path: redirectPath,
      progress: {
        ...toQuestProgressServerPayload(snapshot),
        answered_at: snapshot.answeredAt,
        updated_at: snapshot.updatedAt,
      },
    })
    return sessionKey
  } catch (error) {
    // Снимок — страховка, а не условие регистрации: 401/404 до выката #2749,
    // сеть, таймаут. Локальная копия остаётся для переноса в этом браузере.
    const { devWarn } = require('@/utils/logger')
    devWarn('Quest guest progress handoff was not stored:', error)
    return null
  }
}
