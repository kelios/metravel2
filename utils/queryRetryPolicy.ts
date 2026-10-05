// utils/queryRetryPolicy.ts
// #2184: политика повторов тяжёлого чтения для React Query.
//
// Тяжёлое чтение — запрос, на который бэкенд тратит секунды расчёта (каталог
// мест: фасеты, группировка и count на каждый запрос). Оборванный клиентом
// запрос сервер досчитывает до конца, поэтому повтор после таймаута — второй
// такой же расчёт рядом с первым. 04.10.2026 `retry: 2` на шести параллельных
// запросах экрана /places дал до 18 расчётов с одного открытия и занял обе нити
// единственного воркера прода (#2183).
//
// Правило: не больше ОДНОГО повтора и только когда сервер этот запрос уже не
// считает — соединение не состоялось либо пришёл 502/503. 503 каталог отдаёт сам
// (`Retry-After: 1`), когда расчёт не уложился в бюджет и был отменён (#2183).
// Таймаут и 504 (`isServerStillWorkingAfter`), 4xx, 500 и ошибка разбора ответа
// не повторяются: исход показывает экран, повтор — ручная кнопка.

import { isServerStillWorkingAfter } from '@/api/clientErrors'
import { isConnectionFailure } from '@/utils/networkFailureTag'

const RETRYABLE_STATUSES = new Set([502, 503])
// Не меньше `Retry-After: 1` каталога.
const HEAVY_READ_RETRY_DELAY_MS = 1500

/** Сервер этот запрос не считает: он не дошёл либо сервер сам отказался от расчёта. */
export const noServerWorkInFlight = (error: unknown): boolean => {
  if (isServerStillWorkingAfter(error)) return false
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status === 'number' && status > 0) return RETRYABLE_STATUSES.has(status)
  return isConnectionFailure(error)
}

/** Опции `retry`/`retryDelay` запроса тяжёлого чтения: `...heavyReadRetry`. */
export const heavyReadRetry = {
  retry: (failureCount: number, error: unknown): boolean =>
    failureCount < 1 && noServerWorkInFlight(error),
  retryDelay: HEAVY_READ_RETRY_DELAY_MS,
} as const
