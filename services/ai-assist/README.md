# metravel-assist — смысловой подбор по индексу сайта

HTTP-сервис (#2456) поверх артефакта смыслового индекса (#2454): превращает
вопрос посетителя в вектор той же моделью, что строила индекс, находит ближайшие
фрагменты статей и квестов и сливает их с лексическим поиском бэкенда. Он же
отдаёт «похожие статьи» и «квесты рядом» без обращения к модели. Код — `scripts/ai-assist/`
(исполняемые модули репозитория живут в `scripts/`; здесь — образ и описание, как у
`services/metravel-llm`).

## Эндпоинты

| запрос | ответ |
| --- | --- |
| `POST /ai/search` `{q, locale?: ru\|be\|uk\|pl\|en, type?: travel\|quest, limit?: 1..20}` | `{items, took_ms, index_built_at, degraded, cached}` |
| `GET /ai/similar?type=travel&id=816&limit=6&locale=ru&result_type=quest` | `{items, took_ms, index_built_at}` — вектор источника берётся из индекса, модель не нужна |
| `GET /ai/health` | `{ok, model, dim, count, index_built_at, rss_mb, heap_mb, uptime_s, queue, cache}` |

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
| `REDIS_URL` | — | `redis://[:pass@]host:port[/db]` |

## Запуск на Mac

```bash
AI_INDEX_DIR=.codex-temp/ai-index/dist BACKEND_URL=https://metravel.by npm run ai:assist:dev
curl -s localhost:8787/ai/health
curl -s -X POST localhost:8787/ai/search -H 'content-type: application/json' \
  -d '{"q":"замки под Краковом на день","locale":"ru"}'
curl -s 'localhost:8787/ai/similar?type=travel&id=816&limit=6'
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
