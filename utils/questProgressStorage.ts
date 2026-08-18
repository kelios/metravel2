/**
 * Ключ локальной копии прогресса квеста в AsyncStorage.
 *
 * Запись обязана быть привязана к владельцу. До #1456 ключ приходил из бандла
 * (`storage_key`) и знал только квест: на общем устройстве аккаунт A проходил
 * квест, выходил, заходил аккаунт B — и визард сливал серверный прогресс B с
 * оставшейся записью A. Утекали и ответы, и (после #1451) монотонный
 * `completed`, то есть чужое прохождение уезжало в серверную запись B.
 *
 * Ключ владельца добавляем в конец, а не в начало: гостевой префикс `guest_`
 * исторически стоит спереди, и разводить два несовместимых формата не нужно.
 * Записи, оставшиеся от старого ключа, намеренно не мигрируем и не удаляем:
 * определить их владельца нельзя (в этом и был баг), а удаление затёрло бы
 * офлайн-прогресс, который ещё не долетел до сервера.
 */

/** Префикс гостевой (не привязанной к аккаунту) записи прогресса. */
export const GUEST_QUEST_STORAGE_PREFIX = 'guest_'

/** Разделитель перед id пользователя. Двойное подчёркивание не встречается в `storage_key`. */
export const QUEST_PROGRESS_USER_SUFFIX = '__u'

/**
 * Владелец известен как «залогинен», но его id ещё не подтянулся в стор
 * (`app/(tabs)/accountconfirmation.tsx` поднимает `isAuthenticated` до того, как
 * `checkAuthentication` заполнит `userId`). Гостевой ключ тут брать НЕЛЬЗЯ: под
 * ним лежит запись гостевого визарда этого устройства — её штатная миграция
 * (#1430) идёт по другому ключу (`guestQuestProgress:v1:{questId}`), так что
 * чужие гостевые ответы просто слились бы с аккаунтом. Отдельный временный
 * ключ ни с гостём, ни с числовым id не пересекается; ответы при этом не
 * теряются — save-эффект всё равно отправляет их на сервер.
 */
export const QUEST_PROGRESS_PENDING_USER = 'pending'

const DEFAULT_QUEST_STORAGE_BASE = 'quest_progress'

export type QuestProgressOwner = {
  isAuthenticated: boolean
  userId?: string | number | null
}

/** Собирает ключ прогресса квеста для конкретного владельца. */
export function buildQuestProgressStorageKey(
  baseKey: string | null | undefined,
  owner: QuestProgressOwner,
): string {
  const base = String(baseKey ?? '').trim() || DEFAULT_QUEST_STORAGE_BASE
  if (!owner.isAuthenticated) return `${GUEST_QUEST_STORAGE_PREFIX}${base}`

  const userId = String(owner.userId ?? '').trim()
  return `${base}${QUEST_PROGRESS_USER_SUFFIX}${userId || `:${QUEST_PROGRESS_PENDING_USER}`}`
}
