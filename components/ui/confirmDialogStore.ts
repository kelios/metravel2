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

let pending: PendingConfirm | null = null
const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

/** Ответ пользователя: подтверждение (`true`), отмена или Escape (`false`). */
export const resolveConfirmDialog = (value: boolean) => {
  const current = pending
  if (!current) return
  pending = null
  emit()
  current.resolve(value)
}

/** Подписка хоста диалога; возвращает отписку (контракт `useSyncExternalStore`). */
export const subscribeConfirmDialog = (listener: () => void): (() => void) => {
  listeners.add(listener)
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
 * Без смонтированного хоста промис резолвится `false` — деструктивное действие не
 * выполняется, но и молча зависшего await не остаётся (Fallback policy #1556).
 */
export const requestConfirmDialog = (request: ConfirmDialogRequest): Promise<boolean> => {
  if (listeners.size === 0) {
    console.warn('ConfirmDialogHost не смонтирован: подтверждение отклонено по умолчанию')
    return Promise.resolve(false)
  }
  // Второй запрос поверх первого: старый закрываем как отменённый, иначе его
  // промис никогда не резолвится.
  pending?.resolve(false)
  return new Promise<boolean>((resolve) => {
    pending = { ...request, resolve }
    emit()
  })
}
