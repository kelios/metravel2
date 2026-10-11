## 1. Calendar core and registry

- [x] 1.1 Confirm separate apply request, main branch and clean task-owned paths; record full task preflight and preserve unrelated changes.
- [x] 1.2 Add the five-theme rule registry and pure calendar core described in design; verify fixed windows, Western/Orthodox annual Easter offsets, merging/disjoint windows and explicit priority (`holiday-calendar`: periods, Easter, conflict resolution).
- [x] 1.3 Replace days-1–28 verification with real daily traversal; add inclusive boundaries ±1, leap/year-wrap, reordered priorities, duplicate/equal-priority rejection and current/upcoming range tests. Include independent Easter fixtures for coincidence, separation and year 2100.
- [x] 1.4 Embed the same self-contained core into the existing pre-hydration boot script; verify emitted ES5 payload in an isolated execution environment, daily boot/runtime parity 2000–2099 and selected 2100 dates, every manual preference/auto/off/invalid and storage read errors (`holiday-calendar`: first-frame consistency).

## 2. Automatic lifecycle and calendar status

- [x] 2.1 Update web-only date lifecycle to one next-local-midnight timeout, focus/visibility/pageshow catch-up and complete cleanup; preserve manual/off, independent light/dark mode and native boundaries.
- [x] 2.2 Add fake-clock provider tests for visible start/end midnight, restoration after sleeping, 23h/25h local days, no hydration flash and no native timer; run focused provider/calendar/boot tests after this block.
- [x] 2.3 Expose current/next resolved period through the existing theme state so menus/settings share it; test year-crossing and separated Easter status (`holiday-appearance`: automatic status).

## 3. Visuals and localized controls

- [x] 3.1 Implement spring/Easter/autumn light/dark token palettes and static canopy/edge/logo motifs through existing CSS channels; enrich Halloween/Christmas detail per design without changing header/wordmark/bird geometry.
- [x] 3.2 Extend existing menu/settings options to seven choices with typed Feather icons, accessible radio labels and compact automatic period status; use locale date formatting and wrap long labels without clipping controls.
- [x] 3.3 Add all new labels/descriptions/status strings in RU/BE/UK/PL/EN and verify fallback; update options/CSS tests for full registry, static bounded layers, print and pointer-events.
- [x] 3.4 Update docs/features/seasonal-theme.md with new periods, priorities, yearly Easter rules, lifecycle and saved-preference behavior.

## 4. Code-level validation and independent review

- [x] 4.1 Run targeted registry/core/boot/provider/CSS/options/Logo Jest suites, scoped ESLint, TypeScript noEmit, web-style guard, npm run test:i18n and diff checks; fix confirmed failures.
- [x] 4.2 Obtain mandatory independent metravel-code-reviewer/review-auditor review-and-fix for the complete task diff, rerun affected code checks and then obtain code-review-gate pass. No browser/runtime QA during review.

## 5. Testing after review

- [x] 5.1 Enter testing only after code-review pass and use the production target from the existing authorized AGENTS release pipeline, with verified task build SHA and operation gate; planning does not execute that pipeline.
- [x] 5.2 Collect fresh guest and authenticated desktop/mobile browser evidence at 1440/1280/1279/767/390: five themes light/dark, all seven choices, automatic status, manual/off/auto, persistence, keyboard/focus, logo/header clickability and no horizontal overflow. Save screenshots and empty console/page-error evidence.
- [x] 5.3 Verify RU/BE/UK/PL/EN menu/status/settings on desktop and mobile, long PL/EN labels and date ranges, current/next periods and separated Easter windows.
- [x] 5.4 Use controlled browser clock scenarios to prove automatic first-frame and visible-midnight switching at inclusive boundaries, focus/visibility/pageshow catch-up, independent color scheme and preserved off/manual choices.
- [x] 5.5 Verify print/reduced-motion, contrast, unchanged header/bird geometry, unobstructed travel/map reading and zero additional decorative/calendar network requests; return any confirmed regression to implementation and review.

## 6. Completion

- [x] 6.1 Record actual commands, reviewed source SHA, browser/clock screenshots and results, owned paths and remaining limitations. Claim production completion only with the matching live build and acceptance evidence.
- [x] 6.2 Run strict change validation and openspec validate --all, distinguish unrelated change failures, and synchronize/archive this change only after implementation and acceptance satisfy all required tasks.

## Acceptance evidence — 2026-10-11

- Reviewed source: calendar/holiday `24a0d3dd7`, base artwork `5f38dbdc6`, shared radio correction `c1214567a`. Independent review-and-fix and final source gate passed; the radio correction has 3 suites / 12 tests, scoped ESLint and TypeScript passing.
- First canonical task release `5f38dbdc6` completed in 230 seconds with health, static/media/SEO and closure checks passing. Its five-season light/dark matrix passed 60 checks across 1440/1280/1279/767/390; 20 screenshots were saved; representative screenshots were inspected alongside base screenshots.
- Final integrated production build is `89e62e6296821e75deeab74a8cb4b9532ed3bbc9`, containing `c1214567a`. `.build-source.json` and `/health` returned 200. All 44 task-owned paths are byte-identical to reviewed source. The existing pipeline owner confirmed successful completion; a duplicate deployment was avoided.
- Under `run-with-quality-gate-lock.js holiday-base-browser-final`, production Playwright acceptance passed: base appearance (12 cases), pre-hydration first frame (10), local-midnight/resume/separated-Easter clock (7), five-language desktop/mobile menus (14), authenticated five-language settings (10), menu/settings breakpoints 1280/1279/767 (12), base/Halloween article and actual Leaflet map reading (12). All checked console/page-error collections were empty; decorative/calendar request collections were empty. Print, reduced motion, focus, Space, persistence, geometry and seasonal isolation passed.
- Browser helpers and screenshots are ignored evidence under `.codex-temp/base-theme/` and `.codex-temp/holiday-expansion/`. Result files: `integrated-release-receipt.json`, `final-guest-result.json`, `final-settings-reading-pass.json`, `final-breakpoints-pass.json`, `final-stable-reading-pass.json`. Initial harness failures (unsupported VM file import, duplicate SSG/React locator, mobile routes without a brand menu, focus timing) were diagnosed and corrected; final acceptance is based on subsequent passing runs, not the failed runs.
- Limits: unrelated full-Jest failures and existing bundle-budget excesses (#2389) were preserved and were not reported as passing. Android/iOS runtime, backend changes and content/media editing are outside this web-theme scope. The automatic autumn period is active on 11 October; seasonal Off exposes the base artistic theme.

- Strict validation: the task change passed; all five main specs passed. `openspec validate --all --strict` returned 41 passing items and one pre-existing unrelated failure (`persist-planned-trip-original-route-file`: no delta specs and no skip_specs marker). Both new capabilities were synchronized with all requirements and scenarios preserved, then this completed change was archived; the unrelated change was not edited.
