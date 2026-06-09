# TASK-20260609-070: Long-lived SPA tabs keep serving the old web bundle after a deploy — add in-app new-version detection

Status: Backlog
Owner: Frontend
Support: Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Detect when a new front-end bundle has been deployed while a user's browser tab is still running the old bundle, and surface a non-intrusive "Update available" prompt so the user can reload and get the latest code without having to discover this themselves.

## Context

Long-lived SPA tabs (Expo Web / React Native Web) hold the old JavaScript bundle in memory indefinitely. Client-side navigation never triggers a full page load, so the browser never re-fetches the HTML entry point or new JS chunks, and users continue running stale code until they manually reload.

**Reproduced symptom (2026-06-09):** The owner kept a metravel.by tab open before a deploy. After navigating client-side (URL contained `?returnTo=…`), clicking a Tripster affiliate card opened the old destination URL (experience.tripster.ru homepage) instead of the new country-specific page (`/experience/belarus/`) introduced in commits c6da0709 and 62ed9a4c. The fix had been live on prod for some time but never reached the open tab.

**Cache headers on prod are correct — this is NOT a caching bug (verified 2026-06-09):**
- HTML pages (`/`, `/travels/<slug>`): `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` + ETag/Last-Modified.
- JS chunks (`/_expo/static/js/web/index-*.js`, `__common-*.js`): `Cache-Control: public, max-age=0, must-revalidate` + ETag.
- A fresh page load (F5 / new tab) always delivers the latest bundle. The problem is exclusively in already-open tabs that never reload.

**Deploy mechanics:** When a deploy happens, `static/dist` is atomically swapped on the server. Old `_expo/static` chunks are overlaid on top of the new build (open-tab safety — in-flight chunk requests from open tabs do not break). The entry chunk name (`index-<hash>.js`) may stay the same between deploys; the common chunk (`__common-<hash>.js`) changes and is referenced only from a fresh HTML response.

**Proposed solution (Frontend, open to iteration):**
- At build time, emit `dist/prod/version.json` containing a build hash or timestamp (build scripts live in `scripts/`).
- At web runtime, poll `/version.json` with `cache: 'no-store'` every 10–15 minutes and on `window focus` / `visibilitychange`.
- On version mismatch, show a non-blocking toast: «Доступна новая версия — Обновить»; on user click, call `location.reload()`.
- Alternatively, trigger a soft reload on the next client-side navigation (invisible to the user unless mid-interaction).
- Native platforms (iOS / Android): not affected — leave untouched; all version-check code must be gated behind `Platform.OS === 'web'`.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] After a deploy, an open browser tab detects the new version within 15 minutes OR on the next window focus/visibility event, whichever comes first.
- [ ] A non-blocking "Доступна новая версия — Обновить" prompt is shown; the user can dismiss it or click to reload.
- [ ] No forced automatic reload occurs while the user is actively typing, scrolling, or mid-interaction without their explicit action.
- [ ] Version polling is web-only (`Platform.OS === 'web'`); native builds are unaffected and no new code paths run on iOS/Android.
- [ ] The version-check HTTP request is lightweight (one small JSON file, < 1 KB), fires no more often than the configured interval, and is excluded from LCP/startup critical path (no blocking fetch on initial load).
- [ ] No regression in Lighthouse/LCP score: the check does not add any blocking resource to the page load waterfall.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run check:image-architecture` all pass green after the change.

## Gherkin Tests

```gherkin
Feature: New-version detection for long-lived SPA tabs

  Scenario: Tab open before deploy detects new version on focus
    Given a user has metravel.by open in a browser tab running bundle version "v1"
    And a new deploy has made bundle version "v2" available on the server
    When the user switches back to the metravel.by tab (window gains focus)
    Then a non-blocking toast "Доступна новая версия — Обновить" appears within seconds
    And no automatic reload occurs

  Scenario: User clicks the update prompt and gets the new bundle
    Given the "Доступна новая версия — Обновить" toast is visible
    When the user clicks "Обновить"
    Then the page reloads (location.reload())
    And after reload the tab runs the new bundle (the Tripster link opens the correct country page)

  Scenario: User dismisses the prompt
    Given the "Доступна новая версия — Обновить" toast is visible
    When the user dismisses the toast
    Then the toast disappears and no reload occurs
    And the toast does not reappear until the next version check interval

  Scenario: Tab on the same version as the server — no prompt
    Given the user's open tab is already running the latest bundle version
    When the version-check interval fires or the window gains focus
    Then no toast is shown and the page is not reloaded

  Scenario: Version check does not run on native platforms
    Given the app is running on iOS or Android (Platform.OS !== 'web')
    When the app is foregrounded or the check interval fires
    Then no HTTP request to /version.json is made
    And no update prompt is rendered
