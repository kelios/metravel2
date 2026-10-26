# Proposal

## Why

The frozen v4 complex evaluation completed only 7/16 requests and 34/48 conditions. It includes a concrete contradiction: a 45-minute visit is declared possible in 20 minutes. Existing assistant training favours lists, the holdout exclusion covers only the original question file, and v4 logs show examples truncated from 1100/1138 to 1024 tokens.

Goal: prepare and validate an isolated v5 candidate that learns joint constraints and specific uncertainty without training on the evaluation, then launch the owner-authorized local continuation. Improvement is established only by later comparison, not by starting training.

## What Changes

- Protect all current evaluation question sets and controlled synthetic `eval-fixture-*` identities, including their names, from training overlap; keep evaluation questions, paraphrases and reference answers out of new examples. Real article/quest facts and URLs remain eligible replay context, rather than being excluded merely because an evaluation also uses them.
- Add 400–600 fictional training examples covering date/time budgets, weather, wheelchair/gurney geometry, low vision, missing information and contextual follow-ups. The initial target is 480 examples: 120 independently constructed scenarios with four phrasing variants each. Keep variants in one split and retain nearby distractors which fail one condition.
- Prepare deterministic training splits using the actual model tokenizer and full chat template, including the answer, with a 1024-token ceiling. Reject overlength examples rather than truncate their facts or targets; record input hashes, removals and final counts.
- Continue the v4 adapter into a separate v5 directory with S1/S2 replay and bounded off-topic examples. Preserve old RAG knowledge through the resumed adapter; do not regenerate the weak list/easy-means-child-suitable target templates into the final stage. Require source checks, independent review, a finite-loss short probe and coordinated local resource readiness before the full run.
- Preserve v4, its reports and the unchanged evaluation for later v4/v5 comparison.

## Capabilities

### New Capabilities

- `llm-training-data-quality`: isolated, bounded and auditable training data for assistant constraint solving, with guarded local candidate launch.

### Modified Capabilities

None. No existing OpenSpec capability owns model-training preparation.

## Impact

- **User-visible result:** a separately trained candidate and traceable local run; no live assistant change or quality guarantee before comparison.
- **Platform impact:** none; this is local training tooling. Desktop/mobile web, Android and iOS app code remain unchanged.
- **Localization impact:** selected locales: new editorial training scenarios are RU initially; replay retains existing multilingual examples. No app localization resources change.
- **Paths:** `scripts/ai-train/`, focused `__tests__/scripts/ai-train-*`, training documentation and this change.
- **Data/API:** training examples, provenance and preparation report gain validation; no backend/API contract changes.
- **Accessibility:** supervised examples distinguish explicitly supported access from unknown access; fictional venue facts are never presented as facts about real destinations.
- **Performance:** local Mac memory/time only. Retain batch 1 and 1024-token sequences; no app bundle or Core Web Vitals changes.
- **Security:** local files and existing models only; no secrets, cloud training, network downloads or external writes.
- **SEO and analytics:** none; routes, published content, metadata and product events do not change.
- **Dependencies:** existing v4 adapter, local tokenizer/model, training environment, saved corpus and available Mac memory. No backend dependency or new paid resource.
- **Fallback/mock policy:** synthetic training data is explicitly fictional, not a fallback for absent real accessibility information. Missing tokenizer, model, failed validation or competing training stops launch; no approximate-token or silent-truncation fallback.
- **Preserve:** old dataset schemas, generation prompt snapshot, v4 artifacts, evaluation inputs, app retrieval/generation behaviour and prior skill coverage.
- **Non-goals:** production deployment, backend edits, live weather integration, real accessibility certification, app changes, promotion over v4, and claiming a target quality score before evaluation.
- **Open questions:** no scope-blocking owner decision. Final iteration count follows the prepared data count; actual training duration and memory are measured by the probe.

The user's instruction authorizes preparation, checks and local training in this flow. It does not authorize a production or store release.
