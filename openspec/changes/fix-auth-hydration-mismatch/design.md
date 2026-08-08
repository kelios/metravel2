## Context

See [proposal.md](proposal.md) for the symptom, the recurrence history and the
scope boundary. This section records only the current implementation facts that
shape the approach. All line numbers were read on 2026-08-08 at commit
`a7ccc1c8`.

### How these two screens are delivered

`app.json` L80-84 sets `web.output: "static"`, so every route is prerendered to
HTML. `app.json` L86-94 configures `expo-router` with
`asyncRoutes: { "web": true, "default": false }`, so on the web **client** each
route is a lazy boundary that hydrates after the root shell. `metro.config.js`
L153-163 replaces `expo-router/_ctx` with `metro-stubs/expo-router-context.web.js`
for the client web bundle only (`!isWebServerEnvironment`, where the server
environment is `node` / `react-server`); that stub (L9-18) pins the route context
to `'lazy'`. The static render therefore uses the stock context while the client
uses the project stub — the two graphs are built from different context modules.

### Route and form paths

- `app/(tabs)/login.tsx` L1-5 — renders `LoginForm` and nothing else.
- `app/(tabs)/registration.tsx` L1-5 — renders `RegistrationForm` and nothing else.
- `app/(tabs)/login.native.tsx`, `app/(tabs)/registration.native.tsx` — native variants.
- `app/register.tsx` L1-5 — `<Redirect href="/registration" />`.
- `components/auth/LoginForm.tsx` (599 lines)
  - L16 `useIsFocused`, L29 `useResponsive`, L72 `const isFocused = useIsFocused()`,
    L74 render-time `require('@/utils/seo')`, L77 `const { isMobile } = useResponsive()`
  - L220 `{isFocused ? (<InstantSEO … />) : null}`
  - L236 `{Platform.OS === 'web' && !isMobile && (<Image … roulette-map-bg.jpg … />)}`
  - L251-268 visually hidden `h1` via `React.createElement('h1', …)`
  - L340 `<Feather name={showPassword ? 'eye-off' : 'eye'} … />`
  - L380-391 the social block: `GoogleSignInButton` L381, `FacebookAuthFlow` L386
- `components/auth/RegistrationForm.tsx` (721 lines) — same shape:
  L35/L67 `useResponsive`, L71 render-time `require('@/utils/seo')`, L252 the same
  `Platform.OS === 'web' && !isMobile` background branch, L263 hidden `h1`,
  L505-517 the social block (`GoogleSignInButton` L506, `FacebookAuthFlow` L511).
- Neither form contains `lazy`, `Suspense`, or any direct `window` / `document` /
  `navigator` / `localStorage` read in its render path.

### The auth social block

- `components/auth/GoogleSignInButton.web.tsx`
  - L48-78 `getGoogleAvailability(hasClientId, hydrationReady)`; L58 keeps SSR and
    the first hydration render identical; L62 reads `window.location.hostname`;
    L69 reads `window.google?.accounts?.id`
  - L96 `const hydrationReady = useHydrationReady()`; L97-100 the `useMemo`
  - L101-102 `shouldShowFallback`, `isButtonDisabled`
  - L210-245 render: a `View` with `accessibilityRole="button"` (L216) whose
    children are the loading block (L224-229) **and a raw `<div ref=…>`** (L230-243)
  - L56-57 carries a stale comment claiming the handoff happens "via
    `useSyncExternalStore`"; `useHydrationReady` is a `useState` + `useEffect` gate.
- `components/auth/GoogleSignInButton.tsx` — the non-Metro fallback used by Jest
  (L23-27 says so). Its web branch (L123-150) computes availability **without any
  hydration gate**, so component tests that import this file do not exercise the
  production code path.
