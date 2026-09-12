# MeTravel App Review — physical-device evidence, 12 September 2026

Task: #1889. Candidate: **1.0.5 (9)**, source
`8ae84cb56b578013a0fa1c3ec75c8d5524982c1a`. This is an active evidence protocol;
it does not certify completion of the App Review demonstration.

Latest operational state: the owner resolved the device-access prompts. Both
reviewed test helpers are built, and physical TestFlight UI confirms candidate
1.0.5 (9) on both devices. The iPad runs current iPadOS 26.6.2; the iPhone runs
iOS 26.5. Four chapters are saved: iPad guest navigation (151.56 seconds),
owner-entered iPad reviewer login (213.19 seconds), the owner's iPhone
scenario (206.73 seconds), and iPad authenticated settings/personal planning
(432.53 seconds). Physical reviewer sign-in succeeded on iPad, and the later
chapter verifies session persistence after termination, deletion-entry
visibility, reversible favourite addition/removal and a saved dated personal
route in Calendar. A silent 181.5-second partial edit is now saved with explicit cut markers; all
credential-entry and phone footage is excluded. Its whole timeline has a
one-second sampled visual review, not continuous playback or an every-frame
privacy certification. The source recordings remain private. The helper's dummy
Paste channel was not accepted and no real credentials were sent through it.
Authorization to create the two named disposable accounts and the remaining
acceptance scenarios are still outstanding. No complete App Review demonstration
is certified. See the latest checkpoint below; older lock/XCTest failures remain
historical evidence.

## Resume checkpoint — 12 September, 12:51 UTC

- After the owner's unlock, the cached helper read the physical iPad screen/tree
  in approximately 9 seconds. Candidate remains TestFlight 1.0.5 (9), iPad mini 6,
  iPadOS 26.6.2. The reviewer session was reversibly logged out.
- A 22.56-second physical recording shows guest Login → Register. The complete
  visible form has empty Email/Password fields and no separate Terms checkbox
  or consent wording. No registration submission or account creation occurred.
- Source: `device/recorder-resume/registration-entry.mp4`, H.264, 1488×2266,
  with an audio track; keep this source private. A video-only derivative is
  `device/recorder-resume/registration-entry-silent.mp4`, SHA-256
  `aedf587c1f6ad72431d42fa8c6f4991ac80b9909316699b749bb986226009c1e`.
  This is registration-entry evidence, not registration/activation success.
- Screenshot: `device/recorder-resume/registration-capture/register-screen.png`.
  The existing Gmail tab is signed in to the intended activation mailbox;
  activation messages have not been accessed and no accounts have been created.
- The subsequent short dummy-input check stopped before the test body on
  `deviceprep Code=-3` asking to unlock iPad. No real credentials were used.
  A dummy-only file remains staged in the helper container for the next probe.
- Next: obtain the pending named-account decision, unlock immediately before
  resuming the prepared dummy probe, verify input and cleanup, then execute the
  registration/activation scene. Preserve the permanent reviewer account.


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

Read-only `xcrun devicectl` probes and the later physical UI checks on
12 September established:

| Layer | Actual state | What this proves |
| --- | --- | --- |
| Physical iPhone 13 mini | iOS 26.5; paired; Developer Mode enabled; unlocked at 10:28:21 UTC; installed inventory and later TestFlight UI show 1.0.5 (9) | Exact-candidate compatibility target; the owner's 206.73-second recording is saved. This is not latest-OS evidence. |
| Physical iPad mini 6 (`iPad14,1`) | iPadOS 26.6.2; unlocked at 10:28:21 UTC; installed inventory and TestFlight UI show 1.0.5 (9); Software Update reports up to date | Latest-OS physical target. Guest chapter and successful reviewer login are recorded; full demonstration acceptance remains incomplete. |
| Other paired iPhone | iPhone 16 Pro, iOS 26.6; unavailable | Not a usable recording target in this session. |
| QuickTime physical video | Both Screen/device-audio sources worked; three iPad chapters and one iPhone chapter are saved with silent derivatives | Actual physical recording evidence is available. Final playback/privacy review and remaining scenarios are still required. |
| iPhone Mirroring | App failed to remain running when selected through computer use | No usable touch channel from Mirroring was established. |
| Existing XCUITest driver | Initial runner-only attempt timed out on the XCTest passcode prompt. After the owner's access action, the same cached Settings-tree scenario passed | Physical iPhone touch/tree access is now working; this operational probe is not a product-scenario pass. |

