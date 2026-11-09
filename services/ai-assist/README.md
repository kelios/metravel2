# metravel-assist — смысловой подбор по индексу сайта

HTTP-сервис (#2456) поверх артефакта смыслового индекса (#2454): превращает
вопрос посетителя в вектор той же моделью, что строила индекс, находит ближайшие
фрагменты статей и квестов и сливает их с лексическим поиском бэкенда. Он же
отдаёт «похожие статьи» и «квесты рядом» без обращения к модели, а `/ai/ask`
(#2713) ведёт ответ ассистента: фильтр тем, лимиты на IP, подбор, `metravel-llm`,
страж ссылок — одним SSE-потоком. Код — `scripts/ai-assist/`
(исполняемые модули репозитория живут в `scripts/`; здесь — образ и описание, как у
`services/metravel-llm`).

## Эндпоинты

| запрос | ответ |
| --- | --- |
| `POST /ai/search` `{q, locale?: ru\|be\|uk\|pl\|en, type?: travel\|quest, limit?: 1..20}` | `{items, took_ms, index_built_at, degraded, cached}` |
| `GET /ai/similar?type=travel&id=816&limit=6&locale=ru&result_type=quest` | `{items, took_ms, index_built_at}` — вектор источника берётся из индекса, модель не нужна |
| `POST /ai/ask` `{q, locale?, history?: [{role: user\|assistant, text}] ≤ 6, source?: {type: travel\|quest, id}}` | SSE `sources → text* → done`; отказы до потока — JSON (ниже). `source` (#2897) — страница, с которой открыт ассистент: её карточка из индекса первой в `sources` и промпте на каждом ходу; кривой `source` → `400 bad_request`, нет в индексе → без закрепления |
| `POST /ai/author-draft` `{text, kind: title\|lead\|meta\|trip, locale?}` (#2885, #2911) | `{variants: string[], remaining}` — помощник автора в визарде статьи: 3 варианта заголовка (≤ 90 знаков), лида (2–3 предложения, ≤ 420) или SEO-описания (≤ 160) по тексту статьи через `metravel-llm` (промпт: только по тексту, ничего не выдумывать, без ссылок; ответ на языке `locale`), страж ссылок с пустым списком карточек режет любой адрес. `kind: 'trip'` (#2911) — черновик описания поездки планировщика: текст — точки по порядку, даты и транспорт (`components/trips/planning/tripDraftText.ts`), 2–3 варианта ≤ 600 знаков, промпт «только по плану, ничего не выдумывать». `400 bad_request` — текст короче порога вида (`AI_AUTHOR_DRAFT_MIN_TEXT_CHARS_BY_KIND`: статья 200 знаков, `trip` 40) или неизвестный `kind`, `429 limit` — `AI_AUTHOR_DRAFT_DAILY_LIMIT` (5) запросов/сутки/IP на эндпоинт, тот же `AskLimits` с префиксом `ai-author-draft:v1`; `429 busy` — очередь к модели; `503 generator_unavailable` — нет `AI_LLM_URL`, модель не ответила или не дала вариантов (запрос в квоту возвращается). Тело до 64 КБ, текст длиннее 8000 знаков обрезается |
| `POST /ai/suggest-tags` `{text, locale?}` (#2886) | `{countries, categories, transports, companions, over_nights_stay, confidence, degraded, neighbours, took_ms}` — подсказка словарных значений визарда статьи: текст → вектор → `AI_TAG_SUGGEST_NEIGHBOURS` (10) ближайших статей индекса (тот же `vectorSources`, что у `/ai/search`, очередь к эмбеддингу общая) → у каждой `GET /api/travels/<id>/` (id стран, категорий, транспорта, компаньонов, ночёвок) → голосование: значение проходит с `max(2, ⌈0.3·k⌉)` голосов из k ответивших статей и только если есть в словаре `GET /api/getFiltersTravel/` + `GET /api/countriesforsearch/`; `confidence` — средняя доля голосов принятых значений. Словарь и ответы статей — в памяти час (`TagCatalog`), отказы не кэшируются. `400 bad_request` — текст короче 300 знаков или кривая `locale`; `503 busy` — очередь к эмбеддингу; нет словаря или ни одной статьи → `200` с пустыми списками, `confidence: 0`, `degraded: true`. Модель не участвует: бюджет клиента 4 с не вмещает обработку промпта из 4000 знаков на CPU |
| `POST /ai/near-route` `{points: [{lat, lng}], limit?: 1..12, locale?}` (#2911) | `{items, took_ms}` — материалы в коридоре маршрута планировщика: источники индекса с координатами не дальше 30 км от ближайшего сегмента ломаной (haversine до ближайшей точки сегмента; одна точка — расстояние до неё), ближние первыми, один фрагмент на источник (у квеста — локали `locale`, если есть), `items[]` формы `/ai/search` со `score: null` плюс `distance_km`. Без модели и эмбеддинга, как `/ai/similar`. `400 bad_request` — нет точек, больше 50, кривые координаты или `limit` вне 1..12 |
| `POST /ai/intent` `{q, locale?}` (#2887) | `{categories, radius_km, center, constraints}` — фильтр карты из описания для строки «Опишите, что ищете» на `/map`: вопрос → `metravel-llm` с промптом набора `osm_intents` (`INTENT_PROMPT` из `scripts/ai-train/sets/osm_intents.py`, система — как у `/ai/ask`) → первый JSON-объект из ответа → TS-валидатор схемы `scripts/ai-train/osm_filter_schema.json` (`scripts/ai-assist/osmFilterSchema.ts`, порт `validate_filter()`/`extract_json()` с тестом эквивалентности Python-валидатору; enum'ы читаются из файла схемы, в образ он копируется). `categories` — `OsmPoiCategory` карты (attractions, culture, viewpoints, entertainment, religion, history), `radius_km` — 10/25/50/100/200, `center` — `{name}` или `null`, `constraints` — `{dogs, camper, kids, free}` (пустой объект, если модель опустила). `400 bad_request` — `q` короче 3 или длиннее 300 знаков, кривая `locale`; `422 {error: 'invalid_intent', detail}` — ответ без JSON или не по схеме (`detail` — ошибки валидатора); `429 limit` — `AI_MAP_INTENT_DAILY_LIMIT` (30) запросов/сутки/IP, тот же `AskLimits` с префиксом `ai-intent:v1`; `429 busy` — очередь к модели; `503 generator_unavailable` — нет `AI_LLM_URL` или модель не ответила. Неудачный запрос (422/429 busy/503) лимит не тратит |
| `GET /ai/health` | `{ok, model, dim, count, index_built_at, rss_mb, heap_mb, uptime_s, queue, cache, llm, ask_queue}` |

`items[]`: `{type, source_id, title, url, snippet, score, city, country, lat, lng}`;
`score` — косинус лучшего фрагмента (`null`, если источник пришёл только из
лексики). Ошибки: `400 {error: 'bad_request', detail}`, `404 not_found`,
`405 method_not_allowed`, `413 payload_too_large`, `503 {error: 'busy'}`.

Гибрид: top-50 источников по косинусу (нормализованные векторы → скалярное
произведение, `scripts/ai-index/query.ts`) + top-20 статей из
`GET /api/travels/?query=<q>&page_size=20` бэкенда (ранжирование #1581; ответ
кэшируется бэкендом на час), слитые Reciprocal Rank Fusion (k = 60). Проверено на
проде 18.10.2026: `searchextended` из плана отдаёт 404, `cards/?query=` не
кэшируется и отвечает 3,6–5,5 с, `travels/?query=` — 5,4 с первый раз и 0,43 с
повторно. Квесты бэкенд не ищет, поэтому при `type: 'quest'` лексика не
вызывается. Бэкенд недоступен или дольше `AI_ASSIST_LEXICAL_TIMEOUT_MS` → ответ
только векторный с `degraded: true` (такие ответы не кэшируются).

Квест лежит в индексе на каждой локали; выдача отдаёт фрагмент локали `locale`,
если квест на ней есть, иначе — любую. Статьи в индексе только на `ru`.

## `/ai/ask` (#2713)

Пайплайн — тот же, что у экрана `/assistant`, и из тех же модулей `api/aiAssist/*`
(фильтр тем `topicGate.ts`, промпт `prompt.ts`, страж `linkGuard.ts`, клиент модели
`generator.ts`): фильтр тем → лимиты на IP → подбор (гибрид `/ai/search`, ≤ 8
карточек) → промпт → `AI_LLM_URL` (`llama-server` metravel-llm) → страж ссылок.

События SSE (`content-type: text/event-stream`, `x-accel-buffering: no`):

| событие | данные |
| --- | --- |
| `sources` | `{sources: AiSource[], degraded, remaining}` — карточки промпта `{type, source_id, title, url, path, snippet, score}`; для отказа — `[]` |
| `text` | `{text}` — накопленный текст после стража ссылок (не дельта: страж может убрать уже показанный адрес) |
| `done` | `{status: done, removed_links, usage, remaining}` · `{status: off_topic, reason: offtopic_warning, strikes, strikes_to_block}` · `{status: off_topic, reason: model_refusal}` · `{status: no_sources}` · `{status: unavailable}` · `{status: error}` |

Второй рубеж и лимит рекомендаций (#3216) — те же модули, что у экрана:
`judgeModelReply` (`api/aiAssist/topicGate.ts`) отдаёт отказ модели на вопрос с
признаком поездки как `done {status: no_sources}` со строкой `no_sources` в журнале
спроса, без признака — прежний `off_topic/model_refusal`; генератор получает
`maxRecommendations: AI_MAX_RECOMMENDATIONS` (3) и закрывает стрим на четвёртой
рекомендации, поэтому последнее событие `text` несёт не больше трёх пунктов.

Отказы до потока — JSON `{error, detail, …}`: `400 bad_request`;
`429 offtopic_blocked` (`retry_after_sec`, `strikes`, `Retry-After` до полуночи) —
третий за календарный день вопрос не по теме с этого IP и любой вопрос до полуночи
после него, строка `offtopic_blocked` в журнале; `429 limit` — дневной лимит;
`429 busy` — очередь к модели (`Retry-After: 30`); `503 generator_unavailable` —
`AI_LLM_URL` не задан или модель не ответила до первого токена; `503 busy` —
очередь к эмбеддингу подбора.

Лимиты считаются на IP (`X-Real-IP`, затем последний адрес `X-Forwarded-For` — его
дописывает nginx, начало заголовка присылает сам посетитель; иначе сокет;
`AI_ASSIST_TRUST_PROXY=0` — только сокет) за календарный день Europe/Minsk
(`AI_ASSIST_DAY_TZ`) в redis: ключи `ai-ask:v1:{quota|offtopic}:<день>:<ip>` с TTL до
полуночи; без `REDIS_URL` и при его ошибке — память процесса. Вопросы не по теме
лимит не тратят; занятая/упавшая модель и уход посетителя до первого токена
возвращают списанный вопрос, обрыв после начала ответа — нет. Журнал спроса `AI_DEMAND_LOG` (`logs/ai-demand.jsonl`,
`{ts, q, locale, reason}` — та же форма, что у клиентского `api/aiAssist/demandLog.ts`;
IP не пишется) — единственная запись на диск: compose (#2457) монтирует под него том.

## Контракт с индексом

- Чтение `AI_INDEX_DIR` — `readIndex` из `scripts/ai-index/format.ts`: `count` =
  строки `chunks.jsonl` = `size(vectors.f16) / (dim × 2)` и `source_sha256`;
  несогласованный набор (читатель попал между rename файлов) — повтор через
  секунду, три попытки, затем отказ старта.
- Модель берётся из `manifest.model`; `AI_ASSIST_MODEL` закрепляет её явно (образ
  запекает одну модель), и при несовпадении старт завершается с сообщением, какой
  индекс и какая модель.
- Вектор запроса — тот же рецепт, что у индекса (`scripts/ai-index/models.ts`):
  `onnx-community/embeddinggemma-300m-ONNX`, dtype `q8`
  (`onnx/model_quantized.onnx`), выход `sentence_embedding`, промпт
  `task: search result | query: <q>`; реализация — `createEmbedder` из
  `scripts/ai-index/embed.ts`, та же, что у `npm run ai:index -- query`.

## Ограничители

- Один запрос к модели одновременно (`SingleFlight`); ожидание в очереди до
  `AI_ASSIST_QUEUE_TIMEOUT_MS` (2000) → `503 busy`.
- Кэш ответов `/ai/search` по ключу «модель + sha индекса + locale + type + limit +
  нормализованный q»: LRU в памяти (`AI_ASSIST_CACHE_SIZE`, 500) и, если задан
  `REDIS_URL`, redis с TTL `AI_ASSIST_CACHE_TTL_SECONDS` (3600). Redis — ускоритель:
  его ошибки логируются и не влияют на ответ; клиент — свой, RESP2 на `node:net`
  (GET и SET EX), без зависимостей.
- `AI_ASSIST_THREADS=1` и `--max-old-space-size=320` в образе. Пул libuv оставлен
  дефолтным (`UV_THREADPOOL_SIZE=4`): с одним потоком первое HTTPS-соединение к
  бэкенду занимало 1,3 с, лексика упиралась в таймаут, а оборванный keep-alive
  делал «первым» каждый следующий запрос (замер 18.10.2026); CPU ограничивают
  очередь и потоки ONNX, а не IO-пул.

## Переменные

| переменная | по умолчанию | назначение |
| --- | --- | --- |
| `AI_INDEX_DIR` | `dist/ai-index` (образ: `/index`) | директория артефакта |
| `BACKEND_URL` | `http://127.0.0.1:8000` (образ: `http://backend:8000`) | бэкенд для лексики |
| `PORT`, `HOST` | `8787`, `0.0.0.0` | адрес сервиса |
| `AI_ASSIST_MODEL` | модель из `manifest.model` | закрепляет ключ модели из `scripts/ai-index/models.ts` (в образе — запечённую); при несовпадении с индексом — отказ старта |
| `AI_ASSIST_MODEL_CACHE` | `~/metravel-ai/models/transformers-cache` (образ: `/models/transformers-cache`) | кэш весов |
| `AI_ASSIST_OFFLINE` | — (`1` в образе) | не ходить в huggingface.co |
| `AI_ASSIST_THREADS` | `1` | потоки ONNX |
| `AI_ASSIST_QUEUE_TIMEOUT_MS` / `AI_ASSIST_LEXICAL_TIMEOUT_MS` | `2000` / `1500` | очередь к модели / таймаут бэкенда |
| `AI_ASSIST_CACHE_SIZE` / `AI_ASSIST_CACHE_TTL_SECONDS` | `500` / `3600` | LRU / TTL redis |
| `REDIS_URL` | — | `redis://[:pass@]host:port[/db]` — кэш `/ai/search` и счётчики `/ai/ask` |
| `AI_LLM_URL` | — | `llama-server` metravel-llm для `/ai/ask`; без него вопросы по теме → `503 generator_unavailable` |
| `AI_ASSIST_LLM_TIMEOUT_MS` / `AI_ASSIST_ASK_QUEUE_TIMEOUT_MS` | `60000` / `2000` | таймаут ответа модели / ожидание очереди к модели до `429 busy` |
| `AI_ASK_DAILY_LIMIT` | `20` (`api/aiAssist/policy.ts`) | вопросов в сутки на IP |
| `AI_AUTHOR_DRAFT_DAILY_LIMIT` | `5` (`api/aiAssist/policy.ts`) | запросов `/ai/author-draft` в сутки на IP (#2885) |
| `AI_MAP_INTENT_DAILY_LIMIT` | `30` (`api/aiAssist/policy.ts`) | запросов `/ai/intent` в сутки на IP (#2887) |
| `AI_ASSIST_TAGS_TIMEOUT_MS` | `2500` | таймаут каталога `/ai/suggest-tags` (#2886): словарь и `GET /api/travels/<id>/` к `BACKEND_URL` |
| `AI_ASSIST_DAY_TZ` | `Europe/Minsk` | календарный день лимитов и блока «не по теме» |
| `AI_DEMAND_LOG` | `logs/ai-demand.jsonl` (образ: `/app/logs/ai-demand.jsonl`) | журнал спроса |
| `AI_ASSIST_TRUST_PROXY` | `1` | IP из `X-Real-IP`/последнего адреса `X-Forwarded-For`; `0` — только адрес сокета |

## Запуск на Mac

```bash
AI_INDEX_DIR=.codex-temp/ai-index/dist BACKEND_URL=https://metravel.by npm run ai:assist:dev
curl -s localhost:8787/ai/health
curl -s -X POST localhost:8787/ai/search -H 'content-type: application/json' \
  -d '{"q":"замки под Краковом на день","locale":"ru"}'
curl -s 'localhost:8787/ai/similar?type=travel&id=816&limit=6'
curl -s -X POST localhost:8787/ai/near-route -H 'content-type: application/json' \
  -d '{"points":[{"lat":53.9,"lng":27.56},{"lat":53.68,"lng":23.83}],"limit":8}'   # #2911, без модели
# /ai/ask с живой моделью: AI_LLM_URL=http://127.0.0.1:8080 (llama-server, см. docs/features/ai-assistant.md)
curl -sN -X POST localhost:8787/ai/ask -H 'content-type: application/json' \
  -d '{"q":"куда поехать под Гродно с детьми","locale":"ru"}'
curl -si -X POST localhost:8787/ai/ask -H 'content-type: application/json' -d '{"q":"как готовить кашу"}'  # ×3 → 429
curl -s -X POST localhost:8787/ai/author-draft -H 'content-type: application/json' \
  -d '{"text":"<текст статьи от 200 знаков>","kind":"meta","locale":"ru"}'   # {variants: [...], remaining}
curl -s -X POST localhost:8787/ai/intent -H 'content-type: application/json' \
  -d '{"q":"где рядом с Несвижем смотровые и парковка для кемпера","locale":"ru"}'   # #2887: {categories, radius_km, center, constraints}
npm run ai:assist:bench -- --n 1000                 # p50/p95, RSS после 1000 запросов
npm run ai:assist:bench -- --n 20 --concurrency 20  # очередь: часть ответов 503 busy
```

Нужен Node ≥ 22 (`--experimental-strip-types`; на Mac —
`PATH=/opt/homebrew/opt/node@22/bin:$PATH`). На машине без локального бэкенда
лексика берётся с прода (`BACKEND_URL=https://metravel.by`, только GET).

## Образ

```bash
docker build -f services/ai-assist/Dockerfile --build-arg AI_ASSIST_MODEL=embeddinggemma-300m-q4 -t metravel-assist .
docker run --rm -p 127.0.0.1:8787:8787 --cpus 1 -m 1g \
  -v "$PWD/.codex-temp/ai-index/dist-q4:/index:ro" -e BACKEND_URL=http://host.docker.internal:8000 \
  metravel-assist
```

`node:22-slim`, модель запекается на этапе сборки (`scripts/ai-assist/fetch-model.ts`),
индекс монтируется в `/index`. Ключ модели образа обязан совпадать с
`manifest.model` смонтированного индекса. Лимит памяти — по замерам
`docs/LOCAL_AI_ASSISTANT_PLAN.md` §11.2: q4 держит ≈ 0,7 ГБ RSS, q8 (дефолт
`ARG AI_ASSIST_MODEL`) — ≈ 2 ГБ и в 512 МБ не помещается. Compose, nginx (`/ai/` → сервис), лимиты и выкат —
карточка `area=back` #2457. Замеры (p50/p95, RSS, размер образа) — в карточке #2456 и
`docs/LOCAL_AI_ASSISTANT_PLAN.md` → раздел 11.
