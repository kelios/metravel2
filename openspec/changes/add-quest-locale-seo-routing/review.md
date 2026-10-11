# E #2366 source and release evidence

Owner authorized E implementation in the separate frontend checkout on
2026-10-11. Root is the sole writer on `main`; the backend handoff is
`87be5c600a5e8a58b5c932cf4f23220d754f580d`. Initial frontend base is
`eb1bf5c154fd1270cc59b5fbf168b637159802b7`.
Before handoff, `main` fast-forwarded to
`35886e1ea65af8f17b752c3aef5a9821c211baff`; its two independent content/docs
commits do not overlap the 23 task-owned paths. Own changes were preserved.
A final fetch advanced remote main through three further independent
content/docs/PDF commits to `3c645bda4`; the exclusive E commit was rebased
without conflicts or overlap. Full lint, the relevant ten suites, i18n and
typecheck passed again on that integrated source.

## Code Review and Repair

Independent review-auditor read the complete task diff, callers, new helpers,
tests and runbook. Confirmed repairs: physical macOS TMPDIR; critical legacy
mutation and flock in the same process with directory identity CAS; complete
sealed-generation inventory and explicit owner budget; unreadable-tree and
archive-parent bounds; exact HTTP 200 and one readiness deadline. Removed dead
legacy variables. Source re-review has no remaining P1/P2 findings.

The distinct gate identified the managed branch's omission of the existing
shared quest fallback publication. It now uses the app-owned operation lock,
active identity/CAS, no-link checks and atomic copy from the sealed tree;
rollback/recovery also republish it, with a public readiness control. Regression
coverage executes the actual preflight shell locally and real filesystem/flock
cover publication without SSH or production.

The distinct code-review gate checked correctness, duplication, efficiency and
project contracts and re-read the complete repaired diff and evidence: source
verdict `pass`, no findings. Its recorded verdict and pushed task SHA belong
on #2366 before `testing`.
Static evidence never certifies deployed identity, live eligibility/cache
behavior, UI or performance.

## Validation

- Pinned official Node 22.13.1; frozen dependency install completed without a
  tracked lockfile change.
- Full `npm run lint` passed twice, including its guards and ESLint; the second
  run follows the current-main synchronization and shared-cover repair.
- Scoped syntax/AST, changed-file ESLint, root-artifact/complexity guards,
  `git diff --check` and strict OpenSpec validation passed.
- Initial relevant ten-suite run: 159 passed, one structural fixture failed;
  fixture repaired. Focused overlay/operation recheck: 46 passed, zero failed.
- Final relevant `npm run test:run -- --runTestsByPath` across operation,
  remote-stdin, recovery, overlay, lifecycle, package, static verifier,
  deploy entrypoint, public files and disk guard: 10 suites / 219 tests passed.
  After the final cover-deadline adjustment, the operation suite passed again:
  29 tests. Scoped ESLint and syntax checks passed on the final code.
- `npm run test:i18n`: 26 suites / 445 tests passed.
- After the final main rebase, full lint and typecheck passed again; all ten
  relevant suites passed with 220 tests, including the final cover deadline
  regression, and i18n remained 26 suites / 445 tests passed. An initial rerun
  used three nonexistent selector paths; that command's 128 passing tests and
  selector errors are preserved separately, not claimed as the complete gate.
- Gated `npm run typecheck` passed; repeated after the last test change, also
  passed. Reviewer `audit:prompts`, root-artifact and changed-complexity guards
  passed. Complexity reports zero app TS/TSX files scanned: E changes scripts,
  tests and docs, so this is not evidence of a production-code complexity scan.
- Full `npm run test:run`: **6 failed / 1734 passed suites**, 81 failed /
  19234 passed tests. This run is not claimed green. It completed before the
  final cover/deadline repair; the relevant checks above cover those changes.
  The fresh checkout initially lacked ignored pinned PDF fonts; standard setup
  completed with 138 checksum-verified faces and no tracked changes.

The six failing paths were replayed from a clean `main` baseline clone at exact
`eb1bf5c154fd1270cc59b5fbf168b637159802b7`, with the same dependencies and
verified fonts: **5 failed / 1 passed suites**, 11 failed / 153 passed tests.
`bookRendererWorker.test.ts` now passes. The unchanged failures are:

- `android-release-safety.test.ts`, `android-config.test.ts` and
  `native-compat-governance.test.ts`: six assertions require ignored generated
  Android Gradle/manifest files absent in a fresh clone. E has no native scope;
  no native generation/build/store operation was substituted for acceptance.
- `bookGolden.test.ts` and `bookGolden.native.test.ts`: five complete-book
  fixtures differ after the earlier pastel final-page source change
  `a98621ecf`. This source/fixture area is owned by active #2368. E does not
  overwrite another task's product changes or regenerate its golden fixtures.

Exact baseline reproduction command:

```bash
npm run test:run -- --runTestsByPath \
  __tests__/services/pdf-export/bookRendererWorker.test.ts \
  __tests__/scripts/android-release-safety.test.ts \
  __tests__/config/android-config.test.ts \
  __tests__/config/native-compat-governance.test.ts \
  __tests__/services/pdf-export/bookGolden.test.ts \
  __tests__/services/pdf-export/bookGolden.native.test.ts
```

Output is in `/tmp/metravel-2366-baseline-tests.log`.
The baseline stays tracked-clean. These failures remain visible release risks:
obtain the native setup result and reviewed #2368 source/fixtures, synchronize
the intended release and rerun the affected checks before production release.
No tests, snapshots or native rules were weakened or skipped.

Raw local logs are `/tmp/metravel-2366-*.log`; these are machine-local evidence,
not portable production receipts.

## Residual release gate

No production build, legacy conversion, activation, Nginx/config release,
exposure or production acceptance has been claimed. D maintenance
requires its Ops/owner authority. New checkout also needs the existing private
production build/deploy environment; secrets must stay in ignored local files.

After source gates and push: prepare the complete RU v1 baseline through the
normal pipeline, record actual backend/frontend revisions, mounts, candidate
identity/inventory/headroom and retained legacy backup, then perform owner
conversion and a second translated generation with valid RU rollback. D owns
configuration/exposure. Verify all effective prefixed sitemap entries and
no-JS statuses/head/body/locale, RU canonical/aliases and unrelated routes,
desktop/mobile screenshots/console/network, controlled test-content
withdraw/change/republish/source drift, warm validators, pinned readers and
rollback without resurrection. Capture matched TTFB/LCP/CLS and build
duration/requests/bytes. No Done, spec synchronization or archival until these
production gates pass.
