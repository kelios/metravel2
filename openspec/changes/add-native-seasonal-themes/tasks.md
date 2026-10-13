## 1. Apply preflight and design confirmation

- [x] 1.1 Preserve the owner implementation authorization; verify main, task-owned clean paths and coordinate with sessions owning shared files.
- [x] 1.2 Confirm requirements/UX with profile/native experts and architecture review: seven choices, reused menus, bounded motifs, storage hydration and native/web palette parity. Record acceptance/ownership evidence before code changes.
- [x] 1.3 Inspect existing startup readiness and static themed-color consumers; finalize readiness integration and narrowly scoped consumer repairs from design evidence.

## 2. Native seasonal palette

- [x] 2.1 Add typed light/dark palettes for all five seasons and extend the design-system resolver without changing existing web CSS variable behavior or no-season callers.
- [x] 2.2 Connect active season to useThemedColors; derive alpha variants, aliases and gradients; preserve semantic status colors.
- [x] 2.3 Add regression tests for complete palette coverage, CSS/native parity, derived colors, contrast and representative themed consumers; run targeted tests.

## 3. Preference and calendar lifecycle

- [x] 3.1 Preserve current storage keys and handle slow/error reads, early user selection and unmount without overwriting newer preferences; integrate native readiness before exposing the themed shell.
- [x] 3.2 Share civil-midnight refresh; use native foreground lifecycle, suspend timers in background and clean up all owned subscriptions/timers while retaining web listeners.
- [x] 3.3 Test Android/iOS auto/off/manual restore, failed reads/writes, late restore, independent light/dark/system preference, foreground/time-zone/DST/midnight transitions and cleanup.

## 4. Native controls and decoration

- [x] 4.1 Enable existing seasonal settings/menu controls and status on Android/iOS with all seven localized radio choices and guest/authenticated access parity.
- [x] 4.2 Add static native motifs inside the existing header brand row, with no pointer/accessibility interception or changes to header/safe-area geometry; keep web CSS ownership intact.
- [x] 4.3 Test native radio selection/status and decor isolation; update seasonal/base theme feature docs and run test:i18n for RU/BE/UK/PL/EN.

## 5. Code review

- [x] 5.1 Run targeted Jest suites, scoped lint/type checks, themed-color/style guards and existing web theme/boot regressions; no runtime QA in review.
- [x] 5.2 Run independent metravel-code-reviewer review-and-fix over the full task diff, followed by code-review-gate; repair findings and repeat affected checks.

## 6. Testing after review

- [ ] 6.1 Enter testing through the applicable project handoff gate; before backend-dependent QA synchronize/start the local backend and pass operation gates for builds/browser/device runs.
- [ ] 6.2 Verify desktop web 1440px and mobile web 390px: seven choices, light/dark, first frame, menu/settings, keyboard/touch, print, screenshots and console; inspect adjacent article/map chrome.
- [ ] 6.3 Verify on USB Android using a local build/install: guest/authenticated theme controls, all five themes in light/dark, off/auto, restart persistence, foreground refresh, screenshots/logcat and tap/contrast checks.
- [ ] 6.4 Verify iPhone simulator: same selection/persistence/foreground cases, safe areas and no runtime errors; inspect iPad portrait/landscape/resizable-window geometry.
- [ ] 6.5 Verify localized labels/date status RU/BE/UK/PL/EN in native settings/menu, longest labels at narrow width and no-network selection. Record exact tested candidate and unresolved gates; do not equate source fixes with an updated store app.

## 7. Specification handoff

- [ ] 7.1 Reconcile evidence with each scenario and document failures or precise access/device unblock requests; leave unverified tasks unchecked.
- [ ] 7.2 Run strict change validation and openspec validate --all before a separately requested archive. Store build/upload/submit/release requires the respective explicit authorization and operator workflow.
