## 1. Evidence and design

- [x] 1.1 Preserve live 2026-09-19–2026-10-18 channel, Unassigned detail and event baseline in ignored task evidence; record 169/516 and UI source labels in #2659 with limitations.
- [x] 1.2 Inventory first-party UTM producers and analytics consumers; classify confirmed parameter collisions, queue order, UTM risks and unresolved `(not set)` rows separately.

## 2. Diagnostic reporting

- [x] 2.1 Implement completed-day and explicit-date CLI validation plus testable report seams, preserving totals/events (Reproducible completed-day reporting).
- [x] 2.2 Implement independent overall/Unassigned totals, separate source/medium aggregates and paginated detail with readable/JSON output (Independent channel and source diagnostics).
- [x] 2.3 Expose report metadata, no-data state and service errors without secrets; fixture-test non-additive counts, thresholds, empty results, pagination, dates and CLI output (Explicit data limitations and errors).

## 3. Attribution and provider delivery

- [x] 3.1 Namespace GA-only UI/identity parameters at all GA send paths and preserve original payloads for Metrika/internal consumers; add regression coverage (GA event attribution isolation).
- [x] 3.2 Ensure initial sanitized GA page_view precedes deferred custom events with per-provider exactly-once delivery; cover staggered readiness, consent, automation exclusion and native no-op (Initial page view before queued GA custom events).
- [x] 3.3 Centralize first-party medium vocabulary, update confirmed defective share producers and card payloads, and cover vocabulary enforcement plus existing URL/UTM/hash preservation (Governed first-party campaign medium vocabulary).
- [x] 3.4 Document baseline causes, known unknowns, corrected reporting dates, medium semantics and monthly <10% threshold in docs/GROWTH_PLAN.md.

## 4. Code review and validation

- [x] 4.1 Run focused Jest suites, scoped lint/static/guard checks and inspect the complete task diff; i18n and UI/device checks are N/A for the unchanged UI/native contracts.
- [x] 4.2 Complete independent review-auditor review-and-fix, repeat affected checks, and pass the mandatory code-review gate before runtime QA.
- [x] 4.3 Validate the change with `openspec validate diagnose-ga4-unassigned-attribution --type change --strict`.

## 5. Testing and temporal acceptance

- [ ] 5.1 Commit explicit reviewed task paths, push main with code-level preflight, record SHA and enter testing; deploy via frontend-deployer under the project operation gate, as authorized by the owner's «делай» and AGENTS.md pipeline.
- [x] 5.2 Run the live diagnostic command for the fixed baseline and record independent total/source/detail evidence with each cause and unknown explained.
- [ ] 5.3 On deployed desktop and mobile web, inspect collection payload/order and console for sanitized page_view before custom events, GA parameter isolation and preserved consent/automation boundaries; save ignored evidence.
- [ ] 5.4 Record actual deployment timestamp, property time zone and seven fully deployed-day dates plus 48-hour processing allowance; schedule the precise temporal recheck and retain testing rather than assert a future metric pass.
- [ ] 5.5 At the dated recheck run the fixed-window diagnostic report: positive independent session denominator, Unassigned <10%, report limitations assessed and residual sources explained; otherwise record the measured failure and continue investigation.

## 6. Finalization

- [ ] 6.1 After all acceptance evidence exists, run `openspec validate --all`, synchronize the living capability and archive the completed change through the project workflow.
