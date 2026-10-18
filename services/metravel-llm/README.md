# metravel-llm — сервер собственной модели сайта

Контейнер `llama.cpp` (`llama-server`) с моделью `metravel-llm` — Qwen3.5-4B,
дообученной на статьях и квестах metravel.by (#2462), в формате GGUF Q4_K_M
(#2463). Отдаёт OpenAI-совместимый HTTP `POST /v1/chat/completions` со
стримингом; его вызывает ассистент сайта (#2460) и сервис `metravel-assist`
(#2456). Снаружи порт не публикуется — только внутренняя сеть compose (#2457).

## Файлы

| что | где |
| --- | --- |
| образ | `services/metravel-llm/Dockerfile` — `ghcr.io/ggml-org/llama.cpp:server-b11669` по digest, модель не запекается |
| модель | `metravel-llm-v1-Q4_K_M.gguf`, 2 783 446 880 байт (2,6 ГиБ), sha256 `b31d18c7d9ade88df7450b3f5dd18ded059ab791f76db489091bafa1a7157d64`; на проде — том `/srv/metravel/models` → `/models:ro` (#2457), на Mac — `~/metravel-ai/gguf/` |
| экспорт | `scripts/ai-train/export_gguf.sh` (слияние LoRA → bf16 GGUF → Q4_K_M), `scripts/ai-train/merge_lora.py` |
| оценка и замеры | `scripts/ai-train/eval.py --server`, `scripts/ai-train/bench_server.py`; числа — `scripts/ai-train/README.md` → «Экспорт в GGUF» |

## Запуск

```bash
docker build -t metravel-llm services/metravel-llm
docker run --rm -p 127.0.0.1:8080:8080 --cpus 4 -m 6g \
  -v ~/metravel-ai/gguf:/models:ro -e LLM_MODEL=metravel-llm-v1-Q4_K_M.gguf -e LLM_THREADS=3 \
  metravel-llm
curl -s http://127.0.0.1:8080/health          # {"status":"ok"} после загрузки (503 — ещё грузится)
```

Переменные: `LLM_MODEL` (имя файла в `/models`), `LLM_THREADS` (= vCPU минус
одно ядро для сайта), `LLM_CTX_SIZE` (общий KV-бюджет, делится между слотами:
8192 / 2 = 4096 токенов на запрос; системный промпт + 8 карточек + история
≤ 6 ходов — ~3 тыс. токенов; при 4096 / 2 = 2048 такой запрос получает
`400 exceeds the available context size`), `LLM_PARALLEL` (2 слота), `LLM_PORT`.

Запрос — как у ассистента (`api/aiAssist/`): системный промпт и карточки
подставляет клиент, сервер промптов не хранит:

```bash
curl -s http://127.0.0.1:8080/v1/chat/completions -H 'Content-Type: application/json' -d '{
  "messages": [{"role":"system","content":"Ты — помощник сайта metravel.by…"},
               {"role":"user","content":"Какие квесты есть в Гродно?"}],
  "max_tokens": 400, "temperature": 0.3, "stream": true,
  "chat_template_kwargs": {"enable_thinking": false}
}'
```

`--jinja` обязателен: без шаблона чата модели `enable_thinking: false` не
применяется и ответ начинается с блока размышлений.

## Обновление модели

Новая версия — новый файл `metravel-llm-vN-Q4_K_M.gguf` рядом со старым,
`LLM_MODEL` в compose на новое имя, `docker compose up -d metravel-llm`; откат —
вернуть имя. Sha256 файла сверяется с `*.sha256` из экспорта до замены
(`scripts/deploy-llm.sh` — часть #2457). Образ меняется только при смене сборки
`llama.cpp`: тег `server-b<build>` и digest обновляются вместе, после прогона
`eval.py --server` на той же сборке.

## Ограничения

- На Mac без Docker (ноутбук владельца) образ не собирался: Dockerfile проверен
  чтением базового образа (entrypoint `/app/llama-server`, `curl` в образе,
  `HEALTHCHECK` на `/health`), запуск — через brew `llama-server` той же сборки
  11669. Первая сборка образа — на хосте прода или в CI при #2457; там же
  проверяется запуск под `USER 1000:1000` (файл модели на томе должен быть
  читаем этим uid: `chmod 644`).
- Прод (1 vCPU / 1,8 ГБ) модель не вмещает — контейнер поднимается только после
  апгрейда сервера (#2458). Требования в числах — таблица замеров в
  `scripts/ai-train/README.md`.
