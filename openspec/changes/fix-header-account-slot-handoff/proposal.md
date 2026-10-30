## Why

The late account-controls handoff shifts the visible More link horizontally at 1024px while the global header height remains stable. Two recorded runs identify the account fallback and its inner element as layout-shift sources; the first moves from x=959 to x=145. This repeats the header-hydration CLS family through a newly identified nested layout-owner mechanism.

## What Changes

- Keep the visible account fallback in the same position while deferred account controls load.
- Give the web account slot one layout owner across the deferred handoff; retain the existing native account container.
- Cover the suspended intermediate state with a real web DOM regression and retain the existing zero-header-shift browser assertion.

Goal: remove the confirmed handoff shift without changing header breakpoints, reserved heights, fallback visibility, or performance budgets. Non-goals: the separate deferred-sidebar shift, article-data readiness, footer changes, account/auth behavior, and a broader header redesign.

## Capabilities

### New Capabilities

- `header-account-handoff`: Stable visible account navigation during deferred web-header loading, with the existing native container preserved.

### Modified Capabilities

None. The existing specification inventory has no global-header handoff capability.

## Impact

- Platform impact: desktop web and mobile web; shared source retains native Android/iOS rendering behavior.
- Localization impact: none; no text or locale-format changes.
- User-visible/accessibility: More remains visible, positioned, and usable until the existing runtime menu takes over; existing roles and destinations remain intact.
- Performance: removes the measured header layout shift; no extra eager loading, observers, or budget changes.
- API/data, SEO, security, analytics: none; no endpoint, metadata, session, or event changes.
- Affected source: `components/layout/CustomHeaderAccountSection.tsx`; focused real-RNW DOM regression. Existing `CustomHeader` ownership, account styles, critical CSS, and CLS spec provide the surrounding contract and acceptance gate.
- Dependencies: the current lazy account components and the parent web account slot. No new package dependency. Fallback/mock policy: retain the real visible More link; suspend only the inner component in the unit regression, with real RNW layout nodes. Browser acceptance uses the existing application path.
- History: `docs/PROBLEM_MEMORY.md` family `HEADER-HYDRATION-CLS-001`; this cause concerns horizontal nested ownership, not the previously repaired reserved-height breakpoint mismatch. No board mutation is part of this change.
