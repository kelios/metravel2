## 1. Source adapters and reporting contracts

- [x] 1.1 Preserve GSC/GA4 CLI behavior while exposing the minimal request adapters and main guard needed for import-safe reuse.
- [x] 1.2 Implement completed calendar-month windows and source-specific monthly collectors for the required Google metrics/events, optional Yandex and paginated production content, retaining identity, coverage and safe gap reasons.

## 2. Community aggregation and Markdown command

- [x] 2.1 Implement snapshot counts and all-history community approximation with pre-window author history, undated-history exclusion, catalogue-wide publication-date selection and explicit trip-date proxy coverage without mixed date meanings.
- [x] 2.2 Implement qualified YoY arithmetic, missing-data display and readable dated Markdown output under ignored `.codex-temp/metrics-summary/`.
- [x] 2.3 Register `stats:summary`, document source/window/gap semantics in `docs/GROWTH_PLAN.md`, and preserve current individual statistics commands.

## 3. Code-level validation and review

- [x] 3.1 Add focused `.test.ts` tests for calendar/leap boundaries, available/zero/missing YoY, pre-window authors, undated articles, proxy dates, empty/partial source responses, pagination safety and Markdown gaps.
- [x] 3.2 Run relevant Jest, task-scoped lint, Node syntax/import checks, planning strict validation and applicable guards; fix confirmed failures.
- [x] 3.3 Complete independent review-auditor review-and-fix followed by code-review-gate; repeat affected code checks after findings.

## 4. Testing and completion

- [x] 4.1 After review/handoff, execute the command against readonly production sources, verify absolute windows and current content snapshot, and inspect generated Markdown with explicit source gaps.
- [x] 4.2 Record actual evidence and residual data limits against #2660. Browser/device/i18n probes are inapplicable because there is no app UI/platform change.
- [x] 4.3 Run `openspec validate --all` before archive and reconcile completed tasks with the accepted implementation.

## Accepted evidence — 2026-10-20

- Implementation: b5506a77f on origin/main. Independent review-and-fix and final code-review-gate: pass.
- Full scripts Jest after fixes: 302 suites / 4898 tests passed. Focused summary + GA4: 2 suites / 93 tests passed. Scoped lint, syntax, project prompt audit and task strict OpenSpec validation passed.
- Real stats:summary run: exit 0; report .codex-temp/metrics-summary/2026-10-20.md, window 2025-10-01 through 2026-09-30; twelve months and YoY pairs verified, no credential matches.
- GSC and GA4 collected; current snapshot: 429 articles, 15 authors, 280 Russian-language quests, 39 completions. Separate production API count probes matched both catalogues. Production now exposes published_at; it was selected without trip-date mixing.
- Explicit gaps: optional Yandex token unconfigured, limited GSC comparison history, missing GA4 event observations, current-public-catalogue historical approximation.
- openspec validate --all executed: 56 passed / 1 unrelated failed change, persist-planned-trip-original-route-file (no delta specs or skip_specs). No task-owned validation failure; the unrelated change was preserved.
