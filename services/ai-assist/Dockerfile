# metravel-assist — смысловой подбор по индексу сайта (#2456).
#
# Контекст сборки — корень репозитория:
#   docker build -f services/ai-assist/Dockerfile -t metravel-assist .
#
# В образ запекаются только рантайм-зависимость (@huggingface/transformers + onnxruntime-node),
# код scripts/ai-index + scripts/ai-assist, общие с экраном модули api/aiAssist (фильтр тем,
# промпт, страж ссылок, клиент модели — #2713) и веса модели EmbeddingGemma-300M q8
# (~330 МБ), чтобы прод не ходил в интернет. Индекс (#2454) в образ НЕ входит: он
# доставляется выкатом фронта и монтируется в /index (compose — #2457).
#
# Версия transformers обязана совпадать с package.json/yarn.lock репозитория: индекс
# считается на Mac той же библиотекой, что и запрос на проде (рецепт вектора — контракт).

ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS deps
ARG TRANSFORMERS_VERSION=4.3.1
WORKDIR /app
# .npmrc: onnxruntime-node-install=skip — без postinstall-скачивания CUDA-библиотек.
COPY .npmrc ./
RUN npm init -y >/dev/null \
 && npm pkg set type=module private=true name=metravel-assist \
 && npm install --omit=dev --no-audit --no-fund "@huggingface/transformers@${TRANSFORMERS_VERSION}" \
 && npm cache clean --force \
 # onnxruntime-node тащит бинарники всех платформ (darwin 86 МБ, win32 135 МБ): в образе нужен только linux.
 && rm -rf node_modules/onnxruntime-node/bin/napi-v6/darwin node_modules/onnxruntime-node/bin/napi-v6/win32
COPY scripts/ai-index/ scripts/ai-index/
COPY scripts/ai-assist/ scripts/ai-assist/
COPY api/aiAssist/ api/aiAssist/
# Журнал спроса /ai/ask (logs/ai-demand.jsonl): единственная запись сервиса; compose монтирует том.
RUN mkdir -p logs && chown 1000:1000 logs

# Веса модели: отдельный stage, чтобы смена кода не перекачивала веса.
# AI_ASSIST_MODEL — ключ из scripts/ai-index/models.ts; обязан совпадать с manifest.model индекса.
FROM deps AS model
ARG AI_ASSIST_MODEL=embeddinggemma-300m
ENV AI_ASSIST_MODEL=${AI_ASSIST_MODEL} AI_ASSIST_MODEL_CACHE=/models/transformers-cache
RUN node --experimental-strip-types scripts/ai-assist/fetch-model.ts

FROM ${NODE_IMAGE}
ARG AI_ASSIST_MODEL=embeddinggemma-300m
WORKDIR /app
ENV NODE_ENV=production \
    AI_ASSIST_MODEL=${AI_ASSIST_MODEL} \
    # Ограниченная куча: прод — 1 vCPU / 1.8 ГБ рядом с Django. Пул libuv — дефолтные 4 потока:
    # с UV_THREADPOOL_SIZE=1 первое HTTPS-соединение к бэкенду занимало 1,3 с (замер 18.10.2026),
    # лексика упиралась в таймаут, а оборванный keep-alive делал «первым» каждый следующий запрос.
    # CPU-параллелизм ограничивают очередь к модели и AI_ASSIST_THREADS, а не пул IO-потоков.
    UV_THREADPOOL_SIZE=4 \
    NODE_OPTIONS=--max-old-space-size=320 \
    AI_ASSIST_THREADS=1 \
    AI_ASSIST_OFFLINE=1 \
    AI_ASSIST_MODEL_CACHE=/models/transformers-cache \
    AI_INDEX_DIR=/index \
    BACKEND_URL=http://backend:8000 \
    AI_DEMAND_LOG=/app/logs/ai-demand.jsonl \
    HOST=0.0.0.0 \
    PORT=8787
COPY --from=deps /app /app
COPY --from=model /models /models

EXPOSE 8787
# Модель и индекс — только чтение, пишется только /app/logs; root процессу не нужен.
USER 1000:1000

# В node:22-slim нет curl: проба — тем же node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/ai/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "scripts/ai-assist/main.ts"]
