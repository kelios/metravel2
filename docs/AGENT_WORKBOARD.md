# Agent workboard

Last updated: 2026-05-22

Scope: testing and fixing the travel details page.

Local visual board: open `docs/AGENT_WORKBOARD_LOCAL.html` from the repository on the local machine. This HTML board is local-only, stores status changes in browser `localStorage`, and is not part of the production Expo app.

Board truth rule: a task can be treated as `Done` only when it has evidence: changed files, test/browser validation, review, or an explicit docs-only artifact. The local HTML board is a display surface; this Markdown file remains the canonical evidence journal.

Team rituals:

- Daily standup: every day at 10:00, thread heartbeat automation `Metravel agent daily standup`.
- Sprint planning: every Monday at 10:30, workspace automation `Metravel weekly sprint planning`.
- Monthly retro: last Friday of each month at 16:00, workspace automation `Metravel monthly retro`.

## Sprint Planning

Sprint: `Travel QA Stabilization`.

Planning date: 2026-05-22.

Sprint dates: 2026-05-22 through 2026-05-29.

Sprint goal:

- Close approval blockers for `T-010` through `T-014`.
- Prepare developer-ready scope for travel page fixes.
- Align QA, UX, SEO, and BA acceptance criteria before implementation.

Capacity:

- Active sprint roles: Мариночка (QA), Мариночка (Manual QA), Мариночка (QA Analyst), UI/UX Designer, Крина (Business Analyst), Ромик (Dev), Сео (SEO Engineer).
- Support roles: Андриуш (Manager/Approver/Backlog Manager/Reviewer), Витаутас (DevOps).

Committed scope:

- `T-010` authenticated manual QA for favorite, rating, and comments write flows.
- `T-011` manual test cases for travel details web/mobile.
- `T-012` Instagram rich-text expected behavior decision and e2e alignment.
- `T-013` neutral hero media placeholder design decision.
- `T-016` business requirements and acceptance criteria for travel QA fixes.
- `T-017` technical fix plan for confirmed travel QA findings.

Stretch scope:

- `T-014` mobile overlays and touch target audit.
- `T-020` travel page SEO metadata/schema audit.
- Implementation patch by Ромик (Dev) after approved spec/design.

Planning decisions:

- Андриуш (Approver) owns readiness approval before implementation.
- `T-010` through `T-014` are approved to start discovery/testing/design work in this sprint.
- Крина (Business Analyst) owns acceptance criteria.
- Мариночка (QA) owns QA evidence and retest plan.
- UI/UX Designer owns `D-001` and `D-002` design direction.
- Ромик (Dev) starts code patch only after design/spec approval.
- Витаутас (DevOps) watches automations, e2e artifacts, and local server health.
- Сео (SEO Engineer) reviews SEO risks before final validation.

Non-goals:

- Production deploy is not included in this sprint unless explicitly requested later.
- Ромик (Dev) does not start implementation for `D-001` or `T-012` until spec/design output is accepted.

Planning risks:

- `T-012` remains the main blocker because old e2e expectations conflict with the project rule for valid Instagram embeds.
- `D-001` needs a designer decision before code changes because the current visible text placeholder violates the neutral-placeholder rule.
- Authenticated manual QA depends on `.env.e2e` access being available without exposing secrets.

## Status board

