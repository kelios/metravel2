/**
 * Фича-флаг ассистента сайта (#2460).
 *
 * Ассистент (`/assistant`, пункт меню, кнопка на `/search`) живёт под
 * `EXPO_PUBLIC_AI_ASSISTANT=1`. Путь ответа один (#3297): серверный `POST /ai/ask`
 * службы metravel-assist (#2713) по адресу службы смыслового подбора
 * (`utils/aiPicksConfig.ts`: same-origin на web, origin API на native,
 * `EXPO_PUBLIC_AI_PICKS_URL` переопределяет); подбор, лимиты и блок «не по теме» — на
 * сервере. Прямого похода приложения в `llama-server` нет: значение
 * `EXPO_PUBLIC_AI_ASSISTANT_PROVIDER=llamacpp` — ошибка конфигурации
 * (`AI_ASSISTANT_PROVIDER_REMOVED`), `EXPO_PUBLIC_AI_ASSISTANT_URL` не читается.
 * Решение владельца 18.10.2026: локально включено, на проде выключено, пока нет
 * сервера под модель (#2457/#2458). При выключенном флаге ни страница, ни меню,
 * ни запросы к серверу не появляются ни на одной платформе: роут отдаёт
 * «страница не найдена», навигация не содержит пункта, экран грузится
 * отложенным чанком.
 *
 * Значения читаются литеральным `process.env.EXPO_PUBLIC_*`: только так Expo
 * подставляет их в бандл. Проверка конфигурации — `utils/runtimeConfigContract.js`
 * (`AI_ASSISTANT_*` диагностики).
 *
 * Сборочный контракт (#2738) тот же, что у `aiPicksConfig`: экран подключается
 * только литеральным `process.env.EXPO_PUBLIC_AI_ASSISTANT ? import(...) : …`,
 * чтобы сборка без флага не содержала ни экрана, ни `api/aiAssist`.
 */

// Имя переменной объявлено один раз — в `utils/runtimeConfigContract.js`
// (`AI_ASSISTANT_FLAG_NAME`); здесь нужен литерал, потому что Expo подставляет
// только литеральный `process.env.EXPO_PUBLIC_*`.
const TRUTHY_FLAG_VALUES = new Set(['1', 'true'])

const isFlagOn = (value: string | undefined | null): boolean =>
  TRUTHY_FLAG_VALUES.has(String(value ?? '').trim().toLowerCase())

/** Включён ли ассистент в этой сборке. Читается при вызове, не при загрузке модуля. */
export const isAiAssistantEnabled = (): boolean =>
  isFlagOn(process.env.EXPO_PUBLIC_AI_ASSISTANT)

/**
 * Контекстный вход (#2897): страница статьи или квеста ведёт в ассистента с
 * параметром `source=<type>:<id>`, и карточка этой страницы стоит первой в промпте.
 * Формат разбирает `api/aiAssist/sourceRef.ts` (`parseSourceRef`); билдер живёт
 * здесь, чтобы кнопка на странице не тянула `api/aiAssist` в сборку без флага (#2738).
 */
export type AiAssistantSourceRef = { type: 'travel' | 'quest'; id: number }

export const buildAssistantSourceHref = (ref: AiAssistantSourceRef): string =>
  `/assistant?source=${ref.type}:${ref.id}`

/**
 * `testID` поля вопроса. Общий для композера и роута: роут запоминает узел поля из
 * статической разметки до загрузки чанка экрана (#3346), а подключать сам композер
 * ему нельзя (#2738).
 */
export const ASSISTANT_INPUT_TEST_ID = 'assistant-input'