The first disconnected iPad inventory reported 18.7.8 and unavailable. The resumed
direct probe returned **26.6.2**, so the earlier value is historical cache evidence,
not the tablet's current OS. Both devices were unlocked at that readiness check;
any later access request must be based on a fresh observation, as recorded below.

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
succeeds. The later helper-signing completion is described below.

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

The reviewed safe helper was committed and pushed at `2dcc62d1a`. Its first
authorised iPad-only `build-for-testing` attempt exited 65 before Swift
compilation: Xcode reported `No Accounts: Add a new account in Accounts settings`
and the cached profile still excluded the iPad. Xcode 26.6 → Apple Accounts was
opened and directly showed an empty account list with `Add Apple Account…`.
This access gate requires the owner to finish developer sign-in; it is not a
MeTravel runtime failure. No profile update or candidate build succeeded in that
attempt. Evidence: `safe-helper/build-result.json` and `safe-helper/build-summary.log`.

A local fallback check confirmed that the existing helper profile includes the
iPhone 13 mini and that a profile certificate fingerprint matches an available
local codesigning identity. A sequential helper-only iPhone build can therefore
use the existing automatic-signing state without portal/provisioning-update
flags while iPad access is resolved. This does not establish safe-input runtime
behaviour: the new helper still requires binary identity and a dummy canary with
both attachment lifetimes set to `keepNever` before any real credentials.
Evidence: `iphone-safe-helper-fallback-readiness.json`.

The iPhone helper fallback then built successfully (exit 0) without provisioning
update/device-registration flags. The resulting test binary SHA-256 is
`525f99690117a03ff47b2479b8af996ffab7e82c041ea9eed4a7407fec7fb64e`;
its runner supports device families `[1,2]`, contains the private-input protocol
marker, and does not contain the old raw-scenario print marker. The generated
runtime manifest explicitly sets both attachment lifetimes to `keepNever`.
Evidence: `safe-helper-iphone/binary-identity.json` and `build-result.json`.
A read-only initial run using this new helper passed and still showed the empty
guest registration form. The first dummy-only clipboard/long-press attempt then
displayed the physical iPhone passcode prompt `Enable UI Automation` for XCTest;
the owner was asked to complete that exact action. This is not a passing secret
canary, and no real MeTravel credentials have been sent through the helper.

The owner subsequently added the Apple account in Xcode. A fresh Accounts UI
check shows a development team and `Sign Out`, replacing the empty account list;
the first iPad build failure above is now historical access evidence. The
authorised iPad helper build can be retried once the current device operation
finishes. Team/account/device identifiers are excluded from retained evidence.

The iPad retry produced `TEST BUILD SUCCEEDED` with completed compilation/signing
and no build errors. Its `xcodebuild` process then remained in macOS's exiting
state; only the waiting task wrapper was interrupted after that state and the
success marker were verified. An exit-code-0 result is not claimed. Independent
artifact checks passed: the new embedded profile includes the connected iPad,
`codesign --verify --deep --strict` succeeds, and the runner has device families
`[1,2]`. The iPad helper test binary SHA-256 is
`17216cb7c78a07878636e4b09619fe52fb08f60db336939e5f345b59835062ee`.
Sources: `safe-helper/build-result.json`, `safe-helper/binary-identity.json`.

The following iPad TestFlight run encountered the physical device's ordinary
lock screen before the test body started; its log requests Unlock. QuickTime
also shows the locked physical iPad with Touch ID. The owner was asked to unlock
it and complete a subsequent XCTest passcode prompt if shown. This does not
establish a TestFlight or MeTravel failure. The iPhone dummy attempt likewise
does not establish private-input safety: the navigation-only test body completed,
but no Paste/value verification occurred and the orchestration timed out.

## Recorded guest chapter and current sign-in gate

