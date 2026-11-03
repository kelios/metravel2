## Why

Android publication currently waits for browser tests, a web export and server-side PDF rendering tests. A native candidate needs evidence for its own platform and the shared app contracts it uses.

## What Changes

- Add separate Android and iOS source release checks and route their release runbooks to them.
- Keep shared type, dependency security, localization and native contract checks in both gates.
- Keep the existing web gate and the exact native binary and store checks.

## Capabilities

### New Capabilities

- `native-release-checks` provides independently runnable Android and iOS source checks.

### Modified Capabilities

None.

## Impact

Package scripts, test selection, release documentation and operator runbooks. The commands do not build, upload or publish artifacts.
