---
name: metravel-play-campaign-tester
description: >-
  Run the metravel Google Play closed-testing reciprocity campaign on the configured USB Android
  device: inspect community assignments, exercise configured apps, capture evidence, check crashes
  and available updates, and maintain the campaign log/version snapshot. Use for “daily testing pass”,
  “test campaign apps”, “check campaign updates”, or when testing must be likely to count as real
  Google Play closed-testing usage. Do not buy, review, uninstall, leave tests, message people, or
  change accounts without explicit user authority.
---

# Metravel Play Campaign Tester

Use the existing operational state as the single source of truth instead of copying it:

- `.claude/play-testing/config.json`
- `.claude/play-testing/LOG.md`
- `.claude/play-testing/versions.json`
- `.claude/play-testing/evidence/`

The directory name is legacy; Codex and Claude intentionally share the same campaign state.

## Device Gate

1. Read the campaign dates, device serial, package lists, and paths from config.
2. Run `adb devices -l`; operate only the configured device in status `device`.
3. Wake/dismiss the keyguard only when no PIN/password entry is required. A locked or unavailable device is a blocker, not permission to guess credentials.
4. Store captures only under the configured ignored evidence directory.

## Daily Pass

1. Inspect every configured community app first: tasks, notifications, messages, and assigned tests.
2. Open each configured target and own app, interact meaningfully for the configured campaign requirement, avoid ads, capture final evidence, and check package-specific crash logs.
3. Perform only clearly authorized in-app task confirmations after the real test. Do not post incentivized Play reviews/ratings, make purchases, enter personal data, message people, switch accounts, leave testing programs, or uninstall apps.
4. If an assignment requires an install or another material external action, do it only when the user’s campaign request clearly authorizes that action; otherwise log it for the owner.
5. Update the current day in `LOG.md` with completed count, assignments, crashes, skipped packages, and blockers.

## Google-Countable Testing Standard

The goal is honest closed-testing activity that a developer and Google Play reviewer could reasonably treat as real app usage, not just opening the app for a screenshot.

For every assigned app:

1. Read the assignment instructions before testing. If instructions exist, follow the deepest safe path they request: sign in only with provided test credentials, enter only neutral test data, and avoid personal accounts or sensitive data.
2. Launch the installed app from the device, not only the Play listing. If the community app opens Google Play first, tap only the safe `Open`/`Открыть` control for the intended package.
3. Spend a real session in the app. Prefer at least one meaningful in-app action: navigate to a second screen, use a core feature, create neutral test content, submit a test form, play a level, run analysis, join with a provided test code, or view a real dashboard/result.
4. Avoid shallow proof. A home page, splash screen, login screen, permission prompt, ad, error page, or Play Store page counts only when the app is blocked and no safe deeper action is possible. If proof is shallow, record the blocker and include it in the proof note.
5. Capture proof after the meaningful action, with visible in-app state that shows the tested feature or result. When possible, keep status bars and app identity visible, and prefer screenshots that would survive manual partner review.
6. Stay in the app long enough to look like a real test session. For apps with explicit duration instructions, follow them. Otherwise do not rapid-fire open/capture/close when a short interaction path is available.
7. Check for crashes or obvious blocking failures after the interaction. If the app crashes, capture/log it and upload proof only if the assignment accepts crash/blocker evidence.
8. Submit proof only after the real test is complete. If a proof is rejected, read the rejection reason, perform a deeper valid action, and re-upload a better proof instead of resubmitting the same screenshot.

Safety limits still apply: never click ads, buy, rate/review, use personal social accounts, expose private data, switch Google accounts, leave test programs, message people, or uninstall/reinstall unless explicitly authorized by the user.

Partner review rule: accept partner proof only when it shows genuine use of our app or the instructed flow. Reject proof that is only Play Store, an error page, a generic home screen with no use, a fake/irrelevant screenshot, or insufficient evidence, and give a concise actionable reason.

## Update Check

1. Compare installed versionCodes with `versions.json`.
2. Open each configured Play listing and detect an exact `Update`/`Обновить` control from the UI tree.
3. Install only the update for the intended package, verify versionCode increased, launch it, capture evidence, and crash-check it.
4. Never tap `Uninstall`, purchase controls, ads, or unrelated buttons. Refresh `versions.json` only after the final installed state is known.

## Output

Report date, device, apps completed/total, updates, assignments, crashes, evidence path, log update, and blockers. Do not expose account data or unrelated on-device content.
