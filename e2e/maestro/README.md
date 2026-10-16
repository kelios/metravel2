# Native regression suites

`suites.json` is the executable selection contract. The project runner runs the
listed flows sequentially, stops at the first failure and never retries a failed
flow. `launch.yaml` is a shared subflow; running the entire directory mixes guest
and signed-in preconditions and is not a supported suite.

Maestro covers Android emulators/physical devices and **iOS simulators**.
Physical iPhone/iPad and the exact TestFlight candidate use the XCTest driver in
`tools/ios-device-uitests/`; a simulator pass does not prove their behavior.
See [Supported platforms](https://docs.maestro.dev/get-started/supported-platform).

## Source validation

```bash
npm run e2e:native:check
```

This parses every referenced YAML, checks budgets/platforms and prints a source
hash. It does not contact a device or execute a scenario and never reports a
runtime pass. It does not need the runtime quality lock.

## Runtime prerequisites

Run only at the task's testing stage after code review and the operation gate in
`docs/WORKFLOW_OPERATIONS.md`. Reuse the prepared local stack and installed build;
the runner never builds, installs, signs, unlocks, resets data or starts Metro.
Use an explicit device identifier from `adb devices -l` or
`xcrun simctl list devices booted`; identifiers stay out of the JSON report.

Maestro and a working Java runtime must be on PATH. Set `JAVA_HOME` to the local
JDK installation if Maestro cannot find Java. `MAESTRO_BIN` can select an existing
local executable; no cloud execution is involved.

The runner requires the expected installed version/build and verifies them with
Android package metadata or the simulator app's Info.plist before UI actions.
`--api-url` is recorded as a **declared** API origin: metadata does not prove the
compiled backend origin or source commit of a signed candidate. The report makes
that limitation explicit. API/fixture readiness and locale/account setup remain
prerequisites, and the guest flows assert guest state before interactions.

## Run one suite

```bash
npm run e2e:native -- --suite guest-smoke --platform ios-simulator \
  --device "$IOS_SIMULATOR_ID" --account guest --locale ru \
  --version 1.0.0 --build 22 --api-url http://localhost:8000

npm run e2e:native -- --suite quest-regression --platform android \
  --device "$ANDROID_DEVICE_ID" --account guest --locale ru \
  --version 1.0.0 --build 22 --api-url http://localhost:8000
```

Replace version/build and API origin with the selected installed candidate.
Android physical devices use the local backend's LAN origin. Dev-client runs
add `--dev-client` deliberately; Android also needs an already configured
`adb reverse tcp:8081 tcp:8081`. Release runs never attempt the Expo launcher URL.

| Suite | Platform | Preconditions and actual assertions |
|---|---|---|
| `guest-smoke` | Android, iOS simulator | Guest; login and registration consent hint disappears after checking, returns after unchecking |
| `quest-regression` | Android | Guest; review modal load/close/reopen/close, intro point count, GPX share for the specified quest |
| `recommendations` | Android | Seeded signed-in test account with favorites/history; both shelf headings visible |

Selectors currently require RU. Production data ordering is not a fixture:
quest-regression needs the named Gomel review quest and Krakow dragon route
(9 points / 6 tasks) on the selected API. Seed equivalent local fixture data
before the run. Missing fixture data is a failed precondition, not permission
to switch silently to production or to remove an assertion.

## Budgets, evidence and coverage

- A flow has at most 150 seconds; a suite at most 600 seconds including
  preflight. Timeouts terminate only the runner's own subprocess group.
- The existing quality lock and shared per-device lock reject competing runs
  immediately. Busy is non-zero and produces no pass. A dead device-lock owner
  requires verifying orphan processes before removing the reported lock.
- Every attempt gets a new ignored `.codex-temp/native-e2e/` directory with JSON,
  JUnit and Maestro logs/debug artifacts. Missing, skipped, failed or malformed
  JUnit cannot become pass. Previously successful reports are never overwritten.
- The report fingerprints the flow and runner definitions, lists exact checks,
  and records candidate metadata and elapsed time. It proves only those checks.
  `completeReviewScenes: []`, `candidateSourceVerified: false` and
  `recordingReady: false` prevent treating these limited flows as App Review
  acceptance or a recording gate.
- These new/updated flows are **authored and source-validated, not runtime
  verified in this audit**. Historical Android passes do not certify today's
  candidate. Full guest/article/map/auth/UGC/deletion/permission coverage remains
  separate work until executable cases and real results exist.

See [Maestro test reports](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts)
for report formats. The report here is source-controlled runner output, not an
agent-written claim that a recording is ready.
