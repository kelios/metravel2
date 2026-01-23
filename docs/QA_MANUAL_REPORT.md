# Manual QA report (localhost)

## Scope & environment
- Target: localhost web build served from `dist` via `scripts/serve-web-build.js` on `http://127.0.0.1:8086`.
- Personas: guest (new user), registered user (attempted via UI), mobile (iPhone 12 viewport emulation).
- Note: backend requests from localhost to `http://192.168.50.36` are blocked by CORS in this environment; this impacted content-heavy pages.

## Summary
- Navigation works for browser back button, but footer navigation clicks did not navigate.
- Multiple critical pages fail to load data due to CORS and show runtime React errors in console.
- Cookie consent banner overlaps key actions and blocks pointer interactions until dismissed.
- Login page “Зарегистрируйтесь” link does not navigate to registration.
- `/register` route returns not found; only `/registration` exists.

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

### 2) Cookie banner overlaps key actions (login/register, footer nav)\n- Severity: major\n- Steps:\n  - Open `/login` and try clicking “Зарегистрируйтесь”.\n  - Open `/` and try clicking footer nav items.\n- Expected:\n  - Links are clickable without requiring extra steps.\n- Actual:\n  - Cookie banner overlays the link area (elementFromPoint hits banner), blocking pointer events.\n- Impact:\n  - Users cannot navigate unless they dismiss the banner first.\n\n### 3) Footer navigation items do not navigate
- Severity: major
- Steps:
  - On home page, click footer items (Travels, Map, Roulette).
- Expected:
  - SPA route changes to `/travelsby`, `/map`, `/roulette`.
- Actual:
  - Path remains `/`.
- Impact:
  - Core navigation is blocked from the primary UI controls.

### 4) “Зарегистрируйтесь” link on login does not navigate (blocked by banner)\n- Severity: major\n- Steps:\n  - Open `/login`.\n  - Click “Зарегистрируйтесь” without dismissing cookie banner.\n- Expected:\n  - Navigate to `/registration`.\n- Actual:\n  - Remains on `/login` because click is intercepted by the banner.\n- Impact:\n  - Registration entry point appears broken.

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
