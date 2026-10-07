## Context

See `proposal.md` and `specs/trip-web-static-render/spec.md`. Current `app/(tabs)/trips/index.tsx:6–8,17–25` immediately renders a fresh lazy import beneath Suspense. The installed Expo static renderer calls synchronous `renderToString`, and the installed async-import loader schedules resolution through a promise continuation. This guarantees a pending cold boundary even when the module itself can load.

The original Node probe uses the actual route, catalog, RNW, query, theme, locale and head owners: cold HTML has one explicit pending-abort template and no catalog/loading; only after saving that output, natural import settlement allows the same route to render its real loading owner with zero failed markers and zero server fetches. It observed no import/loading-leaf exception. It does not execute exact ExpoRoot or Metro: navigation ESM blocks that harness. jsdom separately captures the abort recovery, but missing CSSFontFaceRule prevents complete hydration. Retain both raw failures; no harness result substitutes for rollout acceptance.

## Goals / Non-Goals

**Goals:** resolve the established cold boundary at its route owner, preserve actual catalog states/static head, and keep the canonical authenticated trip matrix as a required acceptance gate.

**Non-Goals:** framework/server-renderer rewrite, new client-only gates, timeout/preload tricks, copied catalog skeleton, source patches for harness-only Expo/font failures, unrelated media/CLS/native work, or backend/auth contract changes.

## Decisions

1. Replace the public catalog's immediate lazy route import/Suspense wrapper with the ordinary synchronous catalog import already used by the native route. The catalog's real query loading branch becomes the initial owner; SEO stays in the existing wrapper. Reuse the current catalog, `usePublicTripsApi`, query client, theme/locale providers and `TripsPageSeo`; add no new loading component or shared abstraction.
2. Reject a whole-screen hydration gate or delay: it removes static catalog content and violates #938. Reject a renderer-wide async/preload rewrite: one route is evidenced, and protected Metro/config/scripts ownership is outside this change. Do not patch a supposed browser-global leaf: the actual leaf imported/rendered successfully under the established fixture.
3. Permanent regression must render a fresh route payload before awaiting anything and inspect actual server HTML. Use real RNW/catalog/query/theme/locale/head, enumerating navigation/asset/native infrastructure adapters. It must fail the old lazy route and require actual catalog/loading markers plus zero failed boundaries after the change. Do not stub the catalog or pre-resolve the import.
4. Complete hydration validation records raw recoverable/uncaught errors. A documented font/CSS test adapter can make the DOM harness capable of running; preserve the route/catalog and all errors, and keep exact ExpoRoot/Metro output as a separate production-build gate. A harness repair is not a product repair or accepted browser result.
5. Scope is `app/(tabs)/trips/index.tsx`, permanent cold-render/hydration tests under `__tests__/app/`, a focused production trip-flow regression under `e2e/`, and the route/SSR documentation in `docs/features/trips.md`. The explicit native index, global renderer/config, API modules and foreign dirty TripPlanCard/E2E-helper paths remain outside the implementation diff. If the fresh full export or historical flows expose a different source fault, stop, preserve evidence and revise this change's owned paths before repair; do not claim a route-only fix closed that fault.

## Contracts and risk zones

- Data/API/auth: retain existing `POST /api/trips/planned/`, `GET /api/trips/planned/me/`, `GET /api/public-trips/{id}/`, application endpoints and notifications. Real acceptance uses the existing usable test-owned A/B accounts and reversible cleanup rules; no alternate login, mocked success, backend edit or token output.
- SEO: preserve `/trips`, canonical/head and static content; no robots, sitemap, redirect or structured-data change. Compare generated HTML/head with first-client output.
- Accessibility: retain actual loading/error/search/filter/empty owners, headings, keyboard/focus and searchbox rules. Do not treat an unfiltered-empty catalog as a populated catalog without controls, or remove applicable filtered-empty reset actions.
- Localization: no new keys or formatter change. Initialization and raw first-render output must be checked in RU/BE/UK/PL/EN; do not force a test-only locale to silence a mismatch.
- Performance: synchronous ownership can move catalog modules into the route's initial chunk. Compare request count/bytes and loading transition using immutable original artifact/source and fresh source-pinned production output, followed by actual rollout observation. Retain existing budgets; slider/media geometry is untouched, so new slider gates are not created by this change.
- Security/analytics: no new input, URL, auth storage or event path. Preserve existing sanitized content and protected queries.

## Risks / Trade-offs

- [Chunk growth] → measure the cold route's loaded bytes/requests before and after; keep API/UI boundaries rather than adding a concealment timer.
- [Standalone provider fixture differs from ExpoRoot] → capture exact production static output and browser errors after review; never relabel the isolated reproducer as full export acceptance.
- [Other original #864 flows can have separate faults] → retain the complete A-create/B-view/apply/cancel/my matrix, with raw unexpected 400/401 and #418/#419 gates. A failing flow stays unresolved, even if the catalog passes.
- [Foreign ownership and shared guard] → coordinate exact paths and stable hashes before commit. The current mandatory scanner false positive remains an external integration gate; no hook bypass or unrelated content rewrite.

## Validation matrix and rollout

| Target | Code-level evidence | Testing evidence |
| --- | --- | --- |
| Web cold server output | Fresh real route/catalog fixture in synchronous static mode; old RED/new GREEN; raw failure metadata; exact export later | Source-pinned static HTML has real loading/catalog and no failed server marker; raw HTML/head comparison |
| Mobile web390, light/dark, RU/BE/UK/PL/EN | Deterministic first render and real loading/empty/populated/filtered/error states; raw hydration errors | Own reviewed rollout: fresh direct and client entry, screenshots/console; slow response, retry/offline recovery; full authenticated matrix and cleanup |
| Desktop web | Same route/provider invariant and source/compile checks | Explicitly deferred by the owner's current mobile390-only runtime instruction; no desktop browser pass claimed |
| Android/iOS | No native route/config changes | No new device gate; mobile-browser evidence is not native proof |

After the separately authorized apply, use narrow static/unit checks, independent review-and-fix and code-review-gate before testing. The user's all-TODO request and project workflow authorize explicit-path commit/push, standard production rollout and acceptance once the protected shared scanner and ownership gates are satisfied. Exact production build/export occurs only under the operation gate after review; browser/API probes remain in testing. Revert the explicit task commit for rollback; no data migration or server-write recovery is introduced.