- `components/auth/GoogleSignInButton.native.tsx`, `components/auth/googleSignInButtonTheme.ts`.
- `components/auth/FacebookSignInButton.web.tsx`
  - L50-51 `isFacebookLoginEnabled()` reads `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED`
  - L86 `const hydrationReady = useHydrationReady()`; L87 `useLocale()`
  - L150 `if (!enabled) return null;`
  - L151 `if (!hydrationReady) return <View style={styles.hydrationPlaceholder} />;`
    — added by commit `e980b5e9` "fix(web): stabilize auth hydration"
  - L183-214 the real control; L203 `<Feather name="facebook" … />`
  - L218-222 the placeholder style (`width: 100%`, `minHeight: 48`, radius)
- `components/auth/FacebookSignInButton.tsx` (base, returns `null`),
  `components/auth/FacebookSignInButton.native.tsx`,
  `components/auth/facebookLoginTypes.ts`.
- `components/auth/FacebookAuthFlow.tsx` (base, returns `null`),
  `components/auth/FacebookAuthFlow.web.tsx` / `.native.tsx` (re-export),
  `components/auth/FacebookAuthFlow.shared.tsx` — L326-348 the default branch is
  `<View>` + `FacebookSignInButton`; L196/L240 use `Feather` in the panels.

### Project mechanisms already in place against mismatch

- `hooks/useHydrationReady.ts` L25-33 — `false` for SSR and the first web render
  of that consumer, `true` after its own commit. L4-18 documents that
  `clientOnly: true` is **only** valid for a subtree a parent mounts after
  hydration, and that using it for a node present in the SSR HTML is itself a
  #418. No consumer in `components/auth/**` passes `clientOnly`.
- `hooks/useResponsive.ts` — L166-167 `SSR_SNAPSHOT = { width: 0, height: 0 }`,
  L188 live `getSnapshot`, L258-268 `useResponsive(options?)`, L265
  `const snapshot = hydrationReady ? liveSnapshot : getServerSnapshot()`. At
  width `0`, `isMobile === true`, so the desktop-only background branch is absent
  from both the server render and the first client render.
- `components/layout/ResponsiveContainer.tsx` L42 is the only
  `useResponsive({ clientOnly })` call site, driven by
  `components/home/HomeHero.tsx` L332. `components/home/useHomeViewport.ts` has
  its own `clientOnly` (used by `components/home/Home.tsx` L182 and
  `HomeHero.tsx` L117). None of this reaches the auth screens.
- `hooks/useWebHydrationGate.ts` — a separate rAF+timeout gate used by
  `app/(tabs)/map.web.tsx` L42, `app/(tabs)/trips/community.tsx` L20,
  `components/screens/messages/MessagesScreen.tsx` L41,
  `components/travel/upsert/LazyUpsertTravelRoute.web.tsx` L22. Not used by auth.
- `metro-stubs/FeatherHydrationSafe.web.tsx` (aliased in `metro.config.js`
  L169-174) — renders an empty sized `<Text aria-hidden>` until its own consumer
  commits. Its header comment states the exact failure class this project already
  hit: the root shell can load the icon font before a lazy route boundary
  hydrates, so that boundary renders glyphs on the client while its server HTML
  holds empty placeholders.
- `app/+html.tsx` L331-339 — a pre-hydration inline script sets `data-theme` from
  `localStorage`/`matchMedia`; L394 `<html … suppressHydrationWarning>` is the
  single occurrence of that escape hatch in the repository.
- `hooks/useTheme.ts` L81-89 — explicit SSR-safe defaults; the web first render is
  always `isDark === false`, and `constants/designSystem.ts` returns CSS
  `var(--color-…)` strings on web, so theme does not change rendered style strings.
- `i18n/instance.web.ts` L9-10 pins language and `resolvedLanguage` to `ru`, so
  SSR and the first client render agree on locale;
  `i18n/LocaleProvider.web.tsx` L115 remounts the subtree on a later locale change.
- `styles/globalFocus.ts` L92-98 injects a `<style>` into `document.head` at module
  import (imported by `LoginForm.tsx` L25).

