# Rules

## Project scope

- Current project is `metravel2`.
- The app codebase root is `metravel2/` (the folder that contains `package.json`).
- Treat `docs/` (this folder) as the source of truth for development rules.
- Implementation ownership in this workspace is frontend/app/docs only. Backend/Django/API/server work in `../metravel-backend` or `area=back` is analysis-only: read source, run safe read-only probes, and create/update board tasks with evidence, but do not edit backend files, migrations, tests, settings, or server code from this repository. Do not run Git-changing operations in a backend checkout locally or on a server, including `add`, `commit`, `push`, `pull`, `merge`, `rebase`, `tag`, `checkout`, `reset`, `restore`, `stash`, or `clean`.
- If a frontend task depends on missing or broken backend behavior, leave a concrete blocker and link/create the `area=back` task instead of shipping a mock-only or silently failing frontend path.

## Application architecture and localization

- Metravel's active product surfaces are desktop web, mobile web, and Android.
  The repository may retain `ios/` and `.ios.*` scaffolding, but there is no
  current iOS/iPadOS application, so iOS is not a required QA, release-readiness,
  Done-gate, or `verify pending` surface until the user explicitly reactivates it.
- Before every task, record
  `Platform impact: desktop web | mobile web | Android | shared | none` and
  `Localization impact: all current locales | selected locales | none`.
  `none` must be a considered conclusion, not an omitted check.
- Shared components, hooks, services, API adapters, and state must preserve all
  affected active platforms. Platform files may adapt engines, permissions,
  safe areas, storage, or native APIs, but must not silently fork product behavior.
- Mobile web and Android are a coupled validation pair. If a change affects one,
  the task automatically includes the other and verifies the same scenario,
  state, locale, hierarchy, action order, key geometry, and touch semantics on both.
- The production locale registry is defined by `i18n/config.ts`; it currently
  contains RU/BE/UK/PL/EN with RU as default/fallback. `i18n/resources.ts` and the
  Russian resources define the typed namespace/key contract.
- Localize app-owned UI copy, accessibility text, validation, errors, toasts,
  empty states, legal/SEO/PDF UI, and display dictionaries. Do not client-translate
  user/editorial/API content, place names, comments, messages, or stable backend
  codes without a separate content-locale/API contract.
- Use `useTranslation()` from `@/i18n` in React code and the shared translation
  helpers outside React. Use `i18n/format.ts` for locale-sensitive formatting,
  plural selection, and collation; do not hardcode `ru-RU` or manual plural rules.
- Add every new translation key to all production locales in the same change.
  Preserve deterministic web SSR/hydration and the existing native locale/storage
  lifecycle; do not add locale URL prefixes or `hreflang` without a separate SEO
  routing contract.
- Any localization-impacting change must pass `npm run test:i18n` plus the normal
  feature checks. Shared native changes require separate mobile-web and Android
  evidence; one does not replace the other.

## Development workflow

- Before starting any change, review relevant files in `docs/`.
- Work only on the `main` branch by default:
  - check the current branch before editing;
  - do not create or switch to another branch unless the user gives a new explicit instruction;
  - if the current branch is not `main`, stop before making changes and ask how to proceed;
  - exception — harness-created auto-worktrees (`.claude/worktrees/*`, branch
    `claude/*` or detached HEAD): working there is allowed, but the work must
    not stay there. When the task is done, port the changes to the primary
    checkout, commit them on `main`, and leave no commits on the worktree
    branch that are absent from `main`.
- Protected project/release files (`eas.json`, `app.json`, `.github/workflows/`, `nginx/`, `plugins/`, `scripts/`, `public/robots.txt`, `public/sitemap.xml`, `entry.js`) require an explicit user request that puts the file or its behavior in scope. Do not change them as incidental cleanup.
- Before deploying to production, validate the local code in production-like conditions:
  - build a production web export (`dist/prod`)
  - run checks against that build (not against a dev server)
- After each logical change, run checks that match the scope of the change:
  - точечные, локальные изменения: запускай только релевантные проверки для затронутой области;
  - средние изменения: запускай релевантные тесты и линт для затронутых файлов/модулей;
  - крупные или сквозные изменения: обязательно запускай полный прогон:

```bash
npm run lint
npm run test:run
```

- Skipped tests are not allowed in the repository:
  - do not leave `it.skip`, `test.skip`, `describe.skip`, `xit`, or `xtest`;
  - if a test is broken, fix it, replace it with stable coverage at the correct level, or remove the obsolete test in the same task;
  - the green baseline is `0` skipped tests unless a documented project-level exception is explicitly added to `docs/`.

- If a task changes UI, layout, styling, visual states, or interaction behavior visible on web:
  - verify the changed scenario on desktop web and mobile web before considering the task complete;
  - take screenshots of the desktop and mobile-web result to confirm visual correctness;
  - check the browser console for errors (no new errors should appear after the change).
- If a task changes visible UI/layout/interaction on any active surface, also run
  the same scenario on a locally built Android app installed on the USB-connected
  phone. Visible UI completion therefore requires desktop web + mobile web +
  Android evidence unless a concrete environment blocker is reported.
- Always self-verify (mandatory):
  - the agent must verify its own changes end-to-end (browser and/or tests) before handoff — never defer verification to the user and never report a change as done/fixed while verification is still pending;
  - **never offload browser verification to the user.** Asking the user to scroll, hard-refresh, open devtools, run a console snippet, take a screenshot, or "tell me what you see" is NOT verification — it is offloading, and it is forbidden as a substitute for doing it yourself. The user reporting a bug is the input; confirming the fix in a browser is your job, not theirs;
  - if the preview/dev server is flaky (crashes, slow bundling, route redirects, transient API timeouts), restart it, wait, re-navigate, or retry until verification actually completes — instability is not an acceptable reason to skip verification;
  - if the default preview cannot reach or lay out the target (headless viewport reports `0`, RN-Web scrolls an inner container so `window.scrollTo`/IntersectionObserver never fire, the route is production-only, dev-SSR crashes on the page), you must exhaust an alternate self-verification path BEFORE declaring a blocker — e.g. build a local prod web export and serve it statically with a prod-API proxy (`Prod Static` / `Dist Prod` launch), drive it with Playwright/e2e, or device-verify on the real Android build. "The preview couldn't show it" is only a real blocker once every available path has actually been tried and reported;
  - when Android verification is relevant, assume a USB Android phone is connected to this workstation: run `adb devices -l` before marking Android unavailable; if a device is listed with status `device`, build Android locally, install that build to the phone, and test the needed scenario on it using `docs/MANUAL_TEST_CASES.md` `AND-USB-*` instead of asking the user to verify;
  - if a change genuinely cannot be verified after real effort (e.g. an environment blocker outside the code that no available path can bypass), say so explicitly, mark the item as `verify pending` with the concrete blocker AND the list of paths you already tried, and do not claim it is done.
- Authenticated QA (allowed):
  - for QA/testing that requires a signed-in user, you may sign in using the dedicated end-to-end test account from `.env.e2e` (`E2E_EMAIL` / `E2E_PASSWORD`);
  - prefer the e2e auth mechanism — the Playwright auth setup or a programmatic login (login API → `Authorization: Token <token>` injected into the store/headers) — over hand-typing credentials into UI fields, and reuse the e2e session where possible;
  - this is scoped to local/preview QA against the dev server only; never use it for destructive or irreversible actions;
  - never print, echo, log, screenshot, or commit the credential values — keep them only in `.env.e2e`.
- Android build/testing policy (mandatory):
  - Android EAS/cloud builds and submits are disabled: never run
    `eas build --platform android`, `eas submit --platform android` or an EAS
    `--platform all` command. Build Android locally with the project Gradle
    wrapper and publish only through the production-only Google Play API script;
  - the active closed-testing surfaces (`alpha`, `internal`, `beta`, testers,
    countries and their releases) are protected and must not be changed by the
    production release automation;
  - Android device QA requires a locally built Android app installed over USB on the connected phone, for example `cd android && ./gradlew :app:installDebug` or `:app:assembleDebug` plus `adb install -r ...`;
  - do not substitute mobile web viewport evidence, Expo web export, EAS preview/development/production builds, or dev-client/export flows for Android device validation without explicit user approval;
  - if local build/install is blocked, report the exact command, result, and next safe step instead of claiming Android verification passed.
