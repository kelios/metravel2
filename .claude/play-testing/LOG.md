# Google Play Closed Testing — журнал кампании 2026-07-09 → 2026-07-22

Цель: 14 дней подряд ежедневная активность тестера по всем приложениям из `config.json`,
чтобы наши приложения прошли закрытое тестирование Google Play. Пропуск дня = риск провала кампании.

Правила заполнения: агент `play-tester` после каждого прохода отмечает день, число открытых
приложений, краши и найденные задания. Агент `play-update-watcher` пишет обновления.

| День | Дата       | Тест-проход | Обновления | Задания из community | Заметки |
|------|------------|-------------|------------|----------------------|---------|
| 1    | 2026-07-09 | ⏳          |            |                      | Пачка установлена вручную владельцем |
| 2    | 2026-07-10 |             |            |                      | |
| 3    | 2026-07-11 |             |            |                      | |
| 4    | 2026-07-12 |             |            |                      | |
| 5    | 2026-07-13 |             |            |                      | |
| 6    | 2026-07-14 |             |            |                      | |
| 7    | 2026-07-15 |             |            |                      | |
| 8    | 2026-07-16 | ✅          |            | TCT: uploads done; post-reset TCT: 12/12 uploads submitted; Pack Boneclaw IV: 13/13 done (100%); App Testers: 1 install/test, stopped before Play review | Evidence: `.claude/play-testing/evidence/2026-07-16/`; 110 moons; Putik/Jurisprudence retested |
| 9    | 2026-07-17 | ✅          | `com.nadeemgs.testerscommunity` 37 → 38 | Pack Boneclaw IV: 13/13 done (100%); TCT: MVG/HealthMate/Damas reuploads submitted, partner proofs accepted; GridArt/Bigpic partner proofs accepted; App Testers/NadeemGS TC checked | Evidence: `.claude/play-testing/evidence/2026-07-17/`; TCT home: `You're all caught up!`; no crash-buffer hits |
| 10   | 2026-07-18 | ✅          | none | Pack Boneclaw IV: 12/12 done (100%); TCT: 10 completed today, 2 pending states audited; App Testers/NadeemGS TC checked | Evidence: `.claude/play-testing/evidence/2026-07-18/`; bugs/risks logged: GridArt 404/waiting partner, Rocky list/detail status mismatch, own app opens dev launcher |
| 11   | 2026-07-19 | ✅          | none checked | Pack Boneclaw IV: 12/12 done (100%); TCT: 7 completed today, 5 pending partner/review waits; App Testers/NadeemGS TC inspected | Evidence: `.claude/play-testing/evidence/2026-07-19/`; 3+ minute interactive testing used for each TC task app; bugs/improvements logged |
| 12   | 2026-07-20 | ✅          | none checked | Pack Boneclaw IV: 11/11 done (100%); TCT: 4 pending uploads, 8 completed today; App Testers/NadeemGS TC inspected | Evidence: `.claude/play-testing/evidence/2026-07-20/`; 3+ minute interactive testing used for each TC task app; bugs/improvements logged; no crash-buffer hits |
| 13   | 2026-07-21 |             |            |                      | |
| 14   | 2026-07-22 |             |            |                      | |

## Найденные задания / инциденты

(агенты дописывают сюда)

### 2026-07-16 — Pack Boneclaw IV / The Closed Test

- The Closed Test: status checked, no new upload slots required; visible test cards had `MY UPLOAD Done`, one partner still `Waiting`, and home showed `MeTravel` recruiting `10 / 12 Testers`.
- Pack Boneclaw IV: completed 13 of 13 daily open-test tasks, daily progress 100%, all tasks complete.
- Moons balance after pass: 110.
- Author feedback sent/retested:
  - `Putik`: still blocked by employee login; asked for demo credentials or guest mode for testers, then completed as blocker feedback.
  - `Jurisprudence (3Y LL.B)`: retested successfully after prior ad issue; opened study docs and read `Nature and Value of Jurisprudence`, then completed feedback.
- Apps exercised successfully with in-app actions: Kolorino, PraEx, Priority dz, Ball Sort - Zen, Denkleşelim, First Time Daddy, Call Of Poker, Kitchen Match & Merge, Smart Bill POS, BareMacros, `運の社`.
- App Testers: `Smart Spirit Bubble Level Tool` link returned Play Store `File not found`; `Food Feast - Tapri Rush` was installed, profile created with neutral test data, gameplay controls tested, then stopped at App Testers step `Leave a review on the Play Store` because incentivized Play reviews are not allowed.

