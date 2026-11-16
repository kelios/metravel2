## Context

See proposal.md. The controller owns settled list state and actual outgoing callbacks. NavigationLink forwards its ref to the existing real anchor. Desktop header and mobile menu have distinct visibility lifetimes. Existing useTrackedImpression and analytics transport already enforce visibility and provider-consent policies.

## Goals / Non-Goals

Goals: finite source on href and events; one event per genuine action; settled search outcomes; repeatable aggregate queries.
Non-Goals: a new analytics provider, persistent journey IDs, global URL attribution, layout changes or modification of map callbacks outside the catalog.

## Decisions

- Reuse useTrackedImpression on the actual navigation anchor and existing analytics transport. A global menu-render impression was rejected because closed/scrolled links are not visible. Hook callbacks are gated to web and valid catalog hrefs.
- Carry only places_source=desktop_navigation|mobile_menu in the real href. Direct/unknown values normalize to direct in the catalog. A stored opaque journey identifier was rejected: it is unnecessary for session aggregates and could leak through page URLs. Copying a marked link can preserve its source; it is source attribution, not proof of a closed cohort.
- Use separate action event names and finite action parameters. Existing GA4 event_label stores source and outcome stores search outcome; reporting does not require retroactive registration of a new custom action dimension. first_action is a local-opening diagnostic flag, not a session identity.
- Pass the screen's existing focus state to the analytics hook: web tabs remain mounted, so blur suppresses events and refocus starts a new opening.
- Keep local search/filter keys only in hook memory. Deduplicate settled results, ignore placeholder/fetching and pagination, permit error-to-success recovery once. No key or query text is emitted or persisted.
- Validation: focused real-controller/query tests plus navigation/impression tests, scoped ESLint, TypeScript and strict OpenSpec; independent source review and formal gate. In testing, mobile-menu visibility/click and catalog search/actions on published SHA; desktop navigation visibility is a distinct boundary and gets a narrow check. No Android/iOS runtime: web-only emitters and unchanged native behavior, covered at the platform boundary in Jest. No locale matrix: no new text/formatting; a localized href is covered in source tests.

## Risks / Trade-offs

- Consent/automation and source-window boundaries → distinguish local intent from delivery and event ratios from session cohorts.
- Navigation attribution via copied links → finite source only, documented as observational attribution.
- Query placeholder/refetch → gate on matching committed query and terminal state; regression tests cover stale data, pagination and retries.
- Bundle entry/chunk budgets → reuse existing modules and no new dynamic import root; canonical deployment retains unchanged budgets.

## Release budget repair

The first canonical deployment stopped before publication on home/article Brotli
budgets. Earlier incorporated revisions also failed these caps before publication;
the last published revision passed. Retained failing artifacts are diagnostic only
(`reference_eligible=false`), not new byte pins.
Source inspection found `questWizardHelpers → questWizardMedia → QuestFullMapLazy
→ useProgressiveLoad`: a clipboard helper unnecessarily traversed map media after
the visibility wrapper was introduced. Load the existing `expo-clipboard` target
directly from its sole caller and remove the barrel edge; map visibility behavior
and dynamic import targets stay intact. Route-only catalog event bodies also stay
inside the existing catalog hook. Raising budgets, undoing map deferral, and a new
analytics dynamic root were rejected. Risk is chunk redistribution; exact recovery
is accepted only by the next canonical build. Rollback is the reviewed source diff.

## Migration Plan

Ship only after review/gate and explicit-path push. Verify published SHA and new intent payloads, provider metadata/goals and organic report query. Record first complete observation day for #3450. Rollback is reverting task-owned source/spec/docs via normal reviewed release; old events and /map remain unchanged.
