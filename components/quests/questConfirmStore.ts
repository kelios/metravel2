// Мост между императивным `confirmQuestAsync(): Promise<boolean>` и декларативным
// `components/ui/ConfirmDialog` (`visible` / `onConfirm` / `onClose`).
//
// Зачем отдельный модуль: в остальных местах приложения вызывающий компонент сам
// держит состояние и рендерит диалог в JSX (см. `ListTravelLayout`, `CommentItem`,
// `ImageGallery`). У квеста подтверждение висит внутри `useCallback`, которому нужен
// именно await, поэтому состояние живёт здесь, а не в вызывающем компоненте.
//
// Модуль намеренно без React и без импортов UI: его тянет `questWizardHelpers`, а
// тот импортируется половиной квестового кода — статический импорт `ConfirmDialog`
// (Paper Portal + react-dom) утащил бы диалог в чужие чанки.

export type QuestConfirmRequest = {
  title: string
  message: string
}

type PendingQuestConfirm = QuestConfirmRequest & {
  resolve: (value: boolean) => void
}

let pending: PendingQuestConfirm | null = null
const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

/** Ответ пользователя: подтверждение (`true`), отмена или Escape (`false`). */
export const resolveQuestConfirm = (value: boolean) => {
  const current = pending
  if (!current) return
  pending = null
  emit()
  current.resolve(value)
}

/** Подписка хоста диалога; возвращает отписку (контракт `useSyncExternalStore`). */
export const subscribeQuestConfirm = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    // Хост ушёл с открытым диалогом (уход со страницы, браузерный Back): без этого
    // await в `resetQuest` не резолвился бы никогда, а протухший запрос всплыл бы
    // призрачным диалогом в следующем инстансе визарда и дёрнул бы сброс прогресса
    // чужого прохождения. Инвариант стора: нет подписчиков — нет запроса.
    if (listeners.size === 0) resolveQuestConfirm(false)
  }
}

/** Текущий запрос или `null`. Ссылка стабильна, пока запрос не сменился. */
export const getQuestConfirmRequest = (): QuestConfirmRequest | null => pending

/**
 * Просит хост показать диалог и ждёт ответа.
 * Без смонтированного хоста промис резолвится `false` — деструктивное действие не
 * выполняется, но и молча зависшего await не остаётся (Fallback policy #1555).
 */
export const requestQuestConfirm = (title: string, message: string): Promise<boolean> => {
  if (listeners.size === 0) {
    console.warn('QuestConfirmHost не смонтирован: подтверждение отклонено по умолчанию')
    return Promise.resolve(false)
  }
  // Второй запрос поверх первого: старый закрываем как отменённый, иначе его
  // промис никогда не резолвится.
  pending?.resolve(false)
  return new Promise<boolean>((resolve) => {
    pending = { title, message, resolve }
    emit()
  })
}

