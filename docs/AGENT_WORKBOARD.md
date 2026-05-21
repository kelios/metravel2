# Agent workboard

Last updated: 2026-05-21

Scope: testing and fixing the travel details page.

## Status board

| Track | Owner | Status | Current output | Next action |
| --- | --- | --- | --- | --- |
| Scope and priorities | Manager / BA | Done | QA scope, acceptance criteria, bug severity priorities | Use as acceptance gate for fixes |
| Code readiness | Developer | Done | Relevant files, risk zones, targeted test map | Wait for confirmed QA bug report |
| Visual contract | UI/UX Designer | Done | Web/mobile UI contract and visual QA checklist | Feed checklist into QA and implementation |
| Browser QA | QA Tester | Done | E2E detail tests passed; duplicate initial request bug candidate found | Triage duplicate request path |
| Manual QA | Manual QA Tester | Done | Manual user-flow testing completed; comments 404 finding triaged | Add authenticated QA pass as a separate task |
| Bug triage | Orchestrator | Done | F-001 and comments 404 console issue triaged | Keep board updated for new findings |
| Implementation | Developer | Done | Fixed travel detail preload reuse and comments empty-state request path | Reviewer check if needed |
| Re-test | QA Tester | Done | F-001 and comments request checks passed locally | Monitor future manual QA findings |
| Review | Reviewer / Architect | Done | Reviewer caught incomplete F-001 fix; follow-up fix applied and re-tested locally | Re-review on next diff if requested |
| Final validation | Orchestrator | Done | Targeted tests and local e2e browser checks completed | Hand off result |

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
