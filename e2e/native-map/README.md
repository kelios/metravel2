# #2471 / #2483 native marker acceptance

The tracked sidecar observes the actual installed Leaflet WebView. It never
calls zoom, marker-render or network-control commands. Maestro opens the real
`/userpoints` route and selects Map; a QA agent performs three real gestures
while the sidecar asserts baseline → zoom +1 → +2 → +1. These assertions are
separate from an entry-only Maestro exit code. This flow is intentionally not
advertised as an independently passing suite in `maestro/suites.json`.

Preconditions: reviewed changes in `testing`, one selected target, RU, an
already signed-in account **104**, a fresh independent snapshot of **all current API places**,
verified installed candidate/backend identity. Credentials come from the
existing private `.env.e2e` input channel before this test; neither a credential
nor a login command belongs in the report. The sidecar does not attest an account
identity from its declared number: independently confirm the authenticated
account before the run. Missing/wrong fixture fails baseline; never filter the
snapshot, change account data or substitute another map. The app must be running before iOS attach.
The owner approved the complete current dataset for #2471/#2483 on 2026-10-18
(2655 points at that capture), replacing the historical 869-point prerequisite.
The snapshot defines the exact expected set; its count is not hardcoded.

Acceptance of #2483 requires the reviewed `UserPointsMap.pointsOnly` wiring and
native dataset guard in the code actually running on the target. Version/build
alone cannot establish whether an installed iOS Release **1.0.5(14)** includes
that fix: both older and reviewed candidates can share those values. Compare
the installed executable and bundled JavaScript with the reviewed source and
candidate stamp; rebuild/install only after a confirmed provenance mismatch.
Changing `--source` cannot update an installed application. For the
Android dev-client, separately verify that its loaded JavaScript bundle contains
the reviewed fix; installed binary version/build alone does not identify that
bundle. Store build/upload authorization remains separate from this scenario.

Static checks, without a target:

```bash
node e2e/native-map/run.js --check
node --test e2e/native-map/telemetry.test.js
python3 -c 'import ast,pathlib; ast.parse(pathlib.Path("e2e/native-map/lldb_probe.py").read_text())'
```

Runtime examples (substitute the explicitly selected target, real backend and
verified full source SHA; these are metadata, not installation attestation):

```bash
node e2e/native-map/run.js --platform ios-simulator --device "$IOS_QA_DEVICE" --pid "$MAP_APP_PID" --account-id 104 --locale ru --api-url "$MAP_API_ORIGIN" --version "$MAP_CANDIDATE_VERSION" --build "$MAP_CANDIDATE_BUILD" --source "$MAP_CANDIDATE_SHA" --expected-keys-file "$MAP_FIXTURE_JSON"
node e2e/native-map/run.js --platform android --device "$ANDROID_QA_DEVICE" --cdp-url http://127.0.0.1:9222 --account-id 104 --locale ru --api-url "$MAP_API_ORIGIN" --version "$MAP_CANDIDATE_VERSION" --build "$MAP_CANDIDATE_BUILD" --source "$MAP_CANDIDATE_SHA" --expected-keys-file "$MAP_FIXTURE_JSON"
```

Prepare `MAP_FIXTURE_JSON` independently using the existing private auth resolver:
verify authenticated account 104 and fetch **all pages** of `/api/user-points/`
from the selected backend, without filters. Do not obtain these keys from the
WebView, logs or `__metravelMarkerDesired`. Save the following shape in an ignored
private artifact directory:

```json
{"accountId":104,"apiOrigin":"https://metravel.by","capturedAt":"<fresh ISO timestamp>","keys":["<all canonical keys from the authenticated API points>"]}
```

The projection follows `components/UserPoints/userPointsMapData.ts` →
`api/mapPlaces.ts:getMapPointIdentityKey`: each finite-coordinate API point maps
to `travel-${Number(id)}@${Number(latitude)},${Number(longitude)}`, then commas
are replaced with `-`. Require valid, unique API IDs, complete pagination and a
nonempty set of valid, unique keys; sort them before saving. Derive the complete
finite-coordinate projection without sampling or trimming it to an old count.
The runner requires exact key equality, origin,
account metadata and a capture age under 24h; the report fingerprints the fixture
bytes. This prevents a same-size global dataset from satisfying the baseline.
Account/backend/source provenance still needs the independent QA identity check.

