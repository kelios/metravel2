# Manual QA report (localhost)

## Scope & environment
- Target: localhost web build served from `dist` via `scripts/serve-web-build.js` on `http://127.0.0.1:8086`.
- Personas: guest (new user), registered user (attempted via UI), mobile (iPhone 12 viewport emulation).
- Note: backend requests from localhost to `http://192.168.50.36` are blocked by CORS in this environment; this impacted content-heavy pages.
- To unblock QA: поднять локальный прокси, чтобы CORS исчезал (см. Вариант A ниже).

## Summary
- Navigation works for browser back button; footer navigation issue likely resolved by banner fix (pending manual retest).
- Multiple critical pages fail to load data without proxy; local proxy now available to unblock CORS.
- Cookie consent banner overlapped key actions; pointer-events fix applied (pending manual retest).
- Login page “Зарегистрируйтесь” link was blocked by banner; fix applied (pending manual retest).
- `/register` route returns not found; redirect added.
- Bottom dock “Ещё” menu items did not navigate; fixed (pending manual retest).
- Added local proxy support for QA build to bypass CORS; requires re-run with proxy enabled.
- Playwright E2E suite passed with proxy-enabled web server (see Evidence/Automation).

## Bugs & issues

### 1) API calls blocked by CORS; core pages show errors and empty data
- Severity: blocker
- Steps:
  - Open `/`, `/travelsby`, `/roulette`, `/map` on localhost.
- Expected:
  - Pages load data (popular/random/of-month, filters, map points, roulette results).
- Actual:
  - Requests to `http://192.168.50.36/api/*` fail with CORS errors; console logs show minified React errors.
- Impact:
  - User cannot browse content, filters, map results, or roulette recommendations.
- Status:
  - Blocked without proxy; resolved when local proxy is enabled.

### 2) Cookie banner overlaps key actions (login/register, footer nav)
- Severity: major
- Steps:
  - Open `/login` and try clicking “Зарегистрируйтесь”.
  - Open `/` and try clicking footer nav items.
- Expected:
  - Links are clickable without requiring extra steps.
- Actual:
  - Cookie banner overlays the link area (elementFromPoint hits banner), blocking pointer events.
- Impact:
  - Users cannot navigate unless they dismiss the banner first.
- Status:
  - Fixed by allowing pointer-events passthrough on non-interactive banner areas; pending manual retest.

### 3) Footer navigation items do not navigate
- Severity: major
- Steps:
  - On home page, click footer items (Travels, Map, Roulette).
- Expected:
  - SPA route changes to `/travelsby`, `/map`, `/roulette`.
- Actual:
  - Path remains `/`.
- Impact:
  - Core navigation is blocked from the primary UI controls.
- Status:
  - Likely resolved by cookie banner fix; pending manual retest.

### 4) “Зарегистрируйтесь” link on login does not navigate (blocked by banner)
- Severity: major
- Steps:
  - Open `/login`.
  - Click “Зарегистрируйтесь” without dismissing cookie banner.
- Expected:
  - Navigate to `/registration`.
- Actual:
  - Remains on `/login` because click is intercepted by the banner.
- Impact:
  - Registration entry point appears broken.
- Status:
  - Fixed by cookie banner pointer-events update; pending manual retest.

### 5) Bottom dock “Ещё” sheet items do not navigate
- Severity: major
- Steps:
  - On mobile web viewport, tap “Ещё” in bottom dock.
  - Tap “Политика конфиденциальности”, “Настройки cookies”, “Связаться с нами”.
- Expected:
  - Navigate to `/privacy`, `/cookies`, `/about`.
- Actual:
  - Sheet closes without navigation.
- Impact:
  - Users cannot reach legal/support pages from mobile dock.
- Status:
  - Fixed by routing the “Ещё” sheet items; pending manual retest.

## Scenario checks

### Scenario A: Find a route
- Steps: open `/travelsby`, use search/filter.
- Expected: list updates with results.
- Actual: API requests fail (CORS), list cannot populate.
- Problems: blocker due to API access.

### Scenario B: Read a route
- Steps: open a travel card from list.
- Expected: opens travel details page.
- Actual: list does not populate due to API failures.
- Problems: blocker due to missing data.

### Scenario C: Save/add a route
- Steps: on home, click “Рассказать о путешествии”, then attempt to go to registration.
- Expected: login page opens and registration link is clickable.
- Actual: registration link is blocked by cookie banner until consent is dismissed.
- Problems: major conversion blocker (extra friction + perceived broken flow).

