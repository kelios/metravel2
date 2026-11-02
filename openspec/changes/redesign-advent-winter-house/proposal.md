## Why

The shipped advent uses a generic status grid and the existing Christmas logo decoration does not match the owner's approved design. The owner approved the winter apartment-house prototype and explicitly requested implementation and publication on 2026-11-02.

## What Changes

- Render the 24 main doors as numbered apartment windows on the approved illustrated panel-house facade; show three bonus doors separately with their actual dates.
- Give unopened windows translucent frost and dim warm light, and opened windows clear bright interiors, with a soft moonlit facade. No visible scene captions or hover tooltips.
- Place the current-day action before secondary progress/sharing content and retain the existing gift/task/reward sheet. Optional gift media must not create an empty block.
- Add a small face-safe Santa cap and Christmas tree to the shared brand mark while preserving the existing seasonal preference, theme palette, route navigation and campaign availability.
- Integrate approved, locally bundled illustration assets and localized app-owned labels.

## Capabilities

### New Capabilities

- `advent-winter-house`: the approved responsive winter calendar presentation and its seasonal brand integration.

### Modified Capabilities

None. Existing campaign dates, API/data, progression and seasonal-resolution requirements are preserved.

## Impact

- User-visible: `/advent`, its gift sheet and Christmas brand decoration. Non-goals: editorial rewrites, backend changes, new reward/credit rules, store releases, or the concurrently edited home hero/base theme.
- Platform impact: shared RN UI on desktop/mobile web and native consumers. Required runtime evidence: mobile web first, desktop web second; add native only if a platform-specific rendering boundary actually changes.
- Localization impact: RU/BE/UK/PL/EN for any new interface/a11y labels; editorial data stays unchanged.
- Assets/performance: local WebP facade and frost variants, stable geometry, no new dependency, animation loop or delayed reveal. Existing approved images are decorative illustration, not documentary travel photos.
- Accessibility: retain date/state labels, keyboard buttons, disabled future doors and effective touch targets; ornamental layers do not receive focus or pointer input.
- Backend API/data, auth, SEO, external links and analytics: preserve existing contracts and events. The shared image primitive gains an optional terminal-error callback without changing legacy `onError` or retry behavior. No mock progress or production date override is introduced.
- Fallback: existing real campaign loading/error behavior; image-less gifts omit media. Local bundled art is independent of editorial/server media.
- Deployment: independent complete-diff review, explicit-path commit/push, testing, project-owned production deployment and targeted live acceptance.

Approved implementation handoff: `docs/design/advent-2026-approved.md`.