| Track | Owner | Status | Current output | Next action |
| --- | --- | --- | --- | --- |
| Team coordination | Андриуш (Manager) | In progress | Staffing, role status, delivery coordination | Keep idle roles visible and assign next work |
| Approval gate | Андриуш (Approver) | In progress | Approves scope, design decisions, QA findings, and developer-ready tasks | Define and enforce task readiness flow |
| Scope and requirements | Крина (Business Analyst) | In progress | QA scope, user stories, acceptance criteria, bug severity priorities | Clarify Instagram expected behavior and implementation acceptance gates |
| Backlog management | Андриуш (Backlog Manager) | In progress | Convert QA/design findings and idle capacity into prioritized backlog | Keep next work ready for every role |
| Code readiness | Ромик (Dev) | In progress | Relevant files, risk zones, targeted test map; technical fix plan opened | Prepare implementation approach for D-001 and T-012 |
| DevOps health | Витаутас (DevOps) | In progress | Local automation, scheduled rituals, and workboard health | Watch e2e artifacts, automations, and local server state |
| SEO engineering | Сео (SEO Engineer) | In progress | Travel page metadata, schema, OG, canonical, and SEO checks | Audit SEO health and hand off implementation recommendations |
| Visual contract | UI/UX Designer | In progress | Web/mobile UI contract and visual QA checklist; new designer audit tasks opened | Review screenshots and prioritize UX polish tickets |
| Browser QA | Мариночка (QA) | In progress | E2E detail tests passed; duplicate initial request bug candidate found; extended web/mobile pass started | Run extended travel detail, layout, comments, and rich-text checks |
| Manual test cases | Мариночка (QA Analyst) | Open | Manual test-case backlog needed for web/mobile travel details | Write reusable manual cases with steps, expected result, priority, and evidence fields |
| Manual QA | Мариночка (Manual QA) | In progress | Guest/manual pass completed; authenticated pass opened | Test signed-in favorite/rating/comments write flows |
| Bug triage | Orchestrator | Done | F-001 and comments 404 console issue triaged | Keep board updated for new findings |
| Implementation | Ромик (Dev) | Done | Fixed travel detail preload reuse and comments empty-state request path | Reviewer check if needed |
| Re-test | Мариночка (QA) | Done | F-001 and comments request checks passed locally | Monitor future manual QA findings |
| Review | Андриуш (Reviewer) | Done | Reviewer caught incomplete F-001 fix; follow-up fix applied and re-tested locally | Re-review on next diff if requested |
| Final validation | Orchestrator | In progress | Targeted tests and local e2e browser checks completed for previous loop | Complete extended web/mobile QA loop |

## Role rules

- Андриуш (Manager), QA, Manual QA, UI/UX Designer, and Reviewer do not edit code.
- Ромик (Dev) edits only confirmed bugs from QA or explicitly approved fix tasks.
- Existing unrelated dirty changes must not be reverted or mixed into this task.
- Temporary screenshots, traces, logs, and QA artifacts belong only in ignored local folders.
- Visible UI fixes require browser verification, screenshot, and console check before handoff.

## Confirmed context

- Branch: `main`.
- Project rules read: `AGENTS.md`, `docs/RULES.md`, `docs/CODEX.md`, `docs/README.md`.
- Active page area: travel details page, especially `app/(tabs)/travels/[param].tsx` and `components/travel/details/*`.
- Existing dirty files at board creation:
  - `__tests__/components/profile.test.tsx`
  - `app/(tabs)/profile.tsx`
  - `components/profile/ProfileTabs.tsx`

## Acceptance checklist

- Travel page opens from direct URL and from travel cards without blank screen or infinite loader.
- Web hero is complete after runtime-ready: main media, blurred background, and slider chrome appear together.
- Missing local development media does not collapse layout or show non-neutral placeholders.
- Desktop and mobile layouts have no overlapping UI, clipped button text, or horizontal overflow.
- Rich text and supported Instagram post/reel/tv embeds render correctly on web.
- Favorite, rating, comments, share, map, points, nearby/recommended, and navigation states are tested.
- Browser console has no new runtime errors in the tested scenarios.
- External links use centralized helpers, not direct `window.open(...)` or direct `Linking.openURL(...)`.

## Open tasks

