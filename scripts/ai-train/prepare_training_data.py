#!/usr/bin/env python3
"""Prepare intact, exactly token-budgeted local examples and guard MLX launch.

  venv/bin/python prepare_training_data.py --data data/sft-v5/s3 --model models/Qwen3.5-4B-MLX-4bit --out data/sft-v5/prepared
  venv/bin/python prepare_training_data.py --config lora-v5.yaml --ai-home ~/metravel-ai

The second form rechecks every example and its provenance; --launch-run is used
by train.sh after review. No model weights or network resources are loaded here.
"""
from __future__ import annotations

import argparse
from collections import Counter
import fcntl
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from sets.assistant_prompt import holdout_provenance, holdout_violation  # noqa: E402

PARTS = ("train", "valid", "test")
TOKENIZER_FILES = ("config.json", "tokenizer.json", "tokenizer_config.json", "chat_template.jinja", "tokenizer.model")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()


def check_limit(max_tokens: int) -> None:
    if isinstance(max_tokens, bool) or not isinstance(max_tokens, int) or not 1 <= max_tokens <= 1024:
        raise ValueError("max_seq_length must be an integer in [1, 1024]")


def local_tokenizer(model: Path):
    if not model.is_dir():
        raise ValueError(f"local model directory missing: {model}")
    # The same loader/wrapper and defaults as mlx_lm.load(), without model weights.
    from mlx_lm.utils import load_tokenizer
    tokenizer = load_tokenizer(model, {"local_files_only": True, "trust_remote_code": False})
    identity = {"model": str(model.resolve()), "mlx_lm": importlib.metadata.version("mlx-lm"),
                "files": {name: digest((model / name).read_bytes()) for name in TOKENIZER_FILES if (model / name).is_file()}}
    return tokenizer, identity


def encoded_lengths(row: dict, tokenizer) -> tuple[int, int]:
    """Mirror mlx_lm.tuner.datasets.ChatDataset.process, including prompt masking."""
    messages = row.get("messages")
    if (not isinstance(messages, list) or len(messages) < 2
            or any(not isinstance(m, dict) or m.get("role") not in ("system", "user", "assistant")
                   or not isinstance(m.get("content"), str) for m in messages)
            or messages[-1]["role"] != "assistant" or not messages[-1]["content"].strip()):
        raise ValueError("example needs messages and a nonempty final assistant target")
    tools = row.get("tools")
    full = tokenizer.apply_chat_template(messages, tools=tools, return_dict=False)
    prefix = tokenizer.apply_chat_template(messages[:-1], tools=tools, add_generation_prompt=True, return_dict=False)
    if len(full) <= len(prefix):
        raise ValueError("example has no supervised target tokens")
    return len(full), len(full) - len(prefix)


def scan(data: Path, tokenizer, max_tokens: int):
    """Check all source examples, returning complete accepted lines, never slices."""
    check_limit(max_tokens)
    indexed = [(data / f"{part}.records.jsonl").is_file() for part in PARTS]
    if any(indexed) and not all(indexed):
        raise ValueError("partial record provenance: need all three .records.jsonl files")
    accepted, inputs, stats = {}, {}, {}
    messages_seen, groups_seen = {}, {}
    for part in PARTS:
        file = data / f"{part}.jsonl"
        raw = file.read_bytes()
        inputs[file.name] = digest(raw)
        lines = [line for line in raw.decode("utf-8").splitlines() if line.strip()]
        record_lines = None
        if all(indexed):
            file = data / f"{part}.records.jsonl"
            raw_records = file.read_bytes()
            inputs[file.name] = digest(raw_records)
            record_lines = [line for line in raw_records.decode("utf-8").splitlines() if line.strip()]
            if len(record_lines) != len(lines):
                raise ValueError(f"{part}: record provenance length mismatch")
        kept, records, totals, targets = [], [], [], []
        counts, by_set, rejected_by_set = Counter(), Counter(), Counter()
        for index, line in enumerate(lines):
            row = json.loads(line)
            metadata = json.loads(record_lines[index]) if record_lines is not None else None
            origin = metadata.get("set", "unknown") if metadata else "unknown"
            if metadata and metadata.get("messages") != row.get("messages"):
                raise ValueError(f"{part}:{index + 1}: record provenance messages mismatch")
            length, target = encoded_lengths(row, tokenizer)
            violation = holdout_violation(row["messages"])
            if violation:
                raise ValueError(f"{part}:{index + 1}: {violation}")
            identity = digest(json_bytes({"messages": row["messages"], "tools": row.get("tools")}))
            if identity in messages_seen and messages_seen[identity] != part:
                raise ValueError("identical conversation occurs across splits")
            messages_seen[identity] = part
            if metadata:
                if not all(isinstance(metadata.get(key), str) and metadata[key] for key in ("set", "key", "id")):
                    raise ValueError(f"{part}:{index + 1}: invalid record provenance")
                group = (metadata["set"], metadata["key"])
                if group in groups_seen and groups_seen[group] != part:
                    raise ValueError(f"scenario group occurs across splits: {group}")
                groups_seen[group] = part
            if length > max_tokens:
                counts["overlength"] += 1
                rejected_by_set[origin] += 1
                continue
            kept.append(line)
            if metadata:
                records.append(record_lines[index])
            totals.append(length)
            targets.append(target)
            by_set[origin] += 1
        if not kept:
            raise ValueError(f"{part}: no usable complete examples after exact validation")
        accepted[part] = {"lines": kept, "records": records}
        stats[part] = {"input": len(lines), "accepted": len(kept), "rejected": dict(counts),
                       "by_set": dict(by_set), "rejected_by_set": dict(rejected_by_set),
                       "tokens_min": min(totals), "tokens_max": max(totals), "target_tokens_min": min(targets)}
    return accepted, inputs, stats