```

## Assignment

Primary owner: `dev-loop` or `travel-expert` (Frontend Developer)
Support agents:
- `test-author` — add/update Jest unit tests for the version-check hook and Playwright e2e smoke
- `$metravel-code-reviewer` — review diff before merge (check Platform guard, no LCP regression, no forced reload risk)
- Releaser — verify `/version.json` is emitted correctly in `dist/prod/` after `npm run build:web:prod`

## Likely Files Or Areas

- `scripts/` — build script that emits `dist/prod/version.json` (likely `scripts/build-web.sh` or equivalent)
- `hooks/useAppVersionCheck.ts` (new) — web-only polling hook (`Platform.OS === 'web'`, `visibilitychange`, interval)
- `components/ui/` or `components/common/` — lightweight UpdatePrompt/toast component (reuse existing toast infrastructure if present)
- `app/_layout.tsx` or top-level web entry — mount the version-check hook once
- `public/` or `dist/prod/version.json` — generated version marker file (must not be committed, must be generated at build time)
- `constants/` or `config/` — version-check interval constant and `/version.json` URL

## Plan

1. **Build step:** Extend the web build script (`scripts/`) to write `dist/prod/version.json` containing `{ "version": "<git-sha-or-timestamp>" }` immediately after the Expo export step. Confirm the file is served at `/version.json` via nginx static routes.
2. **Embed version at build time:** Inject the same version string into the bundle via an Expo/Metro constant or `EXPO_PUBLIC_BUILD_VERSION` env var so the running app knows its own version.
3. **Hook:** Create `hooks/useAppVersionCheck.ts`. Web-only (`if (Platform.OS !== 'web') return`). On mount, register `visibilitychange` and `focus` listeners + a `setInterval` (default 10 min). Each trigger: `fetch('/version.json', { cache: 'no-store' })`, compare to embedded version, set `needsUpdate` state on mismatch. Cleanup listeners on unmount.
4. **Prompt UI:** Create a small non-blocking toast/banner (`UpdatePromptBanner`) that appears at the bottom (above dock) when `needsUpdate` is true. Buttons: «Обновить» (`location.reload()`) and «×» dismiss. Re-use project color tokens and `StyleSheet`.
5. **Mount point:** Import and render `<UpdatePromptBanner />` (or call the hook) inside `app/_layout.tsx` web segment (or a dedicated web-only wrapper), ensuring it renders only once and outside the main navigation tree.
6. **Validation guards:** Run `npm run typecheck`, `npm run lint`, `npm run test:run`; add a Jest unit test for the hook logic (mock `fetch`, simulate version change); add a minimal Playwright smoke (version mismatch → prompt visible).
7. **Nginx:** Confirm `/version.json` is served from the static root with `Cache-Control: no-store` or very short max-age so polling always fetches fresh. Update nginx config via TASK if needed (separate TASK for nginx change — do not touch `nginx/` here).

## Validation

```bash
# 1. Build and verify version.json is generated
npm run build:web:prod
ls dist/prod/version.json       # must exist, must contain a "version" key

# 2. Type and lint checks
npm run typecheck
npm run lint

# 3. Unit tests
npm run test:run -- --testPathPattern="useAppVersionCheck|UpdatePromptBanner"

# 4. Full suite must stay green
npm run test:run

# 5. Manual browser smoke
# a) Build and serve dist/prod locally (via .claude/prod-server.js or equivalent)
# b) Note the current version from /version.json
# c) Manually edit dist/prod/version.json to a different value
# d) Wait <= 1 min (or tab out and back) — toast must appear
# e) Click "Обновить" — page reloads, no console errors

# 6. Confirm no fetch on native (check that no /version.json request appears in Expo Go or simulator network log)
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] `dist/prod/version.json` is generated at build time and NOT committed to git (add to `.gitignore` if not already excluded via `dist/`).
- [ ] `EXPO_PUBLIC_BUILD_VERSION` or equivalent env injection is documented in `.env.prod` / `.env` example comments (no secret).
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
