# Tasks

## 1. Evaluation isolation

- [x] 1.1 Extend shared exclusion to all current evaluation question sets and controlled synthetic fixture identifiers/names; verify normalized overlap, controlled-identity reuse, allowed real article/quest context, and unreadable/malformed inputs with focused unit checks.
- [x] 1.2 Document independent new scenarios and protected inputs in preparation provenance; verify no evaluation questions, paraphrases, reference scenarios or controlled synthetic venues enter the candidate without banning shared real corpus facts/URLs.

## 2. Grounded constraint training set

- [x] 2.1 Add 400–600 fictional training examples, initially 480 from 120 independent scenarios × four phrasing variants, covering joint date/time/weather/access constraints, near-miss distractors, no feasible option, unknowns and contextual follow-ups; verify target grounding and arithmetic/eligibility properties in focused tests.
- [x] 2.2 Preserve scenario-group isolation across train/valid/test and unchanged prompt formatting; verify deterministic group splitting, full fact retention and existing mix/RAG/prompt consumers.
- [x] 2.3 Add the isolated v5 final-stage mix/config with S1/S2 replay and bounded off-topic examples; verify it resumes v4, excludes regenerated weak RAG target templates, writes separate probe/full adapter paths and documents scope/non-guarantees.

## 3. Exact candidate preparation and entry guard

- [x] 3.1 Add deterministic full-conversation token-budget preparation using the actual local training encoding; test 1024/1025 boundaries, intact accepted messages, overlength rejection, missing tokenizer and unusable split failures.
- [x] 3.2 Record input/tokenizer identities, hashes, rejection reasons, final split counts and actual post-filter composition; verify reproducible output for the same inputs/seed and document the preparation command.
- [x] 3.3 Guard the training entry against unprepared/modified candidate data; verify hash mismatch and missing report rejection without loading a training model.
- [x] 3.4 Build the candidate locally, audit all complete examples and exclusions, and resolve final iterations/schedule from its accepted train count; retain the exact report/config as review evidence.

## 4. Code review and source validation

- [x] 4.1 Run the relevant training helper, set, mix and prompt tests plus scoped lint/static checks through project operation coordination; record actual pass results and preserve unrelated earlier evaluation edits.
- [x] 4.2 Complete independent review-and-fix of the whole task diff and the read-only code-review gate; verify that no blocking finding remains before runtime launch.
- [x] 4.3 Validate the OpenSpec change and verify final artifacts, resolved config and candidate hashes remain coherent with the reviewed code.

## 5. Testing: probe and authorized local launch

- [x] 5.1 Check active training/inference/build processes, relevant locks and local memory; free only authorized/owned competing resources and verify v4 artifacts are preserved.
- [x] 5.2 Run the isolated 12-step probe using the prepared data; retain finite training/validation losses, usable target tokens, memory/throughput evidence and absence of OOM/truncation warnings.
- [x] 5.3 If probe and review pass, launch the full local continuation under sleep prevention; record resolved config/provenance, live PID/log and first finite progress without overwriting v4 or claiming completion/improvement.

## Workflow follow-up

- After training finishes, export a separate candidate and compare it to v4 on the unchanged evaluation inputs, including semantic condition grading, shown/raw answers and old-skill regression slices. Do not promote based on launch, training loss or automatic lexical checks alone.
- Keep critical-access assertions grounded; absence of unsupported promises in one small evaluation is not proof of real-world accessibility or safety.
- Archive only when the tracked preparation/launch tasks and applicable final OpenSpec validation are complete. No commit, push, deployment or board mutation is part of this change.
