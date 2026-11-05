## Context

See proposal.md. Saved Google PSI and a production CDP trace agree on long React tasks; the latter is attribution evidence only because concurrent native builds invalidate local numeric comparisons. The article's StableContent enrichment is absent from the no-scroll PSI requests. The hero is requested once and costs 24.7 KB.

## Goals / Non-Goals

**Goals:** break the initial travel hydration into existing independently hydratable regions and remove repeated geometry transactions that cannot change flow. Preserve full server HTML, hero dimensions and reader position.

**Non-Goals:** changing article content, media identity, responsive design, APIs, locale resources, native branches or numeric guards. Do not use visibility/interaction gates or delay initial hydration with timers.

## Decisions

1. Add completed Suspense boundaries around the existing web hero and article, with memoized child elements. React can hydrate each independently; unrelated container updates keep the same child element. Keep synchronous server rendering and native composition. A new lazy mount or content-visibility gate would delay content and violate the first-screen contract, so those alternatives are rejected. Expected contribution: partition the largest 340/222 ms PSI tasks; actual benefit requires an identical deployed probe.
2. In the existing deferred geometry owner, return before ancestor/anchor traversal when valid measured height and written flow height are unchanged and no reserved slack needs reconciliation. Preserve width tracking, stale-generation fencing and all real growth transactions. Reject removing scroll correction or caching owners across DOM changes: either can break nested sections and reader position. Expected contribution: remove repeated 14–36 ms scans visible in the attribution trace, without claiming this alone reaches 90.
3. Keep the original acceptance source: live mobile PageSpeed >=90. Unit tests, reduced scans and build success are supporting evidence. If a candidate fails, inspect its retained trace before another change/build; do not expand into unrelated routes.
4. The first production candidate did not pass (Google mobile 73/62; the comparable-CPU repeat had TBT 587 ms). Keep navigation registry and queue semantics intact: response-only scheduling/context probes did not establish a large dependable benefit. The next bounded candidate marks noncritical web readiness and measured-size updates as transitions, preserving urgent LCP/false/reset paths and native scheduling. These updates were attributed to DefaultLane32 in the retained trace; transitions let React yield without adding a delay gate.
5. Travel SSR uses the same complete inline critical stylesheet already used by Home. The saved Google report identifies its separate blocking request at 451 ms; placing the stylesheet in the existing HTML response removes that dependency. Adjacent routes retain the shared immutable file. No CSS rules, media identities or rendering gates change.
6. Slider readiness belongs to a unique travel visit. An already queued transition can survive a render-phase boolean reset; capture the visit token when preloading and expose readiness only when it matches the current visit, including A→B→A navigation. Genuine React DOM tests cover queued/suspended transitions across travel swaps and loading resets.

## Risks / Trade-offs

- Pending boundaries receiving urgent updates can lose selective hydration → preserve child identity and trace actual update ownership before changing scheduling.
- Same-height updates with reserved slack or responsive width changes can still need bookkeeping → retain the existing path for slack and preserve width semantics; run all genuine-DOM anchoring regressions.
- First-screen/slider regression → mobile drag, vertical scroll and desktop screenshots/console plus both bilateral gates in testing.
- Local host load corrupts numeric comparisons → use Google's live service and applied Lighthouse only on a quiet host; retain baseline and identical run parameters.

## Migration Plan

Focused source/unit checks, independent review-and-fix and code-review-gate, explicit-path commit/push on main, testing, standard frontend-deployer publication, live acceptance. Roll back the task commit through the standard release path if hydration or reader position regresses. No API/data migration or backend mutation.
