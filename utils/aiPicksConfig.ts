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
 *
 * Сборочный контракт (#2738): `isAiPicksEnabled()` решает, показывать ли блоки,
 * но не попадает ли их код в бандл — вызов функции Metro не сворачивает. Поэтому
 * код вне `components/aiPicks` подключает блоки только через литеральное условие
 * `process.env.EXPO_PUBLIC_AI_PICKS ? require(...)/import(...) : null`: Expo
 * подставляет значение (`void 0`, если переменной нет), и Metro сворачивает ветку
 * до сбора зависимостей — сборка без флага (прод) не содержит ни блоков, ни
 * `api/aiPicks`. Новый статический импорт запрещён тестом `aiFeatureBuildGate`
 * (три прежних оставлены до #2741 — причина записана в тесте).
 *
 * Блоки «Похожие» без службы (#3292): `EXPO_PUBLIC_AI_SIMILAR_SOURCE=static` включает
 * только их и берёт соседей из статического слепка `/assets/data/ai-similar.json`
 * (`npm run ai:similar:build`) — служба `metravel-assist` на сервере не нужна. Строка
 * подбора на `/search` и «Рядом с маршрутом» остаются под `EXPO_PUBLIC_AI_PICKS`: им
 * нужен живой эмбеддинг запроса. Условие сборки для блоков «Похожие» — литерал
 * `process.env.EXPO_PUBLIC_AI_PICKS || process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE`.
 */
import { Platform } from 'react-native'

import { API_BASE_URL } from '@/api/apiConfig'

const TRUTHY_FLAG_VALUES = new Set(['1', 'true'])

const isFlagOn = (value: string | undefined | null): boolean =>
  TRUTHY_FLAG_VALUES.has(String(value ?? '').trim().toLowerCase())

/** Включён ли смысловой подбор в этой сборке. Читается при вызове, не при загрузке модуля. */
export const isAiPicksEnabled = (): boolean => isFlagOn(process.env.EXPO_PUBLIC_AI_PICKS)

/** Origin сайта для запросов мимо `/api`: пустая строка — same-origin (web), на native — origin API без `/api`. */
const getSiteOrigin = (): string => {
  if (Platform.OS === 'web') return ''
  return String(API_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
}

/** Origin службы без завершающего слэша; пустая строка — same-origin (web). */
export const getAiPicksBaseUrl = (): string => {
  const override = String(process.env.EXPO_PUBLIC_AI_PICKS_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
  return override || getSiteOrigin()
}

/** Полный адрес эндпоинта службы: `/ai/similar`, `/ai/search`. */
export const buildAiPicksUrl = (path: string): string => `${getAiPicksBaseUrl()}/ai${path}`

export type AiSimilarSource = 'service' | 'static'

/** Статический слепок «похожих» (#3292): файл из `public/`, собирает `npm run ai:similar:build`. */
export const AI_SIMILAR_STATIC_PATH = '/assets/data/ai-similar.json'

/**
 * Откуда блоки «Похожие» берут соседей (#3292): `static` — из слепка, без службы;
 * `service` — `GET /ai/similar`, когда включён весь смысловой подбор; `null` — блоков нет.
 * Явное `static` сильнее флага подбора: слепок работает и там, где службы нет.
 */
export const getAiSimilarSource = (): AiSimilarSource | null => {
  const source = String(process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE ?? '').trim().toLowerCase()
  if (source === 'static') return 'static'
  return isAiPicksEnabled() ? 'service' : null
}

/** Показывать ли блоки «Похожие» в этой сборке. Читается при вызове, не при загрузке модуля. */
export const isAiSimilarEnabled = (): boolean => getAiSimilarSource() !== null

/** Адрес слепка: на web — тот же origin, на native — origin сайта; адрес службы подбора на него не влияет. */
export const getAiSimilarStaticUrl = (): string => `${getSiteOrigin()}${AI_SIMILAR_STATIC_PATH}`
