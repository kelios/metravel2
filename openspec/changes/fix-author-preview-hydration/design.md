## Context

See `proposal.md` for the observed failure and scope. Source evidence before editing:

- `UpsertTravelView.tsx:439–481` synchronously opens a blank tab, saves, then replaces that tab with `/travel/new?previewTravel=<id>` to obtain the exported app shell.
- `app/+html.tsx:266–280,504–508` rewrites history to `/travels/<id>` before the app starts. The delivered tree is still the creation route.
- `LazyUpsertTravelRoute.web.tsx:22–24` emits the same progressbar fallback on the server and initial client render through `useWebHydrationGate`; the early rewrite instead makes the client select a detail route.
- `app/+html.tsx:165–188` schedules an asynchronous public script from the then-current travel path; `public/travel-hero-preload-v2.js:24–31,411–414` independently reads the current path and fetches anonymously.
- `hooks/useTravelDetails.ts:162–187,221–240` consumes matching preload data and checks the initial target before waiting. `api/travelDetailsQueries.ts:108–150` also consumes matching direct-API data and can wait on preload globals. `hooks/useBreadcrumbModel.ts:278–285` reads matching preload data without consuming it. the former static SSG generator (removed in #2766)–1400` produces public SSG preload globals.

## Goals / Non-Goals

**Goals:** replace the unsafe boot-time route mutation with a post-commit router transition, retain the existing loading/detail states, and prevent anonymous preloading of a private route reached through a different document. Preserve the public producers and consumers above.

**Non-Goals:** no backend, cookie policy, global authentication, detail-query cache, editor save, native route, media geometry, or new UI changes. No new preview marker/global is needed.

## Decisions

1. Remove the author-preview history rewrite from `app/+html.tsx`. Handle valid preview input in the existing `LazyUpsertTravelRoute.web.tsx` boundary: strictly require `/travel/new`, take the first scalar/router-array query value, trim it, and accept only `/^[1-9][0-9]*$/`. Reuse the existing spinner for SSR, the first client render, and pending preview navigation. Run `router.replace('/travels/<id>')` only from an effect after commit and existing `authReady`; never mount/import the heavy wizard for a valid preview. This boundary serves both new and edit, so the exact-path guard is mandatory. Keep `app/(tabs)/travel/new.tsx` thin and leave the native adapter untouched.

   Rejected: a pre-hydration history rewrite, direct document navigation to the private detail, a timer-delayed rewrite, or disabling SSR. They retain the mismatch, trigger server-side private filtering, or avoid rather than establish route parity.

2. Reuse `useAuthStore(s => s.authReady)` rather than creating a second session probe. The cold store initially reports `isAuthenticated=false`; `fetchTravel` branches on that state (`api/travelDetailsQueries.ts:479–515`) and can otherwise classify a cookie-authenticated payload as guest data. Waiting for existing session restoration keeps author reads on their proper branch without adding an API or leaking a token. A settled guest still reaches the usual private-detail denial; this is not a login wall.

3. Keep all public preload credentials unchanged. The original `/travel/new` pathname naturally exits the inline public loader before it sets script/pending/target globals, so fresh private previews bypass both consumer waits and call the normal authenticated API. Add an early external-script guard when an existing `__metravelTravelPreloadTargetPath` differs from the current pathname. The target is captured synchronously by the inline loader; a late async execution cannot drift from public A into private B. Preserve standalone script operation when no original target is present. No new auth marker is required; do not disable public preloads globally.

   Rejected: adding credentials to the public preload, a blanket preload disable for numeric IDs, or a persistent private-preview global. Those expand privacy risk, remove useful public behavior, or introduce redundant state.

4. Permanent regressions cover actual render parity and effect timing, not merely an expected history call. E2E uses the real editor action/new document plus allowed cookie auth and asserts rendered data and unfiltered hydration errors. Network evidence distinguishes anonymous preload from ordinary cookie detail by initiator; successful content alone is insufficient.

## Impact and ownership

Frontend edits are confined to the HTML bootstrap, the existing web lazy route, the inaccurate editor preview comment, public preload eligibility, scoped units/e2e, and feature/problem documentation. Existing API/hook/SSG consumers are read-only controls unless a confirmed regression demands a scoped repair.

Data/API: owner GET `/api/travels/<id>/` remains 200; anonymous/unauthorized private GET remains 404. Auth uses the existing HttpOnly session. No new payload field, stored token, backend edit, or external link.

SEO: public URL/canonical/metadata/SSG behavior is unchanged. Creation metadata may exist briefly while its real document hydrates, after which normal detail SEO owns the page. No robots/sitemap changes.

Accessibility/design: reuse the current progressbar and detail/error UI, labels, focus behavior, keyboard controls, and touch targets. No design artifact is needed because layout and copy do not change. Before/after screenshots at 390/1440 demonstrate state parity.

Performance: remove one anonymous private request and hydration replacement. Keep lazy editor splitting, public preload data reuse, and unchanged hero/media layout. No slider/detail geometry edits, so the slider-performance gate is not applicable.

Analytics: production code and event schemas remain unchanged; browser acceptance intercepts test collection before counters, preserving #2659.

## Risks / Trade-offs

- [Authentication restoration is slow] → existing loading state persists until `authReady`; no artificial timer or duplicate session request. Test unresolved-to-ready and settled-guest transitions.
- [Bridge unintentionally affects edit/native] → exact `/travel/new` guard and `.web` ownership; test edit-with-preview and retain native adapter unchanged.
- [Delayed public script drops an obsolete optimization] → ordinary detail loading remains authoritative; test target mismatch and matching/absent target controls.
- [Regression tests pass with fake success] → final e2e prohibits fake storage auth, session-success/detail-success mocks, or filtered hydration errors. Use unique task-owned fixtures and clean up only those.
- [Public producer/consumer contract drifts] → run existing hook/API/breadcrumb/preloader tests; no new global names or public response shapes.

## Validation matrix

| Surface/consumer | Code-level evidence before testing | Runtime evidence in testing |
| --- | --- | --- |
| Desktop web 1440 / mobile web 390, RU representative locale | SSR/first-client parity; valid/missing/invalid ID; effect/authReady timing; editor is not mounted for preview | Actual editor action opens a new document; title/body visible; #418/#419=0; screenshots, console, network/initiators; no anonymous draft preload |
| Normal create and edit | Missing/invalid input renders existing wizard after hydration; edit ignores preview | Existing create/edit controls retained |
| Public id/slug detail | Matching/absent target allows preload; route drift aborts; existing hook/API/breadcrumb/SSG reuse tests | Public detail loads and normal anonymous preload remains available |
| Unknown ID and guest/private | Valid ID path does not bypass errors or auth readiness | Existing detail error; guest private API404 and no private payload |
| Slow session/async script | Deferred auth and route-change tests | No wizard flash, blank detail, or deferred private anonymous read |
| Other locales / Android / iOS | No locale resources, native adapter, copy, or formatting changes | No device gate; no localization gate for localization impact none |

Run scoped Jest, ESLint/typecheck/guards appropriate to the complete diff and mandatory independent review-auditor then code-review-gate. Runtime follows reviewed commit/push and board `testing`, authorized standard deployment, and deployed SHA verification. Tests use own draft; capture source baseline and final evidence without secrets. Validate this change strictly and run `openspec validate --all` before archive.

## Migration Plan

No data migration. Ship the reviewed frontend paths together through the standard task pipeline; verify the deployed build SHA before production acceptance. Rollback reverts those task-owned paths and redeploys the prior frontend SHA. Clean up only owned acceptance data; no backend state change is needed.