After the owner confirmed both devices unlocked, a fresh direct probe at
10:28:21 UTC showed `passcodeRequired=false` on both targets. On the physical
iPad, TestFlight visibly confirms MeTravel **1.0.5 (9)** with an Open action,
the same previous-build entry, and compatibility with this iPad. Settings →
Software Update subsequently reports **iPadOS 26.6.2**, up to date, beta updates
off. Sources: `owner-unlocked-both-lock-state.json`,
`ipad-testflight-provenance.json`, `ipad-latest-os-verified-summary.log`.

The iPad app was switched to English; its menu showed Login and Register,
confirming a guest session. A **151.56-second physical guest chapter** is saved:

- `ipad-guest-demonstration.mp4`: video-only stream copy for review preparation;
  1488×2266, H.264. No audio track.
- `ipad-guest-demonstration-raw.mov`: original QuickTime capture, including the
  selected iPad system-audio stream; not the transfer artifact.
- `ipad-guest-demonstration.json`: original metadata and checksum. Raw SHA-256:
  `d0fa7738bd0a3ea8d7e07f33dbd819582f0824f20f8bf325afbb97b12730aca5`.

The recorded path is TestFlight candidate details → explicit app termination
and activation → catalogue → Bobrowisko travel detail → route map with visible
OpenStreetMap tiles/markers → article description → All quests (182) → Krakow
quest overview. The corresponding `ipad-video-*` runs exit 0. The root reviewer
independently sampled frames every five seconds and enlarged the TestFlight
frame: the visible sequence matches those actions, with no visible secrets or
personal notifications in those samples. **Full playback and final timecodes
remain outstanding. This guest chapter is not the complete App Review demo.**

Recording stopped before any sign-in input. The iPad Login initially had empty
Email and Password fields. The private dummy Paste test body passed, with no
full marker or unique marker fragments found in stdout, raw result data,
activities or action logs; exported attachment count was zero. Separate console
export was unavailable. However, an independent field check did **not** observe
the dummy value after Paste. Therefore the private-input channel is **not
accepted**, and no real credentials were transferred through it. Sources:
`safe-helper-iphone/canary/ipad-paste-canary/scan.json`,
`safe-helper-iphone/canary/ipad-value-verification.json`.

Further helper-input retries were stopped. At this checkpoint the requested
access action was the owner's normal sign-in to the permanent reviewer account
on the already open iPad Login screen, without saving the password in Keychain.
The following section records that action's completion. The temporary-account registrations still
require their separate pending consent; neither registration nor account
deletion was performed. The iPhone's unsent Autofill-populated registration was
left through Back → menu → Login without submission or password saving.

## Owner-recorded sign-in and iPhone continuation

The owner explicitly requested recording her manual Login entry on the physical
iPad. QuickTime recording was started and its Stop action/timer verified before
the owner entered the password. The password reveal control was not operated
by the agent. Subsequent live observation and `ipad-video-reviewer-profile`
confirm successful physical sign-in as the permanent reviewer display name
`Редакция metravel`; the profile and its existing subscription content load.

That private input chapter is preserved as
`ipad-reviewer-login-private.mp4` (video only), with raw
`ipad-reviewer-login-private.mov` and metadata in
`ipad-reviewer-login-private.json`. Duration: **213.192 seconds**, 1488×2266.
MP4 SHA-256:
`36c836e5b6b3fa855fbc85031634695e2cb1c16e012de7a4ceb52cb71912b11f`.
It starts at 10:45:14 UTC and ends approximately 10:48:47 UTC. The next UI check
found recording already stopped; the agent did not infer that it continued
through later device actions. Password-entry/keyboard frames have not yet been
reviewed or redacted, so this chapter is **private and not approved for sharing**.

Settings was reached in the later `ipad-video-settings-open` runtime run at
10:50 UTC. Its tree contains Privacy Settings and Delete account, but the latter
was below the viewport and was not tapped. That later Settings action cannot be
claimed as present in the 213-second chapter. Cold-restart session persistence,
reversible favourite verification and the planned disposable-account chapters
remain unperformed at this checkpoint.