- Do not start iOS simulator/device/EAS QA as an implicit path. iOS is inactive
  and excluded from current validation until a new explicit product decision.
- Task-board token recovery (mandatory):
  - if `/api/tasks/`, `/api/tasks/board/`, `/api/sprints/`, or the MCP `ticket-board` tools return `HTTP 401`, first refresh the staff DRF token with a programmatic login using the credentials from `.env.e2e` and the procedure in `docs/TASK_BOARD_MCP.md`;
  - write the refreshed token only to `.secrets/metravel-task-board.env`, never to chat, screenshots, committed files, or shell logs, then retry the board endpoints;
  - a local fallback draft is allowed only after token refresh fails or the refreshed token is not authorized, and it must still be synced to the board before handoff when access is restored.
- Dev media caveat:
  - in local dev, article/travel images may fail to load because content can come from production data while media files remain tied to production storage/CDN access;
  - do not treat this alone as a frontend bug and do not change app code only to “fix” dev-only missing production media;
  - fix real frontend regressions instead, such as broken navigation, scrollspy/highlight logic, rendering bugs, or invalid URL normalization introduced by frontend code.
 
- Always verify the changed scope before finishing the task.
  - For small, isolated changes, this can be a targeted lint/test check instead of the full suite.
  - For larger changes, use the full `npm run lint` and `npm run test:run` pass.
- Long-running operation coordination is mandatory:
  - deploys, release/build commands, production web builds, Android local/EAS builds or installs, server rebuilds/restarts, full/preflight checks, Playwright/e2e, Lighthouse, and any command that writes shared build/test artifacts are exclusive by operation type and target;
  - before starting one, check active processes and known locks for the same target, for example `ps`/`pgrep -af` matches for `build-prod.sh`, `deploy-frontend.sh`, `npm run`, `playwright`, `lighthouse`, `expo export`, `eas build`, `eas submit`, `gradlew`, `expo run:android`, `adb install`, `docker compose`, `nginx`, `systemctl`, plus lock files such as `dist/.prod-build.lock` or `.codex-temp/ops/*.lock`;
  - if another agent or terminal already runs the same deploy/build/rebuild target, do not start a duplicate. Reuse the active operation, wait only when its result is required by your scope, or report a blocker with PID, command, target, and the next safe action;
  - test/quality gates use a stricter non-waiting contract: when a live `.codex-temp/ops/quality-gate.lock` or active quality process exists, stop the attempted validation immediately. Do not wait, poll, monitor completion, retry after the lock is released, or start a narrower bypass test;
  - when the active gate's scope covers the current task and automated tests are its only remaining Done-gate step, report `validation delegated: active gate pid/name`; the task may be completed/closed without claiming that tests already passed. The active owner must fix real failures and rerun; if a failure cannot be resolved in that scope, the owner reopens the affected task or records a blocker;
  - when the active gate does not cover the touched scope, or deploy/browser/API/device/another validation step remains, report `validation skipped: active gate pid/name` and keep the task open. Other chats do not duplicate the active owner's work;
  - do not kill, restart, or replace another agent's process unless the user explicitly asked for it or a documented safe wrapper owns that cleanup;
  - if a lock is stale, confirm the process is gone or the lock exceeded its documented stale window before removing it;
  - broad gates (`npm run release:check`, `npm run check:preflight`, full `npm run test:run`, Playwright/e2e) are exclusive per workspace. Narrow unit tests may run only when they do not share the same server/build/output and no broad gate is already active.
  - project-owned test wrappers return exit code `0` with an explicit `SKIPPED` message when a live owner already holds the quality gate. This zero code is a coordination outcome, not green validation evidence; it can support `validation delegated` only under the conditions above.
- Store temporary debugging artifacts only in ignored local folders such as `.codex-temp/` or `.codex-debug/`.
  - Do not put ad-hoc screenshots, traces, logs, JSON reports, or throwaway QA output in tracked project folders.
  - Keep only artifacts that are still useful for the current task, and delete stale or unnecessary debug output before handoff.
