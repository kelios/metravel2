# MeTravel App Review — physical-device evidence, 12 September 2026

Task: #1889. Candidate: **1.0.5 (9)**, source
`8ae84cb56b578013a0fa1c3ec75c8d5524982c1a`. This is an active evidence protocol;
it does not certify completion of the App Review demonstration.

## Scope and evidence boundary

- Task type: physical Apple-device demonstration and exact-candidate acceptance
  evidence, with both iPhone and iPad compatibility checks.
- Task-owned paths: this document and ignored
  `.codex-temp/app-review-2026-09-12/device/`.
- Platform impact: iOS and iPadOS; no app-code changes.
- Localization impact: none; proposed video explanations are English.
- Backend target: production `https://metravel.by`, as required for the selected
  TestFlight candidate. No local-source rebuild can replace this candidate.
- Runtime gate: #1889 entered `testing` after the independent review of its
  no-code scope; parent confirmed the board readback on 12 September.
- Store writes, new signed builds, app replacement and public uploads are outside
  this task. Account mutations below require their named test-only authorization.

## Current device and recording readiness

Read-only `xcrun devicectl` probes on 12 September, including the resumed pass at
09:41 UTC after the owner's access action, established:

| Layer | Actual state | What this proves |
| --- | --- | --- |
| Physical iPhone 13 mini | iOS 26.5; paired; Developer Mode enabled; initially unlocked; `by.metravel.app` installed as 1.0.5 (9) | Device and installed version/build are available. The current probe alone does not prove installation provenance or latest OS. |
| Physical iPad mini 6 (`iPad14,1`) | **Current:** iPadOS 26.6.2, connected and unlocked. App inventory succeeds after the owner's Developer Mode action; MeTravel 1.0.5 (9) is installed | Latest-OS physical recording target. TestFlight provenance and product scenarios remain to be verified. |
| Other paired iPhone | iPhone 16 Pro, iOS 26.6; unavailable | Not a usable recording target in this session. |
| QuickTime physical video | Both devices are available as Screen sources; their Home screens were observed. Recreating the iPad preview resolved its initial black image | Physical recording channel is available. QuickTime supplies video, not remote touch; no final demonstration is recorded yet. |
| iPhone Mirroring | App failed to remain running when selected through computer use | No usable touch channel from Mirroring was established. |
| Existing XCUITest driver | Initial runner-only attempt timed out on the XCTest passcode prompt. After the owner's access action, the same cached Settings-tree scenario passed | Physical iPhone touch/tree access is now working; this operational probe is not a product-scenario pass. |

The first disconnected iPad inventory reported 18.7.8 and unavailable. The resumed
direct probe returned **26.6.2**, so the earlier value is historical cache evidence,
not the tablet's current OS. Both devices are now unlocked; do not request another
generic unlock/connect action.

The installed-app inventory also reports `builtByDeveloper=true`. This is a
provenance signal to resolve by inspecting TestFlight and the selected installed
candidate; version/build equality alone is insufficient. No conclusion that the
binary differs from the historic candidate is made from this field alone.

The release-artifact analyst retrieved the archived candidate IPA in this session
and reported compiled version/build **1.0.5 (9)**, `UIDeviceFamily=[1,2]`, minimum
OS **16.4**, `UIRequiresFullScreen=false` and all four iPad orientations. IPA
SHA-256: `485fdd80833054add8fb980c8d4d0f1a2d52a96e39090f933ed92194e724d858`.
Sanitised source:
`.codex-temp/app-review-2026-09-12/artifact/identity-config.json`, with interpretation
in `.codex-temp/app-review-2026-09-12/services-evidence.md`.
This proves the archived binary declares universal iPhone/iPad support. It does
not identify the currently installed copy or prove physical iPad behaviour.

The initial visible iPhone blocker was **“Enter iPhone Passcode for XCTest —
Enable UI Automation.”** The owner completed that action, and the resumed
Settings-tree run passed. Do not request, transmit or record the passcode. The
tablet Developer Mode request was also completed and direct app inventory now
succeeds. The remaining helper-signing work is separately described below.

