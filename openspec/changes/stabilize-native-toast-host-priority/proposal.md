## Why

Physical iPhone QA for #2440 reproduced an image-permission message reaching the root feedback layer while the fullscreen description editor remained open. Keyboard/inset rerenders can change the registered layer priority; the message is hidden beneath the modal.

Goal/user-visible result: feedback remains visible in the highest active modal through rerenders, then returns to its parent when that modal closes.

## What Changes

- Stabilize each native feedback host's lifetime identity using the repository's existing dependency-patch mechanism.
- Add real-library regression coverage for root and internal rerenders, nested hosts, unmount fallback and current imperative methods.
- Recheck the affected physical editor and adjacent retained-modal consumers after independent code review.

## Capabilities

### New Capabilities

- `native-feedback-layer-priority`: preserve active modal feedback priority across presentation updates.

### Modified Capabilities

None.

## Impact

Platform impact: shared native dependency (iOS and Android); assigned runtime acceptance is physical iPhone. Desktop/mobile web use their separate host and receive no visible change. Localization impact: none; preserve RU/BE/UK/PL/EN text and formatting.

Owned paths: one `patches/react-native-toast-message+2.3.3.patch`, one focused real-library test, and this OpenSpec change. Preserve foreign runner/docs/skills changes. Dependency is lockfile-resolved 2.3.3; no upgrade or new package.

Data/API, auth, SEO, analytics and security contracts are unchanged. Accessibility semantics, focus and layout remain unchanged; the existing message becomes visible in its intended layer. Performance: constant-size lifetime proxy, no timers, extra requests or media. Existing success/error/retry, durations, keyboard avoidance, action buttons and modal-close fallback must remain intact.

Dependencies: no backend/store operation. Real-library negative control and independent review precede runtime. No mock-only acceptance or synthesized feedback. Physical LOCAL Debug evidence remains distinct from future TestFlight13 footage.

Non-goals: new toast UI, per-screen offsets, longer durations, permission changes, dependency upgrades, simulator/iPad/Android recording, build/upload/submit/release. Open questions: none that block this mechanism repair.