### Scenario D: Register
- Steps: go to `/login`, click “Зарегистрируйтесь”.
- Expected: navigate to `/registration` and show registration form.
- Actual: cookie banner overlays the link; navigation works only after consent is dismissed.
- Problems: major navigation friction.

### Scenario E: Return to site
- Steps: navigate from `/` to `/travelsby`, then back.
- Expected: returns to `/`.
- Actual: browser back returned to `/`.
- Problems: none observed.

### Scenario F: Global search
- Steps: open `/search`, enter a query, apply filters.
- Expected: results update, filters persist on navigation back.
- Actual: blocked by CORS; list cannot populate.
- Problems: blocker due to API access.

### Scenario G: Favorites flow
- Steps: open `/favorites` as guest, attempt to add/remove a favorite from a card.
- Expected: prompt login or show empty-state guidance; after auth, favorites persist.
- Actual: blocked by CORS/auth; verify after backend доступен.
- Problems: blocked by API/auth.

### Scenario H: Map filters and list panel
- Steps: open `/map`, open filters, apply region/category, toggle list panel.
- Expected: map points + list update and reflect filters.
- Actual: blocked by CORS; no map points.
- Problems: blocker due to API access.

### Scenario I: Roulette recommendations
- Steps: open `/roulette`, set preferences, run roulette.
- Expected: recommendations render with cards and details link.
- Actual: blocked by CORS; results empty, console errors.
- Problems: blocker due to API access.

### Scenario J: Create travel (wizard)
- Steps: click “Рассказать о путешествии”, proceed through steps, upload media, submit.
- Expected: validation works, draft/save flow works, publish confirms.
- Actual: not fully verified (API blocked); UI steps load.
- Problems: needs retest with API.

### Scenario K: Draft recovery
- Steps: start wizard, leave page, return, check for draft recovery banner.
- Expected: recovery prompt appears and restores draft.
- Actual: not verified; requires API and local draft persistence.
- Problems: pending.

### Scenario L: Password reset
- Steps: `/login` → “Забыли пароль?”, submit email.
- Expected: success toast and email sent.
- Actual: blocked by API/CORS (no confirmation).
- Problems: blocked by API.

### Scenario M: Profile update
- Steps: open `/profile`, edit profile fields, save.
- Expected: data updates and persists on refresh.
- Actual: blocked by API/auth.
- Problems: blocked by API.

### Scenario N: Cookie settings page
- Steps: open `/cookies`, toggle analytics consent, return to home.
- Expected: consent saved in localStorage, analytics load only when enabled.
- Actual: not verified in this run.
- Problems: pending retest.

### Scenario O: About/contact form
- Steps: open `/about`, submit contact form.
- Expected: validation messages and submit success feedback.
- Actual: not verified in this run.
- Problems: pending.

### Scenario P: Export/PDF
- Steps: open `/export`, generate PDF, download.
- Expected: PDF export succeeds and download starts.
- Actual: not verified in this run.
- Problems: pending.

### Scenario Q: 404/unknown route
- Steps: open `/not-a-real-page`.
- Expected: not found page or redirect to home.
- Actual: ✅ **Automated** in `e2e/qa-pending-scenarios.spec.ts`.
- Problems: none.

### Scenario R: SEO meta tags
- Steps: open `/`, `/travelsby`, `/map`, `/registration`, view page source.
- Expected: title/description/canonical present and correct.
- Actual: ✅ **Automated** in `e2e/qa-pending-scenarios.spec.ts` (home title+description, travels canonical, registration canonical+robots).
- Problems: none.

### Scenario S: Cookies banner lifecycle
- Steps: open `/`, accept cookies, reload.
- Expected: banner hidden on reload; consent persisted.
- Actual: ✅ **Automated** in `e2e/qa-pending-scenarios.spec.ts` (banner appears + accept flow).
- Problems: none.

### Scenario T: Accessibility basics
- Steps: tab through header/nav/footer, check focus visibility.
- Expected: focus ring visible and order logical.
- Actual: not verified in this run.
- Problems: pending.

### Scenario U: Bottom dock “Ещё” navigation
- Steps: open mobile web viewport, tap “Ещё”, select legal/support items.
- Expected: navigates to `/privacy`, `/cookies`, `/about`.
- Actual: not verified after fix.
- Problems: pending retest.

