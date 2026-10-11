## 1. Freeze source and establish checks

- [x] 1.1 Freeze task-owned baseline, all registered theme palettes and representative final content; identify legacy and pinned final-renderer consumers and separate #2407 evidence.
- [x] 1.2 Add failing near-white/synthetic cover contrast regression plus all20themes × all5locale existing-label checks and final summary/empty/pinned-year conservation checks.

Evidence: regression coverage is added and the current implementation passes it. The attempted pre-fix baseline runner was SKIPPED by a foreign quality gate; this is not an observed old-code failure or a validation PASS.

## 2. Correct postcard painting

- [x] 2.1 Implement final semantic primary/secondary/art ink independent of cover colors; verify minimum4.5:1 contrast against the fixed pastel background palette.
- [x] 2.2 Replace legacy screen glow/rule with opaque pale decoration behind content; retain current artwork and #2275 gradient-alpha-free print invariant.
- [x] 2.3 Amend exact obsolete gradient assertions and intentional final golden portions only; preserve final geometry, quote escaping and one-page footer contract.

## 3. Code review and regression checks

- [x] 3.1 Run coordinated targeted final gradient/contrast, generator, web/native golden and worker final-renderer tests, scoped lint and typecheck; diagnose every unrelated golden difference without blanket regeneration.
- [ ] 3.2 Complete independent review-auditor review-and-fix over the whole owned diff, then separate code-review-gate and required repeated code-level checks.

Evidence: all 27 urgent suites passed in the full Jest run; the final source-driven golden refresh was followed by a normal four-suite run (183 tests, no skips), owned ESLint and diff whitespace checks, all PASS. Typecheck, image/i18n/prompt guards and all three urgent strict OpenSpec validations passed. Golden prefix/suffix bytes are identical; only each final section changes (+1289 bytes). The full repository run remains non-green for six older map suites and one older quest-route assertion after the sandbox-fixture rerun; `openspec validate --all` also retains one unrelated change failure. Independent review-and-fix is complete; item 3.2 stays open for the separate gate. Physical pagination and production acceptance remain unchecked.

## 4. Acceptance in testing

- [ ] 4.1 Use the existing authorized task pipeline for owned-path commit/push and production deploy; record exact reviewed and served revision before runtime acceptance.
- [ ] 4.2 Export affected article672 normally on desktop and mobile web; retain actual final preview and printed PDF evidence showing readable heading/statistics/quote/stamp and no clipping.
- [ ] 4.3 Verify all100theme/locale final geometry cases; print representative minimal/dark/illustrated and longest localized content with one physical final page, and verify WebKit gradient-paint compatibility with explicit evidence limitations.
- [ ] 4.4 Record acceptance results and residual risks, update scoped docs/board evidence through the owning session, and run final OpenSpec strict validation before completion/archive.