The iPhone TestFlight UI separately confirms MeTravel **1.0.5 (9)** with an Open
action: `iphone-testflight-provenance-final-summary.log` (exit 0). The owner then
explicitly chose to perform the phone demonstration herself. QuickTime was
switched to the iPhone screen and its device-audio source, and a live Stop
action/timer plus phone image confirmed recording active. The phone was then
signed in as the owner's personal display name `Julia Savran`, not the reviewer
account, on Messages → New dialogue. The agent left that device untouched
while the owner performed her requested scenario. During this owner-run phone
recording, no account, message, trip or favourite mutation was executed by the
agent. The iPhone's iOS 26.5 is
compatibility evidence and is not described as the latest OS.

## Saved iPhone owner scenario

After the owner said she had finished, QuickTime's Window menu identified the
separate `Без названия 3` movie. It was already stopped at **03:27**, so the agent
did not toggle recording. The observed autosave URL was copied only after its
file size and modification time remained stable across a metadata probe.

- `iphone-owner-main-scenario-private.mov`: original capture, H.264 and AAC,
  **206.728625 seconds**, 1082×2340, created at 10:52:34 UTC. Raw SHA-256:
  `69c226470b1ce797b42e9c6f06daf964e1097733aeec99a052f3c8544f9f9f7d`.
- `iphone-owner-main-scenario-private.mp4`: video-only stream copy with identical
  recorded pixels/timing; SHA-256:
  `20b8a2e1acb62e720470087c4cb15a350fbf5227995358121cbf1c4e903d74bd`.
- `iphone-owner-main-scenario-private.json`: stream metadata and checksums.
  `iphone-owner-recording-observations.jsonl` retains live checkpoints.

The initial paused QuickTime image identifies TestFlight MeTravel **1.0.5 (9)**;
this observation is not a frame-accurate playback timecode. Live
observations were approximately 00:15 Messages → New dialogue in the personal
account, 02:05 catalogue/search with keyboard, and 03:18 the public Elnya article.
The extracted final frame also shows that article, the Comments tab and its
embedded public Instagram content, with the personal account header still
visible. These observations prove those individual screens only. They do not
establish that reviewer login, favourite/plan mutations, profile/settings or
every instructed scenario occurred somewhere in this recording.

The original and silent derivative remain **private, not approved for sharing**.
The opening personal Messages segment must be excluded from the sharing copy;
the exact cut and any other private-input interval require full playback review.
The agent has stopped device actions while the parent reviews the saved files.
No App Store upload or submission was performed.

## Recorded authenticated settings and personal planning

The next direct iPad lock check at 11:04:55 UTC returned
`passcodeRequired=false`; the reviewer session remained signed in, and the
interface was English. No credential or other text input was used. The existing
reviewed helper was reused without a build, installation or wrapper change.

The following dedicated-reviewer actions passed with matching live recording
observations and `ipad-authchapter-*` test logs (each runner exit 0):

| Scenario | Actual result | Approximate source interval |
| --- | --- | --- |
| Settings and deletion-entry visibility | Scrolled to Account: `You are logged in`, Log out and **Delete account** are visibly on screen. Application version shows iOS 1.0.5, assembly 9. No deletion control was tapped. | 00:48–00:55, retained on screen afterwards |
| Cold process restart | Explicit terminate → activate → Profile returns the reviewer header and profile without new credentials. | 01:58–02:06 |
| New favourite | Preexisting Bobrowisko was already selected and was left intact. Rysy (travel 738) started unselected, then displayed selected state and `Added to "I want to go"`. | 03:10–03:17 |
| Restore favourite baseline | Removed only the newly added Rysy item: button becomes unselected and `Removed from "I want to go"` appears. | 03:31–03:39 |
| Personal planned route | Article → Add to plan → I'm planning → calendar date **2026-09-19** → Save. Toast and route status confirm the date. | Save 06:06–06:15 |
| Open saved plan | Profile → Calendar shows `I'm planning (1)`, Rysy and its date. Selecting September 19 filters that card, which opens the same route. | 06:35–07:04 |

