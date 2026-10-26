#!/usr/bin/env bash
# LoRA fine-tune of metravel-llm on the Mac (MLX). Long-running: start it in the
# background and follow logs/train-<run>.log.
#
#   AI_HOME=~/metravel-ai scripts/ai-train/train.sh [extra mlx_lm lora args]
#
# Prerequisites (see scripts/ai-train/README.md): $AI_HOME/venv with mlx-lm,
# base model in $AI_HOME/models, dataset from build_mix.py (config `data:`).
set -euo pipefail
AI_HOME="${AI_HOME:-$HOME/metravel-ai}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${CONFIG:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lora-qwen3.5-4b.yaml}"
# absolute before cd "$AI_HOME", so CONFIG=scripts/ai-train/… works from the repo root
CONFIG="$(cd "$(dirname "$CONFIG")" && pwd)/$(basename "$CONFIG")"
RUN="${RUN:-$(date +%Y%m%d-%H%M)}"
# mlx-lm compiles the train step (mx.compile); for Qwen3.5 the compiled graph
# defeats gradient checkpointing in the Gated DeltaNet fallback: peak 20.9 GB
# vs 15.4 GB uncompiled for one 1024-token sample, and 3× slower (measured
# 2026-10-18, mlx 0.32.4). Uncompiled fits the 18 GB Metal working set.
export MLX_DISABLE_COMPILE="${MLX_DISABLE_COMPILE:-1}"
# Exact validation, provenance snapshots and a cross-worktree training lock are
# acquired before loading model weights. The lock descriptor survives exec and
# is released by the OS when the trainer exits, including after a signal.
exec "$AI_HOME/venv/bin/python" "$SCRIPT_DIR/prepare_training_data.py" \
  --config "$CONFIG" --ai-home "$AI_HOME" --launch-run "$RUN" -- "$@"