| ID | Task | Owner | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| T-001 | Complete browser QA for travel details desktop and mobile | Мариночка (QA) | Done | E2E/browser QA pass | `40 passed`; duplicate initial request bug candidate found |
| T-002 | Complete manual user-flow QA for travel details desktop and mobile | Мариночка (Manual QA) | Done | Manual QA pass | Guest/manual pass completed; authenticated pass remains separate |
| T-003 | Triage duplicate initial travel detail requests | Orchestrator | Done | Finding/root cause logged | Root cause: concurrent guest consumers could start separate detail requests |
| T-004 | Fix confirmed travel details bugs | Ромик (Dev) | Done | Code changed + tests logged below | Shared direct preload reuse; comments read by `travel_id` |
| T-005 | Re-test fixed scenarios | Мариночка (QA) + Мариночка (Manual QA) | Done | Browser re-test | Browser checks passed on local e2e build |
| T-006 | Review final diff and validation | Андриуш (Reviewer) | Done | Review note | Initial review blocked F-001; final local browser check passed after follow-up |
| T-007 | Run extended web QA for travel details and related public flows | Мариночка (QA) | In progress | Evidence pending | Cover desktop Chrome travel details, interactions, comments, Instagram rich text, responsive layout |
| T-008 | Run extended mobile-web QA for travel details and related public flows | Мариночка (QA) | In progress | Evidence pending | Cover `390x844` mobile viewport, horizontal overflow, clipped actions, sticky/navigation states |
| T-009 | Create designer UX/UI audit backlog from QA evidence | UI/UX Designer | In progress | Visual audit evidence exists; backlog still active | Find concrete visual, hierarchy, touch-target, empty-state, and mobile polish work |
| T-010 | Run authenticated manual QA for write flows | Мариночка (Manual QA) | Open | No execution evidence yet | Sprint approved to start; use `.env.e2e`; cover favorite, rating, comment create/edit/delete, author-only actions |
| T-011 | Write manual test cases for travel details web/mobile | Мариночка (QA Analyst) | Open | No execution evidence yet | Sprint approved to start; include prerequisites, steps, expected result, priority, viewport, and evidence checklist |
| T-012 | Align Instagram rich-text e2e expectation with project rules | Мариночка (QA Analyst) + Ромик (Dev) | Open | Spec evidence pending | Sprint approved to start; current e2e expects fallback cards, while rules require iframe embeds for valid post/reel/tv URLs |
| T-013 | Redesign missing hero media state for travel details | UI/UX Designer + Ромик (Dev) | Done | Changed files: `components/travel/details/TravelDetailsOptimizedLCPHero.tsx`, `__tests__/components/travel/TravelDetailsContainer.performance.web.test.tsx`; validation: targeted Jest, `npm run check:fast`, Playwright hero smoke | Fixed in code: travel hero fallback is now a neutral geometry-preserving placeholder with no visible text/icons |
| T-014 | Audit mobile bottom overlays and touch target sizes | UI/UX Designer | Open | No execution evidence yet | Stretch approved to start if capacity remains; cookie banner, bottom nav, sticky section tabs, and several actions need mobile spacing/touch-target review |
| T-015 | Form and groom backlog from QA/design findings | Андриуш (Backlog Manager) | In progress | Backlog evidence pending | Convert findings, manual cases, and idle capacity into prioritized implementation-ready tasks |
| T-016 | Write business requirements and acceptance criteria for travel QA fixes | Крина (Business Analyst) | In progress | Requirements evidence pending | Separate product requirements, user stories, non-goals, risks, and acceptance criteria from manager coordination |
| T-017 | Prepare technical fix plan for travel QA findings | Ромик (Dev) | In progress | D-001 code done; T-012 plan pending | Locate files and prepare implementation approach for T-012 Instagram e2e alignment |
| T-018 | Approve and govern task readiness flow | Андриуш (Approver) | In progress | Approval evidence pending | Define who approves requirements, design, QA findings, and developer-ready tickets before implementation |
| T-019 | Keep local QA automation and workboard health green | Витаутас (DevOps) | In progress | Automation evidence pending | Watch local board, e2e artifacts, scheduled rituals, and automation health for the team |
| T-020 | Audit travel page SEO metadata and schema health | Сео (SEO Engineer) | In progress | SEO audit evidence pending | Review canonical, title, description, OG tags, schema.org, and SEO e2e coverage for travel details |
| T-021 | Create cross-page QA acceptance matrix | Крина (Business Analyst) | In progress | Requirements pending | Acceptance criteria for Search, Home, Map, Places, Quests, and PDF/export before implementation starts |
| T-022 | Write manual test cases for next-page QA wave | Мариночка (QA Analyst) | In progress | Test cases pending | Reusable cases for Search, Home, Map, Places, Quests, PDF/export with prerequisites, steps, expected results, viewport, and evidence fields |
| T-023 | Run Search page web and mobile QA pass | Мариночка (QA) | Done | `e2e/search.spec.ts` chromium: 1 passed; local `/search` desktop 1440x900 and mobile iPhone 13 passed with `overflowX=false`, consoleErrors=0, pageErrors=0 | Search input, filtered empty/results state, desktop/mobile layout, horizontal overflow, and console/page errors verified |
| T-024 | Run Home page web and mobile QA pass | Мариночка (QA) | Done | `e2e/home-quick-filters-nightstay.spec.ts` chromium: 1 passed; local `/` desktop 1440x900 and mobile iPhone 13 passed with `overflowX=false`, consoleErrors=0, pageErrors=0 | Home title/h1, quick filters, Home -> Search filter navigation, desktop/mobile layout, horizontal overflow, and console/page errors verified |
| T-025 | Run Map page web and mobile QA pass | Мариночка (QA) | In progress | Browser evidence pending | Map load, markers, filters, popups, route interactions, mobile controls, and external links |
| T-026 | Run Places page web and mobile QA pass | Мариночка (QA) | In progress | Browser evidence pending | Places catalog, country/category/search filters, cards, map focus links, incremental loading, and mobile layout |
| T-027 | Run Quests page web and mobile QA pass | Мариночка (QA) | In progress | Browser evidence pending | Quest list/detail/start flows, media states, map dependencies, responsive layout, and console errors |
| T-028 | Run PDF/export QA pass | Мариночка (Manual QA) | In progress | Manual evidence pending | PDF/export entry points, generated output, loading/errors, and permissions without exposing secrets |
| T-029 | Create UX/UI audit for next-page QA wave | UI/UX Designer | In progress | Screenshot audit pending | Search, Home, Map, Places, Quests, PDF/export hierarchy, touch targets, overlays, placeholders, and responsive polish |
| T-030 | Run SEO audit for indexable pages | Сео (SEO Engineer) | In progress | SEO audit pending | Titles, descriptions, canonical, OG, schema, indexability, and SEO e2e coverage |
| T-031 | Prepare implementation queue for confirmed page findings | Ромик (Dev) | In progress | Dev readiness pending | Confirmed QA/design/SEO findings become fix-ready diffs only after acceptance criteria and repro |
| T-032 | Review cross-page QA findings and fix readiness | Андриуш (Reviewer) | In progress | Review evidence pending | Duplicates, severity, owner, acceptance criteria, validation plan, and project-rule compliance |
| T-033 | Prepare multi-page e2e and local environment health plan | Витаутас (DevOps) | In progress | Automation evidence pending | Stable e2e server/build health, selective commands, no stale artifacts or stuck servers |
| T-034 | Maintain cross-page backlog and capacity board | Андриуш (Backlog Manager) | In progress | Backlog evidence pending | All findings assigned, prioritized, evidence-tagged, and ready for weekly planning |
| T-035 | Run mobile manual smoke for Search, Home, Map, Places, Quests | Мариночка (Manual QA) | In progress | Manual mobile evidence pending | Tap targets, navigation, overlays, scroll behavior, and screenshots/evidence notes |
| T-036 | Write Search page test cases | Мариночка (QA Analyst) | In progress | Test cases pending | Query, filters, sorting, pagination/infinite load, empty state, deep links, and mobile variants |
| T-037 | Create Search page UX audit | UI/UX Designer | In progress | Screenshot audit pending | Filter ergonomics, result cards, empty states, touch targets, and mobile filter access |
| T-038 | Run Search page SEO audit | Сео (SEO Engineer) | In progress | SEO audit pending | Title, description, canonical, indexability, schema risk, and e2e coverage notes |
| T-039 | Prepare Search findings for development | Ромик (Dev) | Open | Code evidence pending | Wait for QA/BA/design evidence; then map confirmed findings to target files and validation commands |
| T-040 | Write Home page test cases | Мариночка (QA Analyst) | In progress | Test cases pending | First load, hero, navigation to details/search/map, degraded data, and responsive sections |
| T-041 | Create Home page UX audit | UI/UX Designer | In progress | Screenshot audit pending | Hierarchy, cards, media placeholders, CTAs, section spacing, and mobile bottom/nav overlap |
| T-042 | Run Home page SEO audit | Сео (SEO Engineer) | In progress | SEO audit pending | Metadata, OG, heading structure, internal links, and structured data risks |
| T-043 | Write Map page test cases | Мариночка (QA Analyst) | Open | Test cases pending | Geolocation allowed/denied, marker click, popup, filters/search, route interactions, and error state |
| T-044 | Create Map controls UX audit | UI/UX Designer | Open | Screenshot audit pending | Touch targets, popup layout, map controls, overlays, and mobile gesture conflicts |
| T-045 | Write Places page test cases | Мариночка (QA Analyst) | Open | Test cases pending | List, filters, place card, map relation, missing media, empty state, and incremental loading |
| T-046 | Run Places SEO audit | Сео (SEO Engineer) | Open | SEO audit pending | Metadata, canonical, OG, schema notes, and indexability for Places surfaces |
| T-047 | Write Quests page test cases | Мариночка (QA Analyst) | Open | Test cases pending | List, detail, start/resume where available, locked/empty/error states, and media handling |
| T-048 | Create Quests UX audit | UI/UX Designer | Open | Screenshot audit pending | Quest flow clarity, cards, next-action states, empty states, and dead-end prevention |
| T-049 | Write PDF/export test cases | Мариночка (QA Analyst) | Open | Test cases pending | Export entry points, permissions, loading, error, generated output, and download/result verification |
| T-050 | Prepare PDF/export findings for development | Ромик (Dev) | Open | Code evidence pending | Only confirmed PDF/export bugs with repro, expected result, target files, and validation enter implementation |
| T-051 | Run cross-page review gate | Андриуш (Reviewer) | Open | Review evidence pending | Deduplicate findings, verify severity, reject vague bugs, and approve implementation-ready tasks |
| T-052 | Keep new sprint evidence and e2e health green | Витаутас (DevOps) | In progress | Board/e2e evidence pending | Board shows active work, no fake Done, evidence required for every closed task, and e2e setup remains stable |
| T-053 | Cross-page implementation lane | Ромик (Dev) | Blocked | Waiting for QA/BA/design evidence | Starts only after approved bug/spec/design output from T-023 onward |
| T-054 | Create cross-page final regression plan | Крина (Business Analyst) + Мариночка (QA Analyst) | Open | Regression plan pending | One reusable release checklist covers web/mobile/page-specific risks before final regression |