### 2026-07-16 — The Closed Test post-reset pack

- After the TCT reset, `My Tasks` showed `12 pending • 0 completed today`; submitted all 12 `MY UPLOAD` proofs so visible items moved from `Required` to `Pending`.
- Submitted TCT uploads: Earth radio Day 4, MVG Public School Day 5, 12 testers app closed testing Day 2, School Master App Day 5, Libera Day 5, My Healthmate Day 4, Insta saver Day 4, Damas Go Day 3, Loam - Moto Day 2, GridArt Day 9, Bigpic Day 9, Rocky Decodes Calories Day 9.
- Installed and tested `Loam - Moto` (`app.loam.moto`); used demo garage and maintenance details for 30+ seconds, uploaded proof, and accepted partner proof that showed real MeTravel usage.
- Strong in-app proof captured for Earth radio, App Testers, Loam, GridArt, Rocky Decodes Calories, Insta saver and My Healthmate. Weak-proof risk: Bigpic opened an ad activity before capture; MVG Public School, School Master App, Libera and Damas Go returned to TCT during launch attempts, so their TCT uploads may need partner tolerance or later replacement if rejected.

### 2026-07-17 — Daily pass / TCT cleanup

- Device: Pixel 10 Pro `61020DLCH0086L`, USB/adb authorized.
- TestersCommunity Pack Boneclaw IV: completed all daily app-open tasks through task-row flow; final screen showed `Open & test apps today (13/13 done)`, `Daily Progress Complete!`, `All tasks complete!`.
- The Closed Test cleanup:
  - MVG Public School Day 5 was rejected as `Not enough proof of usage`; retested dashboard after login, uploaded fresh proof, accepted partner MeTravel proof.
  - My Healthmate Day 4 was rejected as `Please open my app`; retested app screen after scrolling, uploaded fresh proof, accepted partner MeTravel proof.
  - Damas Go Day 3 was rejected; retested game board against computer, uploaded fresh proof, accepted partner MeTravel proof.
  - GridArt Day 9 and Bigpic Day 9: our proofs were already approved; accepted partner proofs after visual MeTravel verification.
  - Final TCT home showed `You're all caught up!`.
- App Testers `com.nadeemgs.apptesters`: opened home/profile; no daily tasks, wallet `0/0`, no pending proof/review action.
- NadeemGS TestersCommunity `com.nadeemgs.testerscommunity`: app required Play Store update; updated 1.2.x/37 to 1.3.0/38, then opened home/profile/My Apps. Wallet `20/0`; `My Apps` showed `No apps uploaded yet`; no required action found.
- Crash check: `adb logcat -d -b crash` filtered for campaign/community packages returned no relevant crash entries.

### 2026-07-17 — Proof correction audit

- Added a mandatory `Proof Upload Gate` to `.codex/skills/metravel-play-campaign-tester/SKILL.md`: exact foreground package check, local visual preview, exact media-picker selection, post-selection thumbnail verification, and no claim of replacement when TCT does not expose replacement controls.
- TCT Libera Day 5 partner proof was wrong: screenshots showed non-MeTravel content/TCT-style evidence. Rejected it with reason `Wrong app shown`; final status: `You rejected 's proof. Waiting for them to upload again.`
- TCT Insta saver Day 4 audit found our pending proof thumbnail is wrong: it shows TCT instead of the target app. TCT exposes no `Remove`, `Replace`, `Upload`, or `Submit` controls while proof is `Waiting for Review`, so it cannot be corrected until the partner/app rejects or unlocks replacement. Correct replacement proof prepared and visually verified: `instasaver_retest_correct_activity.png` / `/sdcard/Pictures/MetravelPlayEvidence/instasaver_retest_correct_home.png`.
- TCT Rocky Decodes Calories Day 9 audit: pending proof thumbnail shows the Rocky app calorie dashboard, not TCT. A stronger replacement candidate was also prepared and visually verified: `rocky_retest_correct_after_permission.png` / `/sdcard/Pictures/MetravelPlayEvidence/rocky_retest_correct_after_permission.png`.

### 2026-07-18 — Daily pass