### Why only the production-config minified export reproduces it

`scripts/build-web-prod.js` L82 copies `.env.prod` over `.env`, L96-103 sets
`NODE_ENV=production`, `EXPO_ENV=prod`, `EXPO_PUBLIC_RNW_SLIM=1`,
`EXPO_WEB_BUILD_MINIFY=true`, `EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false`, L105
runs `scripts/build-web-safe.js -p web -c --output-dir .tmp/prod-web-export`, and
L106-118 stages and swaps into `dist/prod`. `npm run build:web:prod`
(`package.json` L79) is the entry point; `npm run serve:prod` (L80) serves
`dist/prod` through `.claude/prod-server.js`, and `.claude/launch.json` L276-284 /
L321-331 provide the `Prod Static` launches.

Two config deltas matter and must not be printed as values:
`EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED` is `true` in `.env` and `.env.prod` but
`false` in `.env.dev`, and `EXPO_PUBLIC_GOOGLE_CLIENT_ID` differs between
`.env.dev` and `.env`/`.env.prod`. With the dev config the Facebook subtree is
`null` (`FacebookSignInButton.web.tsx` L150) and the Google branch takes a
different path, so the auth social block is not the same tree at all — which is
consistent with the report that only the production-config export reproduces.
`EXPO_PUBLIC_RNW_SLIM=1` additionally swaps `react-native` for
`metro-stubs/react-native-web-slim.js` (`metro.config.js` L176-181), which is
another production-only delta in the rendered primitives.

### Production markup evidence (read-only probe, 2026-08-08)

`GET https://metravel.by/login` → HTTP 200, 92,237 bytes.
`GET https://metravel.by/registration` → HTTP 200, 100,909 bytes.
Both: `<!--$-->` ×3, `Загрузка Google Sign-In...` ×1, `Войти через Google` ×1,
`main-content` ×1, `roulette-map-bg` ×0.

The served subtree under investigation is, on both routes:

```html
<button aria-label="Войти через Google" role="button" class="css-g5y9jx …" type="button">
  <div class="css-g5y9jx r-1awozwy r-18u37iz r-1cmwbt1 r-1777fci r-peo1c">
    <div role="progressbar" aria-valuemax="1" aria-valuemin="0" …>
      <div …><svg height="100%" viewBox="0 0 32 32" width="100%">…</svg></div>
    </div>
    <div dir="auto" class="css-146c3p1 …">Загрузка Google Sign-In...</div>
  </div>
  <div style="width:100%;min-height:44px;display:none;justify-content:center;pointer-events:auto;opacity:1;color-scheme:light"></div>
</button>
<div class="css-g5y9jx"><div class="css-g5y9jx r-y47klf r-1pl7oy7 r-13qz1uu"></div></div>
```

Three facts follow. The Google control is emitted as a real `<button>` element
containing `<div>` children. The Facebook block **is** in the static HTML — the
outer `View` from `FacebookAuthFlow.shared.tsx` L327 plus the
`hydrationPlaceholder` from `FacebookSignInButton.web.tsx` L151/L218-222 — so
`clientOnly` is structurally unavailable as a fix here. And the desktop-only
background is genuinely absent server-side, confirming the width gate holds.

### Existing regression coverage and its gap

- `e2e/hydration-routes.spec.ts` — L4 matches only
  `/Minified React error #418\b|Hydration failed because the server rendered/i`;
  L8 forces a single 1280×800 viewport; L10 mocks every `/api/**` as 503;
  L23 visits `/login`, `/registration`, `/places`, `/roulette`; L25-27 waits for
  `#main-content` plus 750 ms and asserts, with **no interaction**.
- `e2e/helpers/consoleGuards.ts` L3-5 exposes
  `isRecoverableReactHydrationError`; `e2e/quests-list-detail.spec.ts` L325 uses
  it to *tolerate* #418.
