#!/usr/bin/env bash
# Interactive chat with metravel-llm in the terminal (MLX, Mac only).
#
#   scripts/ai-train/chat.sh            # base + adapter v0 (default)
#   ADAPTER= scripts/ai-train/chat.sh   # base model without adapter, for comparison
#   ADAPTER=adapters/metravel-llm-v1 scripts/ai-train/chat.sh
#
# Do not run while training is in progress on the same Mac: a second copy of
# the model (~2.6 GB) competes for memory with the trainer. The system prompt
# is the one the dataset was built with (build_dataset.SYSTEM).
set -euo pipefail
AI_HOME="${AI_HOME:-$HOME/metravel-ai}"  # обучение переехало на ноутбук 18.10.2026 (README)
MODEL="${MODEL:-models/Qwen3.5-4B-MLX-4bit}"
ADAPTER="${ADAPTER-adapters/metravel-llm-v0}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM="$(python3 -I -c 'import sys; sys.path.insert(0, sys.argv[1]); import build_dataset; print(build_dataset.SYSTEM)' "$HERE")"
cd "$AI_HOME"
args=(--model "$MODEL" --temp 0.3 --max-tokens 400 --system-prompt "$SYSTEM")
if [[ -n "$ADAPTER" ]]; then
  [[ -f "$ADAPTER/adapters.safetensors" ]] || { echo "адаптер $ADAPTER ещё не сохранён (первый чекпоинт — на шаге 200)" >&2; exit 1; }
  args+=(--adapter-path "$ADAPTER")
fi
echo "модель: $MODEL  адаптер: ${ADAPTER:-нет}. Вопрос → Enter; выход: q" >&2
exec venv/bin/python -m mlx_lm chat "${args[@]}"
