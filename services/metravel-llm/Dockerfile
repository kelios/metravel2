# metravel-llm — llama.cpp server with the site's own model (#2463).
#
# The GGUF is NOT baked into the image: it is mounted read-only at /models
# (prod: /srv/metravel/models → /models, see #2457), so a new model version is
# a file swap + `docker compose restart metravel-llm`, not an image rebuild.
#
# Base image pinned by digest (multi-arch index of ghcr.io/ggml-org/llama.cpp:server-b11669,
# the same build 11669 as the brew llama.cpp 0.7.0 the GGUF was produced and
# evaluated with on the Mac). Bump build and digest together.
FROM ghcr.io/ggml-org/llama.cpp:server-b11669@sha256:8ffe0d28ff5261cc2f78ca1f67db1515bc2529b904a3c25f5b24f4cedfc3411d

# Model file name inside the mounted volume; override with -e LLM_MODEL=...
# LLM_CTX_SIZE is the TOTAL KV budget, split evenly between LLM_PARALLEL slots:
# 8192 / 2 = 4096 tokens per request. The assistant's prompt (system + 8 cards
# + 6 turns) is ~3k tokens, and 4096 / 2 = 2048 per slot rejects it with
# HTTP 400 "exceeds the available context size" (measured on build 11669).
# Qwen3.5 keeps KV only in 8 of 32 layers, so the budget is cheap in RAM.
ENV LLM_MODEL=metravel-llm.gguf \
    LLM_THREADS=3 \
    LLM_CTX_SIZE=8192 \
    LLM_PARALLEL=2 \
    LLM_PORT=8080

EXPOSE 8080

# Nothing here needs root: the model is a read-only mount, the binary and its
# libs are world-readable. The base image runs as root by default.
USER 1000:1000

# llama-server's own /health answers 503 while the model loads and 200 after.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${LLM_PORT}/health" || exit 1

# The base image's entrypoint is /app/llama-server; arguments come from the env
# so compose can tune threads/ctx without a new image. The assistant's system
# prompt is sent by the client (#2460) in every request, not configured here.
# --jinja: use the model's chat template (needed for enable_thinking=false);
# --no-warmup: skip the warm-up pass so the container is ready faster;
# -ngl 0: CPU only (prod has no GPU).
# "$@" keeps the base image's contract: compose `command:` / `docker run` args
# are appended to llama-server instead of being silently dropped by `sh -c`.
ENTRYPOINT ["/bin/sh", "-c", "exec /app/llama-server \
  --model \"/models/${LLM_MODEL}\" \
  --host 0.0.0.0 --port \"${LLM_PORT}\" \
  --threads \"${LLM_THREADS}\" --threads-batch \"${LLM_THREADS}\" \
  --ctx-size \"${LLM_CTX_SIZE}\" --parallel \"${LLM_PARALLEL}\" \
  -ngl 0 --jinja --no-warmup --metrics \
  \"$@\"", "metravel-llm"]
