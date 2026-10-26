---
name: metravel-llm-training
description: "Prepare datasets, train local metravel-llm adapters, and export GGUF candidates. Use for AI training mixtures, replay, MLX memory failures, dataset leakage, or continuing a model version."
---

# Metravel LLM Training

`AGENTS.md` is inherited. Own `scripts/ai-train/` and the assigned local model
artifacts; app prompts, retrieval, backend and model promotion are separate
scopes. Load `scripts/ai-train/README.md` for the requested operation and
`docs/AI_TRAIN_DATASETS.md` sections 2–5 for dataset/stage decisions. Before a
long operation, load `docs/WORKFLOW_OPERATIONS.md` → `3.4 Координация долгих
операций`; paid resources also require section 3.4.1.

## Inputs and decision

Require the task's measurable acceptance, model/adapter identities, `AI_HOME`,
mixture/config paths, a new `RUN`, source caches and the evaluation inventory.
Record platform and localization impact: model-only work usually changes no
app implementation but its examples and acceptance cover the named locales.
Read existing manifests/checkpoints before repeating expensive work.

Trace failures to data, prompt, retrieval, guard, evaluator or model using raw
evidence. Do not train around a retrieval/evaluator bug. State the chosen
corrective layer, alternative, risk and rollback before editing. Reuse existing
generators and `sets/common.py` record/split contracts; avoid a second trainer.

## Prepare and review

- Freeze source/cache, base model/tokenizer, starting adapter, code, config and
  evaluation file hashes. Preserve previous candidates and reports. A version
  label alone does not identify a model or dataset.
- Keep evaluation questions, their paraphrases, fixtures and expected answers
  out of training. Inventory **all** evaluation families, including
  `cases*.jsonl` and `eval_prompts/`, before generation. Use independently
  constructed scenarios/entities/numbers for the same skills; lexical leakage
  checks alone do not prove independence. Record any known contaminated slice
  and do not report it as held-out evidence.
- Split by the existing entity/scenario key before paraphrases and replay;
  preserve split seed and cross-set entity ownership. Replay only earlier
  **train** records. Inspect actual per-set/per-locale counts, not just weights.
- Build with `build_mix.py`. For the prepared-data path, use
  `prepare_training_data.py` per README: count the complete chat template and
  supervised answer, exclude oversize records whole, retain provenance and
  verify hashes. Never truncate away constraints or answer supervision.
- Run focused dataset/safety/schema tests for the changed generators. Hand the
  complete diff, manifests and commands to independent code review; preparation
  and source checks do not establish runtime model quality. Training/inference
  follows the reviewed `testing` handoff, not the code-review pass itself.

## Local execution

Use the installed local venv, models and cached sources. New downloads or paid
services are not implied by a training request. Check GPU consumers, disk/RAM,
active training/export/evaluation and operation locks. Do not stop another
session's server or trainer; coordinate exact resource ownership.

Use `train.sh` with explicit `AI_HOME`, `CONFIG` and unique `RUN`. Check resolved
adapter/resume/data paths as well as the log name: changing `RUN` alone does
not change a config's output path. Keep old v4/v5 artifacts intact. A short
probe uses its own adapter path; continue to the full run only with finite
training/validation loss, usable supervision and no OOM/truncation warnings.
Use the existing README recipe for sleep prevention and logging. Persist
PID, command, manifest hashes, log and next step in an ignored checkpoint.

Do not run GPU inference/export beside training. On NaN/OOM or a changed
manifest stop and diagnose; do not retry blindly or weaken a check. When export
is included in the assigned scope, after a successful final checkpoint use
`export_gguf.sh` for that exact
`RUN`, verify complete GGUF and SHA256, and retain the adapter/config identity.
Existing or partial output is not evidence of successful export.

## Handoff

Give `llm-judge` the `$metravel-llm-evaluation` scope with frozen inputs,
baseline/candidate identities, acceptance thresholds and independent raw
artifacts, without a desired verdict. Report data/split/replay counts,
code-level results, training completion/loss/resource failures, artifact paths
and hashes, remaining gates and rollback. A launched process or lower loss is
not improvement. Failed acceptance means **no-go**; keep the incumbent model.
Do not change a product default or deploy from this skill.

Reusable assignment (fill concrete values; no historical permission):

```text
Use $metravel-llm-training for <task and corrective layer>.
Owned paths: <generator/config/new artifact paths>; preserve <existing work>.
Inputs: <AI_HOME, base/resume hashes, caches, mix/config, unique RUN>.
Platform/localization impact: <values>. Acceptance: <slices and thresholds>.
Frozen evaluation inventory: <paths/hashes>; exclude from all training data.
Authorized stage: <prepare | probe/train | export>; resource owner: <owner>.
Output: manifests, exact commands, PID/checkpoint or completion, hashes,
code-review evidence and bounded evaluation handoff; no model promotion.
```
