#!/usr/bin/env bash
# metravel-llm: LoRA adapter (mlx-lm) → merged bf16 HF checkpoint → GGUF bf16 →
# GGUF Q4_K_M for llama.cpp / llama-server (#2463).
#
#   AI_HOME=~/metravel-ai RUN=v8 scripts/ai-train/export_gguf.sh      # RUN has no default
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
#   fused/metravel-llm-$RUN-bf16.adapter.sha256   sha256 of the adapter the outputs were made from
#
# Steps are idempotent: an existing output is reused only when it was made from
# the adapter that is in adapters/ now. The adapter's sha256 is written next to
# the merge; an adapter retrained under the same RUN (or outputs without that
# record) stops the script instead of handing out the old model with a fresh
# checksum. Delete the three outputs to redo, or — for outputs made before the
# record existed and known to match — rerun once with ALLOW_UNVERIFIED_REUSE=1.
# Requires torch in the venv (`uv pip install --python venv/bin/python torch`).
set -euo pipefail
AI_HOME="${AI_HOME:-$HOME/metravel-ai}"
[[ -n "${RUN:-}" ]] || { echo "export_gguf.sh: задайте RUN — версию адаптера (adapters/metravel-llm-\$RUN)" >&2; exit 2; }
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

ADAPTER_SHA="$(shasum -a 256 "$ADAPTER/adapters.safetensors" | cut -d' ' -f1)"
STAMP="$FUSED.adapter.sha256"
# Готовый результат годится только для того адаптера, из которого он сделан.
reuse_ok() {
  local output="$1"
  if [[ ! -f "$STAMP" ]]; then
    if [[ "${ALLOW_UNVERIFIED_REUSE:-}" == "1" ]]; then
      echo "   нет записи $STAMP — $output принят без сверки (ALLOW_UNVERIFIED_REUSE=1), записываю sha текущего адаптера" >&2
      echo "$ADAPTER_SHA" > "$STAMP"
      return 0
    fi
    echo "export_gguf.sh: $output уже есть, но нет записи $STAMP — неизвестно, из какого адаптера он сделан." >&2
    echo "  Удалите $FUSED, $GGUF_BF16 и $GGUF_Q и запустите заново, либо ALLOW_UNVERIFIED_REUSE=1, если результат заведомо от этого адаптера." >&2
    exit 1
  fi
  if [[ "$(cat "$STAMP")" != "$ADAPTER_SHA" ]]; then
    echo "export_gguf.sh: $output сделан из другого адаптера (sha256 $(cat "$STAMP")), а в $ADAPTER сейчас $ADAPTER_SHA." >&2
    echo "  Адаптер переобучен под тем же RUN: удалите $FUSED, $GGUF_BF16, $GGUF_Q и $STAMP и запустите заново." >&2
    exit 1
  fi
}

if [[ -f "$FUSED/model.safetensors.index.json" ]]; then
  reuse_ok "$FUSED"
  echo "== 1/3 слияние: уже есть $FUSED" >&2
else
  echo "== 1/3 слияние LoRA в bf16 → $FUSED" >&2
  rm -f "$STAMP"
  "$PY" "$HERE/merge_lora.py" --base "$BASE" --adapter "$ADAPTER" --out "$FUSED" | tee "$FUSED.merge.json"
  echo "$ADAPTER_SHA" > "$STAMP"
fi

if [[ -f "$GGUF_BF16" ]]; then
  reuse_ok "$GGUF_BF16"
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
  reuse_ok "$GGUF_Q"
  echo "== 3/3 квантизация: уже есть $GGUF_Q" >&2
else
  echo "== 3/3 квантизация $QUANT → $GGUF_Q" >&2
  "$QUANTIZE" "$GGUF_BF16" "$GGUF_Q.part" "$QUANT"
  mv "$GGUF_Q.part" "$GGUF_Q"
fi

shasum -a 256 "$GGUF_Q" | tee "$GGUF_Q.sha256"
echo "адаптер: $ADAPTER sha256 $ADAPTER_SHA" >&2
ls -l "$GGUF_Q"
# -c is the total KV budget shared by --parallel slots: 8192 / 2 = 4096 tokens per request.
echo "готово: llama-server -m $AI_HOME/$GGUF_Q --port 8080 -c 8192 --parallel 2 --jinja" >&2
