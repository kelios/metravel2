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
| Manual QA | Manual QA Tester | In progress | Manual user-flow testing for travel details page | Return manual QA report with steps, expected/actual, severity |
| Bug triage | Orchestrator | Done | F-001 mapped to guest detail request dedupe | Re-test network request count |
| Implementation | Developer | Done | Added guest in-flight/cache reuse for travel detail slug/id requests | Re-test fixed scenario |
| Re-test | QA Tester | In progress | F-001 ready for verification | Re-test duplicate initial requests |
| Review | Reviewer / Architect | Pending | Not started | Review diff, validation, and project-rule compliance |
| Final validation | Orchestrator | Pending | Not started | Run scoped checks and record result |

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
| T-002 | Complete manual user-flow QA for travel details desktop and mobile | Manual QA Tester | In progress | Include concrete steps, expected/actual, severity |
| T-003 | Triage duplicate initial travel detail requests | Orchestrator | Done | Root cause: concurrent guest consumers could start separate detail requests |
| T-004 | Fix confirmed travel details bugs | Developer | Done | Shared guest in-flight/cache layer in `api/travelDetailsQueries.ts` |
| T-005 | Re-test fixed scenarios | QA Tester + Manual QA Tester | In progress | Verify F-001 network request count and page behavior |
| T-006 | Review final diff and validation | Reviewer / Architect | Pending | Check project rules and known risks |

## Findings

### F-001 Duplicate initial travel detail requests

- Severity: medium.
- URL: `/travels/kostel-svyatogo-antoniya-paduanskogo`.
- Viewports: desktop `1440x900`, mobile `390x844`.
- Expected: one initial request or reuse of preload/in-flight promise.
- Actual: desktop observed 3-4 duplicate GET requests to `/api/travels/by-slug/kostel-svyatogo-antoniya-paduanskogo/`, including one aborted request; mobile observed 3 duplicate GET requests.
- Candidate files: `hooks/useTravelDetails.ts`, `api/travelDetailsQueries.ts`, `app/+html.tsx`.
- Fix: added guest request coalescing and detail cache for `fetchTravel` / `fetchTravelBySlug` in `api/travelDetailsQueries.ts`.
- Status: fixed, pending QA re-test.

## Validation log

- `npm run check:fast:dry` showed the current dirty working tree is limited to existing profile-related files at the time of the dry run.
- `npx playwright test e2e/open-travel.spec.ts --project=chromium --workers=1` passed: travel details page can open from the travel list smoke flow.
- QA reported `npx playwright test e2e/travel-detail-page.spec.ts e2e/travel-detail-interactions.spec.ts e2e/travel-rating.spec.ts --project=chromium --workers=1` passed: `40 passed`.
- `npm run test:run -- __tests__/api/travels.test.ts` passed: `69 passed`.
- `npm run test:run -- __tests__/hooks/useTravelDetails.test.ts` passed: `10 passed`.
- `npx playwright test e2e/open-travel.spec.ts --project=chromium --workers=1` passed after F-001 fix.