The parent verified Apple's current release listing as iOS/iPadOS **26.6.2**
(8 September 2026), matching the tablet's direct OS probe. Apple's original
letter requests a physical device on the latest OS, not specifically an iPhone.
Use **physical iPad mini 6 / iPadOS 26.6.2** for the primary video; the iPhone 13 mini
on iOS 26.5 remains a compatibility target. Updating the iPhone is not required
solely to satisfy the video requirement. Reference:
[Apple security releases](https://support.apple.com/en-us/100100).

A 5.5-second **technical capture probe** is retained as
`recording-channel-probe.mov`, H.264, 1082×2340, with audio removed. It only
confirms that QuickTime can produce a physical video file; it is not the app
demonstration and carries no scenario pass or final timecodes.

## Historical evidence reconciliation

| Source | Exact date/build | Accepted meaning |
| --- | --- | --- |
| #1423 and `.codex-temp/ios-build9/QA_REPORT.md` | 8 September, TestFlight 1.0.5 (9), same source | Historical FAIL for Universal Links before the server AASA correction. Preserve this report with its date. |
| #1414 final acceptance entry | 9 September, physical iPhone 13 mini / iOS 26.5, fresh TestFlight 1.0.5 (9) | Later PASS supersedes the older Universal Links result: TN3155 succeeded before first launch, real cross-origin cold 5/5 and warm 5/5 routes succeeded, negative routes 2/2 remained in Safari. |
| #1414 explanation | Same 9 September entry | A new build 10 was unnecessary: the correction was server-only; the same binary passed after fresh association. |
| #1423 remaining matrix | 8 September report | Partial or absent auth, deletion, media permissions/HEIC, accessibility, offline and physical iPad coverage remains partial or absent. The board's `done` status and the later Universal Links PASS do not prove these separate cases. |
| `docs/IOS_STORE_LISTING.md`, screenshots section | 9 September, same-source simulator release builds | Provenance for the previously uploaded store screenshot set; not physical iPad acceptance or physical-device video. |

Suggested append-only clarification for #1423, to be applied by `ticket-board`:

> Evidence clarification, 12 September 2026: retain the 8 September build-9 FAIL
> as history. #1414 records a later physical PASS on 9 September for the same
> TestFlight 1.0.5 (9), after the production AASA correction and fresh install.
> The request for build 10 in the older entry is superseded for this server-only
> fix. This clarification applies to Universal Links only; it does not certify
> the uncompleted rows of the broader candidate matrix. Current Apple-requested
> video and physical iPad work are tracked in #1889.

## Reviewable recording script

Start the final recording only after checking the exact TestFlight version/build,
the current stable OS, the controlled account identities and the capture source.
Use a continuous visible path from app launch to the result of each action.
Keep passwords masked; do not capture keyboard suggestions, unrelated account
details, personal notifications, passcodes or system account pages. Record actual
timecodes after playback; the chapter labels below are not claimed timecodes.

| Chapter | Physical action | Observable result required | English explanation |
| --- | --- | --- | --- |
| A. Candidate and launch | Record app/build and OS evidence without personal identifiers; launch MeTravel from its icon after termination | Exact candidate opens without Metro, error screen or hang | “MeTravel 1.0.5, build 9, running on a physical iPad with iPadOS 26.6.2.” |
| B. Guest browsing | Home → search/catalogue → travel detail → article → map → quest overview | Public content and navigation work without forced login; map has visible base tiles | “Visitors can discover routes, articles, places and quests before signing in.” |
| C. Registration | Create one explicitly designated disposable account using a controlled mailbox; complete the required activation | Account is created; activation succeeds; the account can then sign in | “This account is created only for the review demonstration.” |
| D. Sign-in and session | Sign in with the permitted test account; background and cold-restart the app | Authenticated profile returns and the session persists | “Signed-in users can save routes and organise their trips.” |
| E. Personal planning | Add and remove a favourite; create one agreed test trip/plan and open it | Favourite state and the saved plan are visible after navigation; clean up only the named test item | “The saved route and trip plan are available from the user's profile.” |
| F. Settings/privacy | Open profile → settings → privacy/support and locate Delete account | Required settings are visible and reachable | “Privacy, support and account deletion are available in Settings.” |
| G. Report/block | Open the agreed test author's public profile from its content; submit one clearly labelled test report; block that same author | Report confirmation is shown; block has an observable effect; restore the test block when authorised | “Users can report content or block another user from the author's profile.” |
| H. Disposable account deletion | Verify the currently signed-in identity is the designated disposable account; request deletion and confirm only at the approved gate | Session ends; the deleted account cannot sign in again | “This permanently deletes the disposable demonstration account.” |
| I. Reviewer access | Sign in with the permanent reviewer demo account through the approved secure channel | Reviewer account remains usable and is never the deletion target | “The permanent reviewer account remains available using the credentials in App Review Information.” |
| J. Paid features | Inspect the actual candidate's relevant product surfaces | Show real paid functionality only if present; otherwise state verified absence | Do not invent a purchase or subscription screen. |

Physical iPad follow-up: establish installed TestFlight identity; verify launch,
guest catalogue/detail/quest/map and authenticated shell as applicable; inspect
full-screen portrait/landscape, supported resized windows, keyboard and reachable
primary actions. Do not infer this from simulator screenshots or `supportsTablet`.
On iPhone, separately verify the installed candidate, launch, guest navigation,
map/quest and authenticated shell; the iPad video does not establish these results.

## Named test-data plan

The `.env.e2e` file contains dedicated `E2E_EMAIL` and `E2E_PASSWORD` variables;
values were not printed. There are no reviewer-specific credential variable names
in that file. Permanent reviewer credentials belong in the protected App Review
Information fields and must not be copied into this protocol.

Before the mutating chapters, identify and authorise:

1. One disposable demonstration account and a controlled activation mailbox.
   Registration uses an activation email; creation alone does not establish a
   logged-in account (`components/auth/RegistrationForm.tsx:130`).
2. A separate agreed test author/content target for exactly one report and one
   block/unblock cycle. The report creates a moderation record; block removes
   mutual follows, so it must not target an owner or real author
   (`api/userSafety.ts:104`, `api/userSafety.ts:131`).
3. One test favourite and one test plan with their cleanup actions, limited to
   the test account. No owner content or permanent reviewer data is deleted.
4. Deletion of only the named disposable account through
   `DELETE /user/delete-account/` (`api/user.ts:214`), followed by failed re-login.
   Preserve the permanent reviewer account.

The cited registration and user-safety/account API files match source
`8ae84cb56`: `git diff --name-only 8ae84cb56 --
components/auth/RegistrationForm.tsx api/userSafety.ts api/user.ts` was empty.

No registration, report, block, deletion or test-content mutation was performed
during readiness. No existing authenticated device session has been identified
as a safe mutation target.

## Driver limitations and retained evidence

The existing driver is `tools/ios-device-uitests/MetravelDeviceUITests/RunScriptTests.swift`.
It drives an already-installed application with `XCUIApplication(bundleIdentifier:)`.
The cached manifest targets `by.metravel.deviceuitests.xctrunner` and declares
`UseUITargetAppProvidedByTests=true`; the attempted run used `test-without-building`
without provisioning updates and without replacing `by.metravel.app`.

The original cached driver reads `QA_SCRIPT` and prints `QA-SCRIPT-RAW`; a `strings`
inspection of the cached binary found those same markers plus `system-alert`
and `Allow`. This establishes matching protocol markers, not complete binary/source
identity or a successful runtime execution of these paths. Never put credentials
into this protocol. That old source interruption monitor presses Allow/OK without a
scenario-specific gate and has no documented runtime disable flag.
Limit this runner to already-authorised scenarios that cannot trigger permission
prompts until the reviewed safe input/permission channel is built and verified.
The parent independently reviewed the updated helper source and mirrored skills:
raw-script logging and automatic permission handling were removed; a private
one-shot file-to-clipboard path and explicit alert actions were added. Swift parse
and SDK typecheck passed. This helper change is separate from MeTravel 1.0.5 (9).
New helper runtime properties require the forthcoming build identity and
dummy-canary check before real credentials; they do not apply to the old cache.

Retained, redacted readiness files:

- `devices-readiness-summary.json`
- `device-app-readiness.json`
- `resume-readiness.json` (current direct probe after the owner's access action)
- `iphone-settings-readiness-summary.log`
- `iphone-settings-resumed-summary.log` (cached runner access succeeds)
- `recording-channel-probe.mov` (silent technical probe only)
- `recording-channel-probe.json` (codec, dimensions, duration and SHA-256)
- `crash-report-baseline.json` (09:34 UTC: no matching Mac-synced MeTravel
  reports; device-side unsynced reports and the future runtime remain untested)

After a completed run, add actual scenario results/timecodes, the precise runtime
and crash-log interval, a secret review, video playback verification and the
final local file checksum. Only then prepare the private transfer artifact/link
for the separately authorised Apple response step. The parent observed an
attachment action in App Review Information: a permitted private Apple
attachment may satisfy the delivery requirement; public video hosting is not
automatically required. No attachment or upload has been performed by this task.

## Live continuation after the owner's device-access action

The owner confirmed both devices were ready, then completed the requested iPad
Developer Mode action. Direct iPad app inventory now succeeds: MeTravel
`by.metravel.app` **1.0.5 (9)** is installed on iPadOS **26.6.2**, and the device is
unlocked. The older cached `developerMode=disabled` inventory field is not used to
override that successful direct query. Current TestFlight installation provenance
still requires its UI check. Source: `ipad-ready-readiness.json`.

After recreating the QuickTime preview following the device restart, the physical
iPad Home screen is visible with TestFlight and MeTravel. The earlier black
preview is resolved. No final demonstration recording has begun.

The cached automation helper failed to install on the iPad with
`MIInstallerErrorDomain 0xe8008012`. Its nonexpired development profile includes
one device and excludes this iPad; no compatible local profile was found.
This is a QA-tool signing issue, not a failure of the installed MeTravel binary.
Source: `ipad-runner-profile-readiness.json`. The owner explicitly authorised adding
the connected iPad to the development profile and building only the test helper;
the source reviewer is preparing a safe credential-input and explicit-permission
change before that helper build. MeTravel's candidate is unchanged.

Actual iPhone results on the installed 1.0.5 (9), English locale:

| Observed action | Result and limit | Evidence |
| --- | --- | --- |
| Activate MeTravel and inspect the current screen | All quests renders with 182 quests and real content; this was activation, not a claimed cold-start test | `iphone-app-initial-tree-summary.log` |
| Open the mobile menu | Drawer opens; Login and Register establish a guest session | `iphone-menu-session-summary.log` |
| Open Register | Registration form opens with empty Email and secure Password fields, a Register button, and Apple/Google actions; Facebook is absent. No account was created | `iphone-registration-surface-summary.log` |

No password, account-creation request, report, block, trip write or deletion has
been performed. The permanent reviewer account and owner accounts remain untouched.