- Always fix known real problems before handoff.
  - Treat failures, runtime errors, broken UI states, invalid external-link usage, dead imports, and regressions discovered in the touched area as part of the current task.
  - Do not leave known failing checks or broken behavior in the changed scope.
  - If a discovered issue is outside the task boundary, requires unavailable server/secret access, or would need a risky migration, document it as a blocker with the concrete risk and required next verification instead of silently ignoring it.
- Debug/output hygiene (mandatory):
  - do not place debug information, temporary screenshots, console dumps, ad-hoc JSON reports, QA captures, or other local investigation artifacts in the repository root;
  - such files must not be committed to git;
  - use ignored locations like `tmp/`, `artifacts/`, `test-results/`, `playwright-report/` or keep them outside the repository;
  - if a temporary debug file already appeared in the root or in git, remove it in the same task instead of leaving it behind.
- Task board tracking (mandatory):
  - frontend, backend, and cross-functional work items must be created on the shared MCP task board through `ticket-board`; see `docs/TASK_BOARD_MCP.md`;
  - task `area` is only `front` or `back` for active workflow: Android/native app
    bugs are `area=front` with `[AND-...]` context and paired mobile-web/Android
    validation in the title/description; use `area=back` only for backend/API/server work;
  - `blocked_by` is only for a task that cannot start or continue because a concrete hard dependency is unresolved. A completed implementation waiting for code review, QA, backend/deploy/production/API/browser/device evidence, or another Done-gate check stays in `review` or `testing`; a validation failure requiring code changes returns to `in_progress`;
  - never use `blocked_by` merely because a Done gate is incomplete, a reviewer/tester has not run yet, or production verification is pending. Link the true blocker task/gate only when it prevents implementation work itself;
  - every `area=front` or `area=back` board task must include the required Task Contract, sprint, dependencies, blockers, validation, and Done gate;
  - every new board task, including Android/native QA bugs filed as `area=front`, must be assigned to the current active sprint unless `docs/TASK_BOARD_MCP.md` defines a more specific active sprint rule;
  - do not create new local `tasks/*.md` task files as the normal workflow; local task files are only a temporary fallback/migration draft when the board is unavailable, and must be imported/synced to the board before handoff;
  - do not create ad-hoc backend task notes outside the board workflow.
- For performance checks (Lighthouse), run against a production web export:

```bash
npm run build:web:prod
npm run lighthouse:travel:mobile
npm run lighthouse:travel:desktop
```

- After deploying to production, validate performance against the real production URL (PageSpeed Insights or Lighthouse).
- Web caching policy (mandatory):
  - Do not re-introduce Service Worker runtime/static caching for web pages/assets.
  - Do not add user-facing flows that ask to "clear cache" after deploy.
  - Update rollout must be automatic (server headers + fresh build artifacts only).
  - Do not use client-side cache-bust/reload workarounds in runtime:
    - no forced `window.location.reload(...)` to recover from deploy mismatch,
    - no query-param cache busting like `?__r=` / `?__cb=` appended to JS/CSS URLs at runtime.
  - Do not add pre-hydration "self-heal" scripts that reload the page on version mismatch/chunk error.
  - Keep release consistency at the HTTP layer (Nginx/CDN headers + atomic static deploy), not via browser-side reload hacks.
  - Do not set `Cache-Control: immutable` for `/_expo/static/*.js` by default.
  - For Expo JS bundles/chunks, keep revalidation (`max-age=0, must-revalidate`) unless content-addressed hash stability is explicitly verified across releases.

### Code quality and simplicity (mandatory)

- Do not overcomplicate solutions. Prefer the simplest clear implementation that solves the task.
- Write code to be easy to read and maintain:
  - clear naming
  - small focused functions/components
  - predictable control flow
- Reuse existing components, hooks, helpers, and utilities before creating new ones.
- If you see clear duplication or overgrown logic, refactor to a simpler structure as part of the task.
- If you find unused code (dead imports, unused functions/components/files), remove it.
- If you find real errors or broken behavior during the task, fix them before handoff; only document a blocker when the fix is impossible in current scope or cannot be verified safely.
- Write and refactor code using current 2026 practices by default:
  - prefer up-to-date, actively supported framework and language patterns;
  - avoid legacy or deprecated approaches when a modern project-approved alternative exists;
  - if compatibility constraints force an older pattern, keep it local and document the reason in code or the relevant doc.

