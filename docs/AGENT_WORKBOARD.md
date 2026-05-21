# Agent workboard

Last updated: 2026-05-21

Scope: testing and fixing the travel details page.

Local visual board: open `docs/AGENT_WORKBOARD_LOCAL.html` from the repository on the local machine. This HTML board is local-only, stores status changes in browser `localStorage`, and is not part of the production Expo app.

## Status board

| Track | Owner | Status | Current output | Next action |
| --- | --- | --- | --- | --- |
| Team coordination | Manager | In progress | Staffing, role status, delivery coordination | Keep idle roles visible and assign next work |
| Approval gate | Approver / Product Owner | In progress | Approves scope, design decisions, QA findings, and developer-ready tasks | Define and enforce task readiness flow |
| Scope and requirements | Business Analyst | In progress | QA scope, user stories, acceptance criteria, bug severity priorities | Clarify Instagram expected behavior and implementation acceptance gates |
| Backlog management | Backlog Manager / Product Owner | In progress | Convert QA/design findings and idle capacity into prioritized backlog | Keep next work ready for every role |
| Code readiness | Developer | In progress | Relevant files, risk zones, targeted test map; technical fix plan opened | Prepare implementation approach for D-001 and T-012 |
| Visual contract | UI/UX Designer | In progress | Web/mobile UI contract and visual QA checklist; new designer audit tasks opened | Review screenshots and prioritize UX polish tickets |
| Browser QA | QA Tester | In progress | E2E detail tests passed; duplicate initial request bug candidate found; extended web/mobile pass started | Run extended travel detail, layout, comments, and rich-text checks |
| Manual test cases | QA Test Analyst | Open | Manual test-case backlog needed for web/mobile travel details | Write reusable manual cases with steps, expected result, priority, and evidence fields |
| Manual QA | Manual QA Tester | In progress | Guest/manual pass completed; authenticated pass opened | Test signed-in favorite/rating/comments write flows |
| Bug triage | Orchestrator | Done | F-001 and comments 404 console issue triaged | Keep board updated for new findings |
| Implementation | Developer | Done | Fixed travel detail preload reuse and comments empty-state request path | Reviewer check if needed |
| Re-test | QA Tester | Done | F-001 and comments request checks passed locally | Monitor future manual QA findings |
| Review | Reviewer / Architect | Done | Reviewer caught incomplete F-001 fix; follow-up fix applied and re-tested locally | Re-review on next diff if requested |
| Final validation | Orchestrator | In progress | Targeted tests and local e2e browser checks completed for previous loop | Complete extended web/mobile QA loop |

## Role rules

- Manager, QA, Manual QA, UI/UX Designer, and Reviewer do not edit code.
- Developer edits only confirmed bugs from QA or explicitly approved fix tasks.
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

| ID | Task | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| T-001 | Complete browser QA for travel details desktop and mobile | QA Tester | Done | `40 passed`; duplicate initial request bug candidate found |
| T-002 | Complete manual user-flow QA for travel details desktop and mobile | Manual QA Tester | Done | Guest/manual pass completed; authenticated pass remains separate |
| T-003 | Triage duplicate initial travel detail requests | Orchestrator | Done | Root cause: concurrent guest consumers could start separate detail requests |
| T-004 | Fix confirmed travel details bugs | Developer | Done | Shared direct preload reuse; comments read by `travel_id` |
| T-005 | Re-test fixed scenarios | QA Tester + Manual QA Tester | Done | Browser checks passed on local e2e build |
| T-006 | Review final diff and validation | Reviewer / Architect | Done | Initial review blocked F-001; final local browser check passed after follow-up |
| T-007 | Run extended web QA for travel details and related public flows | QA Tester | In progress | Cover desktop Chrome travel details, interactions, comments, Instagram rich text, responsive layout |
| T-008 | Run extended mobile-web QA for travel details and related public flows | QA Tester | In progress | Cover `390x844` mobile viewport, horizontal overflow, clipped actions, sticky/navigation states |
| T-009 | Create designer UX/UI audit backlog from QA evidence | UI/UX Designer | In progress | Find concrete visual, hierarchy, touch-target, empty-state, and mobile polish work |
| T-010 | Run authenticated manual QA for write flows | Manual QA Tester | Open | Use `.env.e2e`; cover favorite, rating, comment create/edit/delete, author-only actions |
| T-011 | Write manual test cases for travel details web/mobile | QA Test Analyst | Open | Include prerequisites, steps, expected result, priority, viewport, and evidence checklist |
| T-012 | Align Instagram rich-text e2e expectation with project rules | QA Test Analyst + Developer | Open | Current e2e expects fallback cards, while rules require iframe embeds for valid post/reel/tv URLs |
| T-013 | Redesign missing hero media state for travel details | UI/UX Designer | Open | Current placeholder displays text `Фото недоступно`; project UI rule requires neutral placeholder with no text/icons |
| T-014 | Audit mobile bottom overlays and touch target sizes | UI/UX Designer | Open | Cookie banner, bottom nav, sticky section tabs, and several actions need mobile spacing/touch-target review |
| T-015 | Form and groom backlog from QA/design findings | Backlog Manager / Product Owner | In progress | Convert findings, manual cases, and idle capacity into prioritized implementation-ready tasks |
| T-016 | Write business requirements and acceptance criteria for travel QA fixes | Business Analyst | In progress | Separate product requirements, user stories, non-goals, risks, and acceptance criteria from manager coordination |
| T-017 | Prepare technical fix plan for travel QA findings | Developer | In progress | Locate files and prepare implementation approach for D-001 neutral placeholder and T-012 Instagram e2e alignment |
| T-018 | Approve and govern task readiness flow | Approver / Product Owner | In progress | Define who approves requirements, design, QA findings, and developer-ready tickets before implementation |

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
- Owner: UI/UX Designer for design direction, Developer for implementation.
- Status: open.

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
