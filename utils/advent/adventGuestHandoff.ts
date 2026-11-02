// Серверный перенос гостевого прогресса адвента при регистрации по письму (#2939).
//
// Механизм — как у квеста (#2739, `utils/questGuestHandoff.ts`): гостевые
// дверцы живут в хранилище этого браузера (`adventProgressStore`, ключ `guest`),
// а ссылку из письма подтверждения почтовое приложение часто открывает другим
// браузером, где локальной копии нет и `adoptGuest` переносить нечего. Поэтому
// перед отправкой формы снимок уходит на сервер под ключом сессии устройства
// (тот же ключ, что у квестового снимка), регистрация несёт его в
// `advent_handoff_session_key`, подтверждение сливает снимок в аккаунт, дальше
// работает обычная синхронизация `/advent`.
//
// Деградация: 404 до выката бэка, сеть, таймаут — регистрация идёт как раньше,
// локальная копия остаётся для переноса в этом же браузере.
//
// Модуль лёгкий: стор, api и ключ сессии подтягиваются лениво.

/**
 * Отправляет гостевой прогресс адвента, если он есть. Возвращает `session_key`
 * для поля регистрации `advent_handoff_session_key` или `null`, когда
 * переносить нечего или снимок не принят.
 */
export async function prepareAdventGuestHandoff(): Promise<string | null> {
  try {
    const { ADVENT_GUEST_OWNER, useAdventProgressStore } = await import('@/stores/adventProgressStore')
    // Native читает persist из AsyncStorage асинхронно — без гидрации гость «пустой».
    if (!useAdventProgressStore.persist.hasHydrated()) await useAdventProgressStore.persist.rehydrate()
    const guest = useAdventProgressStore.getState().byOwner[ADVENT_GUEST_OWNER]
    const { isAdventProgressEmpty } = await import('@/utils/advent/adventProgressMerge')
    if (!guest || isAdventProgressEmpty(guest)) return null

    const { getQuestAttemptSessionKey } = await import('@/utils/questAnswerTelemetry')
    const { sendAdventGuestHandoff } = await import('@/api/advent')
    const sessionKey = await getQuestAttemptSessionKey()
    await sendAdventGuestHandoff({
      session_key: sessionKey,
      progress: { opened: guest.opened, tasks_done: guest.tasksDone },
    })
    return sessionKey
  } catch (error) {
    // Снимок — страховка, а не условие регистрации.
    const { devWarn } = require('@/utils/logger')
    devWarn('Advent guest progress handoff was not stored:', error)
    return null
  }
}