### Production Git-tracked file immutability (mandatory)

- AI agents working from this frontend workspace must never mutate a Git-tracked
  path in the production backend checkout. Explicit approval for a production
  deploy, recovery, Nginx change, or server investigation does not waive this
  rule.
- Before any explicitly authorized server write, inspect the checkout read-only:

```bash
git status --short
git ls-files --error-unmatch -- path/relative/to/checkout
```

  A successful `git ls-files` match means the path is tracked: stop before
  patching, overwriting, copying, moving, deleting, or changing its mode. Do not
  place backup copies inside the tracked checkout; use the documented external
  runtime/backup location when that write is explicitly authorized.
- If the production checkout is already dirty, do not clean, stash, reset,
  restore, checkout, pull, or deploy over it. Capture the exact path and a
  secret-safe diff summary, create/update an `area=back` or ops board task, and
  hand the canonical source change and normal deploy to the backend owner.
- The frontend deploy cleanliness gate has one exact, non-expanding exception
  for known production-owned runtime/ops artifacts: untracked
  `deploy/prod/nginx/ssl/`, untracked `dump.sql`, and the permission warning for
  `deploy/prod/postgis_1/data/`. Their presence or unreadability alone does not
  block the project-owned frontend deploy. Agents must not inspect their
  contents or read, copy, patch, overwrite, move, delete, chmod, back up, or
  otherwise mutate them. Any other status entry, tracked change, or warning is
  still a dirty-checkout stop condition. Intended frontend deploy targets must
  still be classified independently with `git ls-files` before the write.
- Tracked backend source/config changes must originate in the backend owner's
  canonical repository workflow and arrive through its normal reviewed deploy.
  This frontend workspace does not commit, push, merge, or deploy backend source.
- Project-owned frontend deploy scripts may mutate only their documented
  untracked runtime/static targets such as `static/dist`. Secret stores, runtime
  state, or external backup paths may be written only when explicitly authorized
  and must remain outside Git-tracked paths.

### Server path safety (mandatory)

- For explicitly authorized untracked runtime config only, never change a server
  file path unless existence is verified on the target host. Git-tracked server
  configs remain immutable under the rule above.
- This applies to all critical directives, including:
  - `ssl_certificate`, `ssl_certificate_key`, `ssl_trusted_certificate`
  - `root`, `alias`, `include`
  - `proxy_pass` targets and unix socket paths
- If path existence cannot be verified, do not modify the path; keep current value and mark as `needs server verification`.
- Before editing an allowed untracked Nginx/Apache runtime config, run checks on
  the server first:

```bash
# Example for SSL files:
sudo test -f /path/to/fullchain.pem && echo OK || echo MISSING
sudo test -f /path/to/privkey.pem && echo OK || echo MISSING
sudo test -f /path/to/chain.pem && echo OK || echo MISSING

# Example for web root:
sudo test -d /path/to/web/root && echo OK || echo MISSING
```

- Any allowed untracked runtime config change with path updates must be followed by:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Performance testing with metravel.by

Run Lighthouse directly against `https://metravel.by` to test real production performance.

**Step-by-step:**

```bash
# Desktop:
npx lighthouse https://metravel.by/ --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/search --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/map --preset=desktop --only-categories=performance --chrome-flags="--headless --no-sandbox"

# Mobile:
npx lighthouse https://metravel.by/ --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/search --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
npx lighthouse https://metravel.by/map --form-factor=mobile --screenEmulation.mobile --throttling.cpuSlowdownMultiplier=4 --only-categories=performance --chrome-flags="--headless --no-sandbox"
```

For **local builds** (before deploy), serve and test via Network IP (not `localhost` — CORS blocks it):

```bash
npm run build:web:prod
npx serve dist/prod -l 3000 -s
# Use the Network IP from the output, e.g. http://192.168.50.10:3000
```

**Budgets and evidence:**

- Не хранить здесь моментальные Lighthouse scores как «current»: baseline должен
  указывать абсолютную дату, URL/build и form factor.
- Числовые release budgets берутся из committed performance configs и guard
  defaults, а не из старого отчёта.
