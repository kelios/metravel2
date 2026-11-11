---
name: metravel-llm-training
description: "Наборы данных, локальное MLX-обучение адаптеров metravel-llm и экспорт GGUF-кандидатов: диагностика слоя причины до обучения, смеси, replay, утечки оценки, память обучения. Триггеры: «продолжай обучать модель», «новый круг/версия модели», «собери набор», «почему модель ошибается»."
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

## Diagnose before any training (mandatory)

A training round costs hours of the only GPU. v5, v5-rag and v6 (#2751) were
trained around causes that were not in the weights and all ended no-go. Before
preparing data, run these six checks and write each result with numbers:

1. **Repeat the failing request at least three times on the same prompt.** A
   refusal that appears 2 of 3 times is probabilistic and belongs to the
   pipeline, a 3 of 3 failure is systematic. «Какую кашу взять с собой в поход?»:
   v4 refused 3/3, v6 2/3 — fixed by the second gate in the app (#3216), not by
   weights.
2. **Compare every auto-check hit with the raw answer before blaming the
   model.** `detectLoop` produced 22 false hits out of 34: one fact shared by
   three different quests was read as a loop. A wrong check is fixed in the
   evaluator and old reports are recomputed (`--report`).
3. **Compare the live prompt with the training prompt in numbers**: cards per
   prompt, prompt tokens, snippet length. The screen sent 8 cards (median 1088
   prompt tokens); training saw 1–5 cards under `max_seq_length` 1024 (#3268).
   A shape the model never saw is a pipeline or data-shape cause.
4. **Check that the feature the answer depends on is visible in the prompt.**
   Edition 6 picked three quests in export order while the cards were shuffled:
   48 of 67 answers did not follow card order, so «which three» was unlearnable.
5. **Check that budget fitting keeps the point of the sample.** `fit_sources`
   dropped the cards the answer did not name, so no sample showed more matching
   cards than recommendations; the model listed everything it saw.
6. **Name the new mechanism.** A new round starts only when the data or recipe
   contains something the previous round did not have and the checks above
   attribute the failure to it. «More steps» or «another seed» is not one.

Report the diagnosis as its own artifact: failing ids, repetitions, raw
answers, the layer and the evidence for it. The coordinator or an independent
reviewer confirms it **before** preparation starts; preparation and launch are
a separate stage of the same task.

## Prepare and review

- Freeze source/cache, base model/tokenizer, starting adapter, code, config and
  evaluation file hashes (`scripts/ai-assistant-eval/eval-inventory.json`).
  Preserve previous candidates and reports. A version label alone does not
  identify a model or dataset.
- A resumed adapter carries its training data with it. Check the lineage, not
  only the current mix: the v4 adapter that v6 and v7 continue was trained on
  22 questions of `cases.jsonl` (two acceptance targets and 17 of 27 off-topic
  questions). `prepare_training_data.py` reports lineage violations; list the
  affected ids in the handoff so acceptance does not count them as held out.
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

Give `llm-judge` the `metravel-llm-evaluation` scope with frozen inputs,
baseline/candidate identities, acceptance thresholds and independent raw
artifacts, without a desired verdict. Acceptance is one command —
`npm run ai:assistant:accept` (see that skill), not a hand-built table. Report data/split/replay counts,
code-level results, training completion/loss/resource failures, artifact paths
and hashes, remaining gates and rollback. A launched process or lower loss is
not improvement. Failed acceptance means **no-go**; keep the incumbent model.
Do not change a product default or deploy from this skill.

Reusable assignment (fill concrete values; no historical permission):

```text
Use metravel-llm-training for <task and corrective layer>.
Stage: <diagnosis | prepare | probe/train | export>; diagnosis confirmed by <who, where>.
Owned paths: <generator/config/new artifact paths>; preserve <existing work>.
Inputs: <AI_HOME, base/resume hashes, caches, mix/config, unique RUN>.
Platform/localization impact: <values>. Acceptance: <slices and thresholds>.
Frozen evaluation inventory: <paths/hashes>; exclude from all training data.
Resource owner: <owner>; lineage of the resumed adapter: <data path, known contaminated ids>.
Output: manifests, exact commands, PID/checkpoint or completion, hashes,
code-review evidence and bounded evaluation handoff; no model promotion.
```
