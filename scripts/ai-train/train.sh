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
# mlx-lm compiles the train step (mx.compile); for Qwen3.5 the compiled graph
# defeats gradient checkpointing in the Gated DeltaNet fallback: peak 20.9 GB
# vs 15.4 GB uncompiled for one 1024-token sample, and 3× slower (measured
# 2026-10-18, mlx 0.32.4). Uncompiled fits the 18 GB Metal working set.
export MLX_DISABLE_COMPILE="${MLX_DISABLE_COMPILE:-1}"
cd "$AI_HOME"
mkdir -p logs adapters
cp "$CONFIG" "logs/train-$RUN.config.yaml"
echo "run=$RUN config=$CONFIG log=$AI_HOME/logs/train-$RUN.log"
exec venv/bin/python -m mlx_lm lora -c "$CONFIG" "$@" > "logs/train-$RUN.log" 2>&1
