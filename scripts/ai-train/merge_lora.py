#!/usr/bin/env python3
"""Merge an mlx-lm LoRA adapter into the bf16 Hugging Face checkpoint of the
base model, keeping the HF file layout so `llama.cpp/convert_hf_to_gguf.py`
reads the result exactly like the official model (#2463).

Why not `mlx_lm fuse`: it rewrites the checkpoint in mlx-lm's own key layout
(text-only, `model.layers.*`), which the llama.cpp converter does not accept
for `Qwen3_5ForConditionalGeneration`. Merging in place keeps every tensor,
shard and json of the original repo and changes only the LoRA-touched weights.

Formula (mlx_lm/tuner/lora.py, LoRALinear.fuse):
    W' = W + (scale * lora_b.T) @ lora_a.T        # lora_a (in, r), lora_b (r, out)
computed in float32 and cast back to the checkpoint dtype (bf16).

Usage (inside the training folder, paths relative to it):
    venv/bin/python scripts/ai-train/merge_lora.py \
        --base models/Qwen3.5-4B --adapter adapters/metravel-llm-v1 \
        --out fused/metravel-llm-v1-bf16

Prints the number of merged tensors and the max |delta| per layer so a wrong
scale or key mapping is visible immediately (delta of a healthy rank-16 LoRA
is a few 1e-2; zero means the keys did not match).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

LAYER_RE = re.compile(r"layers\.(\d+)\.(.+)\.(lora_a|lora_b)$")


def load_adapter(adapter_dir: Path) -> tuple[dict[str, dict[str, "torch.Tensor"]], float]:
    import torch
    from safetensors.torch import load_file

    cfg = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
    scale = float(cfg["lora_parameters"]["scale"])
    tensors = load_file(str(adapter_dir / "adapters.safetensors"))
    pairs: dict[str, dict[str, torch.Tensor]] = {}
    for key, value in tensors.items():
        m = LAYER_RE.search(key)
        if not m:
            raise SystemExit(f"неизвестный ключ адаптера: {key}")
        pairs.setdefault(f"layers.{m.group(1)}.{m.group(2)}", {})[m.group(3)] = value
    for name, ab in pairs.items():
        if set(ab) != {"lora_a", "lora_b"}:
            raise SystemExit(f"у {name} нет пары lora_a/lora_b")
    return pairs, scale


def map_to_hf(pairs: dict, weight_map: dict[str, str]) -> dict[str, str]:
    """adapter 'layers.N.mod' → HF tensor name 'model.language_model.layers.N.mod.weight'."""
    mapping: dict[str, str] = {}
    for name in pairs:
        suffix = f".{name}.weight"
        hits = [k for k in weight_map if k.endswith(suffix) and ".visual." not in k and not k.startswith("mtp.")]
        if len(hits) != 1:
            raise SystemExit(f"для {name} найдено {len(hits)} тензоров базы: {hits}")
        mapping[name] = hits[0]
    return mapping


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, help="HF checkpoint of the base model (safetensors shards + index)")
    ap.add_argument("--adapter", required=True, help="mlx-lm adapter dir (adapters.safetensors + adapter_config.json)")
    ap.add_argument("--out", required=True, help="output dir; same shard names, merged weights")
    args = ap.parse_args()

    import torch
    from safetensors.torch import load_file, save_file

    base, adapter, out = Path(args.base), Path(args.adapter), Path(args.out)
    index = json.loads((base / "model.safetensors.index.json").read_text(encoding="utf-8"))
    weight_map: dict[str, str] = index["weight_map"]
    pairs, scale = load_adapter(adapter)
    mapping = map_to_hf(pairs, weight_map)
    by_shard: dict[str, list[str]] = {}
    for name, hf_key in mapping.items():
        by_shard.setdefault(weight_map[hf_key], []).append(name)

    out.mkdir(parents=True, exist_ok=True)
    merged, per_layer = 0, {}
    for shard in sorted({*weight_map.values()}):
        tensors = load_file(str(base / shard))
        for name in by_shard.get(shard, []):
            hf_key = mapping[name]
            w = tensors[hf_key]
            a = pairs[name]["lora_a"].to(torch.float32)  # (in, r)
            b = pairs[name]["lora_b"].to(torch.float32)  # (r, out)
            delta = (scale * b.T) @ a.T  # (out, in)
            if delta.shape != w.shape:
                raise SystemExit(f"{name}: форма дельты {tuple(delta.shape)} ≠ весу {tuple(w.shape)}")
            tensors[hf_key] = (w.to(torch.float32) + delta).to(w.dtype).contiguous()
            layer = name.split(".")[1]
            per_layer[layer] = max(per_layer.get(layer, 0.0), float(delta.abs().max()))
            merged += 1
        save_file(tensors, str(out / shard), metadata={"format": "pt"})
        print(f"{shard}: записан, слит {len(by_shard.get(shard, []))} тензоров", file=sys.stderr)

    if merged != len(pairs):
        raise SystemExit(f"слито {merged} из {len(pairs)} тензоров адаптера")

    # config/tokenizer/index копируются последними: пока их нет, прерванное
    # слияние не выглядит готовым чекпоинтом (export_gguf.sh судит о шаге 1 по
    # наличию model.safetensors.index.json) и повторный прогон не пропустит его.
    for f in base.iterdir():
        if f.is_file() and not f.name.endswith(".safetensors"):
            shutil.copy2(f, out / f.name)

    print(json.dumps({"merged": merged, "scale": scale, "max_abs_delta_by_layer": per_layer}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
