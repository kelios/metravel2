## Context

See proposal.md and #3382. Raw production evidence lives in ignored `.codex-temp/task3382/baseline/` (five runs per viewport) and `attribution/390-1.json`. The latter independently records child resize frames and JavaScript scrollTop setter calls: Nearby contracts by 217px; the map slot grows by 710px and shrinks by 198.6875px. The aggregate transition has no following sibling inside its runtime to anchor until those internal children have already reflowed.

## Goals / Non-Goals

**Goal:** put normal-flow height ownership at the changing child boundary, using the existing measured-transition registry and its single ancestor-height/scroll-anchor transaction.

**Non-goals:** change map internals, hide loaded sidebar content until a timer, increase guessed reserves, add another scroll-anchor algorithm, or change data loading.

## Decisions

- In `TravelDetailsDeferred.tsx`, place the mounted map slot inside `TravelDetailsDeferredTransition`, keeping its existing placeholder and load condition. Once loaded, the isolated runtime can grow without changing sibling flow until its pre-paint measurement captures the visible following frame. The slot's internal map/points/excursions behavior stays owned by its existing component.
- In `sections/TravelDetailsSidebarSection.tsx`, use the same transition around Nearby's content, with measurable empty runtime. Its existing loading/success/error/empty content stays visible; the transition can capture Popular or related navigation before changing its owned flow height.
- Retain the existing aggregate transitions: they own normal-flow heights of absolute ancestor runtimes and already join the leaf measurement transaction. Do not add a second correction algorithm. Existing no-op resize detection prevents repeated unchanged measurements.
- Reject per-screen minHeight or permanently retaining the loading rail: they depend on content/locale and leave empty space. Reject a continuously sampled reading-anchor observer: it duplicates existing ownership and adds work across all frames.
- Query keys, endpoints, invalidation, article content, analytics, SEO and app text remain unchanged. Native's transition renders children directly and its separate deferred composition stays unchanged.

## Risks / Trade-offs

- [Nested leaf and aggregate writes compensate twice] → independent DOM geometry tests cover signed child growth/shrink, browser anchoring, partial bottom clamp and unchanged observer frames; final live probe measures the original cadence.
- [Empty/error content gets clipped or strands a reserve] → allow measurable empty runtime, retain existing unsupported-observer fallback, verify no trailing reserve and accessible compact empty/retry states.
- [Locale text changes heights] → geometry uses actual runtime measurement; test the longest-label locale after review.
- [Internal map-section CLS remains] → leave feature internals unchanged; full-page regression still enforces the total 0.1 outcome, so any remaining violation returns to implementation with exact sources.

## Migration Plan

No data migration. Source handoff includes focused Jest, full lint and the complete task diff for independent review. Root owns the reviewed release and production acceptance. After publication, rerun the identical ten full-scroll probes, mobile Lighthouse ×5 (median ≥60), bilateral slider/performance guards and mobile-first/desktop/long-label geometry checks. Rollback reverts only the task's composition/test/docs paths.
