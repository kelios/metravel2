## Why

`/login` and `/registration` throw React error #418 ("Hydration failed because
the initial UI does not match what was rendered on the server") when the app is
served from a **minified export built with the production config**. Both routes
are prerendered by the static web export, so React discards the server markup of
the failing boundary and re-renders it on the client: the social sign-in area is
visibly repainted after hydration instead of being adopted in place.

The routes ship real server markup for exactly the subtree under suspicion.
Production `GET https://metravel.by/login` (HTTP 200, 92,237 bytes, 2026-08-08)
already contains, inside one `<button aria-label="Войти через Google">`:

- the Google loading state (`Загрузка Google Sign-In...` plus an
  `role="progressbar"` SVG), and
- the empty Google Identity Services mount `<div style="…display:none…">`,

immediately followed by the Facebook block
`<div class="css-g5y9jx"><div class="css-g5y9jx r-y47klf r-1pl7oy7 r-13qz1uu"></div></div>`
— the Facebook hydration placeholder. `GET /registration` (HTTP 200, 100,909
bytes) contains byte-identical structure for the same block. Both documents
contain three Suspense boundary markers (`<!--$-->`) and zero occurrences of the
desktop-only background asset `roulette-map-bg`.

Because these nodes **are present in the server HTML**, the project's usual
escape hatch is unavailable: `useHydrationReady({ clientOnly: true })` is only
valid for subtrees a parent mounts after hydration, and applying it to a node
that exists in the static HTML is itself a #418 (documented in
`hooks/useHydrationReady.ts`). The fix must make the server render and the first
client render produce the same DOM, and recompute browser availability only
after a safe hydration handoff.

This is a recurrence in the `auth-ssg-hydration-race` problem family. The prior
corrective wave — #938, #864, #778, #691 — removed raw viewport reads from the
render path on other surfaces (header, travel details, list/search), and a later
commit added the `useHydrationReady` gate to `FacebookSignInButton.web`. The
shared header is therefore already excluded as the cause: the remaining
route-specific delta is the auth social block
(`GoogleSignInButton.web` / `FacebookSignInButton.web`) and its
hydration-dependent availability computation.

The existing guard `e2e/hydration-routes.spec.ts` already visits `/login` and
`/registration` and asserts zero #418 — but it runs against the non-minified,
default-config e2e export at a single 1280×800 viewport and never interacts with
the page. That is why the regression reached production-config builds.

## What Changes

- Localize the exact DOM node and mechanism that differs between the static
  server render and the first client render on `/login` and `/registration` in a
  minified production-config export, and record it as evidence.
- Make the server markup and the first client render of the auth social block
  byte-equivalent, so React adopts the existing DOM instead of replacing it.
- Recompute host/browser availability (production host vs loopback fallback,
  provider SDK presence) only after a safe hydration handoff for the consumer
  that owns the markup, never during the server render or the first client
  render.
- Keep the Google and Facebook sign-in flows and their explicit localhost
  fallback behavior unchanged.
- Extend the hydration route guard so it runs against a minified
  production-config build, covers 390 / 1280 / 1440 widths, and asserts the
  absence of hydration and page errors both before and after the first user
  interaction.
- Do **not** refactor the auth forms as a whole.

### Goal and user-visible result

`/login` and `/registration` load from the production-config minified export
with no React #418 and no page error, on desktop web and mobile web. The Google
and Facebook controls keep their server-rendered position and do not visibly
repaint or shift when hydration completes. Signing in with Google and with
Facebook still works on the production host, and the explicit "unavailable on
localhost" fallback still appears on loopback hosts.

### Platform impact

- **Desktop web:** direct behavior change; required production-like browser
  evidence at 1280 and 1440 widths.
- **Mobile web:** direct behavior change; paired evidence at 390 width.
- **Android:** not affected. The failing path is web static rendering; the
  native variants (`GoogleSignInButton.native`, `FacebookSignInButton` base
  file) are not in the edit set. Android is confirmed only as a no-regression
  check because the auth forms are shared code.
- iOS is inactive and out of scope.

### Localization impact

`none`. No translation key, resource file, locale persistence, locale-sensitive
formatting, SEO locale, or accessibility copy changes. The existing RU/BE/UK/PL/EN
strings for the Google loading state, the Google localhost fallback, and the
Facebook labels are reused unchanged.

### Dependencies and fallback/mock policy

- Board task: #1299 (`kind=bug`, `urgency=medium`, `area=front`, sprint 2).
  Problem key: `auth-ssg-hydration-race`. Linked closed analogs: #938, #864,
  #778, #691. Problem-memory verdict: `create-linked`.
- No dependency on #1300; it is closed separately and does not block this work.
- No backend, API, endpoint, cookie, CSRF, or token contract change. The
  `../metravel-backend` checkout stays read-only and no `area=back` task is
  required.
