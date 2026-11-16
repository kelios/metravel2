## Why

The canonical wrapper sets production SSR inputs only for DEPLOY=1. DEPLOY=0
therefore measures a static export against byte caps established by SSR, which
can report an entry regression without a corresponding application-code change.
Task #3433 owns the input-selection defect, separately from global budget #3442.

## What Changes

- Both wrapper modes require the same backend SSR capability and set the same
  server/travel-runtime/quest-runtime inputs before build-prod.sh.
- Missing, malformed or disabled capability fails clearly before export.
- Only publishing checks the production checkout and verifies the published SHA;
  build-only retains DEPLOY=0 and performs no publication or rollback.
- The direct build-prod.sh static-preview path remains available without SSH.
- Real shell-fixture regressions cover both modes and failure boundaries; exact
  artifact comparison uses the same frozen source SHA and effective inputs.

## Capabilities

### New Capabilities

- `production-build-only-ssr-parity`: production input parity without publication.

### Modified Capabilities

None.

## Impact

Canonical deployment wrapper, its tests and operational documentation only.
No application UI, API, native, locale, publication protocol or budget-pin change.
