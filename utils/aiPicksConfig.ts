/**
 * Смысловой подбор (#2459): блоки «Похожие статьи» на статье и квесте и строка
 * «Подобрать по описанию» на `/search`, которые читают службу `metravel-assist`
 * (`scripts/ai-assist`: `GET /ai/similar`, `POST /ai/search`).
 *
 * Флаг `EXPO_PUBLIC_AI_PICKS=1` включает блоки; без него ни один запрос к `/ai/*`
 * не уходит ни на одной платформе, а страницы выглядят как раньше. Адрес службы:
 * на web — тот же origin (`/ai/*` проксируют nginx на проде, Metro и
 * `serve-web-build` локально), на native — origin API без `/api`;
 * `EXPO_PUBLIC_AI_PICKS_URL` переопределяет его целиком.
 *
 * Значения читаются литеральным `process.env.EXPO_PUBLIC_*` — только так Expo
 * подставляет их в бандл. Диагностика — `utils/runtimeConfigContract.js`
 * (`AI_PICKS_*`).
 */
import { Platform } from 'react-native'

import { API_BASE_URL } from '@/api/apiConfig'

const TRUTHY_FLAG_VALUES = new Set(['1', 'true'])

const isFlagOn = (value: string | undefined | null): boolean =>
  TRUTHY_FLAG_VALUES.has(String(value ?? '').trim().toLowerCase())

/** Включён ли смысловой подбор в этой сборке. Читается при вызове, не при загрузке модуля. */
export const isAiPicksEnabled = (): boolean => isFlagOn(process.env.EXPO_PUBLIC_AI_PICKS)

/** Origin службы без завершающего слэша; пустая строка — same-origin (web). */
export const getAiPicksBaseUrl = (): string => {
  const override = String(process.env.EXPO_PUBLIC_AI_PICKS_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
  if (override) return override
  if (Platform.OS === 'web') return ''
  return String(API_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
}

/** Полный адрес эндпоинта службы: `/ai/similar`, `/ai/search`. */
export const buildAiPicksUrl = (path: string): string => `${getAiPicksBaseUrl()}/ai${path}`