- Forbidden mitigations, per the task contract: suppressing or filtering the
  console error, disabling SSR/static rendering for these routes, removing the
  social buttons, hiding them behind a reveal timer, or adding
  `suppressHydrationWarning` to the failing subtree. The localhost fallback must
  remain explicit and visible; it must not be silently replaced by an enabled
  button.
- A mock may support focused component tests only. A test that mocks the
  hydration boundary itself is not evidence: at least one check must compare a
  real server-rendered string with a real first client render.
- No production deploy is authorized by this planning change. Until a separately
  authorized deploy plus a live re-probe happens, the handoff wording stays
  `local fix ready; production verification pending`.

### Existing behavior to preserve

- Google Sign-In on the production host: GSI script load, `initialize`,
  `renderButton` into the dedicated container, and credential callback.
- The Google loading state before the GSI script resolves, and the Google
  "not configured" state when the client id is empty.
- The explicit Google localhost fallback text, including its
  `EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN_LOCAL` override and the
  already-injected-`window.google` escape.
- Facebook Login behind its rollout flag: hidden entirely when the flag is off,
  SDK bootstrap with the active locale, permission re-request panel, and the
  email-completion panel.
- Email/password login and registration, validation, password reset, the
  registration CTA links, `noindex, nofollow` metadata and the canonical URL on
  both routes, the visually hidden `h1`, and the desktop-only background image
  that mounts after hydration.
- The `verify pending`-free Android behavior of the shared auth forms.

### Out of scope / Non-goals

- Redesigning, restructuring, or splitting `LoginForm.tsx` /
  `RegistrationForm.tsx`, or changing their layout, styling, or copy.
- Changing the auth API, session/cookie handling, redirect/`intent` behavior, or
  the post-auth navigation contract.
- Changing Google or Facebook provider configuration, client ids, scopes, or the
  rollout flag values.
- Fixing hydration issues on other routes, or auditing routes beyond `/login`
  and `/registration`.
- Removing the desktop-only background image or otherwise addressing the
  post-hydration layout of the auth page beyond proving no new shift.
- Turning `web.output` away from `static`, or changing `asyncRoutes`.
- Any deploy, publish, commit, or task-board state change.

### Open questions

None that block planning. The exact mismatching node is deliberately treated as
a measurement task rather than an assumption: `design.md` records the ranked
candidate mechanisms and the localization method, and `tasks.md` requires the
confirmed node and mechanism to be written down before any fix is applied. If
measurement shows the cause lies outside the auth social block, implementation
stops for a design revision instead of widening scope silently.

## Capabilities

### New Capabilities

- `auth-screen-hydration`: Server/client render equivalence, provider
  availability timing, preserved social sign-in behavior, and the regression
  contract for the statically rendered `/login` and `/registration` screens.

### Modified Capabilities

None. No living OpenSpec capability under `openspec/specs/` currently covers the
auth screens or web hydration.

## Impact

- **Expected frontend scope:** `components/auth/GoogleSignInButton.web.tsx`,
  `components/auth/FacebookSignInButton.web.tsx`, and — only if measurement
  proves it necessary — the wrapper `components/auth/FacebookAuthFlow.shared.tsx`
  or `hooks/useHydrationReady.ts`. Tests: the focused auth component tests under
  `__tests__/components/auth/` and the route guard `e2e/hydration-routes.spec.ts`.
  `components/auth/LoginForm.tsx` and `components/auth/RegistrationForm.tsx` stay
  outside the expected edit set.
- **Data/API:** unchanged. No request, endpoint, payload, header, cookie, or
  error-code change; no backend or migration work.
- **SEO:** must be preserved, not improved. Both routes keep
  `robots: noindex, nofollow`, their canonical URLs, the single visually hidden
  `h1`, and their prerendered static HTML. Removing SSR for these routes is
  explicitly forbidden.
- **Accessibility:** the Google control keeps its `aria-label` and button
  semantics, the Facebook control keeps its label, disabled/busy state and
  `testID`, and both keep a ≥44 px touch target. No new interactive element,
  focus trap, or live region is introduced.
- **Performance:** the target is removing a full client re-render of a
  hydrated subtree, so the change should reduce work rather than add it. No
  additional network request, no reveal timer (project ceiling is 1000 ms and
  timers are forbidden as a hydration workaround), and no new bundle entry.
  Layout shift on both routes must not increase; a before/after screenshot pair
  is required to prove the visual contract is unchanged rather than redesigned.
- **Security:** no new URL construction, redirect, storage, credential, or token
  handling. Provider SDK script origins (`accounts.google.com/gsi/client`,
  `connect.facebook.net`) and the existing CSP surface stay as they are; secrets
  and `EXPO_PUBLIC_*` values are never printed in evidence.
- **Analytics:** no event added, renamed, or removed. The existing
  `AuthViewed` and register-CTA tracking on these routes must keep firing.