- Device: Pixel 10 Pro `61020DLCH0086L`, USB/adb authorized.
- TestersCommunity Pack Boneclaw IV: completed all 12 daily tasks through the task-row flow. Each task was opened via `Start Testing`, foreground package was checked, app was kept open for a real session, then feedback/completion was submitted. Final screen showed `Open & test apps today (12/12 done)`, `Daily Progress Complete!`, `All tasks complete!`.
- TestersCommunity tasks completed: PraEx, BareMacros, Priority dz, Putik, `運の社`, Denkleşelim, Kitchen Match & Merge, Kolorino, Call Of Poker, First Time Daddy, Ball Sort - Zen, Smart Bill POS.
- TCT: home initially showed `You're all caught up!`; Tests tab later showed `2 pending • 10 completed today`. Audited the visible pending uploads:
  - Damas Go Day 4: proof thumbnails show real Damas Go flow/screens; no replacement needed.
  - GridArt Day 10: proof thumbnails mostly show real GridArt UI/settings/about, but one thumbnail shows an in-app `404_NOT_FOUND` screen. Bug/risk: GridArt produced a 404 during the test flow.
  - Rocky Decodes Calories Day 10: proof thumbnails show real Rocky dashboard/privacy/goals/food flow. TCT also warns `Partner hasn't approved 1 old screenshot`; this is a partner-review risk, not a new upload issue.
- Final TCT recheck after user report:
  - GridArt Day 10: `YOUR PROOF Waiting for Review`; `PARTNER'S PROOF Waiting for Partner`. No upload/replace controls were available; waiting is on partner/review.
  - Rocky Decodes Calories Day 9: both our proof and partner proof are approved.
  - Rocky Decodes Calories Day 10: detail view shows `YOUR PROOF Waiting for Review` with correct Rocky thumbnails and partner proof approved, but the Tests list still labels it `MY UPLOAD Required`. Bug/risk: TCT list/detail status mismatch; no upload/replace/submit controls are available in detail, so re-upload is not possible or appropriate now.
- App Testers `com.nadeemgs.apptesters`: opened home/profile; no daily tasks or pending actions, wallet `0/0`.
- NadeemGS TestersCommunity `com.nadeemgs.testerscommunity`: opened home/profile/My Apps; wallet `20/0`; `My Apps` showed `No apps uploaded yet`; no required action found.
- Own app check: `by.metravel.app/.MainActivity` opens Expo `Development Build` launcher instead of the production MeTravel UI. Treat this as an Android installation/state risk before using this installed package as proof.
- Crash check: `adb logcat -d -b crash` filtered for all tested/community packages returned no relevant crash entries.

### 2026-07-19 — Daily pass

- Device: Pixel 10 Pro `61020DLCH0086L`, USB/adb authorized.
- TestersCommunity Pack Boneclaw IV: completed all 12 daily tasks. Final task screen showed `100%, YOUR MISSION`, `Open & test apps today (12/12 done)`, `Daily Progress Complete!`, `All tasks complete!`.
- Per user instruction, assigned TC apps were tested with 3+ minute interactive sessions, not passive opens. Retested weak attempts instead of counting them:
  - BareMacros: opened `ADD CUSTOM MEAL`, tested custom grams/per serving form. Improvement: first-run guidance/examples for custom meal entry could be clearer.
  - PraEx: answered and advanced through driving quiz questions up to later quiz screens. Improvement: long answer options are dense on mobile.
  - Putik: tested employee login screen with neutral credentials and password visibility. Bug/blocker: no demo/guest/tester access; closed testers cannot reach the attendance/employee flow. Additional UX issue: field focus was easy to mis-hit and test password text appended into the email field during input.
  - Smart Bill POS: navigated Dashboard/Inventory/Billing/Khata/Settings and reached inventory item state. Improvement: ad banner sits close to operational POS tabs; target/item flows need clearer confirmation.
  - Kitchen Match & Merge: first attempt only reached level map, so it was not counted; retested Level 1 with active board interactions. Improvement: start/menu ad is prominent and easy to hit accidentally.
  - Ball Sort - Zen: started a level and performed tube moves. Improvement: add a short tutorial/rules hint before the first puzzle.
  - Kolorino: opened `По номерам`, colored a drawing to 24%. Improvement: selected-number zones could be highlighted more strongly for first-time users.
  - `運の社`: opened fortune/oracle flows and captured a result. Improvement: add a language toggle or short English description if international testers are expected.
  - Call Of Poker: first attempt stopped at mode/tutorial screens, so it was not counted; retested Memory Game until the card grid and score were visible. Improvement: tutorial continue arrow/CTA is not obvious enough.
  - Denkleşelim: opened room and `Harcama Ekle` expense form. Improvement: keyboard can cover lower form actions; add better scrolling/focus handling around amount/category/save.
  - First Time Daddy: first attempt returned to TestersCommunity before 3 minutes, so it was not counted; retested 3+ minutes inside the app across Home/Weekly/Guide/Journal/content. Improvement: clarify privacy/local-only status for Journal entries.
  - Priority dz: opened main mode and interacted through level/progression screens. Improvement: bottom ad remains close to level/navigation area; optional language hint could help non-Arabic testers.
