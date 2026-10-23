## Context

See proposal.md — Why. Historical production run13/run14 prove first popstate reaches the own list then a programmatic go(-1) exits the document. They omit callback stack and full query/hash. Source comparison proves the pinned web memory-history fork lacks closure-index synchronization on external popstate and timeout settlement, unlike its sibling, but does not prove who triggers the extra go. A cursor-only fix can hide the defect at index0 while still failing at nonzero index.

## Goals / Non-Goals

**Goals:** establish the real invoking callback before functional changes; preserve one browser action per entry, actual document identity and memory/browser consistency across subsequent actions.

**Non-Goals:** blanket debounce/cancel of browser traversal, returnTo rewrite, feedback UI changes, native router changes, backend/auth changes or unrelated dependency upgrade.

## Decisions

1. First implement a permanent diagnostic/regression layer only. Observe the actual own-list Edit control, native browser Back/Forward, safe full path/state and stack/source frames at history.go. Do not replace actions, intercept documents, synthesize history, suppress errors or change application navigation. Ship this reviewed test-only layer before a bounded testing baseline on the exact live SHA.
2. Use shared tracked assertions with a permanent local live-contract test plus an explicit tracked production-probe orchestrator. Explicit disposable fixture setup/cleanup is separate from read-only navigation observation. Do not poison ordinary production-smoke with manifest-dependent specs or import ignored historical helpers. Reuse existing real-cookie/auth mechanisms and narrow owned-data cleanup.
3. Attribute the callback to exact pinned source, branch and state/path/pending/cursor values. Preserve query/hash only through a safe allowlist, no tokens/cookies/auth snapshots. Existing pathname-only evidence cannot prove path mismatch. If current public-history patch changes reproduction, report the exact current result rather than inventing historical attribution.
4. After causal evidence, correct the common owner. Candidate: port the sibling's two cursor synchronization moments into the existing reproducible Expo patch, preserving pending promise/timeout behavior and #2703 hunks. If the trace establishes separate useLinking replay, correct that demonstrated owner too. The functional correction requires recorded attribution and an updated design decision before apply.
5. Exercise actual pinned implementation, not a copied model: external Back/Forward followed by push, replace, backIndex and go; pending/timeout/interrupt, direct/unknown-ID and native boundary. Include a meaningful nonzero-cursor editor browser case so a boundary clamp cannot masquerade as single-Back success.

Alternatives rejected: app-level extra handler, second-go suppression, arbitrary timeout or fallback redirect conceal the causal owner and break legitimate navigation. Getter-only go clamp leaves stale push/replace/backIndex. Changing pending-path clearing without snapshots is speculative.

## Risks / Trade-offs

- Baseline defect aborts cleanup/navigation → orchestrator cleanup in finally, write ledger separate from navigationwrites0, owned marker/id checks and API/SQL/media readback.
- Instrumentation alters timing or semantics → synchronous transparent wrappers with original this/args/return/errors, no awaits before original calls; inspect output against CDP native history and unchanged document identity.
- Runtime callback remains unknown → no functional patch from the index hypothesis; preserve raw failure and strengthen only the missing observation before next bounded baseline.
- Vendor patch damages public history/native → preserve #2703 hunks, clean patch reverse/apply and actual public/native controls; no native module changes.

## Migration Plan

PhaseA task paths: `e2e` shared assertions/live-contract, explicit `e2e/prod-probe` fixture/operator helpers and focused source-only helper tests, OpenSpec/Problem Memory. Existing quality target guards and ordinary production-smoke remain intact. Independent review-auditor/code-review-gate, explicit test-only commit/push, testing baseline on verified application SHA. No redundant application rollout if bundle inputs are unchanged.

PhaseB after attribution: append minimal confirmed hunks to `patches/expo-router+57.0.28.patch`, focused pinned implementation tests and cause documentation. Repeat review/push/testing, canonical rollout and exactSHA. Production1440×900/390×844 cold/warm actual Edit step1/noSheet and step6/longReason, native Back/Forward, appBack/direct/returnTo and deeper history; one popstate/no extra programmatic traversal, same timeOrigin/document, private residue0, article navigationwrites0 and owned fixture cleanup. Native source boundary only; no new copy in any locale. Rollback task-owned patch/commit through canonical rollout, retaining server contracts and #2703.
