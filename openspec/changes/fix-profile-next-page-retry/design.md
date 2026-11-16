## Context

`hooks/useMyTravels.ts` stops pagination by scope after a failed `fetchNextPage`; the query retains successful pages. `useProfileTravelTabList` owns independent published/draft hooks, while `ProfileTravelListView` owns the existing loader footer. See proposal.md for the user problem.

## Goals / Non-Goals

**Goals:** one recovery action for the active scope, existing request deduplication and auth/query-instance guards, no loss of loaded rows.

**Non-Goals:** no API, counters, native markup or other source lease changes.

## Decisions

- Expose `nextPageError: string | null` using the existing `getLoadErrorMessage` formatter and a scope/Query-bound stored failure (with the query's next-page error as fallback for shared observers). Keep `error` exclusive to first-page/full reload failure.
- Share the existing guarded next-page execution between normal `loadMore` and explicit `retryNextPage`. The retry bypasses only the stopped-pagination check, clears that scope's stop, and repeats the unchanged next page. Do not use `load()` because it trims/reloads page 1.
- Pass both values through `useProfileTravelTabList` from `source`; do not read `allTravels` unconditionally.
- In web's existing footer, use compact `EmptyState` error variant with `sharedStatic:myTravels.nextPageFailedTitle` and `myTravels.retryNextPage`; while retry is pending the existing footer loader replaces it. Native footer remains unchanged.
- Design evidence and normative states: `docs/features/user.md#my-travels-pagination-recovery-3441`; existing primitive and tokens suffice, no new visual pattern or image mock.
- Paths: hook, source adapter, ProfileScreen, ProfileTravelListView, five `i18n/locales/*/static/shared_static.ts` resources, focused hook/adapter/DOM tests, `e2e/profile-next-page-retry-3441.spec.ts`, feature contract and this change. Exact list is in the ignored checkpoint manifest.

## Risks / Trade-offs

- Successful background invalidation of page 1 clears Query.error → keep the failed page cause with the stopped scope and actual Query identity until explicit retry/refresh; a recreated Query never inherits the stop; a complete refreshed snapshot hides an obsolete next-page failure. Regression exercises real invalidate/refetch before retry.

- Stale scope/action after tab/auth switch → retain actual Query and owner guards; cover independent tab failures in adapter tests.
- Double retry → same in-flight Query guard as automatic pagination.
- Shared native hook → hook behavior coverage; native layout and pull-to-refresh unchanged, so no native device run selected.
- Long localized action → shared Button wraps text; test all resources with i18n and inspect mobile first.

## Migration Plan

No data migration. Validate planning before apply; focused hook/adapter/DOM and i18n checks after source lease; independent review-auditor then code-review-gate. Publish reviewed explicit paths only after coordinator's slot. Local browser acceptance mobile web then desktop uses API8000 and browser-only page 2 503→200: footer >4 seconds, 20→40 cards, repeated503, empty-list retry, screenshots and console/network. Normal repo web deploy and narrow live identity/profile smoke remain mandatory; no production fault injection. Rollback is the task-owned diff. Heavy/runtime/deploy execution is deferred until the coordinator grants the lease.
