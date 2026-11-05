## Why

The requested Nesvizh/Mir article receives mobile PageSpeed 69, TBT 841 ms and Speed Index 7835 ms. Production profiling identifies long React hydration/update tasks and repeated deferred geometry transactions. Board #3071 retains the user outcome: live mobile Performance at least 90.

## What Changes

- Hydrate the already server-rendered travel hero and article in independent regions while retaining their visible HTML.
- Skip anchor traversal for unchanged deferred section flow geometry while preserving real-growth anchoring.
- Validate the deployed result and preserve slider behavior and existing numeric budgets.

## Capabilities

### New Capabilities

- `travel-web-loading`: mobile travel startup and continuity of server-rendered content.

### Modified Capabilities

None.

## Impact

Platform impact: mobile web | desktop web. Native rendered branches stay unchanged.
Localization impact: none; preserve existing RU/BE/UK/PL/EN text and formatting.
Affected paths: TravelDetailsCriticalShell.tsx, TravelDetailsDeferredTransition.tsx and focused regression tests.
Data/API, SEO, accessibility, security and analytics contracts do not change; full article HTML, semantic headings and controls remain available.
Dependencies: existing React SSR/Suspense only; no new dependency or backend work.
Fallback/mock policy: real production evidence; no new timer, scroll/interaction reveal gate or weakened threshold.
Non-goals: prose/photo edits, redesign, native releases and unrelated screens.
