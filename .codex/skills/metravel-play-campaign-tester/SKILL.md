---
name: metravel-play-campaign-tester
description: >-
  Run the metravel Google Play closed-testing reciprocity campaign on the configured USB Android
  device: inspect community assignments, exercise configured apps, capture evidence, check crashes
  and available updates, and maintain the campaign log/version snapshot. Use for “daily testing pass”,
  “test campaign apps”, or “check campaign updates”. Do not buy, review, uninstall, leave tests,
  message people, or change accounts without explicit user authority.
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

## Update Check

1. Compare installed versionCodes with `versions.json`.
2. Open each configured Play listing and detect an exact `Update`/`Обновить` control from the UI tree.
3. Install only the update for the intended package, verify versionCode increased, launch it, capture evidence, and crash-check it.
4. Never tap `Uninstall`, purchase controls, ads, or unrelated buttons. Refresh `versions.json` only after the final installed state is known.

## Output

Report date, device, apps completed/total, updates, assignments, crashes, evidence path, log update, and blockers. Do not expose account data or unrelated on-device content.
