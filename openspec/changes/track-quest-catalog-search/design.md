## Context

See proposal.md for intent. `QuestsScreen.tsx` holds raw `searchQuery`, applies its lowercase trimmed value after 200 ms, and computes `questsAll` across the entire catalogue before display pagination. `utils/analytics.ts` already owns consent, automation suppression, provider readiness/queueing, and disabled native delivery.

## Goals / Non-Goals

Capture settled queries with the actual result count while preserving the existing catalogue and provider boundaries. Do not change UI, search matching, ranking, native SDKs, backend endpoints, or content.

## Decisions

- Add a focused `screens/tabs/useQuestCatalogSearchAnalytics.ts` hook rather than another inline effect in the large catalogue screen. Integrate after `questsAll` is computed so `results_count` is independent of pagination and sorting.
- Keep the existing raw input state, lowercase/trim normalization, and 200 ms matching debounce together in `screens/tabs/useQuestCatalogSearchQuery.ts`. The catalogue consumes that focused hook so adding analytics does not cross the screen's 800-line complexity limit; matching and rendering semantics remain unchanged.
- Start a cancellable 900 ms timer only when raw lowercase trimmed input equals the applied term, the screen is focused, and data is ready without error. A ref suppresses the same current tracked query across rendering, sorting, view and count changes; clearing resets it.
- Reuse `sendAnalyticsEvent('quest_search', { source: 'quest_catalog', search_term, results_count })`; no direct provider calls or additional queue. A standalone Yandex JavaScript goal is configured in counter 62803912 by the owning session.
- Bound queries to 2–100 characters and skip obvious email, URL, and phone patterns; no user identifiers or location is added. This is input minimization rather than a promise to detect every possible sensitive phrase.

## Risks / Trade-offs

- Pauses over 900 ms during slow typing can record an intermediate phrase → this represents a displayed stable search; continued fast typing cancels pending events.
- Queries entered without consent are not replayed later → existing consent boundary intentionally discards them.
- No historical query event exists → report starts with deployment and goal creation.
- Heuristic contact suppression can omit unusual searches → bounded suppression is preferable to recording obvious contact input; normal city/title queries remain unchanged.

## Validation matrix

| Surface | Evidence |
| --- | --- |
| Shared measurement logic | Focused fake-timer hook tests: pause/cancellation/count/dedup/reset/readiness/focus/input limits |
| Desktop/mobile web | One representative post-review production search intent and provider boundary probe; no visible layout change needs duplicate viewport evidence |
| Android/iOS | Hook tests verify no event dispatch; no native runtime changes or device gate |
| RU/BE/UK/PL/EN | No locale resources change; test non-Latin/Latin queries and preserve visitor input language |
| Existing providers | Existing analytics consent/automation/queue tests plus target hook tests |

## Migration Plan

Add the standalone Yandex goal before collecting production data. Standard reviewed web publication carries the emitter; verify published source identity and a real search event after review. Roll back by reverting the hook integration and hook; the unused goal may remain harmlessly configured. No backend migration or cloud resource is involved.