The new personal planned route is retained in the reviewer account for Apple.
This is **personal route planning**, not creation of a public community trip.
The separate Trips → Organize form was only inspected, then left without input,
accepting its organizer disclaimer, or submission. Its form-only interval around
04:04 is not a successful trip-creation result and should not be presented as one.
Two helper text selections did not reach their intended controls; fresh visible
geometry corrected those taps. These instrument misses are not app failures.

The actual stopped recording is **432.526250 seconds**, 1488×2266, H.264:

- `ipad-authenticated-settings-plan.mp4`: silent stream copy; SHA-256
  `1dc9517278a431e9a21e58faf735bf8d2b1deaca455cc3794d39adf76edcc216`.
- `ipad-authenticated-settings-plan-raw.mov`: original device-video/system-audio
  capture; SHA-256
  `bb555746e895a352de55536257e35ff06bb332238b8a0fc2c9d4bf383fc0f692`.
- `ipad-authenticated-settings-plan.json`: metadata and approximate scenario
  times derived from runner timestamps and recording creation time 11:06:06 UTC.

These approximate intervals assist playback review and are not final cut points.
The file is saved locally and still requires complete playback/privacy review
before sharing. No registration, report, block, permanent-account deletion,
App Store write or new MeTravel build was performed in this chapter.

The parent's subsequent ten-second sampling of the older iPad login chapter
found authenticated Home already at 00:10, followed by owner-performed profile,
sharing/navigation and route interactions. Therefore the earlier rough estimate
of a one-to-one-and-a-half-minute private entry interval is withdrawn: inspect
00:00–00:10 densely to locate the actual entry/cut boundary. Sampled observations
do not replace full playback or establish unsampled action results.

## Partial edited video and review boundary

The local **`review-demonstration-partial.mp4`** is a **181.500-second** silent
edit: H.264, 896×1500, 30 fps, 5,445 frames. SHA-256:
`57dd1dbac7e4fe46baf27c440a2d5f4ef28acf736c6f1ae1d77ab47b2a4aada8`. The exact output metadata, source ranges and
per-segment captions are in `review-demonstration-partial.json`, under the ignored
device evidence directory. This is evidence of **1.0.5 (9)** on the physical iPad
mini 6 with iPadOS 26.6.2. It does not establish behaviour of a later candidate.
No file has been submitted or uploaded to Apple.

The intro and outro explicitly mark this as partial; each source cut has a
0.5-second **EDIT / SOURCE CUT** card, and source-clock ranges remain on screen.
A separate **SIGN-IN INPUT OMITTED** card replaces all credential-entry footage.
The only excerpt from the older reviewer-login recording is **00:14–00:20**,
after the owner has signed in and after the Save Password prompt. No keyboard,
key popup, password field or credential-entry frame from that recording is used.
The prior experimental masked 00:00–00:04 excerpt was rejected and removed;
its pixel-mask test is not a privacy pass. The phone recording and all private
messages, secondary sign-in, comment and external-app intervals are excluded.
All original raw MOV and silent MP4 files remain preserved locally.

The following are half-open source ranges in the **silent MP4 video timeline**,
not estimated runner wall-clock times or the raw MOV duration. Inside each
excerpt time is unchanged; variable-rate source frames are normalised to 30 fps.
A restart is shown in two explicitly separated excerpts; the saved runtime
terminate/activate evidence supports the session-persistence result.