## Findings

### F-001 Duplicate initial travel detail requests

- Severity: medium.
- URL: `/travels/kostel-svyatogo-antoniya-paduanskogo`.
- Viewports: desktop `1440x900`, mobile `390x844`.
- Expected: one initial request or reuse of preload/in-flight promise.
- Actual: desktop observed 3-4 duplicate GET requests to `/api/travels/by-slug/kostel-svyatogo-antoniya-paduanskogo/`, including one aborted request; mobile observed 3 duplicate GET requests.
- Candidate files: `hooks/useTravelDetails.ts`, `api/travelDetailsQueries.ts`, `app/+html.tsx`.
- Fix: direct API preload payload is retained and reused by `useTravelDetails` and guest `fetchTravel` / `fetchTravelBySlug` callers, preventing duplicate React-side detail requests.
- Status: fixed and locally re-tested.

### F-002 Comments main-thread 404 console noise

- Severity: medium / P2.
- URL: `/travels/11-makarska-otdykh-u-moria-doroga-domoi-cherez-karlovats-i-venu`.
- Expected: empty comments state renders without `GET /api/travel-comment-threads/main/?travel_id=...` 404 console noise.
- Actual: manual QA observed `GET /api/travel-comment-threads/main/?travel_id=527` returning 404 while the UI rendered "Пока нет комментариев".
- Fix: comments read path now fetches public comments directly by `travel_id`; it no longer probes main-thread metadata for the normal travel details read state.
- Status: fixed and locally re-tested.