Use the shared native-device lease owned by this runner. Do not start another
Maestro/XCTest suite against the leased target. The QA agent's purpose-built
gesture tool must participate in this same acceptance operation, after the
entry process finishes; do not bypass a competing owner's lease. Artifacts go
to a unique ignored `.codex-temp/native-map/<run>/` directory. Watch
`progress.json`: stage 1 requests one zoom-in, stage 2 another zoom-in, stage 3
one zoom-out. Wait for each stage before the next gesture. In every phase the
observer requires 600ms of settled state; each phase times out after 20s. The
complete assertion phase is bounded by 90s; entry has a separate 45s budget.
Map gestures must stay over the map canvas and avoid markers/popups. A rejected
or unavailable gesture is a failed/unavailable test, not permission to call
`map.zoomIn()` from a debugger. [Maestro's available commands](https://docs.maestro.dev/reference/commands-available)
do not provide pinch; use the tester's qualified native gesture driver.

On iOS this uses the previously exercised arm64 Objective-C callback
`-[RNCWebViewImpl userContentController:didReceiveScriptMessage:]`. LLDB must
attach to that exact app PID and resolve exactly one loaded callback symbol.
The address breakpoint must stop at its exact entry: a name breakpoint can skip
the optimized prologue, where the argument registers no longer have their entry
meaning. The observer freezes numeric `$x0`/`$x3` pointers before evaluating the
message body or scheduling JavaScript on the captured receiver's WebView;
only nonce-matched QA snapshots are saved, never other bridge messages. This
ABI is deliberately unsupported on x86_64 or a changed native WebView driver.
The runner checks installed version/build and binds the supplied PID to the
selected booted simulator's `launchctl` MeTravel process before attaching.
An attach/evaluate failure is operational failure, not application pass.
Attach before the prepared native My Points list → Map entry opens a fresh map
and emits `READY`. Attaching to an already open, quiet map does not bootstrap
the observer; `attached` alone is not telemetry readiness. Evaluation failures
stop without retry, with phase and numeric LLDB error diagnostics.

On Android qualify the **dev-client** WebView debugging endpoint first. The
installed `react-native-webview` manager enables WebView debugging for a debug
React Native build (`RNCWebViewManagerImpl.kt`). The tester finds the selected
app's `webview_devtools_remote_<pid>` socket in `/proc/net/unix`, forwards an
unused local port via `adb -s "$ANDROID_QA_DEVICE" forward tcp:9222
localabstract:webview_devtools_remote_<pid>`, then supplies that local HTTP
origin. Discovery occurs after route entry and requires exactly one map page.
No endpoint/ambiguous endpoint is a failed precondition; a release build is not
silently replaced. The runner binds the forwarded port to the selected device's
current MeTravel PID through `adb forward --list` and verifies installed
version/build. The QA owner creates and removes only that owned adb forward.

Assertions require exactly the complete independent API fixture key set, the same desired keys, one unique marker
object per key, exact marker-layer membership, unchanged objects/map across all
gestures, `markerZoomAnimation=true`, empty render queue/no scheduled frame,
no active map animation, no GridLayer load in progress and zero pending fallback
tiles. Initial marker fill
may settle; the same map and marker objects must persist throughout its 600ms
baseline window. Any loss/replacement after baseline fails immediately.
Snapshots require increasing generated timestamps/sequence, nondecreasing frame
counts and a generated time within 5s of the host clock. Clock drift is an
operational failure; it never relaxes the fixture or marker assertions. The report
records observed frame maximum and tile counters in raw snapshots. LLDB
instrumentation affects timing: these observations are diagnostic, not an
unbiased frame-performance threshold or proof that every HTTP image loaded.

Cleanup: Android observer is stopped through CDP and CDP closes. iOS requests
observer cleanup on its next own callback, deletes the breakpoint and detaches/
resumes; if no callback remains its observer self-expires after 150s.
The device lease is released after verified cleanup. No point/import/filter/account mutation occurs.
LLDB must provide a positive `detached.json` receipt in addition to exit zero.
If detach is unconfirmed, the report is failed and the lease is retained: check
the target's stopped/debugger state and resolve that owned stale lease before
reuse. Preserve the first failing snapshots,
`entry.xml`, `maestro.log`, `lldb.log`, `progress.json` and `report.json`.

**Uncovered gate:** three real network-loss/recovery cycles with grey map tiles
recovering without a gesture. The #2471 Task Contract explicitly permits
simulator Network Link Conditioner (NLC) or host-network disconnection. Prefer a
qualified target-local NLC mechanism; changing host Wi-Fi/network state requires
a separate current owner command. Record the selected target, impairment settings,
actual request/tile failures during each loss and automatic tile recovery after
each restoration. Observe and report `NetInfo.isConnected` honestly: NLC need not
change that value if real network impairment and recovery are independently
demonstrated. Direct `__metravelSetTileNetwork` injection is not a network-loss
test. This runner never claims offline recovery; the three cycles require
separate runtime evidence in `testing`.

Source validation/unit passes do not prove LLDB/CDP access, current fixture or
any application business outcome. Run actual acceptance in `testing` after
review; this first authored version has no runtime pass yet.