| Output time | Chapter | Source video time |
| --- | --- | --- |
| 00:04.000–00:10.000 | 01 · Exact TestFlight candidate | `ipad-guest-demonstration.mp4` 00:00.000–00:06.000 |
| 00:10.500–00:20.500 | 02 · Guest launch and catalogue | `ipad-guest-demonstration.mp4` 00:11.000–00:21.000 |
| 00:21.000–00:30.000 | 03 · Open a travel article | `ipad-guest-demonstration.mp4` 00:31.000–00:40.000 |
| 00:30.500–00:42.500 | 04 · Route map | `ipad-guest-demonstration.mp4` 01:10.000–01:22.000 |
| 00:43.000–00:56.000 | 05 · Description and quests | `ipad-guest-demonstration.mp4` 01:37.000–01:50.000 |
| 00:56.500–01:07.500 | 06 · Quest overview | `ipad-guest-demonstration.mp4` 02:09.000–02:20.000 |
| 01:10.500–01:16.500 | 08 · After reviewer sign-in | `ipad-reviewer-login-private.mp4` 00:14.000–00:20.000 |
| 01:17.000–01:22.000 | 09 · Reviewer settings | `ipad-authenticated-settings-plan.mp4` 00:00.000–00:05.000 |
| 01:22.500–01:38.500 | 10 · Account controls and version | `ipad-authenticated-settings-plan.mp4` 00:46.000–01:02.000 |
| 01:39.000–01:41.000 | 11A · Before process restart | `ipad-authenticated-settings-plan.mp4` 01:56.000–01:58.000 |
| 01:41.500–01:49.500 | 11B · After terminate / relaunch | `ipad-authenticated-settings-plan.mp4` 02:02.000–02:10.000 |
| 01:50.000–02:00.000 | 12 · Add a new favourite | `ipad-authenticated-settings-plan.mp4` 03:08.000–03:18.000 |
| 02:00.500–02:07.500 | 13 · Restore favourite baseline | `ipad-authenticated-settings-plan.mp4` 03:30.000–03:37.000 |
| 02:08.000–02:18.000 | 14 · Personal route planning | `ipad-authenticated-settings-plan.mp4` 05:44.000–05:54.000 |
| 02:18.500–02:31.500 | 15 · Save the planned date | `ipad-authenticated-settings-plan.mp4` 06:04.000–06:17.000 |
| 02:32.000–02:43.000 | 16 · Saved route in Calendar | `ipad-authenticated-settings-plan.mp4` 06:34.000–06:45.000 |
| 02:43.500–02:57.500 | 17 · Filter and open the saved route | `ipad-authenticated-settings-plan.mp4` 06:51.000–07:05.000 |

Output 00:00–00:04 is the intro; 01:08.000–01:10.000 marks omitted sign-in input;
02:57.500–03:01.500 is the partial-evidence outro. Other gaps in the table are
explicit cut cards, not hidden continuity.

### Checks actually completed

- Full decoding/frame counting of all four saved silent sources completed. The
  phone produced two non-monotonic DTS warnings from the null output muxer;
  it is excluded from the edit. The other three sources had no decoder
  diagnostics. See `montage-review/whole-source-decode.json` and
  `phone-decode-diagnostics.txt`.
- Visual source review covered two-second preview bins over the guest, older
  iPad reviewer-login and phone timelines, with credential areas hidden in
  private previews. Exact seeks at 00:00 through 00:10 established the iPad
  login-to-Home boundary: Login at 00:09 and Home at 00:10. The phone instead
  shows TestFlight at 00:00–00:01, a transition at 00:02 and Login at
  00:03–00:10. Earlier coarse sample labels are not exact event timestamps.
- The authenticated-settings source was inspected at selected exact source
  times around the retained actions; the entire 432-second raw chapter has
  **not** received continuous visual playback review.
- The output was decoded in full and reviewed through one-second preview bins
  across its whole duration. This is a complete sampled timeline review,
  **not continuous playback or an every-frame privacy certification**. No
  visible credential entry or private messages were found in the retained
  sampled excerpts. Reproduction and limits are recorded in
  `review-demonstration-partial-review.md` and
  `montage-review/final-output-validation.json`.

The older iPad owner chapter also contains a later submitted comment, rather
than only a draft, and a message interaction. These observations come from the
recorded timeline; their text is not reproduced here. They were not performed
or cleaned up during this processing task and do not enter the edited video.

Registration/activation, reporting, blocking and actual disposable-account
deletion remain absent. Deletion-entry visibility is not deletion success.
The saved personal Calendar route is not a public community-trip creation.
This partial file is ready for local review, **not certified as the complete
Apple-requested demonstration or as a fully reviewed sharing artifact**. Before
external sharing, finish the missing acceptance chapters and inspect the entire
final output, including transitions, with full playback and frame-level review
of any sensitive interval. No device action, account mutation, new build or
store operation occurred during this editing block.