- Если порт занят, не убивать чужой процесс. Выбрать свободный порт либо
  дождаться владельца операции по operation-gate rule выше.
- JSON reports сохранять только в ignored `.codex-temp/`/`.codex-debug/` или
  системный temp и удалять, когда evidence больше не нужен.

### Timeout policy

- Do not use forced runtime/UI timeouts longer than `1000ms` to reveal content, hide skeletons, upgrade widgets, or "wait out" hydration/loading issues.
- If rendering or loading is unstable, fix the root cause:
  - remove duplicate requests
  - stabilize layout geometry
  - gate work on real events (`load`, `onLoad`, `IntersectionObserver`, user interaction, `requestIdleCallback`)
  - reserve space instead of delaying UI with timers
- Existing fallbacks in loading/hydration/render paths must stay at `<= 1000ms`.
- Network/request timeouts and explicit debounce/retry logic may exceed `1000ms` only when they are not used to mask UI readiness or visual instability.

### Web loading and hydration policy

- Do not treat Expo/Metro dev-network counts as production truth.
  - `localhost:8081/8082` may show extra `*.bundle?platform=web&dev=true...` requests that do not exist in `dist/prod`.
  - Real request-count, chunk-count, and Lighthouse decisions must be made from `npm run build:web:prod` or from the real production URL.
- Do not “fix” visual instability by adding delayed auto-reveal timers for:
  - headers
  - root chrome
  - hero upgrades
  - below-the-fold sections
  - post-LCP runtime widgets
- Above-the-fold UI must render from the critical shell on first paint.
  - Do not lazy-load desktop header, hero shell, or other first-screen chrome if that creates a second visual frame after the skeleton.
- All sections load immediately on page load — no delays, no waiting for scroll or interaction.
  - Show skeleton placeholders while content loads — page is never blocked.
  - No fallback timers, no IntersectionObserver gating — content starts loading right away.
- On travel pages, the web hero slider/background must appear immediately with the hero once runtime is ready.
  - Do not gate the slider/background on explicit click, pointer interaction, keyboard interaction, or scroll.
  - Keep the first rendered web hero visually complete from the start: main image, blurred side background, and slider chrome must arrive together.
  - This is the canonical behavior, not a temporary optimization.
  - Do not remove, downgrade, or defer the hero/slider blur backdrop just to improve Lighthouse or LCP metrics.
  - If a test expects the web hero slider/background to appear only after user interaction, the test is wrong and must be updated to assert the immediate-mount contract instead.
  - Do not re-introduce interaction-gated hero slider activation on web.
- Travel hero swipe and travel-details performance are one bilateral release contract. Any change in `components/travel/sliderParts/**`, `components/travel/details/**`, `ImageCardMedia`, hero overlays/decode gates, travel-details lazy/content-visibility behavior, or responsive image layout must pass both `npm run verify:slider` and `npm run verify:slider-perf`, each started through `scripts/run-with-quality-gate-lock.js`; one green side is not enough for handoff.
- When using preload scripts and React Query together, avoid duplicate first-load API requests.
  - Reuse the in-flight preload promise or preloaded payload instead of firing a second request for the same travel route.
- If a bug is visible only on web, verify it in a real browser flow.
  - Prefer Playwright or a headed browser capture over reasoning from code alone.
  - For visual loading bugs, inspect both DOM state and network state before changing timing logic.

## UI rules

### Component reuse

- Before creating new UI components or styles, check `components/ui` and existing feature components and reuse them.
- Add new components only when no existing component can be reasonably extended or composed.
- When adding buttons, icons, or small UI primitives, prefer existing `components/ui` primitives (`Button`, `IconButton`, `Chip`) over custom one-offs.
- Mobile layout parity is mandatory: mobile web and Android must use the same
  visual and interaction contract for the same user-facing flow. A change on
  either surface must be checked on both. Platform files may adapt technical map
  engines, safe areas, or native APIs, but must not introduce different UX,
  block order, primary actions, hero proportions, or tap behavior.