def prepare(data: Path, out: Path, tokenizer, identity: dict, max_tokens: int) -> dict:
    if out.resolve() == data.resolve() or (out.exists() and any(out.iterdir())):
        raise ValueError("prepared output must be a separate empty directory")
    accepted, inputs, stats = scan(data, tokenizer, max_tokens)
    out.mkdir(parents=True, exist_ok=True)
    for part in PARTS:
        (out / f"{part}.jsonl").write_text("\n".join(accepted[part]["lines"]) + "\n", encoding="utf-8")
        if accepted[part]["records"]:
            (out / f"{part}.records.jsonl").write_text("\n".join(accepted[part]["records"]) + "\n", encoding="utf-8")
    (out / "stats.json").write_bytes(json_bytes(stats))
    manifest = {"prepared_training": 1, "input": str(data.resolve()), "input_hashes": inputs,
                "tokenizer": identity, "max_tokens": max_tokens, "holdouts": holdout_provenance(),
                "stats": stats, "output_hashes": {file.name: digest(file.read_bytes()) for file in sorted(out.iterdir())}}
    (out / "manifest.json").write_bytes(json_bytes(manifest))
    return manifest


def validate(data: Path, tokenizer, identity: dict, max_tokens: int) -> dict:
    manifest = json.loads((data / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("prepared_training") != 1 or manifest.get("max_tokens") != max_tokens or manifest.get("tokenizer") != identity:
        raise ValueError("prepared candidate/tokenizer/limit does not match the effective training configuration")
    expected = manifest.get("output_hashes", {})
    names = {f"{part}.jsonl" for part in PARTS} | {"stats.json"}
    names.update(f"{part}.records.jsonl" for part in PARTS if (data / f"{part}.records.jsonl").is_file())
    if set(expected) != names or any(not (data / name).is_file() or digest((data / name).read_bytes()) != sha for name, sha in expected.items()):
        raise ValueError("prepared data/provenance hash mismatch")
    if json.loads((data / "stats.json").read_text(encoding="utf-8")) != manifest.get("stats"):
        raise ValueError("prepared statistics do not match the manifest")
    if manifest.get("holdouts") != holdout_provenance():
        raise ValueError("evaluation inputs changed; prepare and audit the candidate again")
    _, _, stats = scan(data, tokenizer, max_tokens)
    if any(stats[part]["rejected"] for part in PARTS):
        raise ValueError("prepared data contains overlength examples")
    return manifest


def load_config(config: Path, home: Path, contents: bytes | None = None) -> tuple[dict, Path, Path, int]:
    import yaml
    value = yaml.safe_load(config.read_bytes() if contents is None else contents)
    if not isinstance(value, dict) or not isinstance(value.get("data"), str) or not isinstance(value.get("model"), str):
        raise ValueError("configuration needs local model and data paths")
    if value.get("hf_dataset") or value.get("trust_remote_code") or value.get("report_to"):
        raise ValueError("remote data, code and reporting are outside the local prepared-data contract")
    limit = value.get("max_seq_length")
    check_limit(limit)
    return value, (home / value["data"]).resolve(), (home / value["model"]).resolve(), limit


def launch(config: Path, home: Path, run: str, extra: list[str]) -> None:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", run):
        raise ValueError("RUN must be a safe file-name component")
    # MLX's parser permits abbreviated options. An exact allowlist prevents
    # --mod/--max-seq/etc. from bypassing the config that was audited here.
    allowed = {"--iters", "--steps-per-report", "--steps-per-eval", "--val-batches",
               "--adapter-path", "--save-every", "--test-batches"}
    overrides, index = {}, 0
    while index < len(extra):
        flag, separator, value = extra[index].partition("=")
        if flag not in allowed:
            raise ValueError("configuration overrides must be validated in the config; only exact probe/report/output options are allowed")
        if not separator:
            index += 1
            value = extra[index] if index < len(extra) else ""
        if not value or value.startswith("--"):
            raise ValueError(f"missing training value for {flag}")
        if flag != "--adapter-path":
            number = int(value)
            if number < 1 and not (flag in ("--val-batches", "--test-batches") and number == -1):
                raise ValueError(f"invalid training value for {flag}")
        overrides[flag] = value
        index += 1
    config_bytes = config.read_bytes()
    cfg, data, model, limit = load_config(config, home, config_bytes)
    lock = (home / ".training.lock").open("a+")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.seek(0)
        raise ValueError(f"another training owns {home / '.training.lock'}: {lock.read(1000).strip()}")
    lock.seek(0)
    lock.truncate()
    lock.write(json.dumps({"pid": os.getpid(), "run": run, "config": str(config)}))
    lock.flush()
    tokenizer, identity = local_tokenizer(model)
    validate(data, tokenizer, identity, limit)
    adapter = overrides.get("--adapter-path", cfg.get("adapter_path", "adapters"))
    if not isinstance(adapter, str) or not adapter:
        raise ValueError("empty adapter output path")
    adapter_path = (home / adapter).resolve()
    resume = cfg.get("resume_adapter_file")
    if resume and not (home / resume).is_file():
        raise ValueError("resume adapter file is missing")
    if (resume and adapter_path == (home / resume).resolve().parent) or (adapter_path.exists() and any(adapter_path.iterdir())):
        raise ValueError("candidate adapter output must not overwrite the resumed or an existing adapter")
    logs = home / "logs"
    logs.mkdir(exist_ok=True)
    base = logs / f"train-{run}"
    if any(logs.glob(f"train-{run}.*")):
        raise ValueError(f"run artifacts already exist: {base}")
    snapshot = Path(f"{base}.config.yaml")
    snapshot.write_bytes(config_bytes)
    for name in ("stats", "manifest"):
        shutil.copyfile(data / f"{name}.json", f"{base}.{name}.json")
    Path(f"{base}.resolved.json").write_bytes(json_bytes({"ai_home": str(home), "model": str(model), "data": str(data),
                                                         "max_seq_length": limit, "adapter_path": str(adapter_path), "training_args": extra,
                                                         "resume_adapter": str((home / resume).resolve()) if resume else None,
                                                         "resume_sha256": digest((home / resume).read_bytes()) if resume else None}))
    print(f"run={run} pid={os.getpid()} config={config} log={base}.log", flush=True)
    fd = os.open(f"{base}.log", os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.dup2(fd, 1)
    os.dup2(fd, 2)
    os.close(fd)
    os.set_inheritable(lock.fileno(), True)
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.chdir(home)
    python = str(home / "venv" / "bin" / "python")
    os.execv(python, [python, "-m", "mlx_lm", "lora", "-c", str(snapshot), *extra])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path)
    parser.add_argument("--model", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--max-tokens", type=int, default=1024)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--ai-home", type=Path, default=Path(os.environ.get("AI_HOME", ".")))
    parser.add_argument("--launch-run")
    parser.add_argument("training_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.config:
        if args.data or args.model or args.out:
            parser.error("--config cannot be combined with preparation paths")
        config, home = args.config.expanduser().resolve(), args.ai_home.expanduser().resolve()
        extra = args.training_args[1:] if args.training_args[:1] == ["--"] else args.training_args
        if args.launch_run:
            launch(config, home, args.launch_run, extra)
            return 0
        if extra:
            parser.error("training arguments require --launch-run")
        _, data, model, limit = load_config(config, home)
        tokenizer, identity = local_tokenizer(model)
        report = validate(data, tokenizer, identity, limit)
    else:
        if not all((args.data, args.model, args.out)) or args.launch_run or args.training_args:
            parser.error("preparation needs --data, --model and --out")
        model = args.model.expanduser().resolve()
        tokenizer, identity = local_tokenizer(model)
        report = prepare(args.data.expanduser().resolve(), args.out.expanduser().resolve(), tokenizer, identity, args.max_tokens)
    print(json.dumps(report["stats"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(f"training-data: {exc}", file=sys.stderr)
        sys.exit(1)
