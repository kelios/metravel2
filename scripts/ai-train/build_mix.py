#!/usr/bin/env python3
"""Build a training mix for metravel-llm: sets → weighted/capped subsample →
curriculum stages with replay (docs/AI_TRAIN_DATASETS.md § 2–3).

Usage (PyYAML comes with mlx-lm, so run it with the training venv; a .json mix
works with any python3):
    ~/metravel-ai/venv/bin/python -I scripts/ai-train/build_mix.py \
        --ai-home ~/metravel-ai --mix scripts/ai-train/mixes/v2.yaml

Mix file:
    name: v2
    seed: 20261017
    split: {by: key, valid_share: 0.03, test_share: 0.02}   # by: key (entity) | id (v1 sample key)
    sets:
      site: {weight: 1.0, cap_tokens: 4000000, options: {chunk_chars: 2600, structured: true}}
    stages:                       # optional; default — one stage with every set
      - {name: s1, sets: [toponyms, translations]}
      - {name: s2, sets: [site]}
    replay: 0.15                  # share of earlier stages' train samples in each later stage

Per set: <AI_HOME>/data/sets/<set>/{train,valid,test}.jsonl with every field
(messages, set, key, id, kind, license) and stats.json. weight scales the
number of samples (< 1 subsamples, > 1 repeats train samples), cap_tokens then
limits the set (≈ chars / 3) by a seeded subsample; valid/test are only ever
subsampled, never repeated.

Per mix: <out>/{train,valid,test}.jsonl (messages only, what mlx-lm reads),
stats.json and manifest.json (sets, licences, sources, caps); with several
stages each stage gets <out>/<stage>/. Default out: <AI_HOME>/data/sft-<name>.
A single-set, single-stage mix keeps the set's order untouched, so the v1 mix
reproduces the v1 dataset bit for bit.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import random
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import sets  # noqa: E402
from sets.common import approx_tokens, split, stats, write_jsonl  # noqa: E402

DEFAULT_SEED = 20261017
DEFAULT_SPLIT = {"by": "key", "valid_share": 0.03, "test_share": 0.02}
PARTS = ("train", "valid", "test")


def load_mix(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".json":
        mix = json.loads(text)
    else:
        try:
            import yaml
        except ImportError:
            raise SystemExit("PyYAML is missing: run build_mix.py with the training venv (venv/bin/python) or pass a .json mix")
        mix = yaml.safe_load(text)
    if not isinstance(mix, dict) or not mix.get("name") or not mix.get("sets"):
        raise SystemExit(f"{path}: a mix needs 'name' and 'sets'")
    if mix.get("stages") is not None:
        stages = mix["stages"]
        staged = [s for st in stages for s in st.get("sets") or []]
        unknown = sorted(set(staged) - set(mix["sets"]))
        missing = sorted(set(mix["sets"]) - set(staged))
        if not stages or any(not st.get("name") or not st.get("sets") for st in stages) or unknown or missing or len(staged) != len(set(staged)):
            raise SystemExit(f"{path}: every stage needs a name and sets, every set must be in exactly one stage (unknown {unknown}, missing {missing})")
    replay = float(mix.get("replay", 0.0))
    if not 0.0 <= replay < 1.0:
        raise SystemExit(f"{path}: replay must be in [0, 1)")
    return mix


def resample(rows: list[dict], factor: float, rng: random.Random, allow_repeat: bool) -> list[dict]:
    """Keep the order at factor 1.0 (regression mixes); otherwise a seeded subsample or repeats."""
    if factor == 1.0 or (factor > 1.0 and not allow_repeat):
        return list(rows)
    whole, frac = int(factor), factor - int(factor)
    out = list(rows) * whole
    if frac > 0 and rows:
        out += rng.sample(rows, round(len(rows) * frac))
    return out


def build_set(name: str, cfg: dict, ctx: dict, split_cfg: dict, sets_root: Path) -> dict:
    module = sets.load(name)
    records = module.build(ctx, cfg.get("options") or {})
    random.Random(ctx["seed"]).shuffle(records)
    parts = dict(zip(PARTS, split(records, float(split_cfg["valid_share"]), float(split_cfg["test_share"]), split_cfg["by"])))
    out = sets_root / name
    out.mkdir(parents=True, exist_ok=True)
    for part, rows in parts.items():
        write_jsonl(out / f"{part}.jsonl", rows, messages_only=False)
    set_stats = {"set": name, "license": module.LICENSE, "split": split_cfg, "options": cfg.get("options") or {},
                 **{part: len(rows) for part, rows in parts.items()}, **stats(records)}
    (out / "stats.json").write_text(json.dumps(set_stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    weight = float(cfg.get("weight", 1.0))
    full_tokens = approx_tokens(records)
    cap = cfg.get("cap_tokens")
    factor = weight
    if cap is not None and full_tokens * weight > int(cap):
        factor = int(cap) / full_tokens
    rng = random.Random(f"{ctx['seed']}:{name}")
    taken = {part: resample(rows, factor, rng, allow_repeat=(part == "train")) for part, rows in parts.items()}
    return {
        "parts": taken,
        "manifest": {
            "license": module.LICENSE, "weight": weight, "cap_tokens": cap, "factor": round(factor, 6),
            "records_full": len(records), "tokens_full": full_tokens,
            "records_taken": {p: len(r) for p, r in taken.items()}, "tokens_taken": approx_tokens(taken["train"]),
            "source": module.source_info(ctx),
        },
    }


def build_stages(mix: dict, built: dict, seed: int) -> list[dict]:
    stage_defs = mix.get("stages") or [{"name": mix["name"], "sets": list(mix["sets"])}]
    replay = float(mix.get("replay", 0.0))
    stages, earlier = [], []
    for i, st in enumerate(stage_defs):
        parts = {p: [r for s in st["sets"] for r in built[s]["parts"][p]] for p in PARTS}
        replayed: list[dict] = []
        if i and replay and earlier:
            n = min(len(earlier), round(len(parts["train"]) * replay / (1 - replay)))
            replayed = random.Random(f"{seed}:replay:{st['name']}").sample(earlier, n)
            parts["train"] = parts["train"] + replayed
        if len(st["sets"]) > 1 or replayed:
            for p in PARTS:
                random.Random(f"{seed}:{st['name']}:{p}").shuffle(parts[p])
        earlier += [r for s in st["sets"] for r in built[s]["parts"]["train"]]
        stages.append({"name": st["name"], "sets": st["sets"], "parts": parts, "replayed": len(replayed)})
    return stages


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mix", required=True, help="mixes/<name>.yaml (or .json)")
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--raw", default=None, help="exported corpus (default: <AI_HOME>/data/raw)")
    ap.add_argument("--out", default=None, help="mix output (default: <AI_HOME>/data/sft-<name>)")
    args = ap.parse_args()
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    mix_path = Path(args.mix)
    mix = load_mix(mix_path)
    seed = int(mix.get("seed", DEFAULT_SEED))
    split_cfg = {**DEFAULT_SPLIT, **(mix.get("split") or {})}
    ctx = {"ai_home": home, "raw": Path(args.raw).expanduser() if args.raw else home / "data" / "raw",
           "sources": home / "data" / "sources", "seed": seed}
    out = Path(args.out).expanduser() if args.out else home / "data" / f"sft-{mix['name']}"

    for name in mix["sets"]:
        sets.load(name)  # fail before any set is written when one is not implemented yet
    built = {name: build_set(name, cfg or {}, ctx, split_cfg, home / "data" / "sets") for name, cfg in mix["sets"].items()}
    stages = build_stages(mix, built, seed)

    summary = {"mix": mix["name"], "stages": []}
    for st in stages:
        target = out if len(stages) == 1 else out / st["name"]
        target.mkdir(parents=True, exist_ok=True)
        for p in PARTS:
            write_jsonl(target / f"{p}.jsonl", st["parts"][p], messages_only=True)
        by_set: dict[str, int] = {}
        for r in st["parts"]["train"]:
            by_set[r["set"]] = by_set.get(r["set"], 0) + 1
        st_stats = {"stage": st["name"], "sets": st["sets"], "replayed": st["replayed"], "by_set": by_set,
                    **{p: len(st["parts"][p]) for p in PARTS}, "train_stats": stats(st["parts"]["train"])}
        (target / "stats.json").write_text(json.dumps(st_stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        summary["stages"].append({"dir": str(target), **{k: st_stats[k] for k in ("stage", "train", "valid", "test", "replayed")},
                                  "approx_tokens": st_stats["train_stats"]["approx_tokens"]})
    manifest = {
        "mix": mix["name"], "mix_file": str(mix_path.resolve()), "built_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "seed": seed, "split": split_cfg, "replay": float(mix.get("replay", 0.0)),
        "stages": [{"name": s["name"], "sets": s["sets"]} for s in stages],
        "sets": {name: b["manifest"] for name, b in built.items()},
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copyfile(mix_path, out / f"mix{mix_path.suffix}")
    print(json.dumps(summary, ensure_ascii=False, indent=2), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