### F-003 Instagram rich-text e2e spec mismatch

- Severity: medium / QA blocker.
- URL: mocked `/travels/e2e-instagram-rich-text`.
- Expected by project rules: valid Instagram post/reel/tv rich-text links render as embedded Instagram content on web.
- Actual e2e expectation: `e2e/travel-instagram-rich-text.spec.ts` waits for `.rich-social-card--instagram` fallback cards and expects zero Instagram iframes.
- Observed DOM: `.travel-rich-text` contains an iframe and no fallback card.
- Status: open; update test/spec after product confirmation. Do not treat iframe rendering as a frontend regression without changing the rule.

### D-001 Missing hero media placeholder is not neutral

- Severity: medium / UI polish.
- URL: `/travels/kostel-svyatogo-antoniya-paduanskogo`.
- Viewports: desktop `1440x900`, mobile `390x844`.
- Expected: missing local/dev media preserves geometry with a neutral placeholder, no text, icons, or decorative message.
- Actual: large hero area renders visible text `Фото недоступно`.
- Owner: UI/UX Designer for design direction, Ромик (Dev) for implementation.
- Fix: `components/travel/details/TravelDetailsOptimizedLCPHero.tsx` now renders an empty neutral placeholder with preserved geometry and no role/aria label/visible text when the LCP image fails.
- Status: fixed and locally verified.