- `playwright.config.ts` L47-48 (`baseURL` on port 8085), L102-124 (`webServer` →
  `scripts/e2e-webserver.js`), L139-146 (one `chromium` project).
  `scripts/e2e-webserver.js` L525-531 builds with `npm run build:web` into
  `dist/` — **not** minified and not the production config.
  `scripts/serve-web-build.js` L10-15 reads `E2E_BUILD_DIR` (default `dist/`),
  which is the single hook for pointing the suite at `dist/prod`.
- Other auth-touching specs: `e2e/auth-entrypoints.spec.ts`,
  `e2e/google-signin.spec.ts`, `e2e/public-regressions.spec.ts` L59-78,
  `e2e/cls-audit.spec.ts` L56-57, `e2e/seo-travel-detail.spec.ts` L374,
  `e2e/mobile-dark-theme.spec.ts` L59.
- Unit: `__tests__/components/auth/GoogleSignInButton.web.test.ts` (pure
  `getGoogleAvailability` only), `FacebookSignInButton.web.test.ts` (pure helpers
  only), `FacebookAuthFlow.web.test.tsx` (mocks `FacebookSignInButton`),
  `__tests__/components/login.test.tsx`. Nothing today compares a server render
  with a first client render.

The backend is not involved. `../metravel-backend` stays read-only, no
`area=back` task is required, and no API/cookie/CSRF contract changes.

## Goals / Non-Goals

**Goals:**

- Identify the failing node empirically and record it, instead of patching the
  most plausible candidate.
- Make the server render and the first client render of the auth social block
  emit identical element structure, order, types and text.
- Keep exactly one owner of the SSR/first-render equality decision, so the
  Google and the Facebook control cannot drift apart again.
- Convert the fix into a guard that runs under the reproducing conditions —
  minified production-config build, both routes, 390/1280/1440, before and after
  the first interaction.

**Non-Goals:**

- Introducing a new hydration primitive when `useHydrationReady` already exists.
- Changing how routes are rendered (`web.output`, `asyncRoutes`, the router
  context stub) to sidestep the mismatch.
- Making the auth screens' post-hydration layout "better"; the visual contract is
  frozen and only proven unchanged.
- Extending the fix to the other routes covered by `e2e/hydration-routes.spec.ts`.

## Decisions

### 1. Localize before fixing, with a documented method

The board Done gate requires the concrete root node and mechanism to be written
down, so the first work block produces evidence, not a patch.

Method, in order:

1. Build `dist/prod` with `npm run build:web:prod` and serve it with the
   `Prod Static` launch (`.claude/prod-server.js`, root `dist/prod`). Save the
   raw prerendered `login.html` and `registration.html` from that build.
2. Capture the DOM of `#root` **before** the bundle executes (document snapshot
   at `document-start` / response body) and again after hydration settles, then
   diff the two subtrees. The first structural divergence names the node.
3. Read the browser's own report: the minified `#418` frame plus the surrounding
   console output, resolved against the export's module boundaries. A temporary
   local build with React development warnings may be used **only** as a
   diagnostic; it is never part of the deliverable.
4. Confirm the finding in isolation: render the same component through the
   project's server-render path and compare the produced string with the first
   client render of the same component, using the real `.web` modules rather
   than mocks.
5. Write the confirmed node and mechanism into `tasks.md` before touching
   product code. If the confirmed cause is outside the auth social block, stop
   and revise this design rather than widening scope.

Alternatives rejected: patching the highest-ranked candidate directly (the
task's Done gate explicitly requires the mechanism to be identified, and the
family already accumulated four point fixes); relying on the existing e2e guard
to bisect (it runs against the wrong build and has no interaction phase).

### 2. Ranked candidate mechanisms

These are hypotheses to confirm or eliminate in step 1, each with the evidence
that put it on the list. They are not conclusions.

