# Design

## Context

See proposal.md for the observed v4 failures and scope. Existing `sets.common` owns records and deterministic split keys; `sets.assistant_prompt` owns the prompt snapshot, card formatting and current single-file question exclusion. `build_mix.py` composes sets and curriculum/replay. `train.sh` snapshots config and launches local MLX. Reuse these boundaries rather than create another trainer or prompt source.

## Goals / Non-Goals

**Goals:** teach grounded joint-constraint choices through independent examples; protect the frozen evaluation; validate the exact final trainable representation; launch a separate candidate safely after review/probe.

**Non-goals:** changing app retrieval/prompt/guards, real accessibility data, live weather, a larger context on this 24-GB Mac, cloud operations, candidate promotion or a promised improvement score.

## Decisions

1. **One holdout registry and reusable exclusion.** Cover questions from `cases.jsonl`, `cases.quality.jsonl` and `cases.complex.jsonl`; fixture-identity exclusion applies only to controlled synthetic `eval-fixture-*` identifiers and venue names. Real corpus facts and article/quest URLs are legitimate replay context, including facts the v4 adapter already knows. Normalize superficial question changes and reject controlled-identity reuse; new scenarios use a separate namespace, dates, numbers and grouped keys. Do not claim a lexical matcher proves arbitrary semantic paraphrase absence: construction and review protect held-out questions, paraphrases and references. A generic skill remains trainable on disjoint scenarios. Alternatives rejected: copy failures, match only old literal questions, or broadly ban real corpus context.

2. **Add a focused `constraints` set.** Its semantic cases include one valid choice among near misses, no feasible option, specific unavailable metadata and short contextual dialogue. Targets are constructed from the same explicit facts/solver used for labels; property checks cover duration arithmetic, date/day eligibility, doorway width, continuity of step-free paths, gurney-specific unknowns, low-vision adaptations and companion requirements. Fictional objects remain labelled and use separate identifiers. Produce 400–600 training examples, initially 480 = 120 independently constructed scenarios × four phrasing variants; group every scenario's variants together in one split. This is a bounded diagnostic candidate, not an optimal-size claim. Resume existing RAG knowledge from v4 rather than regenerating its weak list/easy-means-child-suitable target templates in this stage.

3. **Exact preparation after composition.** Use the actual local model tokenizer and the training library's conversation encoding. Check complete messages including the target; reject entire overlength examples and keep an auditable deterministic prepared copy, including filtered old replay. Preserve the facts and distractors in new constraints instead of trimming snippets until a label becomes ungrounded. The preparation report includes per-split original/accepted/rejected counts, hashes and tokenizer identity. The training entry verifies this report and data hashes. Alternative rejected: increase sequence length (earlier OOM), retain character-only heuristics or allow silent library truncation.

4. **Isolated final curriculum stage.** Reuse the v4 base and resume adapter, six LoRA layers/rank 16, batch 1, sequence 1024 and an initial learning rate around `2e-5`. New constraints form the final stage with 0.4 replay from S1/S2 plus a bounded off-topic contribution; old RAG knowledge remains in the resumed adapter and its weak target templates are not regenerated. Derive the iteration count and schedule length from the actual prepared train count before review. Replay proportion after filtering must be visible in the report rather than assumed. Alternative rejected: train only failures without replay, given the documented S1 regressions after v4.

5. **One local launch path.** Existing `train.sh` remains the entry. Check active model/train/build processes and relevant locks; free only authorized/owned inference/dev-server resources necessary for training. Snapshot resolved config/provenance; use separate `v5-probe` and `metravel-llm-v5` adapter paths and preserve v4. A 12-step probe must demonstrate finite training and validation loss, usable supervision, no truncation warnings and no OOM before full background launch. Keep sleep prevention and record PID/log. A running process proves launch, not completed training or improvement.

## Ownership and compatibility

- Edit only `scripts/ai-train/` helpers, new set/config, focused `__tests__/scripts/ai-train-*`, training docs and this change.
- Preserve the existing record/messages contract for old callers; new preparation metadata belongs to candidate reports/manifests, not app/API payloads.
- Python/tokenizer/model failure is a hard local preparation error, never a mock success. No backend work is required or permitted.
- Existing dirty evaluation files and saved v4 reports belong to the earlier evaluation work and remain intact.
- App auth/platform split, SEO, UI accessibility semantics, analytics and bundle performance are not applicable: no product code, URLs, UI or event changes. Accessibility training assertions are grounded solely in explicitly fictional or provided facts.

## Validation matrix

| Surface | Evidence |
| --- | --- |
| Dataset helpers and exclusion | Focused Python-backed unit checks: all holdout questions, missing/malformed registry inputs, normalization, controlled fixture identifiers/names, allowed real corpus context, split-key isolation and deterministic results |
| Constraint targets | Positive/near-miss/no-match/unknown/dialogue property checks; targets supported by untruncated supplied facts and no heldout identities |
| Preparation and launcher | Exact tokenizer full-template boundary at 1024/1025, unchanged accepted messages, empty split rejection, missing tokenizer, changed-data hash rejection and provenance/rejection counts |
| Existing consumers | Existing mix/RAG/off-topic/prompt-snapshot tests; no recursive browser/device checks for unchanged app code |
| Local runtime after review | Prepared dataset audit, 12-step probe with finite losses and memory/throughput evidence, then full run live PID/log and first finite progress |
| Later quality comparison | Same frozen v4/v5 questions and cards, semantic grading in priority order, raw and shown answers, prior-skill regression slices; never train on these inputs |

RU is the new example locale; existing multilingual replay is preserved and covered by existing set consumers. No app i18n/runtime/device gate applies.

## Risks / Trade-offs

- **Filtering shifts replay balance** → report actual counts and composition; choose the final mix after examining accepted data, not the nominal ratio alone.
- **Tokenizer/chat-template mismatch** → use the actual training encoding and regression-test it; no approximate fallback.
- **Synthetic patterns overfit** → independent scenario keys and heldout data, varied constraints/order, and no claim that synthetic success certifies a real location.
- **Earlier skills regress** → retain replay and compare the existing regression slices before candidate promotion.
- **Training occupies the machine** → coordinate processes, run the bounded probe, retain logs and stop on nonfinite loss or memory failure.

## Migration and recovery

Preparation writes a new candidate directory and report. Existing v4 data, adapter and GGUF are unchanged. A failed preparation/probe leaves v4 available; remove or retain only the new candidate artifacts as evidence. If full training fails, preserve config/log/checkpoints and diagnose before a new run. Export, candidate evaluation and any promotion occur only after successful training; this task's launch does not assert those outcomes.
