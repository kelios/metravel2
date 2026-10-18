/**
 * Фича-флаг ассистента сайта (#2460).
 *
 * Ассистент (`/assistant`, пункт меню, кнопка на `/search`) живёт под
 * `EXPO_PUBLIC_AI_ASSISTANT=1`; адрес OpenAI-совместимого `llama-server`
 * (`metravel-llm`) — `EXPO_PUBLIC_AI_ASSISTANT_URL`. Решение владельца
 * 18.10.2026: локально включено, на проде выключено, пока нет сервера под модель
 * (#2457/#2458). При выключенном флаге ни страница, ни меню, ни запросы к
 * серверу не появляются ни на одной платформе: роут отдаёт «страница не
 * найдена», навигация не содержит пункта, экран грузится отложенным чанком.
 *
 * Значения читаются литеральным `process.env.EXPO_PUBLIC_*`: только так Expo
 * подставляет их в бандл. Проверка конфигурации — `utils/runtimeConfigContract.js`
 * (`AI_ASSISTANT_*` диагностики).
 */

// Имена переменных объявлены один раз — в `utils/runtimeConfigContract.js`
// (`AI_ASSISTANT_FLAG_NAME`/`AI_ASSISTANT_URL_NAME`); здесь нужны литералы,
// потому что Expo подставляет только литеральный `process.env.EXPO_PUBLIC_*`.
const TRUTHY_FLAG_VALUES = new Set(['1', 'true'])

const isFlagOn = (value: string | undefined | null): boolean =>
  TRUTHY_FLAG_VALUES.has(String(value ?? '').trim().toLowerCase())

/** Включён ли ассистент в этой сборке. Читается при вызове, не при загрузке модуля. */
export const isAiAssistantEnabled = (): boolean =>
  isFlagOn(process.env.EXPO_PUBLIC_AI_ASSISTANT)

/** Базовый адрес `llama-server` без завершающего слэша; пустая строка — не задан. */
export const getAiAssistantBaseUrl = (): string =>
  String(process.env.EXPO_PUBLIC_AI_ASSISTANT_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
