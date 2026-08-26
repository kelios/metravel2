// Мост между императивным `confirmAction(): Promise<boolean>` и декларативным
// `components/ui/ConfirmDialog` (`visible` / `onConfirm` / `onClose`).
//
// Зачем отдельный модуль: в местах, где вызывающий компонент сам держит состояние
// и рендерит диалог в JSX (`ListTravelLayout`, `CommentItem`, `ImageGallery`),
// посредник не нужен. Здесь же подтверждение висит внутри обработчика, которому
// нужен именно `await`, поэтому состояние живёт в модуле, а не в компоненте.
//
// Модуль намеренно без React и без импортов UI: его тянет `utils/confirmAction`,
// а тот импортируется десятком экранов и хуков (settings, favorites, offline,
// profile, trips, history). Статический импорт `ConfirmDialog` (Paper-стаб +
// Button + react-dom) утащил бы диалог в каждый из этих чанков.
//
// Введён в #1555 для квестового визарда, поднят в общее место в #1556.

export type ConfirmDialogRequest = {
  title: string
  message: string
  /** Подпись подтверждения; без неё берётся дефолт `ConfirmDialog`. */
  confirmText?: string
  /** Подпись отказа; без неё берётся дефолт `ConfirmDialog`. */
  cancelText?: string
}

type PendingConfirm = ConfirmDialogRequest & {
  resolve: (value: boolean) => void
}

// The root layout mounts `ConfirmDialogHost` eagerly on web. Keep a request alive
// through the initial commit, but fail closed if the host is genuinely unavailable.
// This is a host-mount grace period, never a time limit for the user's decision.
export const CONFIRM_DIALOG_HOST_TIMEOUT_MS = 1_000

let pending: PendingConfirm | null = null
let pendingTimeout: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

const clearPendingTimeout = () => {
  if (pendingTimeout === null) return
  clearTimeout(pendingTimeout)
  pendingTimeout = null
}

/** Ответ пользователя: подтверждение (`true`), отмена или Escape (`false`). */
export const resolveConfirmDialog = (value: boolean) => {
  const current = pending
  if (!current) return
  clearPendingTimeout()
  pending = null
  emit()
  current.resolve(value)
}

/** Подписка хоста диалога; возвращает отписку (контракт `useSyncExternalStore`). */
export const subscribeConfirmDialog = (listener: () => void): (() => void) => {
  listeners.add(listener)
  // A request may arrive during the root layout's initial commit. Once the host
  // subscribes, it owns that request and must remain open until the user decides.
  if (pending) clearPendingTimeout()
  return () => {
    listeners.delete(listener)
    // Хост ушёл с открытым диалогом (уход со страницы, браузерный Back): без этого
    // `await confirmAction(...)` не резолвился бы никогда, а протухший запрос всплыл
    // бы призрачным диалогом в следующем инстансе хоста и подтвердил бы чужое
    // деструктивное действие. Инвариант стора: нет подписчиков — нет запроса.
    if (listeners.size === 0) resolveConfirmDialog(false)
  }
}

/** Текущий запрос или `null`. Ссылка стабильна, пока запрос не сменился. */
export const getConfirmDialogRequest = (): ConfirmDialogRequest | null => pending

/**
 * Просит хост показать диалог и ждёт ответа.
 * Если корневой хост ещё не завершил initial commit, запрос ждёт подписчика.
 * При реально недоступном хосте промис через таймаут резолвится
 * `false`: деструктивное действие не выполняется и `await` не зависает.
 */
export const requestConfirmDialog = (request: ConfirmDialogRequest): Promise<boolean> => {
  // Второй запрос поверх первого: старый закрываем как отменённый, иначе его
  // промис никогда не резолвится.
  if (pending) resolveConfirmDialog(false)
  return new Promise<boolean>((resolve) => {
    pending = { ...request, resolve }
    clearPendingTimeout()
    if (listeners.size === 0) {
      pendingTimeout = setTimeout(() => {
        if (!pending) return
        console.warn('ConfirmDialogHost не смонтирован: подтверждение отклонено по умолчанию')
        resolveConfirmDialog(false)
      }, CONFIRM_DIALOG_HOST_TIMEOUT_MS)
    }
    emit()
  })
}
