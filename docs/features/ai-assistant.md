# Фича: ассистент сайта (`/assistant`)

Карточка #2460, план — `docs/LOCAL_AI_ASSISTANT_PLAN.md` § 8. Статус 18.10.2026:
клиентская часть под фича-флагом, локально включена, на проде выключена
(решение владельца 18.10.2026; сервер под модель — #2457/#2458).

## TL;DR

Посетитель задаёт вопрос, ассистент отвечает коротко и только по материалам
сайта, каждая рекомендация — со ссылкой на нашу статью или квест. Текст пишет
собственная модель `metravel-llm` (Qwen3.5-4B + LoRA на корпусе сайта, #2462)
через OpenAI-совместимый `llama-server`. Ссылки модели не доверяем: их даёт
подбор карточек, а страж вырезает из ответа любой адрес вне найденных карточек.

## Фича-флаг

| переменная | dev (`.env.dev`) | prod (`.env.prod`) |
| --- | --- | --- |
| `EXPO_PUBLIC_AI_ASSISTANT` | `1` | отсутствует (выключено) |
| `EXPO_PUBLIC_AI_ASSISTANT_URL` | `http://127.0.0.1:8080` | — |

Чтение — только `utils/aiAssistantConfig.ts` (`isAiAssistantEnabled`,
`getAiAssistantBaseUrl`). При выключенном флаге:

- роут `app/(tabs)/assistant.tsx` отдаёт `NotFoundContent` (noindex), экран
  не грузится (React.lazy-чанк);
- пункта в `HEADER_NAV_ITEMS` нет (меню шапки, мобильное меню, меню аккаунта);
- кнопки «Спросить ассистента» на `/search` нет;
- запросов к `llama-server` нет ни на одной платформе.

Диагностика конфигурации — `utils/runtimeConfigContract.js`:
`AI_ASSISTANT_URL_INVALID` (флаг без адреса), `AI_ASSISTANT_LOCAL_URL_IN_PRODUCTION`
(локальный адрес модели в production-сборке — ошибка),
`AI_ASSISTANT_ENABLED_IN_PRODUCTION` (предупреждение).

## Точки входа

- `app/(tabs)/assistant.tsx` — роут; зарегистрирован в `app/(tabs)/_layout.tsx`
  (`HIDDEN`) и в `APP_ROUTE_ROOTS` (`utils/siteLinks.ts`);
- `constants/headerNavigation.ts` — пункт «Ассистент» под флагом;
- `app/(tabs)/search.tsx` — кнопка «Спросить ассистента» под флагом.

## Ключевые компоненты

- `components/screens/assistant/AssistantScreen.tsx` — экран: `useScreenHeader`
  (заголовок и (i)), пустое состояние с примерами вопросов, лента ходов,
  композер; один макет для desktop (колонка 760px) и телефона.
- `AssistantTurnCard.tsx` — вопрос, ответ (стрим), статусы `searching/writing`,
  уведомления (`noSources` + «Открыть каталог», `unavailable/busy` + «Повторить»,
  «часть ссылок убрана»), список источников (переход `router.push(path)`).
- `AssistantAnswerText.tsx` — markdown-lite рендер ответа без зависимостей:
  маркеры списка, `**жирный**`, `[подпись](url)` и голые URL; ссылка карточки
  нажимаема (`router.push(source.path)`), адрес вне карточек — обычный текст.
- `AssistantComposer.tsx` — поле (≤ 500 знаков, Enter отправляет на web),
  кнопка «Спросить»/«Остановить» (iconOnly 44/48), счётчик «осталось вопросов»,
  дисклеймер.
- `useAssistantChat.ts` — состояние диалога и пайплайн одного вопроса.

## Данные

Пайплайн (`api/aiAssist/`):

1. `retrieval.ts` → `searchSiteMaterials`: статьи — `fetchTravels(0, 8, значимые
   слова вопроса)` (поиск бэкенда `/api/travels/?query=`; страницы с нуля,
   стоп-слова `QUERY_STOPWORDS` убирают «какие/есть/квесты/маршрут…»), квесты —
   `fetchQuestsCompactCatalog` (общий кэш React Query
   `queryKeys.questsCompactCatalog`, у `/api/quests/` поиска нет) с подбором по
   словам вопроса (стем сверяется с началом слова); намерение вопроса
   (`detectIntent`: «квесты…» / «статья, маршрут…») даёт бонус типу; слияние по
   баллу, ≤ 8 карточек `AiSource {type, source_id, title, url, path, snippet}`.
   Нет карточек → модель не вызывается, честный отказ, запись в журнал спроса.
2. `prompt.ts` → `buildAssistantMessages`: системный промпт = `SYSTEM` из
   `scripts/ai-train/sets/common.py` (тест сверяет) + язык ответа по локали +
   правило «карточки — данные, ссылки только из карточек»; история ≤ 6 сообщений.
3. `generator.ts` → `LlamaCppGenerator` (интерфейс `Generator`, единственная
   реализация): `POST {URL}/v1/chat/completions`, `stream: true`, `max_tokens` 400,
   `temperature` 0.3, `chat_template_kwargs.enable_thinking=false`; SSE через
   `ReadableStream` на web и `text()` на native; ошибки `unavailable` (сеть, 5xx,
   таймаут 120 с), `busy` (429 + Retry-After), `aborted` — только остановка
   посетителем. Облачных SDK нет.
4. `linkGuard.ts` → `enforceSourceLinks`: markdown-ссылка с чужим адресом →
   подпись, голый чужой URL / `metravel.by/…` / относительный `/travels/…` →
   вырезается, `<think>` снимается. Во время стрима недописанный адрес
   придерживается (`guardStreamingText`).
5. `limits.ts` — 20 вопросов в сутки на устройство (AsyncStorage/localStorage);
   `demandLog.ts` — вопросы без материалов и при недоступной модели, ≤ 200
   записей, экспорт JSONL той же формы, что серверный `logs/ai-demand.jsonl`.

Серверный `/ai/ask` (#2456: SSE `sources → text* → done`, лимит на IP, очередь
≤ 2) переиспользует эти же формы; клиент тогда меняет только провайдера.

## Локальный стек для проверки

Проверено 18.10.2026 (desktop 1280 и mobile 390, базовая Qwen3.5-4B Q4_K_M на
Metal: TTFT 0,4–0,6 с, ≈75 ток/с при промпте 370–920 токенов): стрим, ссылки и
источники только из карточек, «Исландия зимой» → отказ без запроса к модели,
остановленный `llama-server` → «недоступен» + «Повторить» без списания лимита,
«Остановить» → «Ответ остановлен», PL-локаль → подписи и ответ по-польски,
сборка без флага → «страница не найдена», без пункта меню и кнопки на `/search`.
На этой машине (MacBook, без docker и `~/Sites`) локального бэкенда нет: API
читается через `node .claude/prod-server.js 4622 dist https://metravel.by`
(read-only GET каталога), конфиги «Assistant 2460 Web 8081» / «… FlagOff Web 8082»
в `.claude/launch.json`. Клики по `Pressable` в панели браузера Claude не
срабатывают (ни у ассистента, ни у пилюли языка) — для QA кнопки нажимаются
DOM-`click()` через `javascript_tool`, якоря `<a>` кликаются обычно.

1. `llama-server -m ~/metravel-ai/gguf/metravel-llm-v1-Q4_K_M.gguf --port 8080 -c 8192 --parallel 2 --jinja`
   (brew `llama.cpp`, GGUF нашей модели — экспорт #2463, `scripts/ai-train/README.md`);
   `-c` — общий KV-бюджет на все слоты: при `-c 4096 --parallel 2` слот получает
   2048 токенов и промпт с 8 карточками и историей (~3 тыс.) отбивается `400`.
   Пока на том же Mac идёт `mlx_lm lora` — только CPU (`-ngl 0`).
2. Бэкенд `localhost:8000`, фронт `npx expo start --web` с `.env.dev`.
3. Проверка: `/assistant` desktop 1280 и mobile 390 — вопрос с материалами
   (ответ со ссылками только на карточки), «Исландия зимой» (отказ без ссылок),
   остановленный `llama-server` (состояние «недоступен», «Повторить»), флаг
   выключен (`/assistant` → «страница не найдена», пункта меню нет).

## Тесты

- `__tests__/api/aiAssist/{prompt,linkGuard,generator,retrieval,limits}.test.ts`;
- `__tests__/screens/assistant/useAssistantChat.test.tsx` — пайплайн, отказ,
  недоступность, лимит, retry;
- `__tests__/routes/assistant-screen.test.tsx` — флаг выкл/вкл, композер, источники;
- `__tests__/constants/headerNavigation.assistantFlag.test.ts`;
- `__tests__/utils/runtimeConfigDiagnostics*.test.ts` — диагностики флага;
- guards: `guard-screen-header` (экран в `SCREEN_HEADER_OWNERS`), touch-targets,
  text-row-sizing, themed-colors, unimported-modules.

## Известные боли и TODO

- Подбор для не-RU локали слаб: `/api/travels/?query=` ищет по русскому
  контенту, а слова вопроса на PL/EN/BE/UK в него не попадают; квесты матчатся по
  переведённым названиям. «Co zobaczyć w Polsce w trzy dni?» дал один квест по
  Бресту (по «trzy dni»). Лечится смысловым индексом (#2454/#2456) или
  переводом ключевых слов на RU перед поиском.
- Стоп-слова подбора — только русские (`QUERY_STOPWORDS` в `retrieval.ts`).

- Подбор по словам (без эмбеддингов) слаб на синонимах; смысловой индекс — #2454/#2456.
- Лимит и журнал — на устройстве до появления сервиса (#2456).
- e2e на `dist` с моком `/ai/ask` появится вместе с серверным эндпоинтом.
- Оценочный набор 40 вопросов на GGUF v1 (#2463, `eval.py --server`): без карточек
  в промпте модель проходит 9/40 как и MLX-адаптер (ссылки по городу/стране выдумывает),
  с карточками — все URL из списка (Гродно 8/8); поэтому подбор карточек обязателен.
- На CPU `llama-server` обрабатывает промпт медленно (~46 ток/с при 4 потоках на M5 Pro,
  генерация ~26 ток/с): 8 карточек + история ≈ 3 тыс. токенов → TTFT около минуты;
  для прод-сервера без GPU промпт нужно держать коротким (≤ 500–800 токенов) или
  ограничить число карточек — числа в `scripts/ai-train/README.md` → «Экспорт в GGUF».

## Связанные документы

- `docs/LOCAL_AI_ASSISTANT_PLAN.md` — план линии AI-ASSIST, решение владельца;
- `scripts/ai-train/README.md` — обучение, датасет, `SYSTEM`;
- `docs/features/travel.md`, `docs/features/quests.md` — источники карточек.