### Scenario V: Registration canonical
- Steps: open `/registration`, inspect canonical meta.
- Expected: canonical points to `/registration`.
- Actual: ✅ **Automated** in `e2e/qa-pending-scenarios.spec.ts`.
- Problems: none.

### Scenario W: Login errors and validation
- Steps: `/login`, submit empty form, invalid email, wrong password.
- Expected: inline validation; server error displayed gracefully.
- Actual: not verified.
- Problems: pending.

### Scenario X: Logout
- Steps: login, then logout from profile/menu.
- Expected: session cleared, redirected to `/`, protected pages require auth again.
- Actual: not verified.
- Problems: pending.

### Scenario Y: Profile avatar upload
- Steps: `/settings` or `/profile`, upload avatar image.
- Expected: upload succeeds, avatar renders after refresh.
- Actual: not verified.
- Problems: pending.

### Scenario Z: Travel details deep link
- Steps: open a travel details URL directly (from shared link).
- Expected: page loads, content renders, back navigation works.
- Actual: not verified.
- Problems: pending.

### Scenario AA: Share links
- Steps: open a travel card, use share action (if present).
- Expected: share dialog or link copy succeeds without errors.
- Actual: not verified.
- Problems: pending.

### Scenario AB: Article list and detail
- Steps: open `/articles`, open an article detail.
- Expected: list renders, detail loads with content.
- Actual: not verified.
- Problems: pending.

### Scenario AC: Cookie settings analytics toggle
- Steps: `/cookies`, disable analytics, refresh, then enable analytics.
- Expected: analytics scripts load only when enabled.
- Actual: not verified.
- Problems: pending.

### Scenario AD: Contact form validation
- Steps: `/about`, submit empty form and then valid payload.
- Expected: validation errors then success message.
- Actual: not verified.
- Problems: pending.

### Scenario AE: Map interactions
- Steps: `/map`, pan/zoom, open map points, switch filters.
- Expected: points update, no console errors.
- Actual: not verified.
- Problems: pending.

### Scenario AF: Responsive layout breakpoints
- Steps: test widths 320, 375, 768, 1024, 1440.
- Expected: layout adapts; no overlapping headers/footers.
- Actual: not verified.
- Problems: pending.

### Scenario AG: Offline/slow network handling
- Steps: throttle network to Slow 3G, then offline; refresh `/` and `/travelsby`.
- Expected: loading states shown; friendly error when offline; no infinite spinners.
- Actual: not verified.
- Problems: pending.

### Scenario AH: Pagination / infinite scroll
- Steps: `/travelsby`, scroll to load more results or use pagination controls.
- Expected: more items load; no duplicates; scroll position stable.
- Actual: not verified.
- Problems: pending.

### Scenario AI: Filters reset
- Steps: `/travelsby`, set multiple filters, then reset/clear all.
- Expected: filters cleared, list resets to default state.
- Actual: not verified.
- Problems: pending.

### Scenario AJ: Travel card interactions
- Steps: `/travelsby`, hover/tap cards, open gallery/preview if available.
- Expected: card interactions responsive; no layout shift.
- Actual: not verified.
- Problems: pending.

### Scenario AK: Map list panel scroll
- Steps: `/map`, open list panel, scroll to bottom.
- Expected: list scrolls without locking map; footer does not overlap.
- Actual: not verified.
- Problems: pending.

### Scenario AL: Search deep links
- Steps: `/search?q=минск&tags=...` (query params), reload.
- Expected: state restored from URL, results reflect filters.
- Actual: not verified.
- Problems: pending.

### Scenario AM: Form UX (required fields)
- Steps: registration/contact forms, submit with missing required fields.
- Expected: clear field-level errors and focus management.
- Actual: not verified.
- Problems: pending.

### Scenario AN: Analytics consent on first visit
- Steps: first load `/`, choose "Только необходимые", verify no analytics requests.
- Expected: no analytics calls until user opts in.
- Actual: not verified.
- Problems: pending.

### Scenario AO: Legal pages
- Steps: open `/privacy` and `/cookies`.
- Expected: content loads; links valid; headings readable on mobile.
- Actual: ✅ **Partially automated** in `e2e/qa-pending-scenarios.spec.ts` (privacy + about page content checks).
- Problems: none.

### Scenario AP: 500/error state rendering
- Steps: simulate API 500 (devtools mock) on `/travelsby`.
- Expected: error UI with retry; no crash.
- Actual: not verified.
- Problems: pending.

