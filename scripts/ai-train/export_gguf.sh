#!/usr/bin/env bash
# metravel-llm: LoRA adapter (mlx-lm) → merged bf16 HF checkpoint → GGUF bf16 →
# GGUF Q4_K_M for llama.cpp / llama-server (#2463).
#
#   AI_HOME=~/metravel-ai RUN=v1 scripts/ai-train/export_gguf.sh
#
# Inputs (relative to AI_HOME):
#   models/Qwen3.5-4B            bf16 base, `hf download Qwen/Qwen3.5-4B --local-dir models/Qwen3.5-4B`
#   adapters/metravel-llm-$RUN   trained adapter (adapters.safetensors + adapter_config.json)
#   llama.cpp/                   source checkout matching the installed binaries
#                                (`git clone --depth 1 --branch b<build> https://github.com/ggml-org/llama.cpp`;
#                                build from `llama-server --version`)
# Outputs:
#   fused/metravel-llm-$RUN-bf16/           merged HF checkpoint (same shards as the base)
#   gguf/metravel-llm-$RUN-bf16.gguf        full-precision GGUF (~8 GB, kept for re-quantisation)
#   gguf/metravel-llm-$RUN-Q4_K_M.gguf      the model the server runs (~2.6 GB)
#   gguf/metravel-llm-$RUN-Q4_K_M.gguf.sha256
#
# Steps are idempotent: an existing output is reused (delete it to redo).
# Requires torch in the venv (`uv pip install --python venv/bin/python torch`).
set -euo pipefail
AI_HOME="${AI_HOME:-$HOME/metravel-ai}"
RUN="${RUN:-v1}"
BASE="${BASE:-models/Qwen3.5-4B}"
QUANT="${QUANT:-Q4_K_M}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$AI_HOME"
PY="venv/bin/python"
LLAMA_SRC="${LLAMA_SRC:-llama.cpp}"
QUANTIZE="${QUANTIZE:-llama-quantize}"

ADAPTER="adapters/metravel-llm-$RUN"
FUSED="fused/metravel-llm-$RUN-bf16"
GGUF_BF16="gguf/metravel-llm-$RUN-bf16.gguf"
GGUF_Q="gguf/metravel-llm-$RUN-$QUANT.gguf"
mkdir -p fused gguf

[[ -f "$ADAPTER/adapters.safetensors" ]] || { echo "нет адаптера $ADAPTER" >&2; exit 1; }
[[ -f "$BASE/model.safetensors.index.json" ]] || { echo "нет bf16-базы $BASE (hf download Qwen/Qwen3.5-4B --local-dir $BASE)" >&2; exit 1; }
[[ -f "$LLAMA_SRC/convert_hf_to_gguf.py" ]] || { echo "нет исходников llama.cpp в $LLAMA_SRC" >&2; exit 1; }
command -v "$QUANTIZE" >/dev/null || { echo "нет $QUANTIZE (brew install llama.cpp)" >&2; exit 1; }

if [[ -f "$FUSED/model.safetensors.index.json" ]]; then
  echo "== 1/3 слияние: уже есть $FUSED" >&2
else
  echo "== 1/3 слияние LoRA в bf16 → $FUSED" >&2
  "$PY" "$HERE/merge_lora.py" --base "$BASE" --adapter "$ADAPTER" --out "$FUSED" | tee "$FUSED.merge.json"
fi

if [[ -f "$GGUF_BF16" ]]; then
  echo "== 2/3 конвертация: уже есть $GGUF_BF16" >&2
else
  echo "== 2/3 HF → GGUF bf16 → $GGUF_BF16" >&2
  # Пишем во временный файл и переименовываем: оборванный прогон (Ctrl-C, нет
  # места) не оставляет усечённый .gguf, который следующий запуск считает готовым.
  PYTHONPATH="$LLAMA_SRC/gguf-py" "$PY" "$LLAMA_SRC/convert_hf_to_gguf.py" "$FUSED" \
    --outtype bf16 --outfile "$GGUF_BF16.part" --model-name "metravel-llm-$RUN"
  mv "$GGUF_BF16.part" "$GGUF_BF16"
fi

if [[ -f "$GGUF_Q" ]]; then
  echo "== 3/3 квантизация: уже есть $GGUF_Q" >&2
else
  echo "== 3/3 квантизация $QUANT → $GGUF_Q" >&2
  "$QUANTIZE" "$GGUF_BF16" "$GGUF_Q.part" "$QUANT"
  mv "$GGUF_Q.part" "$GGUF_Q"
fi

shasum -a 256 "$GGUF_Q" | tee "$GGUF_Q.sha256"
ls -l "$GGUF_Q"
# -c is the total KV budget shared by --parallel slots: 8192 / 2 = 4096 tokens per request.
echo "готово: llama-server -m $AI_HOME/$GGUF_Q --port 8080 -c 8192 --parallel 2 --jinja" >&2