### D-002 Mobile overlays and touch targets need designer review

- Severity: low / UX polish.
- URL: `/travels/kostel-svyatogo-antoniya-paduanskogo`.
- Viewport: mobile `390x844`.
- Evidence: visual audit found several action targets around `33-38px` high (`Подписаться`, `Написать`, section tabs), Leaflet controls at `30x30`, and cookie banner competing with bottom navigation/content.
- Expected: mobile controls meet comfortable touch target sizing and overlays do not hide key actions.
- Owner: UI/UX Designer.
- Status: open.

## Validation log

- `npm run check:fast:dry` showed the current dirty working tree is limited to existing profile-related files at the time of the dry run.
- `npx playwright test e2e/open-travel.spec.ts --project=chromium --workers=1` passed: travel details page can open from the travel list smoke flow.
- QA reported `npx playwright test e2e/travel-detail-page.spec.ts e2e/travel-detail-interactions.spec.ts e2e/travel-rating.spec.ts --project=chromium --workers=1` passed: `40 passed`.
- `npm run test:run -- __tests__/api/travels.test.ts` passed: `69 passed`.
- `npm run test:run -- __tests__/hooks/useTravelDetails.test.ts` passed: `11 passed`.
- `npm run test:run -- __tests__/components/CommentsSection.test.tsx __tests__/api/comments.test.ts` passed: `39 passed`.
- `npx playwright test e2e/open-travel.spec.ts --project=chromium --workers=1` passed after F-001 fix.
- Local e2e build browser check for F-001 passed: mobile direct travel URL emitted one `/api/travels/by-slug/kostel-svyatogo-antoniya-paduanskogo/` request, initiated by `travel-hero-preload.js`.
- Local e2e build browser check for F-002 passed: comments section emitted no `/api/travel-comment-threads/main/` request and one `/api/travel-comments/?travel_id=527` request; no critical errors.
- Extended web QA: `E2E_FORCE_REBUILD=1 E2E_API_PROXY_INSECURE=true EXPO_PUBLIC_E2E=true npx playwright test e2e/travel-detail-page.spec.ts e2e/travel-detail-interactions.spec.ts e2e/travel-comments.spec.ts e2e/travel-instagram-rich-text.spec.ts e2e/layout-responsive.spec.ts --project=chromium --workers=1` returned `47 passed`, `1 flaky`, `1 failed`.
- Extended QA failure: `e2e/travel-instagram-rich-text.spec.ts` failed because it expects Instagram fallback cards, while the rendered page contains an iframe; logged as F-003.
- Extended QA flaky: `e2e/layout-responsive.spec.ts` first run timed out with `AggregateError: All promises were rejected`, retry passed.
- Visual audit script: `.codex-temp/travel-visual-audit.mjs`.
- Visual audit evidence: `.codex-temp/travel-visual-audit/desktop-top.png`, `.codex-temp/travel-visual-audit/mobile-top.png`, `.codex-temp/travel-visual-audit/desktop-scrolled.png`, `.codex-temp/travel-visual-audit/mobile-scrolled.png`, and `.codex-temp/travel-visual-audit/report.json`.
- Visual audit result: no horizontal overflow on desktop or mobile; internal scroll container is `travel-details-scroll`; missing media placeholder and mobile touch-target/overlay polish logged as D-001 and D-002.
- D-001 code verification: `npm run test:run -- __tests__/components/travel/TravelDetailsContainer.performance.web.test.tsx` passed: `4 passed`.
- D-001 scope verification: `npm run check:fast` passed: targeted app tests `199 passed`, external-link guards passed.
- D-001 browser verification: `E2E_FORCE_REBUILD=1 E2E_API_PROXY_INSECURE=true EXPO_PUBLIC_E2E=true npx playwright test e2e/travels.spec.ts --project=chromium --grep "should display hero image" --workers=1` passed: `1 passed`.