- TCT: final Tests list showed `5 pending • 7 completed today`.
  - Loam - Moto Day 4 partner proof was visually checked before action: proof opened MeTravel web/article usage, so it was acceptable evidence.
  - Remaining visible pending states were already `MY UPLOAD Pending` with `PARTNER Waiting`: Libera Day 7, Insta saver Day 6, Damas Go Day 5, GridArt Day 11, Rocky Decodes Calories Day 11. No upload/replace controls were available, so no re-upload was attempted.
- App Testers `com.nadeemgs.apptesters`: inspected current `Test Apps` list. No safe mandatory proof action was found; no Play Store reviews/ratings were performed.
- NadeemGS TestersCommunity `com.nadeemgs.testerscommunity`: inspected current `Test Apps` list and wallet state; no mandatory proof action was found.
- Crash check: `adb logcat -d -b crash` filtered for tested/community packages returned no relevant crash entries.

### 2026-07-20 — Daily pass

- Device: Pixel 10 Pro `61020DLCH0086L`, USB/adb authorized.
- TestersCommunity Pack Boneclaw IV: completed all 11 daily tasks. Final screen showed `100%, YOUR MISSION`, `Open & test apps today (11/11 done)`, `Daily Progress Complete!`, `All tasks complete!`.
- Per user instruction, every assigned TC app was tested with a 3+ minute interactive session and visual proof inspection before completion. Weak/incorrect screens were not counted:
  - Putik: retested directly in `com.baihaqi.putik`; login form/password toggle checked without submitting credentials. Bug/blocker: no demo/guest/tester access, so closed testers cannot reach the employee/attendance flow. Prior wrong screenshots/system password/Translate popups were not used as proof.
  - Priority dz: played through Arabic level/progression screens. Improvement: bottom ad remains close to level/navigation controls; optional language hint could help non-Arabic testers.
  - Kolorino: TC `Start Testing` routed to Google Play despite the package being installed, so the app was launched via exact activity; opened `По номерам` and colored a drawing. Improvement: selected-number areas could be highlighted more clearly.
  - First Time Daddy: tested Home/Weekly/Guide/Journal and Week 14 content. Improvement: Journal should clarify privacy/local-only/sync behavior because entries are sensitive.
  - `運の社`: tested omikuji/dice/oracle flows and captured a result screen. Improvement: add a language toggle or short English description for international testers.
  - BareMacros: used quick macro buttons, Meals/Search, Track/date controls; final proof showed updated kcal and P/C/F totals. Improvement: floating Search button overlaps lower content on the test device.
  - Ball Sort - Zen: started a puzzle and performed tube moves for 208 seconds. Improvement: add a short first-level rules hint before the puzzle.
  - Call Of Poker: entered Memory Game, flipped cards for 220 seconds, and captured score/progress. Improvement: tutorial continue arrow is not obvious; negative Memory/Hero points need explanation.
  - Kitchen Match & Merge: opened Level 1 and performed board swaps for 184 seconds; final proof showed `6/22` and `27 Moves`. Improvement/bug risk: an install ad appears on the start screen and is close enough to be easy to hit by mistake.
  - Denkleşelim: opened room `test`, added neutral expense `QA_test` for `₺5,00`, and verified total changed to `₺15,00`. Improvement: numeric keyboard can cover lower form actions/categories until dismissed.
  - PraEx: answered Portuguese driving quiz questions from 1/25 to 9/25 over 207 seconds. Improvement: long answer options are dense on mobile and hard to scan quickly.
- TCT (`com.theneerajsec.theclosedtest`): Tests screen showed `4 pending • 8 completed today`; visible pending items were School Master App Day 8, Libera Day 8, Insta saver Day 7, and Rocky Decodes Calories Day 12. Each showed `MY UPLOAD Pending` and `PARTNER Waiting`; no `Upload`, `Replace`, `Remove`, or `Submit` control was available, so no blind re-upload was attempted.
- App Testers `com.nadeemgs.apptesters`: opened home/test list; no rate modal at inspection time and no mandatory proof action found.
- NadeemGS TestersCommunity `com.nadeemgs.testerscommunity`: opened home/test list; no mandatory proof action found. No Play Store review/rating was performed.
- Crash check: `adb logcat -d -b crash` filtered for the 11 tested packages returned no relevant crash entries.