## Mobile checks (emulation)
- Scroll/viewport: no horizontal overflow detected on home.
- Navigation: pending retest after cookie banner pointer-events fix.
- Content: blocked without proxy; retest with proxy enabled.

## Emulation matrix (planned)
- Mobile: 320x568, 360x740, 375x812, 390x844, 414x896.
- Tablet: 768x1024, 820x1180, 1024x1366.
- Desktop: 1280x720, 1366x768, 1440x900.
- Orientations: portrait + landscape for mobile; portrait for tablet; default for desktop.

## Manual scenario packs (prioritized)
- Pack 1: Core discovery (A, B, F, H, I) with proxy enabled.
- Pack 2: Auth entry points (C, D, L, W, X) with banner visible first load.
- Pack 3: Legal/support navigation (U, AO) from footer + bottom dock.
- Pack 4: Create/edit flows (J, K, Y, Z) with slow network on upload steps.
- Pack 5: Resilience/quality (AG, AF, AP, T, R, S, AN).

## Product issues
- Value discovery is weakened because core content blocks fail to load without backend access; landing does not show featured routes.
- Cookie consent banner blocks critical actions (registration, footer nav) until dismissed.
- Navigation dead-ends (footer links) reduce confidence and task completion.

## Fixes applied during QA
- Added `/register` redirect to `/registration` to avoid 404s.
- Consent banner pointer-events updated to avoid blocking underlying links while still allowing accept actions.
- Consent banner hides when the mobile “Ещё” sheet is open to prevent click interception.
- Bottom dock “Ещё” items now navigate to privacy/cookies/about pages.
- Bottom dock “Ещё” sheet overlay z-index raised above the consent banner.
- `scripts/serve-web-build.js` now proxies `/api` and media paths to `https://metravel.by` to bypass CORS for QA.
- Registration page canonical now defaults to `/registration` when pathname is not available.
- Added `E2E_API_PROXY_INSECURE` option to allow proxying HTTPS without local cert issues.

## Evidence (console/network)
- CORS errors on `http://192.168.50.36/api/*` for pages `/`, `/travelsby`, `/roulette`, `/map`.
- Minified React error logs after failed API requests on the above pages.
- Proxy check: `/api/travels/`, `/api/travels/random/`, `/api/travels/of-month/`, `/api/filterformap/` return HTTP 200 via localhost proxy.
- Proxy check: `/api/getFiltersTravel/`, `/api/countriesforsearch/` return HTTP 200 via localhost proxy.
- Automation: `yarn lint`, `yarn test:run`, `yarn e2e` passed; e2e emitted proxy certificate warnings without `E2E_API_PROXY_INSECURE=true`.

## Automation coverage (new)
- Auth entrypoints: login -> registration link with visible cookie banner.
- Footer navigation: desktop footer items and mobile dock "Ещё" links navigate with banner visible.
- Core pages data: `/`, `/travelsby`, `/map`, `/roulette` validate API responses via proxy.

## Recommendations
- Configure CORS for `http://127.0.0.1:8086` or provide a local API proxy for QA.
- Ensure cookie banner does not block primary actions on auth and footer areas.
- Verify footer nav uses `Link`/`navigate` and click targets are not blocked by overlays.

## QA setup: local proxy to bypass CORS
- You поднимаешь прокси и CORS исчезает.
- Вариант A: vite / webpack devServer
```js
proxy: {
  '/api': {
    target: 'https://metravel.by',
    changeOrigin: true,
    secure: false,
  }
}
```
- Вариант B: локальный сервер статической сборки
  - Запуск: `E2E_API_PROXY_TARGET=https://metravel.by E2E_API_PROXY_INSECURE=true node scripts/serve-web-build.js`
  - Проксируемые пути: `/api`, `/uploads`, `/media`, `/gallery`, `/travel-image`, `/address-image`

## Retest checklist (after fixes)
- Run QA server with proxy enabled (`E2E_API_PROXY_TARGET=https://metravel.by E2E_API_PROXY_INSECURE=true`).
- Verify `/` loads popular/random/of-month content.
- Verify `/travelsby` filters populate and list items open details.
- Verify `/roulette` returns recommendations without console errors.
- Verify `/map` loads points and interacts with map controls.
- Verify login → registration flow works without dismissing the cookie banner.
- Verify footer navigation works when banner is visible.
- Verify bottom dock “Ещё” sheet items navigate correctly.
