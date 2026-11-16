## Context

See proposal.md. Existing route_point_added is emitted for unsaved local edits; trip_created already runs on mutation success. Source links are shared by article and assistant.

## Goals / Non-Goals

Attribute entry, form, successful creation and first persisted point with one entry cohort. Do not change planner UI, backend or navigation ordering.

## Decisions

Use a bounded, expiring per-tab journey matched by a local deterministic fingerprint of the canonical form path and sorted query. Canonicalization always includes the effective finite source, so an undeclared source and its planner_source-decorated equivalent match. Only finite planner_source enters the URL and nested login redirect; the random internal journey id and fingerprint never leave local memory/consented session storage. Never persist raw titles, coordinates or form query values. Form/login/reload selects the latest unexpired matching target; an explicit ready click starts a new journey. Only consented analytics may persist session context; otherwise memory fallback keeps navigation operational. Store finite source/auth/outcomes, stage flags and numeric trip id. auth_state is the first restored entry cohort, including after login. A navigation action during auth restoration carries source immediately but defers event/classification until the form's auth is ready. Existing event_category/event_label dimensions provide reports without new custom dimensions.

Use existing sendAnalyticsEvent for consent and automation handling. Reuse trip_created and route_point_added; label draft edits outcome=draft and emit outcome=first_saved only after a confirmed nonempty API route. Failed responses and empty routes cannot count as saved. Central mutation hooks cover both initial imported route and subsequent route saves.

Alternative: unrelated click events lose guest attribution and do not distinguish draft/persistence. A separate analytics backend or data migration is unnecessary.

## Risks / Trade-offs

- Session storage denial → in-memory fallback; reload attribution can be incomplete and must be reported.
- Consent changes and date-window edges → report stage ratios, not closed-cohort abandonment.
- Retries/reloads → stage deduplication via the latest matching local target. Same-target forms in one tab share the latest journey; denied/unavailable storage cannot preserve context through a page reload. Error attempts remain separate counts.
- Bundle budget → journey runtime loads on visible CTA/click from article and assistant, before attributed navigation; loading failure preserves the functional planner destination. Shared trip analytics does not import the journey runtime. No heavy draft imports at article entry.

## Migration Plan

Focused unit/static checks, independent review, canonical main commit/push, normal deploy and one representative mobile web flow with a private test trip and cleanup. Verify live SHA and report metadata; absence of real visitor rows remains explicit. Rollback by reverting task commit.