- Map/place/travel-point surfaces must reuse one point/place template whenever possible. The mobile popup/card contract is fullscreen inside the app content area with app header/footer still visible; the hero image takes about 70% of the card; below it are title/meta, coordinates with copy, article/page action when available, expandable navigation system choices, and existing save/add/share/route actions.
- The point/place navigation set must explicitly include Google Maps, Apple Maps, Organic Maps/offline, Waze, Яндекс Карты, Яндекс Навигатор, and OpenStreetMap where coordinates are available. Telegram/share is extra and must not replace map/navigation choices.
- Related travel state actions must be visible as text, not only as an unlabeled icon: "Был здесь", "Хочу поехать", "Планирую" or a compact "Был / Хочу / Планирую" affordance that opens those choices.
- On travel details, tapping a point card or its image focuses the map and highlights/raises the corresponding marker. It must not open the fullscreen popup automatically; the popup/card opens from an explicit marker tap/click on the map.

### External link policy

- Do not call `window.open(...)` directly in feature code.
- Do not call `Linking.openURL(...)` directly outside `utils/externalLinks.ts`.
- Use centralized helpers:
  - `openExternalUrl(...)` for standard external navigation.
  - `openExternalUrlInNewTab(...)` for web new-tab flows.
  - `openWebWindow(...)` only for low-level infrastructure cases (single chokepoint).
- CI enforcement:
  - `yarn guard:external-links`
  - `yarn governance:verify`
  - Canonical commands reference: `docs/TESTING.md#governance-commands`
- Allowlist expansion policy:
  - expanding guard allowlists is exceptional and must be temporary;
  - every allowlist expansion PR must include:
    - concrete business/technical reason,
    - risk statement,
    - rollback/removal plan,
    - owner and target removal date.

### Images and placeholders

- Show a placeholder when `imageUrl` is missing or image load fails.
- Placeholder must be neutral:
  - no icons
  - no text like “нет изображения”
  - no emoji
- no bright accent colors
- Placeholder must preserve the same geometry (size/radii) as the real media to avoid layout jumps.
- Images must preserve original aspect ratio (use `contain`) and any unused area should be filled by a blurred version of the same image.
- Published travel/article media (covers, rich-text description images, gallery images, and map-point photos) must be real photos, user-approved licensed photos, or photorealistic generated images saved as local raster files before upload.
  - Do not use flat SVG, Playwright screenshot, vector, icon-like, schematic, cartoon, generic illustration, or "photo-like" placeholder generation for these surfaces.
  - If a suitable photorealistic image cannot be generated or sourced, leave the media unchanged and report the blocker instead of uploading a stylized substitute.
- Article and quest content authority:
  - Codex may independently add, generate, upload, and insert images/media for articles, route points, and quests when requested.
  - Codex must not independently write, expand, rewrite, or creatively improve article/quest prose, tasks, hints, titles, SEO text, or other authored text.
  - If a requested article/quest task appears to require new or changed authored text, ask the user for explicit confirmation before doing the text work, even when the original request sounds direct.
- For web content images that intentionally use `contain + blurBackground` in cards, popups, inline rich-text media, map previews, and similar surfaces, enable the shared-source blur mode (`allowCriticalWebBlur` in `ImageCardMedia`, or `mediaProps.allowCriticalWebBlur` in `UnifiedTravelCard`).
  - The visible image and the blur backdrop must use the same effective image source whenever possible.
  - Sibling sections that use the same card/media pattern must not render different backdrop strength or timing.
  - Quest cover cards on `/quests` and quest CTA cards must keep a single effective web source for the visible image and blur backdrop (`optimizeWeb={false}` with `allowCriticalWebBlur`) unless a real iPhone Safari browser check proves the new source-selection path cannot show blur-only cards.
- On web, travel hero/gallery media and description images must use the canonical `70vh` height contract.
  - The travel hero slider container on web must resolve to `70vh` and keep that height stable across the first paint and slider handoff.
  - Apply the limit at the authoritative container/layout level, not via ad-hoc per-page overrides.
  - Keep `contain` rendering and blurred surround inside that bounded area.
- For critical web hero/slider media, the blurred surround must reuse the same effective image source as the visible image whenever possible.
  - Do not create a second “blur-only” URL for first-paint hero/slider backdrops if the same source image can be reused.
  - The goal is to avoid a separate background request arriving after the main image and causing a visible second-stage backdrop reveal.
