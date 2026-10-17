#!/usr/bin/env bash
# LoRA fine-tune of metravel-llm on the Mac (MLX). Long-running: start it in the
# background and follow logs/train-<run>.log.
#
#   AI_HOME=/Volumes/metravel-ai scripts/ai-train/train.sh [extra mlx_lm lora args]
#
# Prerequisites (see scripts/ai-train/README.md): $AI_HOME/venv with mlx-lm,
# base model in $AI_HOME/models, dataset in $AI_HOME/data/sft.
set -euo pipefail
AI_HOME="${AI_HOME:-/Volumes/metravel-ai}"
CONFIG="${CONFIG:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lora-qwen3.5-4b.yaml}"
RUN="${RUN:-$(date +%Y%m%d-%H%M)}"
cd "$AI_HOME"
mkdir -p logs adapters
cp "$CONFIG" "logs/train-$RUN.config.yaml"
echo "run=$RUN config=$CONFIG log=$AI_HOME/logs/train-$RUN.log"
exec venv/bin/python -m mlx_lm lora -c "$CONFIG" "$@" > "logs/train-$RUN.log" 2>&1
