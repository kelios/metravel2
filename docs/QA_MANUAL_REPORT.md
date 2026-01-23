# Manual QA report (localhost)

## Scope & environment
- Target: localhost web build served from `dist` via `scripts/serve-web-build.js` on `http://127.0.0.1:8086`.
- Personas: guest (new user), registered user (attempted via UI), mobile (iPhone 12 viewport emulation).
- Note: backend requests from localhost to `http://192.168.50.36` are blocked by CORS in this environment; this impacted content-heavy pages.

## Summary
- Navigation works for browser back button, but footer navigation clicks did not navigate (likely due to banner overlay; fixed, needs retest).
- Multiple critical pages fail to load data due to CORS and show runtime React errors in console.
- Cookie consent banner overlapped key actions; pointer-events fix applied, needs retest.
- Login page “Зарегистрируйтесь” link was blocked by banner; fix applied, needs retest.
- `/register` route returns not found; redirect added.
- Bottom dock “Ещё” menu items did not navigate; fixed, needs retest.

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
  - Fixed by allowing pointer-events passthrough on non-interactive banner areas; needs retest.

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
  - Likely resolved by cookie banner fix; needs retest.

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
  - Fixed by cookie banner pointer-events update; needs retest.

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
  - Fixed by routing the “Ещё” sheet items; needs retest.

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
- Actual: not verified in this run.
- Problems: pending.

### Scenario R: SEO meta tags
- Steps: open `/`, `/travelsby`, `/map`, `/registration`, view page source.
- Expected: title/description/canonical present and correct.
- Actual: not verified in this run.
- Problems: pending.

### Scenario S: Cookies banner lifecycle
- Steps: open `/`, accept “Только необходимые”, reload.
- Expected: banner hidden on reload; consent persisted.
- Actual: not verified in this run.
- Problems: pending.

### Scenario T: Accessibility basics
- Steps: tab through header/nav/footer, check focus visibility.
- Expected: focus ring visible and order logical.
- Actual: not verified in this run.
- Problems: pending.

## Mobile checks (emulation)
- Scroll/viewport: no horizontal overflow detected on home.
- Navigation: same issues as desktop; footer navigation clicks do not navigate.
- Content: blocked by CORS like desktop, preventing main flows.

## Product issues
- Value discovery is weakened because core content blocks fail to load without backend access; landing does not show featured routes.
- Cookie consent banner blocks critical actions (registration, footer nav) until dismissed.
- Navigation dead-ends (footer links) reduce confidence and task completion.

## Fixes applied during QA
- Added `/register` redirect to `/registration` to avoid 404s.
- Consent banner pointer-events updated to avoid blocking underlying links while still allowing accept actions.
- Bottom dock “Ещё” items now navigate to privacy/cookies/about pages.

## Evidence (console/network)
- CORS errors on `http://192.168.50.36/api/*` for pages `/`, `/travelsby`, `/roulette`, `/map`.
- Minified React error logs after failed API requests on the above pages.

## Recommendations
- Configure CORS for `http://127.0.0.1:8086` or provide a local API proxy for QA.
- Ensure cookie banner does not block primary actions on auth and footer areas.
- Verify footer nav uses `Link`/`navigate` and click targets are not blocked by overlays.

## Retest checklist (after fixes)
- Verify `/` loads popular/random/of-month content.
- Verify `/travelsby` filters populate and list items open details.
- Verify `/roulette` returns recommendations without console errors.
- Verify `/map` loads points and interacts with map controls.
- Verify login → registration flow works without dismissing the cookie banner.
- Verify footer navigation works when banner is visible.
- Verify bottom dock “Ещё” sheet items navigate correctly.