- Blur backdrops must be present in the DOM from the first relevant frame.
  - Fix missing backdrop rendering by correcting source selection or component structure, not by delaying the main image or adding reveal timers.
  - Do not disable slider/hero blur backdrops as a performance optimization; preserve the visual contract and optimize requests/structure instead.
- Keep image geometry stable across skeleton, static hero, and slider handoff.
  - Do not let the slider/background path introduce a different aspect-ratio box or a late background mount.

### Rich-text embeds

- On web travel/article rich text, Instagram post/reel/tv embeds must render as visible embedded posts when the content contains a valid Instagram iframe or standalone post/reel/tv URL.
  - Do not replace valid Instagram post/reel/tv embeds with generic fallback cards on web.
  - Fallback cards are allowed only for Instagram URLs that cannot be reliably embedded, such as stories/highlights/profile links, invalid URLs, or contexts where iframes are not supported.
  - Sanitize and normalize iframe URLs through the existing rich-text pipeline; do not bypass sanitization to keep an embed.
  - When changing Instagram rich-text handling, add or update targeted tests and verify the changed web scenario in a real browser with no new console errors.

### Icons

- Avoid emoji in production UI.
  - This includes decorative glyphs used as icons/bullets: `●` (U+25CF), `▶`, `🗺️ 🧭 📖 ❤️`, etc. — not in badge text, not as `icon={<Body>▶</Body>}`, not in feature data arrays. Use a Feather icon instead (for a status dot: a small Feather icon in a `flexDirection: 'row'` container + text).
  - There is no automated guard for UI emoji — this is caught only by reading this section and by review.
- Use a single icon source across the UI (e.g. `@expo/vector-icons`).
  - Pick the brand-consistent icon for a concept, not a random Feather name: quests = flag (`flag` / nav `quest-map-person`), map = `map`/`map-fold` — so the set reads as a family and matches the tab bar / `components/layout/NavigationIcon.tsx`.
- Avoid SVG icon stacks (`react-native-svg`, `lucide-react-native`) in components rendered on web.

#### Allowed icon libraries

- **Preferred (safe on web + native)**
  - `@expo/vector-icons/Feather` (default choice)
- **Allowed with caution**
  - Other `@expo/vector-icons/*` families are allowed only if they are not stubbed for web in `metro-stubs/`.
  - If a family is stubbed (example: `metro-stubs/MaterialCommunityIcons.js`), importing that family on web may actually render a different icon set (and cause runtime errors when `name` does not exist).

#### Rules to avoid runtime icon errors

- Only use icon names that exist in the chosen family.
- Do not copy icon names between families (e.g. `"google-maps"` is not a valid Feather icon name).
- If you need a new icon family:
  - verify it renders correctly on web (no Metro stub override)
  - or use an existing Feather alternative.

#### Web interaction rule (nested buttons)

- On web, avoid putting `Pressable`/`button` elements inside other clickable containers that render as `button`.
- For popup/card action icons inside a clickable card, prefer rendering actions as a `View`/`div` with:
  - `role="button"`, `tabIndex=0`, `onClick`/`onKeyDown`
  - `data-card-action="true"` to prevent card click handlers
  - and `title` for hover tooltips.

### Colors

- Use design tokens (`DESIGN_TOKENS`) instead of hardcoded hex colors.
- Status colors (error/success/warning) must use tokens only.

## Design system

- Tokens live in `constants/designSystem.ts`.
- Web CSS variables live in `app/global.css`.

## Travel card rules

### Stable layout

- Cards must have stable, uniform height within the same list/section.
- Image area uses a fixed height; content area must not cause “jumping”.

### Content rendering

- Author is shown only if `user.name` or `user.display_name` is non-empty.
- Views are shown only if `countUnicIpView > 0`.
- If a field is absent from backend payload, its UI block must not render.

## Documentation rules

- Project documentation lives in `docs/`.
- Keep docs minimal: prefer updating `docs/README.md` and `docs/RULES.md` instead of creating many one-off reports.
- Keep instructions compact and operational:
  - prefer scope-based rules over repeated global commands;
  - avoid duplicate guidance when a single authoritative rule already covers the same behavior.