- **C1 — raw DOM children inside the button element.**
  `GoogleSignInButton.web.tsx` L211-219 renders a `View` with
  `accessibilityRole="button"`, which react-native-web emits as a real
  `<button type="button">`; L230-243 places a raw `<div>` inside it, and the
  loading block L224-229 adds more `<div>`s. The served HTML above confirms the
  nesting. `<button>`'s HTML content model is phrasing content, so this is
  invalid nesting; any parser normalization or any client-side element-type
  difference at that position surfaces exactly as #418. Highest rank because it
  is the only invalid-nesting site in the two screens and it is unique to the
  auth surface.
- **C2 — the Facebook placeholder-to-control swap.**
  `FacebookSignInButton.web.tsx` L150-151 returns a childless `View` for SSR and
  the first client render, then a `Pressable` with icon and text. The placeholder
  is confirmed present in the static HTML. Under `asyncRoutes: web=true` the auth
  boundary hydrates after the root shell has committed; if anything lets the
  consumer's `useHydrationReady` read `true` on its hydration render, the client
  produces the control where the server produced the placeholder.
- **C3 — focus-conditional head content.** `LoginForm.tsx` L220 and the
  equivalent in `RegistrationForm.tsx` gate `InstantSEO` on `useIsFocused()`. If
  focus resolves differently in the static render than on the first client
  render, the `expo-router/head` subtree differs.
- **C4 — availability recomputed too early.** `getGoogleAvailability`
  (`GoogleSignInButton.web.tsx` L48-78) swaps the loading block (indicator +
  text) for the fallback block (text only) when `enabled` flips. Today L58 gates
  that on `hydrationReady`, but the comment at L56-57 describes a
  `useSyncExternalStore` handoff the hook does not implement — a contract the
  code no longer matches is a standing hazard even if it is not today's cause.
- **C5 — icon/font race.** Mitigated project-wide by
  `metro-stubs/FeatherHydrationSafe.web.tsx`; kept as a control because
  `FacebookSignInButton.web.tsx` L203 and `FacebookAuthFlow.shared.tsx` L196/L240
  use `Feather`, and `LoginForm.tsx` L340 renders one inside the form itself.
- **C6 — the width-dependent background.** `LoginForm.tsx` L236 /
  `RegistrationForm.tsx` L252. Currently protected by
  `hooks/useResponsive.ts` L265, and the served HTML confirms the element is
  absent server-side. Must be re-verified at 1280 and 1440 and must not be
  "repaired" with `clientOnly`.

### 3. Keep one mechanism, and never `clientOnly` on these nodes

`useHydrationReady` stays the single owner of the SSR/first-render decision for
both social controls. Its `clientOnly` option is unavailable here by
construction: the Google control and the Facebook placeholder are both present
in the prerendered HTML (evidence above), and
`hooks/useHydrationReady.ts` L4-18 states that using `clientOnly` on such a node
is itself a #418. No second gate (`useWebHydrationGate`, a bespoke `isClient`
state, `suppressHydrationWarning`, or a timer) may be introduced for these
components.

Alternatives rejected: `suppressHydrationWarning` on the subtree (hides the
defect and would let the DOM silently diverge); a reveal timer (project rule caps
forced UI timeouts at 1000 ms and forbids using them to wait out hydration);
moving the block behind `useWebHydrationGate` (a second, rAF-based gate would
reintroduce two competing contracts on one screen).

### 4. Prefer a stable element, not a later swap

Where the confirmed cause is a structural swap, the fix is to emit the **same
element with the same children** on the server and on the first client render,
and change only attributes, styles or the provider mount afterwards. This is
strictly better than moving the swap later, because a swap that happens after
hydration still repaints the control and the task explicitly requires no visible
re-render.

Concretely, and only for the branch measurement confirms:

- If C1 is confirmed, the container that carries the button semantics must stop
  wrapping raw DOM children that the HTML parser can relocate, while keeping the
  `aria-label`, the button role, the disabled/busy semantics and the ≥44 px
  target from `GoogleSignInButton.web.tsx` L211-219.
