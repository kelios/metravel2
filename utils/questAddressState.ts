/**
 * Единый контракт состояний адреса квеста (#3227; предшественники — точечные
 * правки #2896 и #2914). Любая форма адреса раздела — `/quests/<city>/<slug>`,
 * `/quests/<slug>`, `/quests/country/<alias>`, `/{be,uk,pl,en}/quests/<city>/<slug>`
 * — приходит к одному из четырёх состояний и рисует один и тот же экран:
 *
 * - `not_found` — такого адреса нет: `QuestNotFoundScreen` (выход в каталог,
 *   `noindex`). Повтор здесь ничего не изменит, кнопки «Повторить» нет.
 * - `error` — источник не ответил (сеть, 5xx, неизвестный статус): экран ошибки
 *   с «Повторить» и своим текстом из `@/i18n`.
 *
 * Текст ошибки бэкенда пользователю не показывается ни в одном состоянии:
 * хуки данных квестов (`hooks/useQuestsApi.ts`) отдают экранам только
 * классификацию сбоя, а не `error.message`. Запрет держит
 * `__tests__/app/questAddressState.guard.test.ts`.
 */

/** Чем закончилось адресное чтение, если оно не удалось. */
export type QuestLoadFailure = 'not_found' | 'error'

export type QuestAddressState = 'loading' | 'ready' | 'not_found' | 'error'

/** Коды, которыми сервер говорит «такого объекта нет» (410 — «был и снят»). */
const NOT_FOUND_STATUSES: ReadonlySet<number> = new Set([404, 410])

/**
 * Классифицирует сбой АДРЕСНОГО чтения (`GET /api/quests/by-quest-id/<id>/`):
 * 404/410 — «не найдено», всё остальное (сеть, таймаут, 5xx, любой неизвестный
 * статус) — «ошибка». Статус читается с ошибки как поле (`ApiError.status`), а
 * не через `instanceof`: класс ошибки не должен зависеть от того, каким путём
 * модуль клиента попал в бандл или в мок.
 *
 * Для списочных чтений (каталог) функция не годится: упавший каталог ничего не
 * говорит о существовании адреса и всегда `error`.
 */
export function classifyQuestLoadFailure(error: unknown): QuestLoadFailure | null {
  if (!error) return null
  const status = typeof error === 'object' ? (error as { status?: unknown }).status : undefined
  return typeof status === 'number' && NOT_FOUND_STATUSES.has(status) ? 'not_found' : 'error'
}

type QuestAddressInput = {
  /** Источник разрешил адрес в данные (бандл квеста, город или страна каталога). */
  resolved: boolean
  /** Источник ещё не ответил. */
  loading: boolean
  /** Сбой источника; `null` — сбоя нет. */
  failure: QuestLoadFailure | null
  /**
   * Публикация ответила 404/410 на клиентский запрос данных маршрута (#2896).
   * Только ускоряет ответ там, где адрес разрешает каталог: экран не ждёт его
   * загрузки. Разрешённый адрес маркер не перекрывает — публикация и каталог
   * суть разные источники.
   */
  loaderNotFound?: boolean
}

/**
 * Сводит сигналы источников к состоянию адреса. Порядок существенный: данные
 * сильнее всего; затем явное «нет такого адреса»; затем ожидание; затем сбой;
 * источник, который ответил и адреса не знает, — тоже «не найдено».
 */
export function resolveQuestAddressState({
  resolved,
  loading,
  failure,
  loaderNotFound = false,
}: QuestAddressInput): QuestAddressState {
  if (resolved) return 'ready'
  if (loaderNotFound) return 'not_found'
  if (loading) return 'loading'
  return failure ?? 'not_found'
}

/**
 * Тот же контракт для адреса, который разрешает каталог (лендинги города и
 * страны). Упавший каталог без данных ничего не говорит о существовании адреса,
 * поэтому сбой здесь — всегда `error`. Аргументы позиционные: вызов живёт в
 * чанках лендингов, у которых поштучный бюджет размера.
 */
export function resolveQuestCatalogAddressState(
  resolved: boolean,
  loading: boolean,
  catalogFailed: boolean,
  loaderNotFound: boolean,
): QuestAddressState {
  return resolveQuestAddressState({ resolved, loading, failure: catalogFailed ? 'error' : null, loaderNotFound })
}