## Manual test cases backlog

| ID | Priority | Viewport | Scenario | Steps | Expected result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| MTC-001 | P1 | Desktop + mobile | Open public travel details by direct URL | Open `/travels/kostel-svyatogo-antoniya-paduanskogo`; wait for hero and main content | No blank screen; title, author, hero area, meta chips, navigation, and key sections render | Screenshot + console log |
| MTC-002 | P1 | Mobile `390x844` | Scroll travel details internal container | Swipe/scroll from hero to description, map, points, comments, share | Sticky/bottom navigation remains usable; no clipped controls or horizontal overflow | Mobile screenshots at top/mid/bottom |
| MTC-003 | P1 | Desktop + mobile | Missing media fallback | Open travel with unavailable local/dev image | Placeholder keeps media geometry and follows neutral placeholder rule | Screenshot of hero |
| MTC-004 | P1 | Authenticated desktop + mobile | Comments write flow | Log in via e2e user; create, reply, edit, like/unlike, delete a comment | Comment actions succeed; ownership/admin restrictions are correct; no main-thread 404 noise | Screenshot + network/console notes |
| MTC-005 | P1 | Authenticated desktop + mobile | Favorite and rating flow | Log in; add travel to plan/favorite; set/change rating; refresh | State persists and controls show correct selected state | Screenshot before/after refresh |
| MTC-006 | P2 | Desktop + mobile | Section navigation | Use side nav/top chips to jump to gallery, description, map, points, comments | Correct section becomes visible; focus/pressed state updates; no overlay blocks target | Screenshot after each jump |
| MTC-007 | P2 | Desktop + mobile | Share/export actions | Use copy link, copy post text, Telegram/VK/WhatsApp, PDF export entry | Actions use safe external-link helpers; user sees clear feedback or allowed navigation | Console + action result notes |
| MTC-008 | P2 | Desktop + mobile | Instagram rich text | Open mocked/known travel with valid Instagram post/reel/tv link | Valid post/reel/tv renders as embed on web; unsupported Instagram URLs use fallback | Screenshot + DOM note |
| MTC-009 | P2 | Mobile | Cookie consent and bottom nav overlap | Reset cookie consent; open travel; inspect banner with bottom nav and primary actions | Banner does not hide critical controls; dismiss/accept targets are easy to tap | Screenshot |
| MTC-010 | P3 | Desktop + mobile | Error states | Open non-existent slug and simulate media/API failures where possible | Error state is readable; no app crash; recovery/back navigation works | Screenshot + console log |