- If C2 is confirmed, the placeholder and the real control must share the same
  element shape, so hydration adopts the node and only its content/attributes
  change afterwards.
- If C3 is confirmed, the metadata subtree must be rendered unconditionally on
  these two routes, with focus affecting only its content synchronisation.
- If C4 turns out to matter, the stale comment at L56-57 is corrected in the same
  change so the contract and the code agree.

### 5. Test at the render-equality layer and at the route layer

Two layers, because either alone is insufficient.

- **Focused component test.** Compare the project's server-rendered string for
  the auth social block against its first client render, using the real
  `components/auth/GoogleSignInButton.web` and
  `components/auth/FacebookSignInButton.web` modules. This is the "do not mock
  the primitive under investigation" rule: mocking the hydration boundary would
  make the test pass on the broken code. Note the resolution gap — Jest resolves
  `components/auth/GoogleSignInButton.tsx`, whose web branch (L123-150) has no
  hydration gate — so the test must import the `.web` module explicitly, as the
  existing `__tests__/components/auth/*.web.test.ts` files already do. Cover the
  three availability inputs that change structure: configured client id, empty
  client id, and Facebook rollout flag on/off.
- **Route guard.** Extend `e2e/hydration-routes.spec.ts` rather than adding a
  parallel spec: widen the matcher beyond #418 to the hydration error family
  (#418/#419/#423/#425 and the unminified "Hydration failed" text), add an
  assertion pass after a first interaction, and run `/login` and `/registration`
  at 390, 1280 and 1440. Point the suite at the minified production-config build
  through `E2E_BUILD_DIR=dist/prod` (`scripts/serve-web-build.js` L10-15) with
  `E2E_NO_WEBSERVER=1` + `BASE_URL` when a `Prod Static` server is already
  running, so the guard exercises the build that reproduces. The tolerance in
  `e2e/quests-list-detail.spec.ts` L325 must not be copied into this guard.

Every Playwright invocation goes through `scripts/run-with-quality-gate-lock.js`
(the pattern used by `package.json` L115-119); a `SKIPPED` exit from a busy gate
is a coordination outcome and is never recorded as a pass.

### 6. Evidence must be quantities, not "no error"

Per project rules, the Done gate records numbers: the byte size and the exact
subtree of the prerendered HTML for both routes, the count of hydration/page
errors before and after the first interaction at each width, the measured layout
shift before and after the change, and a negative probe proving the guard fails
when the mismatch is reintroduced. `curl`-level evidence (HTTP status alone) does
not close this task.

No analytics event changes. SEO output (`noindex, nofollow`, canonical, single
hidden `h1`) and accessibility semantics are asserted as preserved, not improved.
No new URL construction, redirect, storage, or credential path is introduced, and
`EXPO_PUBLIC_*` values never appear in evidence.

This change does not touch `components/travel/sliderParts/**`,
`components/travel/details/**`, `ImageCardMedia`, or hero geometry, so
`verify:slider` / `verify:slider-perf` are not part of its validation plan.

## Risks / Trade-offs

- **The confirmed cause turns out to be outside the auth social block** → stop at
  the end of the localization block and revise this design; do not extend the
  edit set silently, and do not fall back to patching a candidate.
- **A fix that only moves the swap later still repaints the control** → the spec
  requires the server markup to be adopted, and validation compares bounding
  boxes and screenshots before/after, not just the absence of the error.
- **Changing the Google container to satisfy hydration could break the provider
  mount** → the GSI `renderButton` target (`GoogleSignInButton.web.tsx` L189-201)
  must stay a real element the SDK can fill; the Google flow is re-verified on the
  production host, not only in a local export.
- **Changing the Facebook placeholder shape could reintroduce layout shift** →
  the placeholder geometry (L218-222: full width, 48 px min height, same radius)
  is preserved and re-measured.
- **The guard could be satisfied by a suppressed error** → the guard also asserts
  server-markup adoption, and a negative probe must prove it fails on a
  deliberately reintroduced mismatch.
- **Two providers, one screen: a fix applied to one control leaves the other
  drifting** → both controls stay on the single `useHydrationReady` contract, and
  the focused test covers both.
- **The e2e suite normally builds `dist/` with the default config** → the guard is
  explicitly pointed at `dist/prod`; if it is ever run against the default build
  it must be recorded as not covering the reproducing conditions.
- **Shared forms are also used by Android** → the auth screens are re-checked on
  the connected device; the edit set deliberately excludes the shared form files
  to keep that risk small.
- **Quality-gate contention with a parallel session** → check for a live
  `.codex-temp/ops/quality-gate.lock` first; on `SKIPPED`, record
  `validation delegated` or `validation skipped` per the project rule instead of
  retrying.

## Validation Matrix

| Surface / layer | Scenario and evidence | Required result |
|---|---|---|
| Desktop web 1280 | `dist/prod` served locally; `/login` and `/registration` opened, settled, then first interaction | 0 hydration errors, 0 page errors, before and after interaction; social block bounding boxes unchanged |
| Desktop web 1440 | Same trace at 1440 width, including the desktop-only background branch | 0 hydration errors, 0 page errors; background still mounts after hydration with no new shift |
| Mobile web 390 | Same trace at 390 width | 0 hydration errors, 0 page errors; paired with the Android check |
| Prerendered HTML | Saved `login.html` / `registration.html` from the same build | auth form markup present, `noindex, nofollow`, canonical, exactly one hidden `h1`, social subtree identical to the first client render |
| Social behavior | Google flow on the production host; Google fallback on a loopback host; Facebook control with the rollout flag on and off | provider control renders and completes; loopback fallback text visible; flag-off renders no Facebook control |
| Focused tests | Server-render vs first-client-render equality for the real `.web` modules, plus existing auth component tests | all pass, no `.skip` |
| Route guard | Extended `e2e/hydration-routes.spec.ts` against `dist/prod`, plus a negative probe with a deliberately reintroduced mismatch | passes on the fix, fails on the reintroduced mismatch |
| Android | Locally built debug app on the USB device, sign-in and registration screens | unchanged fields, order, provider controls; no new runtime error in logs |
| Project checks | `npm run check:fast` and the relevant lint/test scope, through the quality-gate wrapper | green, or an explicitly recorded `validation delegated` / `validation skipped` |

Localization impact is `none`: RU/BE/UK/PL/EN resources and locale-sensitive
behavior are untouched, and `i18n/instance.web.ts` L9-10 pins the first render to
`ru`, so a single representative locale is sufficient for this hydration
validation. `npm run test:i18n` is therefore not required by this change.

## Migration Plan

1. Build and serve `dist/prod`, reproduce the failure on both routes at 390,
   1280 and 1440, and save the prerendered HTML plus the error inventory as the
   baseline.
2. Localize the exact node and mechanism by the method in Decision 1 and write it
   into `tasks.md`. Stop here for a design revision if the cause is outside the
   auth social block.
3. Add the failing focused render-equality test first, so the fix is proven by a
   test that fails before it.
4. Apply the minimal fix in `components/auth/GoogleSignInButton.web.tsx` and/or
   `components/auth/FacebookSignInButton.web.tsx`, leaving `LoginForm.tsx` and
   `RegistrationForm.tsx` untouched.
5. Extend the route guard, rebuild `dist/prod`, and re-run the full validation
   matrix including the negative probe.
6. Run the mandatory code-review-and-fix pass over the whole task diff and re-run
   every affected check afterwards.
7. Run `openspec validate --all`.

Rollback is a revert of the two component files plus the test/guard changes,
followed by the same checks; there is no data, API, cache, or backend state to
roll back. No deploy is authorized by this change: until a separately authorized
production deploy is followed by a repeat of the live `/login` and `/registration`
probe, the handoff wording stays `local fix ready; production verification
pending`.
