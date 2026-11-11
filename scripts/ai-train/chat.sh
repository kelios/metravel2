#!/usr/bin/env bash
# Interactive chat with metravel-llm in the terminal (MLX, Mac only).
#
#   ADAPTER=adapters/metravel-llm-v7 scripts/ai-train/chat.sh
#   ADAPTER= scripts/ai-train/chat.sh   # base model without adapter, for comparison
#
# ADAPTER has no default (it used to be v0, long superseded): name the version.
# This is the bare site prompt of sets/common.py — not the assistant screen, which
# sends its own prompt and cards (use /assistant or ai:assistant:quality for that).
#
# Do not run while training is in progress on the same Mac: a second copy of
# the model (~2.6 GB) competes for memory with the trainer. The system prompt
# is the one the dataset was built with (sets/common.py SYSTEM).
set -euo pipefail
AI_HOME="${AI_HOME:-$HOME/metravel-ai}"  # обучение переехало на ноутбук 18.10.2026 (README)
MODEL="${MODEL:-models/Qwen3.5-4B-MLX-4bit}"
[[ -n "${ADAPTER+set}" ]] || { echo "chat.sh: задайте ADAPTER=adapters/metravel-llm-<версия> (или пустой ADAPTER= для базы)" >&2; exit 2; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM="$(python3 -I -c 'import sys; sys.path.insert(0, sys.argv[1]); from sets.common import SYSTEM; print(SYSTEM)' "$HERE")"
cd "$AI_HOME"
args=(--model "$MODEL" --temp 0.3 --max-tokens 400 --system-prompt "$SYSTEM")
if [[ -n "$ADAPTER" ]]; then
  [[ -f "$ADAPTER/adapters.safetensors" ]] || { echo "адаптер $ADAPTER ещё не сохранён (первый чекпоинт — на шаге 200)" >&2; exit 1; }
  args+=(--adapter-path "$ADAPTER")
fi
echo "модель: $MODEL  адаптер: ${ADAPTER:-нет}. Вопрос → Enter; выход: q" >&2
exec venv/bin/python -m mlx_lm chat "${args[@]}"
