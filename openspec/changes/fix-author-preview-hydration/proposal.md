## Why

Task #2695 records a cold author-preview tab changing from `/travel/new?previewTravel=<id>` to a detail route before hydration: React reports #418, and an anonymous preload receives the expected private-draft 404 before the cookie-authenticated request succeeds. The goal is an owner preview with matching server/first-client trees, no anonymous draft preload, and unchanged guest privacy.

## What Changes

- Preserve the exported creation route through the first hydration commit; replace it with the numeric detail route through the mounted router after session restoration settles.
- Keep the existing loading state while preview navigation is pending, without mounting the creation wizard for a valid preview.
- Bind asynchronous public preloading to its original document target so a delayed public script cannot read a different private SPA destination.
- Replace the rewrite-only unit and mock-success preview e2e with lifecycle/parity regression coverage and a real cookie-authenticated cold-tab UI flow.

## Capabilities

### New Capabilities

- `travel-author-preview`: Safe cold-tab author-preview routing, public-preload eligibility, owner/private access, and adjacent create/public controls.

### Modified Capabilities

None. No existing living spec owns the author-preview bridge.

## Impact

- User-visible result: “Открыть путешествие” shows the author's saved draft without hydration recovery or an avoidable anonymous read refusal.
- Platform impact: desktop web 1440 and mobile web 390. Android/iOS: none; their existing route path is unchanged.
- Localization impact: none; existing loading, detail, and error UI and all RU/BE/UK/PL/EN resources remain unchanged.
- Affected frontend paths: `app/+html.tsx`, `components/travel/upsert/LazyUpsertTravelRoute.web.tsx`, the preview-link comment in `UpsertTravelView.tsx`, `public/travel-hero-preload-v2.js`, relevant bootstrap/preloader/route units, `e2e/travel-draft-owner-preview.spec.ts`, and feature/problem documentation. Existing detail/preload consumers are regression controls.
- Data/API/security: no fields or API policy changes. Owner detail remains cookie-authenticated; anonymous/unauthorized private access remains 404. Public preload retains `credentials: omit`; no browser token transfer is introduced. Only positive numeric internal IDs are accepted.
- SEO: public detail routes, generated static snapshots, canonical metadata, robots, and sitemap retain their contracts. The transient editor document is adopted before the router moves to existing detail handling.
- Accessibility: existing progressbar/detail/error semantics, focus behavior, labels, and controls are retained; no visual redesign.
- Performance: remove the extra private preload and hydration recovery; preserve public preload reuse, lazy editor chunking, and detail media geometry. No new dependency.
- Analytics: no event or provider changes; test traffic interception follows #2659.
- Dependencies: no hard backend/external dependency. #2677 supplies the recorded finding; #753/#1255 define expected guest privacy. Their cards are not modified by this change.
- Fallback/mock policy: unit fixtures are allowed. Final browser/e2e acceptance uses real allowed cookie auth, live detail responses, and an owned temporary draft; no fake storage auth, session-success mock, detail-success mock, or error filtering. Clean up only task-owned data.
- Existing behavior to preserve: ordinary creation/editing, public id/slug details and preload reuse, unknown-ID error UI, anonymous private denial, and native preview behavior.
- Non-goals: backend/nginx changes, save/moderation, draft recovery, #2677 CTA behavior, #2659 analytics implementation, native/store work, and screen redesign.
- Open questions: none; the existing owner/private API contract is sufficient.
